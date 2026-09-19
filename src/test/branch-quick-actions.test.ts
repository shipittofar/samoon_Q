import { describe, it, expect } from 'vitest'
import { buildPublicCTAs } from '@/utils/public-context'
import { buildCustomerJourney } from '@/utils/journey'
import { buildBranchQuickActions } from '@/utils/branch-quick-actions'

const baseOpts = {
  tenantSlug: 'brew',
  branchSlug: 'downtown',
  meta: { branchCount: 1, primaryBranchSlug: 'downtown' },
  tenant: { status: 'ACTIVE' as const },
}

describe('buildBranchQuickActions', () => {
  it('Order Online is first and primary when only ordering is enabled', () => {
    const ctas = buildPublicCTAs({
      ...baseOpts,
      featureFlags: { 'menu.enabled': true, 'ordering.enabled': true },
      branch: { orderingEnabled: true, reservationsEnabled: false },
    })
    const actions = buildBranchQuickActions(ctas)

    expect(actions[0]?.label).toBe('Order Online')
    expect(actions[0]?.role).toBe('menu')
    expect(actions[0]?.variant).toBe('primary')
    expect(actions.some((a) => a.role === 'reservation')).toBe(false)
  })

  it('Order Online stays first and primary when reservation is also enabled (restaurant)', () => {
    const ctas = buildPublicCTAs({
      ...baseOpts,
      featureFlags: {
        'menu.enabled': true,
        'ordering.enabled': true,
        'reservations.enabled': true,
      },
      branch: { orderingEnabled: true, reservationsEnabled: true },
    })

    const journey = buildCustomerJourney({
      businessTypes: ['restaurant'],
      ctas,
    })
    expect(journey.primaryCTA?.href).toContain('/reservation')

    const actions = buildBranchQuickActions(ctas, [
      journey.primaryCTA,
      ...journey.secondaryCTAs,
    ])

    expect(actions[0]?.label).toBe('Order Online')
    expect(actions[0]?.variant).toBe('primary')
    expect(actions[1]?.label).toBe('Reserve a Table')
    expect(actions[1]?.role).toBe('reservation')
    expect(actions[1]?.variant).toBe('secondary')
    expect(actions.filter((a) => a.variant === 'primary')).toHaveLength(1)
  })

  it('Reservation is first and primary when ordering is off', () => {
    const ctas = buildPublicCTAs({
      ...baseOpts,
      featureFlags: {
        'menu.enabled': false,
        'ordering.enabled': false,
        'reservations.enabled': true,
      },
      branch: { orderingEnabled: false, reservationsEnabled: true },
    })
    const actions = buildBranchQuickActions(ctas)

    expect(actions[0]?.label).toBe('Reserve a Table')
    expect(actions[0]?.role).toBe('reservation')
    expect(actions[0]?.variant).toBe('primary')
  })

  it('preserves View Menu vs Order Online labels from buildPublicCTAs', () => {
    const viewMenu = buildPublicCTAs({
      ...baseOpts,
      featureFlags: { 'menu.enabled': true, 'ordering.enabled': false },
      branch: { orderingEnabled: false },
    })
    expect(buildBranchQuickActions(viewMenu)[0]?.label).toBe('View Menu')

    const order = buildPublicCTAs({
      ...baseOpts,
      featureFlags: { 'menu.enabled': true, 'ordering.enabled': true },
      branch: { orderingEnabled: true },
    })
    expect(buildBranchQuickActions(order)[0]?.label).toBe('Order Online')
  })

  it('keeps loyalty after reservation and does not drop remaining CTAs', () => {
    const ctas = buildPublicCTAs({
      ...baseOpts,
      featureFlags: {
        'menu.enabled': true,
        'ordering.enabled': true,
        'reservations.enabled': true,
        'loyalty.enabled': true,
      },
      branch: { orderingEnabled: true, reservationsEnabled: true },
    })
    const actions = buildBranchQuickActions(ctas)
    expect(actions.map((a) => a.role)).toEqual(['menu', 'reservation', 'loyalty'])
  })
})
