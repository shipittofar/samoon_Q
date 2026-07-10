/**
 * ConfigurationFieldPreview — P9.1.3 Phase I (Preview)
 *
 * Renders `field.preview.kind` — never a per-field switch written by hand.
 * Fields without a preview (`kind: 'none'`, the default) render nothing;
 * this matches the phase brief exactly ("Authentication fields without
 * preview simply render normally").
 */
import { useTranslations } from 'next-intl'
import type { ConfigFieldDefinition } from '@/config'

export function ConfigurationFieldPreview({ field, value }: { field: ConfigFieldDefinition; value: unknown }) {
  const t = useTranslations('console')
  const kind = field.preview.kind

  if (kind === 'swatch') {
    return (
      <div className="flex items-center gap-2">
        <span className="h-6 w-6 rounded-full border border-[var(--border)] shadow-sm" style={{ backgroundColor: String(value ?? '') }} />
        <span className="font-mono text-xs text-[var(--fg-muted)]">{String(value ?? '')}</span>
      </div>
    )
  }

  if (kind === 'font-sample') {
    return (
      <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" style={{ fontFamily: String(value ?? '') }}>
        {t('fontSamplePreview', { fontFamily: String(value ?? '') })}
      </p>
    )
  }

  if (kind === 'json') {
    return (
      <pre className="max-h-40 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-mono text-[var(--fg-muted)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }

  if (kind === 'image') {
    const src = String(value ?? '')
    if (!src) return null
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary tenant-supplied URL, not a static asset next/image can optimize
    return <img src={src} alt="" className="h-16 w-16 rounded-lg border border-[var(--border)] object-cover" />
  }

  if (kind === 'datetime') {
    const raw = String(value ?? '')
    if (!raw) return null
    const formatted = formatDateTimePreview(raw)
    return (
      <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--fg)]">
        {formatted}
      </p>
    )
  }

  // P9.3 Phase J — 'formatted' is a generic escape hatch: any module supplies
  // its own `field.preview.format(value)` (phone_number number layout, currency
  // display, address templates, …) instead of the framework hardcoding a
  // fixed enum of "kinds of formatting" it would never fully cover.
  if (kind === 'formatted' && field.preview.format) {
    return (
      <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--fg)]">
        {field.preview.format(value)}
      </p>
    )
  }

  return null
}

/** Renders an IANA timezone name as its current local time, or an ISO timestamp as a localized date/time — whichever `value` looks like. */
function formatDateTimePreview(raw: string): string {
  try {
    if (/^[+-]?\d/.test(raw) || raw.includes('T')) {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(raw))
    }
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: raw }).format(new Date())
  } catch {
    return raw
  }
}
