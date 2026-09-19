'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { QrCodeDisplay } from '@/components/qr/QrCodeDisplay'

interface CopyUrlWidgetProps {
  url: string
  label?: string
  /** Backend `qr.url` to encode. Never the public slug URL above. */
  qrUrl?: string | null
  qrTitle?: string
  qrDescription?: string
}

/** Public URL display with copy and open actions. Used in admin settings and tenant homepage. */
export function CopyUrlWidget({ url, label, qrUrl, qrTitle, qrDescription }: CopyUrlWidgetProps) {
  const t = useTranslations('marketplace')
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card-hover)] p-4">
      <p className="text-sm font-medium text-[var(--fg-secondary)] mb-2">{label ?? t('publicUrl')}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-[var(--card)] border rounded px-2.5 py-1.5 text-[var(--fg-secondary)] truncate font-mono">
          {url}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={t('copyUrlAria')}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded hover:bg-[var(--card-hover)] transition-colors"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-[var(--success-text)]"/>
          ) : (
            <Copy className="w-3.5 h-3.5"/>
          )}
          {copied ? t('copied') : t('copy')}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('openPublicUrlAria')}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded hover:bg-[var(--card-hover)] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5"/>
          {t('open')}
        </a>
      </div>
      {qrUrl !== undefined ? (
        <QrCodeDisplay url={qrUrl} title={qrTitle} description={qrDescription} />
      ) : null}
    </div>
  )
}
