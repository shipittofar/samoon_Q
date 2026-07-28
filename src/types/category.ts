import type { ImageFieldValue } from '@/components/ImageUploader'
import { appendImageField } from '@/lib/multipart'
import type { Category } from './index'

export interface CategoryFormInput {
  name: string
  description: string
  image: ImageFieldValue
  sort_order: string
  is_active: boolean
}

/** Multipart write request — `image` is a File; response `Category.image` is a URL. */
export interface CategoryWriteRequest {
  name?: string
  description?: string
  sort_order?: number
  is_active?: boolean
  image?: File
  removeImage?: boolean
}

export function categoryFormToWriteRequest(form: CategoryFormInput): CategoryWriteRequest {
  const request: CategoryWriteRequest = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    sort_order: form.sort_order ? parseInt(form.sort_order, 10) : undefined,
    is_active: form.is_active,
  }

  if (form.image.file) {
    request.image = form.image.file
  } else if (form.image.cleared) {
    request.removeImage = true
  }

  return request
}

export function buildCategoryFormData(
  payload: CategoryWriteRequest,
  options?: { branchId?: string },
): FormData {
  const form = new FormData()

  if (options?.branchId) {
    form.append('branch_id', options.branchId)
  }

  if (payload.name != null) form.append('name', payload.name)
  if (payload.description != null) form.append('description', payload.description)
  if (payload.sort_order != null) form.append('sort_order', String(payload.sort_order))
  if (payload.is_active != null) form.append('is_active', String(payload.is_active))

  appendImageField(form, 'image', payload.image, payload.removeImage)

  return form
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
