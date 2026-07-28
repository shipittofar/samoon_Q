import type { ImageFieldValue } from '@/components/ImageUploader'
import { appendImageField } from '@/lib/multipart'
import type { Extra } from './index'

export interface ExtraFormInput {
  name: string
  description: string
  image: ImageFieldValue
  price: string
  order: string
  available: boolean
}

/** Multipart write request — `image` is a File; response `Extra.image` is a URL. */
export interface ExtraWriteRequest {
  name?: string
  description?: string
  price?: number
  order?: number
  available?: boolean
  group_id?: string
  image?: File
  removeImage?: boolean
}

export function extraFormToWriteRequest(form: ExtraFormInput): ExtraWriteRequest {
  const request: ExtraWriteRequest = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    price: parseFloat(form.price) || 0,
    order: form.order ? parseInt(form.order, 10) : undefined,
    available: form.available,
  }

  if (form.image.file) {
    request.image = form.image.file
  } else if (form.image.cleared) {
    request.removeImage = true
  }

  return request
}

export function buildExtraFormData(
  payload: ExtraWriteRequest,
  options?: { branchId?: string },
): FormData {
  const form = new FormData()

  if (options?.branchId) {
    form.append('branch_id', options.branchId)
  }

  if (payload.name != null) form.append('name', payload.name)
  if (payload.description != null) form.append('description', payload.description)
  if (payload.price != null) form.append('price', String(payload.price))
  if (payload.order != null) form.append('order', String(payload.order))
  if (payload.available != null) form.append('available', String(payload.available))
  if (payload.group_id != null) form.append('group_id', payload.group_id)

  appendImageField(form, 'image', payload.image, payload.removeImage)

  return form
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
