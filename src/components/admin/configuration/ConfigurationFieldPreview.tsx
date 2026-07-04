/**
 * ConfigurationFieldPreview — P9.1.3 Phase I (Preview)
 *
 * Renders `field.preview.kind` — never a per-field switch written by hand.
 * Fields without a preview (`kind: 'none'`, the default) render nothing;
 * this matches the phase brief exactly ("Authentication fields without
 * preview simply render normally").
 */
import type { ConfigFieldDefinition } from '@/config'

export function ConfigurationFieldPreview({ field, value }: { field: ConfigFieldDefinition; value: unknown }) {
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
        The quick brown fox jumps — {String(value ?? '')}
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

  return null
}
