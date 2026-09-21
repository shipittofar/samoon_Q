import type { UploadPurpose } from '@/types/upload'
import { DirectUploadError, uploadError } from '@/lib/upload-errors'

export interface UploadPolicy {
  allowedMimeTypes: readonly string[]
  allowedExtensions: readonly string[]
  maxBytes: number
  allowSvg: boolean
}

const IMAGE_JPEG_PNG = {
  allowedMimeTypes: ['image/jpeg', 'image/png'] as const,
  allowedExtensions: ['.jpg', '.jpeg', '.png'] as const,
  maxBytes: 5 * 1024 * 1024,
  allowSvg: false,
}

const IMAGE_JPEG_PNG_WEBP = {
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'] as const,
  maxBytes: 5 * 1024 * 1024,
  allowSvg: false,
}

export const UPLOAD_POLICIES: Record<UploadPurpose, UploadPolicy> = {
  menu_item: IMAGE_JPEG_PNG,
  menu_category: IMAGE_JPEG_PNG,
  menu_tag: IMAGE_JPEG_PNG,
  branch_logo: IMAGE_JPEG_PNG,
  branch_cover: IMAGE_JPEG_PNG,
  branch_hero: IMAGE_JPEG_PNG,
  tenant_logo: IMAGE_JPEG_PNG,
  tenant_discover_avatar: IMAGE_JPEG_PNG,
  tenant_discover_cover: IMAGE_JPEG_PNG,
  tenant_hero: IMAGE_JPEG_PNG,
  user_avatar: IMAGE_JPEG_PNG,
  website_media: IMAGE_JPEG_PNG_WEBP,
}

export type UploadValidationErrorKey = 'unsupportedFileType' | 'invalidExtension' | 'fileTooLarge'

export interface UploadValidationResult {
  valid: boolean
  errorKey?: UploadValidationErrorKey
}

export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot === -1) return ''
  return filename.slice(dot).toLowerCase()
}

export function getUploadPolicy(purpose: UploadPurpose): UploadPolicy {
  return UPLOAD_POLICIES[purpose]
}

export function acceptAttributeForPurpose(purpose: UploadPurpose): string {
  const policy = getUploadPolicy(purpose)
  return [...policy.allowedMimeTypes, ...policy.allowedExtensions].join(',')
}

/**
 * Client-side guard only. Browser `file.type` is not authoritative;
 * the backend remains the security boundary.
 */
export function validateUploadFile(file: File, purpose: UploadPurpose): UploadValidationResult {
  const policy = getUploadPolicy(purpose)
  const ext = getExtension(file.name)

  if (!policy.allowSvg && (ext === '.svg' || file.type === 'image/svg+xml')) {
    return { valid: false, errorKey: 'unsupportedFileType' }
  }

  const mimeOk = policy.allowedMimeTypes.includes(file.type)
  const extOk = policy.allowedExtensions.includes(ext)
  if (!mimeOk && !extOk) {
    return { valid: false, errorKey: 'unsupportedFileType' }
  }
  if (!extOk) {
    return { valid: false, errorKey: 'invalidExtension' }
  }
  if (file.size > policy.maxBytes) {
    return { valid: false, errorKey: 'fileTooLarge' }
  }
  return { valid: true }
}

export function assertValidUploadFile(file: File, purpose: UploadPurpose): void {
  const result = validateUploadFile(file, purpose)
  if (result.valid) return
  if (result.errorKey === 'fileTooLarge') {
    throw new DirectUploadError(uploadError('file_too_large', 'uploadErrorFileTooLarge', { retryable: false }))
  }
  if (result.errorKey === 'invalidExtension') {
    throw new DirectUploadError(uploadError('unsupported_type', 'uploadErrorInvalidExtension', { retryable: false }))
  }
  throw new DirectUploadError(uploadError('unsupported_type', 'uploadErrorUnsupportedType', { retryable: false }))
}
