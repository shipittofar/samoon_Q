import { appendImageField } from '@/lib/multipart'
import type { ImageFieldValue } from '@/components/ImageUploader'

/** Multipart identity-image write for PATCH /tenants/{id}/. Settings.theme is not used. */
export interface TenantMediaWriteRequest {
  image?: File
  discoverAvatar?: File
  discoverCover?: File
  heroImage?: File
  removeImage?: boolean
  removeDiscoverAvatar?: boolean
  removeDiscoverCover?: boolean
  removeHeroImage?: boolean
}

export function buildTenantMediaFormData(payload: TenantMediaWriteRequest): FormData {
  const form = new FormData()
  appendImageField(form, 'image', payload.image, payload.removeImage)
  appendImageField(form, 'discoverAvatar', payload.discoverAvatar, payload.removeDiscoverAvatar)
  appendImageField(form, 'discoverCover', payload.discoverCover, payload.removeDiscoverCover)
  appendImageField(form, 'heroImage', payload.heroImage, payload.removeHeroImage)
  return form
}

export function imageFieldToMediaPatch(
  field: ImageFieldValue,
  fileKey: 'image' | 'discoverAvatar' | 'discoverCover' | 'heroImage',
  removeKey: 'removeImage' | 'removeDiscoverAvatar' | 'removeDiscoverCover' | 'removeHeroImage',
): Partial<TenantMediaWriteRequest> {
  if (field.file) return { [fileKey]: field.file }
  if (field.cleared) return { [removeKey]: true }
  return {}
}
