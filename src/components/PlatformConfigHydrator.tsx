'use client'

import { configurationService } from '@/config'

/** Last payload received from the layout (per browser tab / server process). */
let lastAppliedJson: string | null = null

/**
 * Applies the platform configuration overrides the root layout read from
 * Django, synchronously during render, before any child renders — so the
 * first client render (and hydration) uses the same values as the server
 * render.
 *
 * Each distinct payload from the layout is applied once: a later re-render
 * with the same (now older) payload must not undo a change the superuser
 * just saved in this tab (savePlatformConfigChanges applies the server's
 * fresh answer directly).
 */
export function PlatformConfigHydrator({
  overrides,
  children,
}: {
  overrides: Record<string, unknown>
  children: React.ReactNode
}) {
  const json = JSON.stringify(overrides ?? {})
  if (typeof window === 'undefined' || json !== lastAppliedJson) {
    lastAppliedJson = json
    configurationService.hydratePlatformOverrides(overrides)
  }
  return <>{children}</>
}

/** Test-only. */
export function __resetPlatformConfigHydratorForTests(): void {
  lastAppliedJson = null
}
