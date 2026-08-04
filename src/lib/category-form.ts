import { EMPTY_IMAGE_FIELD } from '@/components/ImageUploader'
import type { CategoryFormInput } from '@/types'

export const EMPTY_CATEGORY_FORM: CategoryFormInput = {
  name: '',
  description: '',
  image: { ...EMPTY_IMAGE_FIELD },
  sort_order: '',
  is_active: true,
}

/** Empty/whitespace-only name, or a non-numeric/negative sort order. */
export function validateCategoryForm(form: CategoryFormInput): string | null {
  if (!form.name.trim()) return 'nameRequired'
  if (form.sort_order && (!/^\d+$/.test(form.sort_order) || parseInt(form.sort_order, 10) < 1)) return 'invalidSortOrder'
  return null
}
