'use client'

/**
 * Service Worker registration & update detection — Phase 4.8 (P4.8.4)
 *
 * Provides:
 *   registerServiceWorker() — registers /sw.js; wires update detection
 *   applyServiceWorkerUpdate(onApplied?) — posts SKIP_WAITING; calls onApplied
 *     when the new SW takes control. Defaults to window.location.reload().
 *   useServiceWorkerUpdate() — React hook exposing updateAvailable + applyUpdate
 *
 * Update flow:
 *   1. Browser installs new SW in "installed" state (waiting).
 *   2. We detect this via the "updatefound" + statechange events.
 *   3. `updateAvailable` becomes true → UpdateBanner renders.
 *   4. User clicks "Refresh" → applyUpdate() posts SKIP_WAITING to the SW,
 *      then navigates once the controller changes.
 *
 * No auto-refresh. The user always controls when the update applies.
 */

import React from 'react'

// ── Registration ──────────────────────────────────────────────────────────────

let _registration: ServiceWorkerRegistration | null = null

export function registerServiceWorker(
  onUpdateAvailable?: () => void,
): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  // Never run the caching service worker in `next dev`: it caches dev bundles
  // and keeps serving stale JS after code changes (a fresh dev server and
  // hard reloads included). Also drop a worker left over from a prod build.
  if (process.env.NODE_ENV === 'development') {
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) void reg.unregister()
    })
    return
  }

  navigator.serviceWorker.register('/sw.js').then((registration) => {
    _registration = registration

    const handleUpdateFound = () => {
      const newWorker = registration.installing
      if (!newWorker) return

      newWorker.addEventListener('statechange', () => {
        // Installed + existing controller = update ready (not first install)
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          onUpdateAvailable?.()
        }
      })
    }

    registration.addEventListener('updatefound', handleUpdateFound)

    // Check for an already-waiting SW (e.g. user had the tab open across deploys)
    if (
      registration.waiting &&
      navigator.serviceWorker.controller
    ) {
      onUpdateAvailable?.()
    }
  }).catch((err) => {
    console.error('[SW] Registration failed:', err)
  })
}

/**
 * Signal the waiting SW to take control. Once the controllerchange event fires,
 * calls onApplied (default: window.location.reload()) to apply the new version.
 * If no waiting SW is found, calls onApplied immediately as a fallback.
 */
export function applyServiceWorkerUpdate(
  onApplied: () => void = () => window.location.reload(),
): void {
  const reg = _registration
  if (!reg?.waiting) {
    onApplied()
    return
  }

  let done = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!done) { done = true; onApplied() }
  })
  reg.waiting.postMessage({ type: 'SKIP_WAITING' })
}

// ── React hook ────────────────────────────────────────────────────────────────

export function useServiceWorkerUpdate(): {
  updateAvailable: boolean
  applyUpdate: () => void
} {
  const [updateAvailable, setUpdateAvailable] = React.useState(false)

  React.useEffect(() => {
    registerServiceWorker(() => setUpdateAvailable(true))
  }, [])

  return {
    updateAvailable,
    applyUpdate: () => applyServiceWorkerUpdate(),
  }
}
