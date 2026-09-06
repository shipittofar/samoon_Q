'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp, ImagePlus, Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils'
import { isUnoptimizedMediaUrl } from '@/utils/media-url'
import { createHeroBackgroundId } from '@/lib/hero-background'
import type { HeroBackgroundImage, HeroObjectPosition } from '@/types/website-builder'

const ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'
const MAX_BYTES = 5 * 1024 * 1024
const POSITIONS: HeroObjectPosition[] = ['center', 'top', 'bottom', 'left', 'right']

export interface HeroBackgroundGalleryProps {
  images: HeroBackgroundImage[]
  onChange: (images: HeroBackgroundImage[]) => void
  onUpload: (file: File) => Promise<string>
  intervalMs: number
  transitionMs: number
  onIntervalChange: (ms: number) => void
  onTransitionChange: (ms: number) => void
}

function reindex(images: HeroBackgroundImage[]): HeroBackgroundImage[] {
  return images.map((img, order) => ({ ...img, order }))
}

export function HeroBackgroundGallery({
  images,
  onChange,
  onUpload,
  intervalMs,
  transitionMs,
  onIntervalChange,
  onTransitionChange,
}: HeroBackgroundGalleryProps) {
  const t = useTranslations('console')
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urlValue, setUrlValue] = useState('')

  const sorted = [...images].sort((a, b) => a.order - b.order)
  const showSlideshowSettings = sorted.filter((img) => img.enabled !== false).length >= 2

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    setError(null)
    setBusy(true)
    const next = [...sorted]
    try {
      for (const file of Array.from(fileList)) {
        const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
        const okType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
        const okExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)
        if (!okType || !okExt) {
          setError(t('heroBackgroundUnsupportedType'))
          continue
        }
        if (file.size > MAX_BYTES) {
          setError(t('heroBackgroundTooLarge'))
          continue
        }
        const url = await onUpload(file)
        next.push({
          id: createHeroBackgroundId(),
          src: url,
          order: next.length,
          enabled: true,
          objectPosition: 'center',
          altText: '',
        })
      }
      onChange(reindex(next))
    } catch {
      setError(t('heroBackgroundUploadFailed'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const addFromUrl = () => {
    const src = urlValue.trim()
    if (!src) return
    if (!/^https?:\/\//i.test(src) && !src.startsWith('/') && !src.startsWith('data:')) {
      setError(t('heroBackgroundInvalidUrl'))
      return
    }
    setError(null)
    onChange(reindex([
      ...sorted,
      {
        id: createHeroBackgroundId(),
        src,
        order: sorted.length,
        enabled: true,
        objectPosition: 'center',
        altText: '',
      },
    ]))
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
          accept={ACCEPT}
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

      {sorted.length === 0 ? (
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
