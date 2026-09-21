import type { ImageFieldValue } from '@/components/ImageUploader'
import { isTransientMediaUrl, type AssetId, type UploadPurpose } from '@/types/upload'
import { uploadService } from '@/services/upload.service'
import { DEFAULT_UPLOAD_CONCURRENCY, runWithConcurrency } from '@/lib/upload-concurrency'

export type AssetWriteValue = AssetId | null | undefined

/** omitted = unchanged, null = remove, uuid = replace */
export function imageFieldToAssetWrite(
  field: ImageFieldValue,
  uploadedAssetId?: AssetId,
): AssetWriteValue {
  if (uploadedAssetId) return uploadedAssetId
  if (field.cleared) return null
  return undefined
}

export function assignAssetWrite<T extends Record<string, unknown>>(
  payload: T,
  key: string,
  value: AssetWriteValue,
): T {
  if (value === undefined) return payload
  ;(payload as Record<string, unknown>)[key] = value
  return payload
}

export async function withUploadedImage<T extends { image_asset_id?: AssetWriteValue }>(
  payload: T,
  field: ImageFieldValue,
  purpose: UploadPurpose,
  options?: { signal?: AbortSignal; entityType?: string; entityId?: string },
): Promise<T> {
  const value = await uploadImageField(field, purpose, options)
  if (value !== undefined) payload.image_asset_id = value
  return payload
}

export async function uploadImageField(
  field: ImageFieldValue,
  purpose: UploadPurpose,
  options?: { signal?: AbortSignal; entityType?: string; entityId?: string },
): Promise<AssetWriteValue> {
  if (field.file) {
    const result = await uploadService.uploadFile({
      file: field.file,
      purpose,
      signal: options?.signal,
      entityType: options?.entityType,
      entityId: options?.entityId,
    })
    return result.assetId
  }
  if (field.cleared) return null
  return undefined
}

export async function uploadImageFields(
  slots: Array<{ key: string; field: ImageFieldValue; purpose: UploadPurpose }>,
  options?: { signal?: AbortSignal; entityType?: string; entityId?: string },
): Promise<Record<string, AssetWriteValue>> {
  const results: Record<string, AssetWriteValue> = {}
  const pending = slots.filter((slot) => slot.field.file)
  const concurrent = await runWithConcurrency(
    pending.map((slot) => ({
      id: slot.key,
      run: async (signal) =>
        uploadService.uploadFile({
          file: slot.field.file!,
          purpose: slot.purpose,
          signal: compose(options?.signal, signal),
          entityType: options?.entityType,
          entityId: options?.entityId,
        }),
    })),
    { limit: DEFAULT_UPLOAD_CONCURRENCY, signal: options?.signal },
  )

  for (const result of concurrent) {
    if (result.status !== 'fulfilled' || !result.value) {
      throw result.error ?? new Error('upload_failed')
    }
    results[result.id] = result.value.assetId
  }

  for (const slot of slots) {
    if (results[slot.key] !== undefined) continue
    if (slot.field.cleared) results[slot.key] = null
  }

  return results
}

export function persistableMediaUrl(url: string | null | undefined): string | undefined {
  if (!url || isTransientMediaUrl(url)) return undefined
  return url
}

function compose(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a) return b
  if (!b) return a
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (a.aborted || b.aborted) {
    controller.abort()
    return controller.signal
  }
  a.addEventListener('abort', abort, { once: true })
  b.addEventListener('abort', abort, { once: true })
  return controller.signal
}
