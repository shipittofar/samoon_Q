/** Value held in menu-item (and other) forms before upload. */
export interface ImageFieldValue {
  /** Newly selected file pending upload on submit. */
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
  /** i18n-backed hint shown below the control when idle. */
  hint?: string
  uploadLabel?: string
  changeLabel?: string
  removeLabel?: string
  previewLabel?: string
  className?: string
}
