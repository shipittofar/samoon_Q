import type { ImageFieldValue } from '@/components/ImageUploader'
import { appendImageField } from '@/lib/multipart'
import type { ConsoleMenuTag } from './index'

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

/** Multipart write request — `image` is a File; response `ConsoleMenuTag.image` is a URL. */
export interface TagWriteRequest {
  name?: string
  slug?: string
  description?: string
  icon?: string
  color?: string
  is_active?: boolean
  display_order?: number
  image?: File
  removeImage?: boolean
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

  if (form.image.file) {
    request.image = form.image.file
  } else if (form.image.cleared) {
    request.removeImage = true
  }

  return request
}

export function buildTagFormData(payload: TagWriteRequest): FormData {
  const form = new FormData()

  if (payload.name != null) form.append('name', payload.name)
  if (payload.slug != null) form.append('slug', payload.slug)
  if (payload.description != null) form.append('description', payload.description)
  if (payload.icon != null) form.append('icon', payload.icon)
  if (payload.color != null) form.append('color', payload.color)
  if (payload.is_active != null) form.append('is_active', String(payload.is_active))
  if (payload.display_order != null) form.append('display_order', String(payload.display_order))

  appendImageField(form, 'image', payload.image, payload.removeImage)

  return form
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
