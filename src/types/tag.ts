import type { ImageFieldValue } from '@/components/ImageUploader'
import type { ConsoleMenuTag } from './index'
import type { AssetId } from '@/types/upload'

export interface TagFormInput {
  name: string
  slug: string
  description: string
  icon: string
  image: ImageFieldValue
  color: string
  is_active: boolean
  display_order: string
}

export interface TagWriteRequest {
  name?: string
  slug?: string
  description?: string
  icon?: string
  color?: string
  is_active?: boolean
  display_order?: number
  image_asset_id?: AssetId | null
}

export function tagFormToWriteRequest(form: TagFormInput): TagWriteRequest {
  const request: TagWriteRequest = {
    name: form.name.trim(),
    slug: form.slug.trim() || undefined,
    description: form.description.trim() || undefined,
    icon: form.icon.trim() || undefined,
    color: form.color.trim() || undefined,
    is_active: form.is_active,
    display_order: form.display_order ? parseInt(form.display_order, 10) : undefined,
  }

  if (!form.image.file && form.image.cleared) {
    request.image_asset_id = null
  }

  return request
}

export function tagToFormInput(tag: ConsoleMenuTag): TagFormInput {
  return {
    name: tag.name,
    slug: tag.slug,
    description: tag.description ?? '',
    icon: tag.icon ?? '',
    image: {
      file: null,
      existingUrl: tag.image ?? '',
      cleared: false,
    },
    color: tag.color ?? '#f97316',
    is_active: tag.is_active,
    display_order: String(tag.display_order),
  }
}
