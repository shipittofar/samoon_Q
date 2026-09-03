'use client'

/**
 * MissingTranslationInspector — P9.5.4 Phase H
 *
 * Development-only floating panel surfacing `getMissingTranslationLog()`
 * (the same event log `src/i18n/runtime.ts` has recorded since P9.5.0/
 * P9.5.1B for missing keys/namespaces/invalid locales) so a developer can
 * see every unresolved translation without grepping console output.
 * Renders nothing in production — the underlying fallback chain
 * (`request.ts`/` ClientIntlProvider`'s ` getMessageFallback`) already never
 * throws, so this component only adds visibility, never behavior.
 */
import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { getMissingTranslationLog, type MissingTranslationEvent } from '@/i18n/runtime'

const POLL_MS = 1500

export function MissingTranslationInspector() {
  const [events, setEvents] = useState<readonly MissingTranslationEvent[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const id = setInterval(() => {
      setEvents((prev) => {
        const next = getMissingTranslationLog()
        return next.length === prev.length ? prev : [...next]
      })
    }, POLL_MS)
    return () => clearInterval(id)
  }, [])

  if (process.env.NODE_ENV === 'production' || events.length === 0) return null

  return (
    <div className="fixed bottom-4 end-4 z-[9999] font-mono text-xs">
      {open ? (
        <div className="w-80 max-h-96 overflow-y-auto rounded-lg border border-[var(--warning)]/50 bg-[var(--card)] p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--warning-text)]">
              <AlertTriangle className="h-3.5 w-3.5"/> Missing Translations ({events.length})
            </span>
            <button type="button"onClick={() => setOpen(false)} aria-label="Close missing translation inspector"className="text-[var(--fg-muted)] hover:text-[var(--fg)]">
              <X className="h-3.5 w-3.5"/>
            </button>
          </div>
          <ul className="space-y-1.5">
            {events.slice(-50).reverse().map((e, i) => (
              <li key={i} className="rounded border border-[var(--border)] p-1.5 text-[var(--fg-muted)]">
                <span className="text-[var(--fg)]">{e.kind}</span>
                {e.namespace && e.key && <span> — {e.namespace}.{e.key}</span>}
                <span> ({e.locale})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${events.length} missing translations — open inspector`}
          className="flex items-center gap-1.5 rounded-full border border-[var(--warning)]/50 bg-[var(--card)] px-3 py-1.5 text-[var(--warning-text)] shadow-lg hover:bg-[var(--card-hover)]"
        >
          <AlertTriangle className="h-3.5 w-3.5"/> {events.length}
        </button>
      )}
    </div>
  )
}
