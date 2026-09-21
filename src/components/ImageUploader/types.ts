import type { UploadPurpose, UploadSession } from '@/types/upload'

/** Value held in forms before / during upload. File stays local — never persisted globally. */
export interface ImageFieldValue {
  /** Newly selected file pending upload on submit (or explicit Upload). */
  file: File | null
  /** Existing CDN URL from the server (edit mode). */
  existingUrl: string
  /** User explicitly removed the existing image. */
  cleared: boolean
}

export const EMPTY_IMAGE_FIELD: ImageFieldValue = {
  file: null,
  existingUrl: '',
  cleared: false,
}

export interface ImageUploaderProps {
  value: ImageFieldValue
  onChange: (value: ImageFieldValue) => void
  label?: string
  error?: string | null
  disabled?: boolean
  id?: string
  hint?: string
  uploadLabel?: string
  changeLabel?: string
  removeLabel?: string
  previewLabel?: string
  className?: string
  purpose?: UploadPurpose
  session?: UploadSession | null
  onRetry?: () => void
  onCancelUpload?: () => void
}
