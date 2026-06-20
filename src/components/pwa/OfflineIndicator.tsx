'use client'

/**
 * OfflineIndicator — Phase 4.8 (P4.8.6)
 *
 * Displays a non-blocking status bar when the browser loses network access.
 * Disappears automatically when connectivity is restored.
 *
 * Uses navigator.onLine for initial state + window online/offline events for
 * live updates. No polling. Cleanup on unmount.
 *
 * Accessible: role="status", aria-live="polite".
 */

import { useState, useEffect } from 'react'

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    // Set initial state from navigator
    setIsOffline(!navigator.onLine)

    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => setIsOffline(false)

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-amber-500 text-white text-sm font-medium py-2 px-4"
    >
      <span aria-hidden="true">📡</span>
      You are offline — some features may be unavailable
    </div>
  )
}
