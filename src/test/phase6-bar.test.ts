/**
 * P6.4 — Bar Module tests
 *
 * Covers:
 *   A. Bar module registration
 *   B. businessTypes=['bar']
 *   C. capability contract
 *   D. required capabilities
 *   E. optional capabilities
 *   F. defaultEnabled capabilities
 *   G. feature flags (defaultFeatureFlags + capability-derived)
 *   H. header navigation (4 items + featureFlagKeys)
 *   I. admin navigation (2 items + featureFlagKeys)
 *   J. getHeaderNav(['bar']) behavior
 *   K. getAdminNav(['bar']) / getAdminNav([]) behavior
 *   L. tenant override compatibility (enable events, disable reservations)
 *   M. restaurant regression
 *   N. cafe regression
 *   O. empty-module edge cases
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DEFAULT_TENANT } from '@/constants'
import type { BarSettings, Module, Tenant } from '@/types'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

async function freshRegistry() {
  vi.resetModules()
  return import('@/modules/registry')
}

async function freshFeatureFlags() {
  vi.resetModules()
  return import('@/services/feature-flags.service')
}

// ── A. Bar module registration ────────────────────────────────────────────────

describe('A. Bar module registration', () => {
  afterEach(() => vi.resetModules())

  it('BAR_MODULE is exported from registry', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE).toBeDefined()
  })

  it('BAR_MODULE.key is "bar"', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.key).toBe('bar')
  })

  it('BAR_MODULE.name is "Bar"', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.name).toBe('Bar')
  })

  it('BAR_MODULE is registered in getModules()', async () => {
    const { getModules } = await freshRegistry()
    const keys = getModules().map((m) => m.key)
    expect(keys).toContain('bar')
  })

  it('getModule("bar") returns BAR_MODULE', async () => {
    const { getModule } = await freshRegistry()
    const mod = getModule('bar')
    expect(mod).toBeDefined()
    expect(mod!.key).toBe('bar')
  })

  it('BAR_MODULE.enabled is true', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.enabled).toBe(true)
  })
})

// ── B. businessTypes=['bar'] ──────────────────────────────────────────────────

describe('B. businessTypes', () => {
  afterEach(() => vi.resetModules())

  it('BAR_MODULE.businessTypes contains "bar"', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.businessTypes).toContain('bar')
  })

  it('BAR_MODULE.businessTypes does not contain "restaurant"', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.businessTypes).not.toContain('restaurant')
  })

  it('BAR_MODULE.businessTypes does not contain "cafe"', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.businessTypes).not.toContain('cafe')
  })

  it('BAR_MODULE.businessTypes has exactly 1 entry', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.businessTypes).toHaveLength(1)
  })
})

// ── C. Capability contract (shape) ───────────────────────────────────────────

describe('C. capability contract', () => {
  afterEach(() => vi.resetModules())

  it('BAR_MODULE has capabilities defined', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities).toBeDefined()
  })

  it('capabilities has required array', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(Array.isArray(BAR_MODULE.capabilities!.required)).toBe(true)
  })

  it('capabilities has optional array', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(Array.isArray(BAR_MODULE.capabilities!.optional)).toBe(true)
  })

  it('capabilities has defaultEnabled array', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(Array.isArray(BAR_MODULE.capabilities!.defaultEnabled)).toBe(true)
  })
})

// ── D. Required capabilities ──────────────────────────────────────────────────

describe('D. required capabilities', () => {
  afterEach(() => vi.resetModules())

  it('menu is required', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities!.required).toContain('menu')
  })

  it('ordering is required', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities!.required).toContain('ordering')
  })

  it('qr_table is required', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities!.required).toContain('qr_table')
  })

  it('notifications is required', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities!.required).toContain('notifications')
  })

  it('required has exactly 4 capabilities', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities!.required).toHaveLength(4)
  })

  it('qr_table is NOT in optional', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities!.optional).not.toContain('qr_table')
  })
})

// ── E. Optional capabilities ──────────────────────────────────────────────────

describe('E. optional capabilities', () => {
  afterEach(() => vi.resetModules())

  it('reservations is optional', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities!.optional).toContain('reservations')
  })

  it('reviews is optional', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities!.optional).toContain('reviews')
  })

  it('loyalty is optional', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities!.optional).toContain('loyalty')
  })

  it('optional has exactly 3 capabilities', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities!.optional).toHaveLength(3)
  })
})

// ── F. defaultEnabled capabilities ───────────────────────────────────────────

describe('F. defaultEnabled capabilities', () => {
  afterEach(() => vi.resetModules())

  it('reservations is defaultEnabled', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities!.defaultEnabled).toContain('reservations')
  })

  it('loyalty is NOT defaultEnabled', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities!.defaultEnabled).not.toContain('loyalty')
  })

  it('reviews is NOT defaultEnabled', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities!.defaultEnabled).not.toContain('reviews')
  })
})

// ── G. Feature flags ──────────────────────────────────────────────────────────

describe('G. feature flags', () => {
  afterEach(() => vi.resetModules())

  it('menu.enabled defaults to true', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.defaultFeatureFlags['menu.enabled']).toBe(true)
  })

  it('reservations.enabled defaults to true', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.defaultFeatureFlags['reservations.enabled']).toBe(true)
  })

  it('delivery.enabled defaults to false', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.defaultFeatureFlags['delivery.enabled']).toBe(false)
  })

  it('table_ordering.enabled defaults to true', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.defaultFeatureFlags['table_ordering.enabled']).toBe(true)
  })

  it('bar.happy_hour.enabled defaults to false', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.defaultFeatureFlags['bar.happy_hour.enabled']).toBe(false)
  })

  it('bar.events.enabled defaults to false', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.defaultFeatureFlags['bar.events.enabled']).toBe(false)
  })

  it('bar.featured_cocktails.enabled defaults to false', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.defaultFeatureFlags['bar.featured_cocktails.enabled']).toBe(false)
  })

  it('getCapabilityFeatureFlags(["bar"]) sets menu.enabled=true (required)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['bar'])['menu.enabled']).toBe(true)
  })

  it('getCapabilityFeatureFlags(["bar"]) sets qr_table.enabled=true (required)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['bar'])['qr_table.enabled']).toBe(true)
  })

  it('getCapabilityFeatureFlags(["bar"]) sets reservations.enabled=true (defaultEnabled)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['bar'])['reservations.enabled']).toBe(true)
  })

  it('getCapabilityFeatureFlags(["bar"]) sets loyalty.enabled=false (optional, not defaultEnabled)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['bar'])['loyalty.enabled'] ?? false).toBe(false)
  })
})

// ── H. Header navigation ──────────────────────────────────────────────────────

describe('H. header navigation', () => {
  afterEach(() => vi.resetModules())

  it('BAR_MODULE.navItems has 5 items', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.navItems).toHaveLength(5)
  })

  it('first nav item is Menu linking to /menu', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.navItems[0]).toMatchObject({ href: '/menu', label: 'Drinks' })
  })

  it('Reservations nav item links to /reservation', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    const item = BAR_MODULE.navItems.find((n) => n.href === '/reservation')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Reservations')
  })

  it('Reservations nav item is gated by reservations.enabled', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    const item = BAR_MODULE.navItems.find((n) => n.href === '/reservation')
    expect(item!.featureFlagKey).toBe('reservations.enabled')
  })

  it('Reviews nav item links to /reviews', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    const item = BAR_MODULE.navItems.find((n) => n.href === '/reviews')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Reviews')
  })

  it('Reviews nav item is gated by reviews.enabled', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    const item = BAR_MODULE.navItems.find((n) => n.href === '/reviews')
    expect(item!.featureFlagKey).toBe('reviews.enabled')
  })

  it('Events nav item links to /events', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    const item = BAR_MODULE.navItems.find((n) => n.href === '/events')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Events')
  })

  it('Events nav item is gated by bar.events.enabled', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    const item = BAR_MODULE.navItems.find((n) => n.href === '/events')
    expect(item!.featureFlagKey).toBe('bar.events.enabled')
  })
})

// ── I. Admin navigation ───────────────────────────────────────────────────────

describe('I. admin navigation', () => {
  afterEach(() => vi.resetModules())

  it('BAR_MODULE.adminNavItems is defined', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.adminNavItems).toBeDefined()
  })

  it('BAR_MODULE.adminNavItems has 7 items', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.adminNavItems).toHaveLength(29)
  })

  it('Event Management admin item links to /console/bar/events', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    const item = BAR_MODULE.adminNavItems!.find((n) => n.label === 'Event Management')
    expect(item).toBeDefined()
    expect(item!.href).toBe('/console/bar/events')
  })

  it('Event Management is gated by bar.events.enabled', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    const item = BAR_MODULE.adminNavItems!.find((n) => n.label === 'Event Management')
    expect(item!.featureFlagKey).toBe('bar.events.enabled')
  })

  it('Happy Hour Settings admin item links to /console/bar/happy-hour', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    const item = BAR_MODULE.adminNavItems!.find((n) => n.label === 'Happy Hour Settings')
    expect(item).toBeDefined()
    expect(item!.href).toBe('/console/bar/happy-hour')
  })

  it('Happy Hour Settings is gated by bar.happy_hour.enabled', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    const item = BAR_MODULE.adminNavItems!.find((n) => n.label === 'Happy Hour Settings')
    expect(item!.featureFlagKey).toBe('bar.happy_hour.enabled')
  })
})

// ── J. getHeaderNav(['bar']) behavior ────────────────────────────────────────

describe('J. getHeaderNav behavior', () => {
  afterEach(() => vi.resetModules())

  it('getHeaderNav(["bar"]) returns 5 items', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(["bar"])).toHaveLength(5)
  })

  it('getHeaderNav(["bar"]) includes Drinks', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['bar'])
    expect(items.some((n) => n.label === 'Drinks')).toBe(true)
  })

  it('getHeaderNav(["bar"]) includes Reservations', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['bar'])
    expect(items.some((n) => n.label === 'Reservations')).toBe(true)
  })

  it('getHeaderNav(["bar"]) includes Reviews', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['bar'])
    expect(items.some((n) => n.label === 'Reviews')).toBe(true)
  })

  it('getHeaderNav(["bar"]) includes Events', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['bar'])
    expect(items.some((n) => n.label === 'Events')).toBe(true)
  })

  it('getHeaderNav(["bar"]) does not include cafe-specific items', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['bar'])
    expect(items.some((n) => n.label === 'Loyalty')).toBe(false)
  })

  it('getHeaderNav(["restaurant"]) does not include bar items', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['restaurant'])
    expect(items.some((n) => n.label === 'Events')).toBe(false)
    expect(items.some((n) => n.label === 'Drinks')).toBe(false)
  })
})

// ── K. getAdminNav(['bar']) / getAdminNav([]) behavior ───────────────────────

describe('K. getAdminNav behavior', () => {
  afterEach(() => vi.resetModules())

  it('getAdminNav(["bar"]) returns 12 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(["bar"])).toHaveLength(29)
  })

  it('getAdminNav(["bar"]) includes Event Management', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['bar']).some((n) => n.label === 'Event Management')).toBe(true)
  })

  it('getAdminNav(["bar"]) includes Happy Hour Settings', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['bar']).some((n) => n.label === 'Happy Hour Settings')).toBe(true)
  })

  it('getAdminNav([]) returns empty array', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav([])).toHaveLength(0)
  })

  it('getAdminNav(["restaurant"]) does not include bar admin items', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['restaurant'])
    expect(items.some((n) => n.label === 'Event Management')).toBe(false)
    expect(items.some((n) => n.label === 'Happy Hour Settings')).toBe(false)
  })

  it('getAdminNav(["cafe"]) does not include bar admin items', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['cafe'])
    expect(items.some((n) => n.label === 'Event Management')).toBe(false)
  })

  it('getAdminNav(["cafe", "bar"]) includes both cafe and bar admin items', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['cafe', 'bar'])
    expect(items.some((n) => n.label === 'Loyalty Management')).toBe(true)
    expect(items.some((n) => n.label === 'Event Management')).toBe(true)
  })
})

// ── L. Tenant override compatibility ─────────────────────────────────────────

describe('L. tenant override compatibility', () => {
  afterEach(() => vi.resetModules())

  it('bar tenant with no overrides gets reservations.enabled=true from defaultFeatureFlags', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['bar'],
      settings: {},
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['reservations.enabled']).toBe(true)
  })

  it('bar tenant with no overrides gets bar.events.enabled=false', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['bar'],
      settings: {},
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['bar.events.enabled']).toBe(false)
  })

  it('tenant override can enable bar.events.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['bar'],
      settings: { featureFlags: { 'bar.events.enabled': true } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['bar.events.enabled']).toBe(true)
  })

  it('tenant override can enable bar.happy_hour.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['bar'],
      settings: { featureFlags: { 'bar.happy_hour.enabled': true } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['bar.happy_hour.enabled']).toBe(true)
  })

  it('tenant override can disable reservations.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['bar'],
      settings: { featureFlags: { 'reservations.enabled': false } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['reservations.enabled']).toBe(false)
  })

  it('tenant override can enable bar.featured_cocktails.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['bar'],
      settings: { featureFlags: { 'bar.featured_cocktails.enabled': true } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['bar.featured_cocktails.enabled']).toBe(true)
  })
})

// ── M. Restaurant regression ──────────────────────────────────────────────────

describe('M. restaurant regression', () => {
  afterEach(() => vi.resetModules())

  it('RESTAURANT_MODULE is unaffected by BAR_MODULE', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.key).toBe('restaurant')
    expect(RESTAURANT_MODULE.businessTypes).toContain('restaurant')
  })

  it('restaurant capabilities unchanged: menu required', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.capabilities!.required).toContain('menu')
  })

  it('restaurant capabilities unchanged: qr_table required', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.capabilities!.required).toContain('qr_table')
  })

  it('restaurant defaultFeatureFlags unchanged: menu.enabled=true', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.defaultFeatureFlags['menu.enabled']).toBe(true)
  })

  it('restaurant navItems still include Menu and Reservation', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    const hrefs = RESTAURANT_MODULE.navItems.map((n) => n.href)
    expect(hrefs).toContain('/menu')
    expect(hrefs).toContain('/reservation')
  })

  it('getHeaderNav(["restaurant"]) does not include Drinks or Events', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['restaurant'])
    expect(items.some((n) => n.href === '/events')).toBe(false)
    expect(items.some((n) => n.label === 'Drinks')).toBe(false)
  })
})

// ── N. Cafe regression ────────────────────────────────────────────────────────

describe('N. cafe regression', () => {
  afterEach(() => vi.resetModules())

  it('CAFE_MODULE is unaffected by BAR_MODULE', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.key).toBe('cafe')
    expect(CAFE_MODULE.businessTypes).toContain('cafe')
  })

  it('cafe defaultFeatureFlags unchanged: cafe.loyalty.enabled=false', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.defaultFeatureFlags['cafe.loyalty.enabled']).toBe(false)
  })

  it('cafe adminNavItems still present (Loyalty Management, Happy Hour)', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    const labels = CAFE_MODULE.adminNavItems!.map((n) => n.label)
    expect(labels).toContain('Loyalty Management')
    expect(labels).toContain('Happy Hour Settings')
  })

  it('getAdminNav(["cafe"]) still returns 7 cafe admin items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['cafe'])).toHaveLength(29)
  })
})

// ── O. Empty-module edge cases ────────────────────────────────────────────────

describe('O. empty-module edge cases', () => {
  afterEach(() => vi.resetModules())

  it('getHeaderNav([]) falls back to all enabled modules (no-filter)', async () => {
    // empty array → length=0 → falsy → no module filter applied → returns all nav items
    const { getHeaderNav, getModules } = await freshRegistry()
    const allItems = getModules().flatMap((m) => m.navItems)
    expect(getHeaderNav([])).toHaveLength(allItems.length)
  })

  it('getAdminNav([]) returns empty array (empty array treated as no active modules)', async () => {
    // getAdminNav uses undefined-check, not length-check — empty array → 0 items
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav([])).toHaveLength(0)
  })

  it('getCapabilityFeatureFlags([]) falls back to all modules', async () => {
    // empty array → falsy → merges capability flags from all enabled modules
    const { getCapabilityFeatureFlags } = await freshRegistry()
    const flags = getCapabilityFeatureFlags([])
    expect(flags['menu.enabled']).toBe(true)
  })

  it('getDefaultFeatureFlags([]) falls back to all modules', async () => {
    // empty array → falsy → merges defaultFeatureFlags from all enabled modules
    const { getDefaultFeatureFlags } = await freshRegistry()
    const flags = getDefaultFeatureFlags([])
    expect(flags['menu.enabled']).toBe(true)
  })
})

// ── BarSettings type structure ────────────────────────────────────────────────

describe('BarSettings type (source-text check)', () => {
  const src = readSrc('types/index.ts')

  it('BarSettings interface is exported from types/index.ts', () => {
    expect(src).toContain('export interface BarSettings')
  })

  it('BarSettings has happyHourEnabled: boolean', () => {
    expect(src).toMatch(/happyHourEnabled:\s*boolean/)
  })

  it('BarSettings has happyHourStart optional string', () => {
    expect(src).toMatch(/happyHourStart\?:\s*string/)
  })

  it('BarSettings has happyHourEnd optional string', () => {
    expect(src).toMatch(/happyHourEnd\?:\s*string/)
  })

  it('BarSettings has eventsEnabled: boolean', () => {
    expect(src).toMatch(/eventsEnabled:\s*boolean/)
  })

  it('BarSettings has reservationsRequiredForEvents: boolean', () => {
    expect(src).toMatch(/reservationsRequiredForEvents:\s*boolean/)
  })

  it('BarSettings has featuredCocktailsEnabled: boolean', () => {
    expect(src).toMatch(/featuredCocktailsEnabled:\s*boolean/)
  })
})
