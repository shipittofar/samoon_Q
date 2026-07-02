/**
 * P8.8.11.4 — Smart Customer Journey Engine tests
 *
 * Verifies that buildCustomerJourney() produces correct section order,
 * CTA priority, and nav priority for each business type and flag combination.
 */

import { describe, it, expect } from 'vitest'
import { buildCustomerJourney } from '@/utils/journey'
import { buildPublicCTAs } from '@/utils/public-context'
import type { PublicCTASet } from '@/utils/public-context'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCTAs(overrides: Partial<PublicCTASet> = {}): PublicCTASet {
  return {
    menu: { label: 'View Menu', href: '/t/b/menu' },
    reservation: { label: 'Reserve a Table', href: '/t/b/reservation' },
    loyalty: { label: 'Loyalty', href: '/t/b/loyalty' },
    locations: null,
    ...overrides,
  }
}

function allCTAsNull(): PublicCTASet {
  return { menu: null, reservation: null, loyalty: null, locations: null }
}

// ── Section order by business type ───────────────────────────────────────────

describe('buildCustomerJourney — section order', () => {
  it('restaurant: featured_menu and reviews appear before about', () => {
    const j = buildCustomerJourney({ businessTypes: ['restaurant'], ctas: makeCTAs() })
    const idx = (k: string) => j.sectionOrder.indexOf(k as never)
    expect(idx('featured_menu')).toBeLessThan(idx('reviews'))
    expect(idx('reviews')).toBeLessThan(idx('about'))
  })

  it('cafe: promotions appears before about', () => {
    const j = buildCustomerJourney({ businessTypes: ['cafe'], ctas: makeCTAs() })
    const idx = (k: string) => j.sectionOrder.indexOf(k as never)
    expect(idx('featured_menu')).toBe(0)
    expect(idx('promotions')).toBeLessThan(idx('about'))
  })

  it('food_truck: branches (location) is first section', () => {
    const j = buildCustomerJourney({ businessTypes: ['food_truck'], ctas: makeCTAs() })
    expect(j.sectionOrder[0]).toBe('branches')
  })

  it('mobile_cafe: branches (location) is first section', () => {
    const j = buildCustomerJourney({ businessTypes: ['mobile_cafe'], ctas: makeCTAs() })
    expect(j.sectionOrder[0]).toBe('branches')
  })

  it('food_court: branches (choose location) is first section', () => {
    const j = buildCustomerJourney({ businessTypes: ['food_court'], ctas: makeCTAs() })
    expect(j.sectionOrder[0]).toBe('branches')
  })

  it('bar: featured_menu first, then about before reviews', () => {
    const j = buildCustomerJourney({ businessTypes: ['bar'], ctas: makeCTAs() })
    const idx = (k: string) => j.sectionOrder.indexOf(k as never)
    expect(idx('featured_menu')).toBe(0)
    expect(idx('about')).toBeLessThan(idx('reviews'))
  })

  it('hotel: about is first section', () => {
    const j = buildCustomerJourney({ businessTypes: ['hotel'], ctas: makeCTAs() })
    expect(j.sectionOrder[0]).toBe('about')
  })

  it('unknown type falls back to default order', () => {
    const j = buildCustomerJourney({ businessTypes: ['pizzeria'], ctas: makeCTAs() })
    expect(j.sectionOrder.length).toBeGreaterThan(0)
    // default puts featured_menu first
    expect(j.sectionOrder[0]).toBe('featured_menu')
  })

  it('empty businessTypes falls back to other/default', () => {
    const j = buildCustomerJourney({ businessTypes: [], ctas: makeCTAs() })
    expect(j.sectionOrder.length).toBeGreaterThan(0)
  })

  it('section order includes all expected body sections', () => {
    const required = ['featured_menu', 'about', 'reviews', 'gallery', 'branches', 'promotions']
    for (const type of ['restaurant', 'cafe', 'bar', 'food_truck', 'food_court', 'hotel']) {
      const j = buildCustomerJourney({ businessTypes: [type], ctas: makeCTAs() })
      for (const k of required) {
        expect(j.sectionOrder).toContain(k)
      }
    }
  })
})

// ── CTA priority by business type ─────────────────────────────────────────────

describe('buildCustomerJourney — CTA priority', () => {
  it('restaurant: reservation is primary when enabled', () => {
    const j = buildCustomerJourney({ businessTypes: ['restaurant'], ctas: makeCTAs() })
    expect(j.primaryCTA?.href).toContain('/reservation')
  })

  it('restaurant: menu is primary when reservation disabled', () => {
    const j = buildCustomerJourney({
      businessTypes: ['restaurant'],
      ctas: makeCTAs({ reservation: null }),
    })
    expect(j.primaryCTA?.href).toContain('/menu')
  })

  it('bar: reservation is primary when enabled', () => {
    const j = buildCustomerJourney({ businessTypes: ['bar'], ctas: makeCTAs() })
    expect(j.primaryCTA?.href).toContain('/reservation')
  })

  it('hotel: reservation is primary when enabled', () => {
    const j = buildCustomerJourney({ businessTypes: ['hotel'], ctas: makeCTAs() })
    expect(j.primaryCTA?.href).toContain('/reservation')
  })

  it('cafe: menu is primary (not reservation)', () => {
    const j = buildCustomerJourney({ businessTypes: ['cafe'], ctas: makeCTAs() })
    expect(j.primaryCTA?.href).toContain('/menu')
  })

  it('food_truck: locations CTA is primary when available', () => {
    const j = buildCustomerJourney({
      businessTypes: ['food_truck'],
      ctas: makeCTAs({ locations: { label: 'Choose a Location', href: '/t#branches' } }),
    })
    expect(j.primaryCTA?.href).toContain('#branches')
  })

  it('food_truck: menu is primary when locations is null', () => {
    const j = buildCustomerJourney({
      businessTypes: ['food_truck'],
      ctas: makeCTAs({ locations: null }),
    })
    expect(j.primaryCTA?.href).toContain('/menu')
  })

  it('mobile_cafe: locations CTA is primary when available', () => {
    const j = buildCustomerJourney({
      businessTypes: ['mobile_cafe'],
      ctas: makeCTAs({ locations: { label: 'Choose a Location', href: '/t#branches' } }),
    })
    expect(j.primaryCTA?.href).toContain('#branches')
  })

  it('returns null primaryCTA when all CTAs are null', () => {
    const j = buildCustomerJourney({ businessTypes: ['restaurant'], ctas: allCTAsNull() })
    expect(j.primaryCTA).toBeNull()
    expect(j.secondaryCTAs).toHaveLength(0)
  })

  it('secondaryCTAs does not include the primary CTA', () => {
    const j = buildCustomerJourney({ businessTypes: ['restaurant'], ctas: makeCTAs() })
    const primaryHref = j.primaryCTA?.href
    const secondaryHrefs = j.secondaryCTAs.map((c) => c.href)
    expect(secondaryHrefs).not.toContain(primaryHref)
  })

  it('total active CTAs = primaryCTA + secondaryCTAs', () => {
    const ctas = makeCTAs({ loyalty: { label: 'Loyalty', href: '/t/b/loyalty' } })
    const j = buildCustomerJourney({ businessTypes: ['restaurant'], ctas })
    const total = (j.primaryCTA ? 1 : 0) + j.secondaryCTAs.length
    // reservation + menu + loyalty = 3 active (locations is null)
    expect(total).toBe(3)
  })
})

// ── Nav priority by business type ─────────────────────────────────────────────

describe('buildCustomerJourney — nav priority', () => {
  it('food_truck: locations appears before menu in nav priority', () => {
    const j = buildCustomerJourney({ businessTypes: ['food_truck'], ctas: makeCTAs() })
    const idx = (k: string) => j.navPriority.indexOf(k)
    expect(idx('locations')).toBeLessThan(idx('menu'))
  })

  it('restaurant: menu appears before reservation in nav priority', () => {
    const j = buildCustomerJourney({ businessTypes: ['restaurant'], ctas: makeCTAs() })
    const idx = (k: string) => j.navPriority.indexOf(k)
    expect(idx('menu')).toBeLessThan(idx('reservation'))
  })

  it('cafe: loyalty appears before order in nav priority', () => {
    const j = buildCustomerJourney({ businessTypes: ['cafe'], ctas: makeCTAs() })
    const idx = (k: string) => j.navPriority.indexOf(k)
    expect(idx('loyalty')).toBeLessThan(idx('order'))
  })

  it('returns non-empty navPriority for all business types', () => {
    for (const type of ['restaurant', 'cafe', 'bar', 'food_truck', 'food_court', 'mobile_cafe', 'hotel']) {
      const j = buildCustomerJourney({ businessTypes: [type], ctas: makeCTAs() })
      expect(j.navPriority.length).toBeGreaterThan(0)
    }
  })
})

// ── Integration with buildPublicCTAs ──────────────────────────────────────────

describe('buildCustomerJourney integrates with buildPublicCTAs', () => {
  it('restaurant with reservation enabled: reservation is primary', () => {
    const ctas = buildPublicCTAs({
      tenantSlug: 'acme',
      branchSlug: 'downtown',
      featureFlags: { 'menu.enabled': true, 'reservations.enabled': true },
    })
    const j = buildCustomerJourney({ businessTypes: ['restaurant'], ctas })
    expect(j.primaryCTA?.href).toContain('/reservation')
  })

  it('food_truck single-branch: menu is primary (no locations CTA)', () => {
    const ctas = buildPublicCTAs({
      tenantSlug: 'truck',
      branchSlug: 'main',
      featureFlags: { 'menu.enabled': true },
      meta: { branchCount: 1 },
    })
    const j = buildCustomerJourney({ businessTypes: ['food_truck'], ctas })
    // locations is null (single branch), so menu becomes primary
    expect(j.primaryCTA?.href).toContain('/menu')
  })

  it('food_truck multi-branch tenant homepage: locations is primary', () => {
    const ctas = buildPublicCTAs({
      tenantSlug: 'truck',
      branchSlug: undefined,  // tenant homepage
      featureFlags: { 'menu.enabled': true },
      meta: { branchCount: 3, primaryBranchSlug: 'midtown' },
    })
    const j = buildCustomerJourney({ businessTypes: ['food_truck'], ctas })
    expect(j.primaryCTA?.href).toContain('#branches')
  })

  it('cafe with all features: menu is primary, loyalty is secondary', () => {
    const ctas = buildPublicCTAs({
      tenantSlug: 'brew',
      branchSlug: 'east',
      featureFlags: {
        'menu.enabled': true,
        'reservations.enabled': true,
        'loyalty.enabled': true,
      },
    })
    const j = buildCustomerJourney({ businessTypes: ['cafe'], ctas })
    expect(j.primaryCTA?.href).toContain('/menu')
    expect(j.secondaryCTAs[0]?.href).toContain('/loyalty')
  })
})
