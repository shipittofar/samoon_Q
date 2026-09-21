import type { ImageFieldValue } from '@/components/ImageUploader'
import type { Extra } from './index'
import type { AssetId } from '@/types/upload'

export interface ExtraFormInput {
  name: string
  description: string
  image: ImageFieldValue
  price: string
  order: string
  available: boolean
}

export interface ExtraWriteRequest {
  name?: string
  description?: string
  price?: number
  order?: number
  available?: boolean
  group_id?: string
  image_asset_id?: AssetId | null
}

export function extraFormToWriteRequest(form: ExtraFormInput): ExtraWriteRequest {
  const request: ExtraWriteRequest = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    price: parseFloat(form.price) || 0,
    order: form.order ? parseInt(form.order, 10) : undefined,
    available: form.available,
  }

  if (!form.image.file && form.image.cleared) {
    request.image_asset_id = null
  }

  return request
}

export function extraToFormInput(extra: Extra): ExtraFormInput {
  return {
    name: extra.name,
    description: extra.description ?? '',
    image: {
      file: null,
      existingUrl: extra.image ?? '',
      cleared: false,
    },
    price: String(extra.price),
    order: extra.order !== undefined ? String(extra.order) : '',
    available: extra.available,
  }
}
