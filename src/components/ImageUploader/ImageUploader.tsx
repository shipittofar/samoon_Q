'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import { Upload, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils'
import { validateMenuImageFile } from './validation'
import type { ImageUploaderProps } from './types'

const ACCEPT = 'image/jpeg,image/png,.jpg,.jpeg,.png'

export function ImageUploader({
  value,
  onChange,
  label,
  error: externalError,
  disabled = false,
  id,
  hint,
  uploadLabel,
  changeLabel,
  removeLabel,
  previewLabel,
  className,
}: ImageUploaderProps) {
  const t = useTranslations('console')
  const generatedId = useId()
  const inputId = id ?? generatedId
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [blobPreview, setBlobPreview] = useState<string | null>(null)

  const displayUrl = value.file
    ? blobPreview
    : value.cleared
      ? null
      : value.existingUrl || null

  useEffect(() => {
    if (!value.file) {
      setBlobPreview(null)
      return
    }
    const url = URL.createObjectURL(value.file)
    setBlobPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value.file])

  const error = externalError ?? localError

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const result = validateMenuImageFile(file)
    if (!result.valid) {
      const message =
        result.errorKey === 'unsupportedFileType'
          ? t('menuImageUnsupportedType')
          : result.errorKey === 'invalidExtension'
            ? t('menuImageInvalidExtension')
            : t('menuImageTooLarge')
      setLocalError(message)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setLocalError(null)
    onChange({ ...value, file, cleared: false })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemove = () => {
    setLocalError(null)
    onChange({ file: null, existingUrl: value.existingUrl, cleared: true })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handlePick = () => {
    if (!disabled) fileInputRef.current?.click()
  }

  const filename = value.file?.name ?? (displayUrl && !value.cleared ? displayUrl.split('/').pop() : null)

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-[var(--fg)]">
          {label}
        </label>
      )}

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={handleFileChange}
        aria-label={uploadLabel ?? t('uploadImage')}
      />

      {!displayUrl ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={handlePick}
          leftIcon={<Upload className="h-3.5 w-3.5"/>}
        >
          {uploadLabel ?? t('uploadImage')}
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--fg-muted)]">{previewLabel ?? t('imagePreview')}</p>
          <div className="relative h-36 w-full max-w-xs overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card-hover)]">
            <Image
              src={displayUrl}
              alt={filename ?? 'preview'}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 320px"
              unoptimized={displayUrl.startsWith('blob:')}
            />
          </div>
          {filename && (
            <p className="text-xs text-[var(--fg-muted)] truncate max-w-xs"title={filename}>
              {filename}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={handlePick}
            >
              {changeLabel ?? t('changeImage')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={handleRemove}
              leftIcon={<X className="h-3.5 w-3.5"/>}
              className="text-[var(--danger-text)] hover:text-[var(--danger-text)] hover:bg-[var(--danger-subtle)]"
            >
              {removeLabel ?? t('removeImage')}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-[var(--danger-text)]"role="alert">
          {error}
        </p>
      )}
      {!displayUrl && !error && (
        <p className="text-xs text-[var(--fg-muted)]">{hint ?? t('menuImageFormatHint')}</p>
      )}
    </div>
  )
}
