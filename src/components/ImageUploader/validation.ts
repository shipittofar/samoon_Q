import { z } from 'zod'
import type { UploadPurpose } from '@/types/upload'
import {
  getUploadPolicy,
  validateUploadFile,
  getExtension,
} from '@/lib/upload-validation'

export const MENU_IMAGE_ALLOWED_MIME_TYPES = getUploadPolicy('menu_item').allowedMimeTypes
export const MENU_IMAGE_ALLOWED_EXTENSIONS = getUploadPolicy('menu_item').allowedExtensions
export const MENU_IMAGE_MAX_SIZE_BYTES = getUploadPolicy('menu_item').maxBytes

export type MenuImageMimeType = (typeof MENU_IMAGE_ALLOWED_MIME_TYPES)[number]

export interface ImageValidationResult {
  valid: boolean
  errorKey?: 'unsupportedFileType' | 'invalidExtension' | 'fileTooLarge'
}

/** Client-side validation for menu item image files (MIME + extension). */
export function validateMenuImageFile(file: File): ImageValidationResult {
  return validateUploadFile(file, 'menu_item')
}

export function validateImageFileForPurpose(file: File, purpose: UploadPurpose): ImageValidationResult {
  return validateUploadFile(file, purpose)
}

/** Zod schema for optional menu item image file input. */
export const menuItemImageFileSchema = z
  .instanceof(File)
  .refine(
    (file) => validateUploadFile(file, 'menu_item').valid,
    (file) => ({ message: validateUploadFile(file, 'menu_item').errorKey ?? 'unsupportedFileType' }),
  )

export const menuItemImageFieldSchema = z.object({
  file: menuItemImageFileSchema.nullable(),
  existingUrl: z.string(),
  cleared: z.boolean(),
})

export { getExtension }
