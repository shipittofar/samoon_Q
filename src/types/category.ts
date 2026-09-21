import type { ImageFieldValue } from '@/components/ImageUploader'
import type { Category } from './index'
import type { AssetId } from '@/types/upload'

export interface CategoryFormInput {
  name: string
  description: string
  image: ImageFieldValue
  sort_order: string
  is_active: boolean
}

export interface CategoryWriteRequest {
  name?: string
  description?: string
  sort_order?: number
  is_active?: boolean
  image_asset_id?: AssetId | null
}

export function categoryFormToWriteRequest(form: CategoryFormInput): CategoryWriteRequest {
  const request: CategoryWriteRequest = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    sort_order: form.sort_order ? parseInt(form.sort_order, 10) : undefined,
    is_active: form.is_active,
  }

  if (!form.image.file && form.image.cleared) {
    request.image_asset_id = null
  }

  return request
}

export function categoryToFormInput(category: Category): CategoryFormInput {
  return {
    name: category.name,
    description: category.description ?? '',
    image: {
      file: null,
      existingUrl: category.image ?? '',
      cleared: false,
    },
    sort_order: String(category.sort_order),
    is_active: category.is_active,
  }
}
