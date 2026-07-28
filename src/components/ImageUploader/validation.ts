import { z } from 'zod'

/** Allowed MIME types for menu item images (JPEG/PNG only). */
export const MENU_IMAGE_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'] as const

/** Allowed file extensions (lowercase, with dot). */
export const MENU_IMAGE_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'] as const

export const MENU_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export type MenuImageMimeType = (typeof MENU_IMAGE_ALLOWED_MIME_TYPES)[number]

export interface ImageValidationResult {
  valid: boolean
  errorKey?: 'unsupportedFileType' | 'invalidExtension' | 'fileTooLarge'
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot === -1) return ''
  return filename.slice(dot).toLowerCase()
}

/** Client-side validation for menu item image files (MIME + extension). */
export function validateMenuImageFile(file: File): ImageValidationResult {
  if (!MENU_IMAGE_ALLOWED_MIME_TYPES.includes(file.type as MenuImageMimeType)) {
    return { valid: false, errorKey: 'unsupportedFileType' }
  }

  const ext = getExtension(file.name)
  if (!MENU_IMAGE_ALLOWED_EXTENSIONS.includes(ext as (typeof MENU_IMAGE_ALLOWED_EXTENSIONS)[number])) {
    return { valid: false, errorKey: 'invalidExtension' }
  }

  if (file.size > MENU_IMAGE_MAX_SIZE_BYTES) {
    return { valid: false, errorKey: 'fileTooLarge' }
  }

  return { valid: true }
}

/** Zod schema for optional menu item image file input. */
export const menuItemImageFileSchema = z
  .instanceof(File)
  .refine(
    (file) => MENU_IMAGE_ALLOWED_MIME_TYPES.includes(file.type as MenuImageMimeType),
    { message: 'unsupportedFileType' },
  )
  .refine(
    (file) =>
      MENU_IMAGE_ALLOWED_EXTENSIONS.includes(
        getExtension(file.name) as (typeof MENU_IMAGE_ALLOWED_EXTENSIONS)[number],
      ),
    { message: 'invalidExtension' },
  )
  .refine((file) => file.size <= MENU_IMAGE_MAX_SIZE_BYTES, { message: 'fileTooLarge' })

export const menuItemImageFieldSchema = z.object({
  file: menuItemImageFileSchema.nullable(),
  existingUrl: z.string(),
  cleared: z.boolean(),
})
