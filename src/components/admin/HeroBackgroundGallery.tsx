'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp, ImagePlus, Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils'
import { isUnoptimizedMediaUrl } from '@/utils/media-url'
import { createHeroBackgroundId } from '@/lib/hero-background'
import { isTransientMediaUrl, type UploadPurpose, type UploadSession } from '@/types/upload'
import { validateUploadFile, acceptAttributeForPurpose } from '@/lib/upload-validation'
import { DirectUploadError, toUploadError } from '@/lib/upload-errors'
import { uploadService } from '@/services/upload.service'
import { DEFAULT_UPLOAD_CONCURRENCY } from '@/lib/upload-concurrency'
import type { HeroBackgroundImage, HeroObjectPosition } from '@/types/website-builder'

const POSITIONS: HeroObjectPosition[] = ['center', 'top', 'bottom', 'left', 'right']

export interface HeroBackgroundGalleryProps {
  images: HeroBackgroundImage[]
  onChange: (images: HeroBackgroundImage[]) => void
  purpose: UploadPurpose
  entityType?: string
  entityId?: string
  intervalMs: number
  transitionMs: number
  onIntervalChange: (ms: number) => void
  onTransitionChange: (ms: number) => void
}

interface PendingSlot {
  id: string
  file: File
  previewUrl: string
  session: UploadSession | null
  errorKey: string | null
  controller: AbortController
}

function reindex(images: HeroBackgroundImage[]): HeroBackgroundImage[] {
  return images.map((img, order) => ({ ...img, order }))
}

export function HeroBackgroundGallery({
  images,
  onChange,
  purpose,
  entityType,
  entityId,
  intervalMs,
  transitionMs,
  onIntervalChange,
  onTransitionChange,
}: HeroBackgroundGalleryProps) {
  const t = useTranslations('console')
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [urlValue, setUrlValue] = useState('')
  const [pending, setPending] = useState<PendingSlot[]>([])
  const pendingRef = useRef(pending)
  pendingRef.current = pending
  const imagesRef = useRef(images)
  imagesRef.current = images

  useEffect(() => {
    return () => {
      for (const slot of pendingRef.current) {
        slot.controller.abort()
        URL.revokeObjectURL(slot.previewUrl)
        if (slot.session?.assetId) void uploadService.cancelUpload(slot.session.assetId)
      }
    }
  }, [])

  const sorted = [...images].sort((a, b) => a.order - b.order)
  const showSlideshowSettings = sorted.filter((img) => img.enabled !== false).length >= 2
  const busy = pending.some((p) => !p.errorKey)

  const updatePending = (id: string, patch: Partial<PendingSlot>) => {
    setPending((prev) => prev.map((slot) => (slot.id === id ? { ...slot, ...patch } : slot)))
  }

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    setError(null)
    const files = Array.from(fileList)
    const slots: PendingSlot[] = []
    for (const file of files) {
      const validation = validateUploadFile(file, purpose)
      if (!validation.valid) {
        setError(
          validation.errorKey === 'fileTooLarge'
            ? t('heroBackgroundTooLarge')
            : t('heroBackgroundUnsupportedType'),
        )
        continue
      }
      slots.push({
        id: createHeroBackgroundId(),
        file,
        previewUrl: URL.createObjectURL(file),
        session: null,
        errorKey: null,
        controller: new AbortController(),
      })
    }
    if (slots.length === 0) {
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setPending((prev) => [...prev, ...slots])

    const queue = [...slots]
    let active = 0
    const runNext = async () => {
      while (queue.length > 0) {
        if (active >= DEFAULT_UPLOAD_CONCURRENCY) return
        const slot = queue.shift()
        if (!slot) return
        active += 1
        void uploadService
          .uploadFile({
            file: slot.file,
            purpose,
            entityType,
            entityId,
            signal: slot.controller.signal,
            onSession: (session) => updatePending(slot.id, { session }),
          })
          .then((asset) => {
            URL.revokeObjectURL(slot.previewUrl)
            setPending((prev) => prev.filter((s) => s.id !== slot.id))
            const current = [...imagesRef.current].sort((a, b) => a.order - b.order)
            onChange(
              reindex([
                ...current,
                {
                  id: slot.id,
                  src: asset.url,
                  assetId: asset.assetId,
                  order: current.length,
                  enabled: true,
                  objectPosition: 'center',
                  altText: '',
                },
              ]),
            )
          })
          .catch((err) => {
            const mapped = err instanceof DirectUploadError ? err.uploadError : toUploadError(err)
            if (mapped.code === 'cancelled') {
              URL.revokeObjectURL(slot.previewUrl)
              setPending((prev) => prev.filter((s) => s.id !== slot.id))
              return
            }
            updatePending(slot.id, { errorKey: mapped.messageKey, session: slot.session })
            setError(t(mapped.messageKey))
          })
          .finally(() => {
            active -= 1
            void runNext()
          })
      }
    }
    await Promise.all(Array.from({ length: DEFAULT_UPLOAD_CONCURRENCY }, () => runNext()))
    if (inputRef.current) inputRef.current.value = ''
  }

  const retrySlot = (slot: PendingSlot) => {
    slot.controller.abort()
    const next: PendingSlot = {
      ...slot,
      errorKey: null,
      controller: new AbortController(),
    }
    setPending((prev) => prev.map((s) => (s.id === slot.id ? next : s)))
    void uploadService
      .retryUpload({
        file: next.file,
        purpose,
        entityType,
        entityId,
        signal: next.controller.signal,
        onSession: (session) => updatePending(next.id, { session }),
      })
      .then((asset) => {
        URL.revokeObjectURL(next.previewUrl)
        setPending((prev) => prev.filter((s) => s.id !== next.id))
        const current = [...imagesRef.current].sort((a, b) => a.order - b.order)
        onChange(
          reindex([
            ...current,
            {
              id: next.id,
              src: asset.url,
              assetId: asset.assetId,
              order: current.length,
              enabled: true,
              objectPosition: 'center',
              altText: '',
            },
          ]),
        )
      })
      .catch((err) => {
        const mapped = toUploadError(err)
        updatePending(next.id, { errorKey: mapped.messageKey })
        setError(t(mapped.messageKey))
      })
  }

  const cancelSlot = (slot: PendingSlot) => {
    slot.controller.abort()
    if (slot.session?.assetId) void uploadService.cancelUpload(slot.session.assetId)
    URL.revokeObjectURL(slot.previewUrl)
    setPending((prev) => prev.filter((s) => s.id !== slot.id))
  }

  const addFromUrl = () => {
    const src = urlValue.trim()
    if (!src) return
    if (isTransientMediaUrl(src)) {
      setError(t('heroBackgroundInvalidUrl'))
      return
    }
    if (!/^https?:\/\//i.test(src) && !src.startsWith('/')) {
      setError(t('heroBackgroundInvalidUrl'))
      return
    }
    setError(null)
    onChange(
      reindex([
        ...sorted,
        {
          id: createHeroBackgroundId(),
          src,
          order: sorted.length,
          enabled: true,
          objectPosition: 'center',
          altText: '',
        },
      ]),
    )
    setUrlValue('')
  }

  const updateAt = (id: string, patch: Partial<HeroBackgroundImage>) => {
    onChange(reindex(sorted.map((img) => (img.id === id ? { ...img, ...patch } : img))))
  }

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= sorted.length) return
    const copy = [...sorted]
    const [item] = copy.splice(index, 1)
    copy.splice(target, 0, item)
    onChange(reindex(copy))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--fg)]">{t('heroBackgroundGalleryTitle')}</p>
          <p className="text-xs text-[var(--fg-muted)] mt-0.5">{t('heroBackgroundGalleryHint')}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          leftIcon={busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
        >
          {t('heroBackgroundUpload')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttributeForPurpose(purpose)}
          multiple
          className="sr-only"
          disabled={busy}
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          placeholder={t('heroBackgroundUrlPlaceholder')}
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--fg)]"
        />
        <Button type="button" variant="secondary" size="sm" onClick={addFromUrl}>
          {t('heroBackgroundAddUrl')}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-[var(--danger-text)]" role="alert">
          {error}
        </p>
      )}

      {pending.map((slot) => (
        <div
          key={slot.id}
          className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-3 flex items-center gap-3"
        >
          <div className="relative h-16 w-20 overflow-hidden rounded-lg border border-[var(--border)]">
            <Image src={slot.previewUrl} alt="" fill className="object-cover" unoptimized sizes="80px" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs truncate">{slot.file.name}</p>
            <p className="text-[10px] text-[var(--fg-muted)]">
              {slot.errorKey
                ? t(slot.errorKey)
                : slot.session?.status === 'PROCESSING'
                  ? t('uploadPhaseProcessing')
                  : t('uploadPhaseUploading', { percent: slot.session?.progress.percent ?? 0 })}
            </p>
            <div className="mt-1 h-1 rounded bg-[var(--border)]">
              <div
                className="h-1 rounded bg-[var(--accent)]"
                style={{ width: `${slot.session?.progress.percent ?? 0}%` }}
              />
            </div>
          </div>
          {slot.errorKey ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => retrySlot(slot)}>
              {t('uploadRetry')}
            </Button>
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={() => cancelSlot(slot)}>
              {t('uploadCancel')}
            </Button>
          )}
        </div>
      ))}

      {sorted.length === 0 && pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--fg-muted)]">
          {t('heroBackgroundEmpty')}
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((img, index) => {
            const unoptimized = isUnoptimizedMediaUrl(img.src)
            return (
              <li
                key={img.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-3 grid grid-cols-[7rem_1fr_auto] gap-3 items-start"
              >
                <div className="relative h-24 w-28 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card-hover)]">
                  <Image
                    src={img.src}
                    alt={img.altText || t('heroBackgroundPreviewAlt')}
                    fill
                    className="object-cover"
                    sizes="112px"
                    unoptimized={unoptimized}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <label className="flex items-center gap-2 text-xs text-[var(--fg)]">
                    <input
                      type="checkbox"
                      checked={img.enabled !== false}
                      onChange={(e) => updateAt(img.id, { enabled: e.target.checked })}
                    />
                    {t('heroBackgroundEnabled')}
                  </label>
                  <input
                    type="text"
                    value={img.altText ?? ''}
                    onChange={(e) => updateAt(img.id, { altText: e.target.value })}
                    placeholder={t('heroBackgroundAltPlaceholder')}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs text-[var(--fg)]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">
                      {t('heroBackgroundPosition')}
                      <select
                        value={img.objectPosition ?? 'center'}
                        onChange={(e) => updateAt(img.id, { objectPosition: e.target.value as HeroObjectPosition })}
                        className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs text-[var(--fg)]"
                      >
                        {POSITIONS.map((p) => (
                          <option key={p} value={p}>
                            {t(`heroBackgroundPos.${p}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">
                      {t('heroBackgroundPositionMobile')}
                      <select
                        value={img.objectPositionMobile ?? img.objectPosition ?? 'center'}
                        onChange={(e) =>
                          updateAt(img.id, { objectPositionMobile: e.target.value as HeroObjectPosition })
                        }
                        className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs text-[var(--fg)]"
                      >
                        {POSITIONS.map((p) => (
                          <option key={p} value={p}>
                            {t(`heroBackgroundPos.${p}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center text-[var(--fg-muted)] hover:bg-[var(--card-hover)]',
                      index === 0 && 'opacity-40 pointer-events-none',
                    )}
                    onClick={() => move(index, -1)}
                    aria-label={t('heroBackgroundMoveUp')}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'h-8 w-8 rounded-lg flex items-center justify-center text-[var(--fg-muted)] hover:bg-[var(--card-hover)]',
                      index === sorted.length - 1 && 'opacity-40 pointer-events-none',
                    )}
                    onClick={() => move(index, 1)}
                    aria-label={t('heroBackgroundMoveDown')}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--danger-text)] hover:bg-[var(--danger-subtle)]"
                    onClick={() => onChange(reindex(sorted.filter((item) => item.id !== img.id)))}
                    aria-label={t('heroBackgroundRemove')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {showSlideshowSettings && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]">
          <label className="text-xs text-[var(--fg-muted)]">
            {t('heroBackgroundInterval')}
            <input
              type="number"
              min={2000}
              max={30000}
              step={500}
              value={intervalMs}
              onChange={(e) => onIntervalChange(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--fg)]"
            />
          </label>
          <label className="text-xs text-[var(--fg-muted)]">
            {t('heroBackgroundTransition')}
            <input
              type="number"
              min={200}
              max={3000}
              step={50}
              value={transitionMs}
              onChange={(e) => onTransitionChange(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--fg)]"
            />
          </label>
        </div>
      )}
    </div>
  )
}
