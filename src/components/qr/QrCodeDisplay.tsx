'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { encodeQrSvg } from '@/lib/qr-svg'
import { isEncodableQrUrl } from '@/lib/qr-url'
import { cn } from '@/utils'

export interface QrCodeDisplayProps {
  /** Exact backend `qr.url` to encode. Never a constructed slug URL. */
  url?: string | null
  title?: string
  description?: string
  className?: string
  /** Visual inactive treatment; still encodes `url` when valid. */
  inactive?: boolean
}

export function QrCodeDisplay({ url, title, description, className, inactive = false }: QrCodeDisplayProps) {
  const t = useTranslations('marketplace')
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const valid = isEncodableQrUrl(url)

  useEffect(() => {
    if (!valid) {
      setSvg(null)
      setFailed(false)
      return
    }

    let cancelled = false
    setFailed(false)
    encodeQrSvg(url)
      .then((markup) => {
        if (!cancelled) setSvg(markup)
      })
      .catch(() => {
        if (!cancelled) {
          setSvg(null)
          setFailed(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [url, valid])

  function handleDownload() {
    if (!svg || !valid) return
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = 'qr-code.svg'
    a.click()
    URL.revokeObjectURL(href)
  }

  const heading = title === undefined ? t('qrCodeLabel') : title
  const ariaLabel = heading || t('qrCodeLabel')

  if (!valid) {
    return (
      <div className={cn('mt-4', className)} data-testid="qr-code-missing">
        {heading ? <h3 className="text-sm font-medium text-[var(--fg-secondary)] mb-1">{heading}</h3> : null}
        {description ? <p className="text-sm text-[var(--fg-muted)] mb-2">{description}</p> : null}
        <p className="text-sm text-[var(--fg-subtle)]">{t('qrNotAvailable')}</p>
      </div>
    )
  }

  return (
    <div className={cn('mt-4', className)} data-testid="qr-code-display" data-qr-url={url}>
      {heading ? <h3 className="text-sm font-medium text-[var(--fg-secondary)] mb-1">{heading}</h3> : null}
      {description ? <p className="text-sm text-[var(--fg-muted)] mb-3">{description}</p> : null}

      <div className="flex flex-col items-center sm:items-start">
        <div
          className={cn(
            'w-full max-w-[240px] aspect-square bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 relative',
            inactive && 'opacity-60',
          )}
          role="img"
          aria-label={ariaLabel}
        >
          {failed ? (
            <p className="text-sm text-[var(--danger-text)] h-full flex items-center justify-center text-center px-2">
              {t('qrEncodeFailed')}
            </p>
          ) : svg ? (
            <div
              data-testid="qr-code-svg"
              className="h-full w-full [&_svg]:h-full [&_svg]:w-full [&_svg]:block"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <div className="h-full w-full rounded-lg bg-[var(--card-hover)] animate-pulse" aria-hidden="true" />
          )}
        </div>

        {svg && !failed ? (
          <button
            type="button"
            onClick={handleDownload}
            aria-label={t('downloadQrSvgAria')}
            className="mt-3 inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded hover:bg-[var(--card-hover)] transition-colors"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            {t('downloadQrSvg')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
