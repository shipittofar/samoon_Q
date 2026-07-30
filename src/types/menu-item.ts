import type { ImageFieldValue } from '@/components/ImageUploader'
import { appendImageField } from '@/lib/multipart'
import type { MenuItem } from './index'

/**
 * Menu item form input — separate from API response models.
 * `image.file` is the pending upload; `existingUrl` is for preview only.
 */
export interface MenuItemFormInput {
  name: string
  description: string
  price: string
  discount: string
  calories: string
  preparation_time: string
  image: ImageFieldValue
  category_id: string
  available: boolean
  is_active: boolean
  is_featured: boolean
  is_popular: boolean
  extra_group_ids: string[]
}

/**
 * API write request — `image` is a File for multipart upload.
 * Response model `MenuItem.image` remains a CDN URL string.
 */
export interface MenuItemWriteRequest {
  name?: string
  description?: string
  price?: number
  discount?: number
  calories?: number
  preparation_time?: number
  category_id?: string
  available?: boolean
  is_active?: boolean
  is_featured?: boolean
  is_popular?: boolean
  image?: File
  /** When true, clears the image on update (no new file selected). */
  removeImage?: boolean
}

/** Maps form state to a multipart write request. */
export function menuItemFormToWriteRequest(form: MenuItemFormInput): MenuItemWriteRequest {
  const request: MenuItemWriteRequest = {
    name: form.name,
    description: form.description,
    price: parseFloat(form.price) || 0,
    discount: form.discount ? parseFloat(form.discount) : undefined,
    calories: form.calories ? parseInt(form.calories, 10) : undefined,
    preparation_time: parseInt(form.preparation_time, 10) || 15,
    category_id: form.category_id,
    available: form.available,
    is_active: form.is_active,
    is_featured: form.is_featured,
    is_popular: form.is_popular,
  }

  if (form.image.file) {
    request.image = form.image.file
  } else if (form.image.cleared) {
    request.removeImage = true
  }

  return request
}

/** Builds multipart/form-data for menu item create/update endpoints. */
export function buildMenuItemFormData(
  payload: MenuItemWriteRequest,
  options?: { branchId?: string },
): FormData {
  const form = new FormData()

  if (options?.branchId) {
    form.append('branch_id', options.branchId)
  }

  if (payload.name != null) form.append('name', payload.name)
  if (payload.description != null) form.append('description', payload.description)
  if (payload.price != null) form.append('price', String(payload.price))
  if (payload.discount != null) form.append('discount', String(payload.discount))
  if (payload.calories != null) form.append('calories', String(payload.calories))
  if (payload.preparation_time != null) form.append('preparation_time', String(payload.preparation_time))
  if (payload.category_id != null) form.append('category_id', payload.category_id)
  if (payload.available != null) form.append('available', String(payload.available))
  if (payload.is_active != null) form.append('is_active', String(payload.is_active))
  if (payload.is_featured != null) form.append('is_featured', String(payload.is_featured))
  if (payload.is_popular != null) form.append('is_popular', String(payload.is_popular))

  if (payload.image instanceof File) {
    appendImageField(form, 'image', payload.image)
  } else if (payload.removeImage) {
    appendImageField(form, 'image', undefined, true)
  }

  return form
}

/** Maps a server MenuItem into form input for edit modals. */
export function menuItemToFormInput(item: MenuItem): MenuItemFormInput {
  return {
    name: item.name,
    description: item.description,
    price: String(item.price),
    discount: String(item.discount ?? ''),
    calories: String(item.calories ?? ''),
    preparation_time: String(item.preparation_time),
    image: {
      file: null,
      existingUrl: item.image ?? '',
      cleared: false,
    },
    category_id: item.category_id,
    available: item.available,
    is_active: item.is_active,
    is_featured: item.is_featured ?? false,
    is_popular: item.is_popular ?? false,
    extra_group_ids: item.extra_group_ids ?? [],
  }
}
