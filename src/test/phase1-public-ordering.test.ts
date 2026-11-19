/**
 * Phase 1 — service verticals (salon, clinic) never offer online ordering on
 * public pages, even when a branch's checkout config would allow it.
 */
import { describe, it, expect } from 'vitest'
import { buildPublicCTAs, resolveOrderingEnabled } from '@/utils/public-context'

const FLAGS = { 'menu.enabled': true, 'ordering.enabled': true, 'reservations.enabled': true }

describe('resolveOrderingEnabled — vertical guard', () => {
  it('food tenant: follows branch checkout / flags as before', () => {
    expect(resolveOrderingEnabled(FLAGS, true, { orderingEnabled: true }, { status: 'ACTIVE', businessTypes: ['restaurant'] })).toBe(true)
  })

  it('service tenant: always false, even if the branch allows ordering', () => {
    expect(resolveOrderingEnabled(FLAGS, true, { orderingEnabled: true }, { status: 'ACTIVE', businessTypes: ['beauty_salon'] })).toBe(false)
    expect(resolveOrderingEnabled(FLAGS, true, undefined, { status: 'ACTIVE', businessTypes: ['clinic'] })).toBe(false)
  })

  it('service tenant: menu CTA says "View Menu" (localized to "View Services" by the UI)', () => {
    const ctas = buildPublicCTAs({
      tenantSlug: 'glow-studio',
      branchSlug: 'main',
      featureFlags: FLAGS,
      tenant: { status: 'ACTIVE', businessTypes: ['beauty_salon'] } as never,
      branch: { orderingEnabled: true, reservationsEnabled: true },
    } as never)
    expect(ctas.menu?.label).toBe('View Menu')
  })
})
