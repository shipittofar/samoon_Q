'use client'

/**
 * ServiceWorkerUpdateBanner — Phase 4.8 (P4.8.5)
 *
 * Non-blocking banner that appears when a newer service worker is waiting.
 * The user can refresh to apply the update or dismiss the banner.
 * Dismissal keeps the old SW active until the next page load.
 *
 * Accessible: role="alert", aria-live="polite", keyboard-navigable buttons.
 */

import { useState } from 'react'
import { useServiceWorkerUpdate } from '@/lib/service-worker'

export function ServiceWorkerUpdateBanner() {
  const { updateAvailable, applyUpdate } = useServiceWorkerUpdate()
  const [dismissed, setDismissed] = useState(false)

  if (!updateAvailable || dismissed) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-4 start-4 end-4 sm:start-auto sm:end-4 sm:w-auto z-50 flex items-center gap-3 bg-[var(--card)] border border-[var(--border)] rounded-2xl px-4 py-3 shadow-xl"
    >
      <span className="text-lg"aria-hidden="true">🚀</span>
      <p className="text-sm font-medium text-[var(--fg)] flex-1">
        New version available
      </p>
      <button
        onClick={applyUpdate}
        className="text-xs font-semibold text-[var(--accent-text)] hover:text-[var(--accent-text)] transition-colors px-2 py-1 rounded-lg hover:bg-[var(--accent-subtle)]"
        aria-label="Refresh to apply the update"
      >
        Refresh
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors px-2 py-1 rounded-lg hover:bg-[var(--card-hover)]"
        aria-label="Dismiss update notification"
      >
        Dismiss
      </button>
    </div>
  )
}
