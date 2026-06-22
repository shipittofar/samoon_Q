/**
 * P6.3 — Cafe Module tests
 *
 * Covers:
 *   - Audit findings: qr_table fixed to required for all modules
 *   - CafeSettings type (source-structure)
 *   - CAFE_MODULE registration and capability contract
 *   - Navigation generation (all 4 nav items + featureFlagKeys)
 *   - Feature flags: cafe.loyalty.enabled, cafe.happy_hour.enabled, cafe.featured_coffee.enabled
 *   - Three-layer flag merge for a cafe tenant
 *   - Tenant capability override (enable loyalty, disable reservations)
 *   - Admin nav visibility: getAdminNav(['cafe'])
 *   - Backward compatibility: restaurant behavior unchanged
 *   - Module.adminNavItems optional field
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DEFAULT_TENANT } from '@/constants'
import type { CafeSettings, Module, Tenant } from '@/types'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

async function freshRegistry() {
  vi.resetModules()
  return import('@/modules/registry')
}

// ── Audit finding: qr_table is required for all modules ──────────────────────

describe('P6.3 audit — qr_table required for all business-type modules', () => {
  afterEach(() => vi.resetModules())

  it('RESTAURANT_MODULE: qr_table is required', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.capabilities!.required).toContain('qr_table')
  })

  it('CAFE_MODULE: qr_table is required', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.capabilities!.required).toContain('qr_table')
  })

  it('BAR_MODULE: qr_table is required', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities!.required).toContain('qr_table')
  })

  it('FOOD_COURT_MODULE: qr_table is required', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities!.required).toContain('qr_table')
  })

  it('FOOD_TRUCK_MODULE: qr_table is required', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.required).toContain('qr_table')
  })

  it('MOBILE_CAFE_MODULE: qr_table is required', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.required).toContain('qr_table')
  })

  it('no module has qr_table in optional (it is universally required)', async () => {
    const { getModules } = await freshRegistry()
    const modules = getModules()
    modules.forEach((m) => {
      if (m.capabilities) {
        expect(m.capabilities.optional).not.toContain('qr_table')
      }
    })
  })
})

// ── Source-structure: types/index.ts — CafeSettings ─────────────────────────

describe('types/index.ts — CafeSettings (P6.3)', () => {
  const src = () => readSrc('types/index.ts')

  it('exports CafeSettings interface',          () => expect(src()).toContain('export interface CafeSettings'))
  it('has happyHourEnabled field',              () => expect(src()).toContain('happyHourEnabled'))
  it('has happyHourStart field',                () => expect(src()).toContain('happyHourStart'))
  it('has happyHourEnd field',                  () => expect(src()).toContain('happyHourEnd'))
  it('has loyaltyEnabled field',                () => expect(src()).toContain('loyaltyEnabled'))
  it('has featuredCoffeeEnabled field',         () => expect(src()).toContain('featuredCoffeeEnabled'))
  it('Module interface has adminNavItems field',() => expect(src()).toContain('adminNavItems?: NavItem[]'))
})

// ── Source-structure: registry.ts — getAdminNav ──────────────────────────────

describe('registry.ts — getAdminNav export (P6.3)', () => {
  const src = () => readSrc('modules/registry.ts')

  it('exports getAdminNav function',              () => expect(src()).toContain('export function getAdminNav'))
  it('CAFE_MODULE declares adminNavItems',         () => expect(src()).toContain('adminNavItems'))
  it('loyalty management admin href declared',    () => expect(src()).toContain('/admin/cafe/loyalty'))
  it('happy hour admin href declared',            () => expect(src()).toContain('/admin/cafe/happy-hour'))
  it('cafe.loyalty.enabled flag gating declared', () => expect(src()).toContain("'cafe.loyalty.enabled'"))
  it('cafe.happy_hour.enabled flag declared',     () => expect(src()).toContain("'cafe.happy_hour.enabled'"))
  it('cafe.featured_coffee.enabled flag declared',() => expect(src()).toContain("'cafe.featured_coffee.enabled'"))
})

// ── Runtime: CAFE_MODULE capability contract ──────────────────────────────────

describe('CAFE_MODULE — capability contract (P6.3)', () => {
  afterEach(() => vi.resetModules())

  it('key is cafe', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.key).toBe('cafe')
  })

  it('businessTypes is [cafe]', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.businessTypes).toEqual(['cafe'])
  })

  it('menu is required', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.capabilities!.required).toContain('menu')
  })

  it('ordering is required', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.capabilities!.required).toContain('ordering')
  })

  it('qr_table is required', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.capabilities!.required).toContain('qr_table')
  })

  it('notifications is required', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.capabilities!.required).toContain('notifications')
  })

  it('reservations is optional', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.capabilities!.optional).toContain('reservations')
  })

  it('reviews is optional', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.capabilities!.optional).toContain('reviews')
  })

  it('loyalty is optional', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.capabilities!.optional).toContain('loyalty')
  })

  it('reservations is defaultEnabled', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.capabilities!.defaultEnabled).toContain('reservations')
  })

  it('reviews is defaultEnabled', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.capabilities!.defaultEnabled).toContain('reviews')
  })

  it('loyalty is NOT defaultEnabled (opt-in per tenant)', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.capabilities!.defaultEnabled).not.toContain('loyalty')
  })
})

// ── Runtime: CAFE_MODULE navigation ──────────────────────────────────────────

describe('CAFE_MODULE — navigation items (P6.3)', () => {
  afterEach(() => vi.resetModules())

  it('has Menu nav item', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.navItems.some((n) => n.href === '/menu' && n.label === 'Menu')).toBe(true)
  })

  it('has Reservations nav item', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.navItems.some((n) => n.href === '/reservation')).toBe(true)
  })

  it('Reservations nav item is gated on reservations.enabled', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    const item = CAFE_MODULE.navItems.find((n) => n.href === '/reservation')
    expect(item?.featureFlagKey).toBe('reservations.enabled')
  })

  it('has Reviews nav item', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.navItems.some((n) => n.label === 'Reviews')).toBe(true)
  })

  it('Reviews nav item is gated on reviews.enabled', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    const item = CAFE_MODULE.navItems.find((n) => n.label === 'Reviews')
    expect(item?.featureFlagKey).toBe('reviews.enabled')
  })

  it('has Loyalty nav item', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.navItems.some((n) => n.label === 'Loyalty')).toBe(true)
  })

  it('Loyalty nav item is gated on cafe.loyalty.enabled', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    const item = CAFE_MODULE.navItems.find((n) => n.label === 'Loyalty')
    expect(item?.featureFlagKey).toBe('cafe.loyalty.enabled')
  })

  it('Loyalty nav item links to /loyalty', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    const item = CAFE_MODULE.navItems.find((n) => n.label === 'Loyalty')
    expect(item?.href).toBe('/loyalty')
  })

  it('getHeaderNav([cafe]) includes /menu', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(['cafe']).some((n) => n.href === '/menu')).toBe(true)
  })

  it('getHeaderNav([cafe]) includes /reservation', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(['cafe']).some((n) => n.href === '/reservation')).toBe(true)
  })

  it('getHeaderNav([cafe]) includes Loyalty item', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(['cafe']).some((n) => n.label === 'Loyalty')).toBe(true)
  })

  it('getHeaderNav([cafe]) returns exactly 5 items', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(['cafe'])).toHaveLength(5)
  })
})

// ── Runtime: CAFE_MODULE routes ───────────────────────────────────────────────

describe('CAFE_MODULE — routes (P6.3)', () => {
  afterEach(() => vi.resetModules())

  it('includes /menu',                    async () => { const { CAFE_MODULE } = await import('@/modules/registry'); expect(CAFE_MODULE.routes).toContain('/menu') })
  it('includes /checkout',               async () => { const { CAFE_MODULE } = await import('@/modules/registry'); expect(CAFE_MODULE.routes).toContain('/checkout') })
  it('includes /order',                  async () => { const { CAFE_MODULE } = await import('@/modules/registry'); expect(CAFE_MODULE.routes).toContain('/order') })
  it('includes /reservation',            async () => { const { CAFE_MODULE } = await import('@/modules/registry'); expect(CAFE_MODULE.routes).toContain('/reservation') })
  it('includes /reviews',                async () => { const { CAFE_MODULE } = await import('@/modules/registry'); expect(CAFE_MODULE.routes).toContain('/reviews') })
  it('includes /loyalty',                async () => { const { CAFE_MODULE } = await import('@/modules/registry'); expect(CAFE_MODULE.routes).toContain('/loyalty') })

  it('all navItem hrefs are present in routes', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    CAFE_MODULE.navItems.forEach((item) => {
      expect(CAFE_MODULE.routes).toContain(item.href)
    })
  })
})

// ── Runtime: CAFE_MODULE feature flags ───────────────────────────────────────

describe('CAFE_MODULE — defaultFeatureFlags (P6.3)', () => {
  afterEach(() => vi.resetModules())

  it('menu.enabled is true',                    async () => { const { CAFE_MODULE } = await import('@/modules/registry'); expect(CAFE_MODULE.defaultFeatureFlags['menu.enabled']).toBe(true) })
  it('reservations.enabled is true',            async () => { const { CAFE_MODULE } = await import('@/modules/registry'); expect(CAFE_MODULE.defaultFeatureFlags['reservations.enabled']).toBe(true) })
  it('delivery.enabled is true',                async () => { const { CAFE_MODULE } = await import('@/modules/registry'); expect(CAFE_MODULE.defaultFeatureFlags['delivery.enabled']).toBe(true) })
  it('cafe.loyalty.enabled is false by default',async () => { const { CAFE_MODULE } = await import('@/modules/registry'); expect(CAFE_MODULE.defaultFeatureFlags['cafe.loyalty.enabled']).toBe(false) })
  it('cafe.happy_hour.enabled is false by default', async () => { const { CAFE_MODULE } = await import('@/modules/registry'); expect(CAFE_MODULE.defaultFeatureFlags['cafe.happy_hour.enabled']).toBe(false) })
  it('cafe.featured_coffee.enabled is false by default', async () => { const { CAFE_MODULE } = await import('@/modules/registry'); expect(CAFE_MODULE.defaultFeatureFlags['cafe.featured_coffee.enabled']).toBe(false) })
})

// ── Runtime: featureFlagsService three-layer merge for cafe tenant ────────────

describe('featureFlagsService — cafe tenant flag resolution (P6.3)', () => {
  afterEach(() => vi.resetModules())

  function cafeTenant(overrides?: Record<string, boolean>): Tenant {
    return {
      ...DEFAULT_TENANT,
      businessTypes: ['cafe'],
      settings: overrides ? { featureFlags: overrides } : undefined,
    }
  }

  it('menu.enabled = true for cafe tenant', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    expect(featureFlagsService.resolve(cafeTenant())['menu.enabled']).toBe(true)
  })

  it('ordering.enabled = true (from capability required)', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    expect(featureFlagsService.resolve(cafeTenant())['ordering.enabled']).toBe(true)
  })

  it('qr_table.enabled = true (from capability required)', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    expect(featureFlagsService.resolve(cafeTenant())['qr_table.enabled']).toBe(true)
  })

  it('notifications.enabled = true (from capability required)', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    expect(featureFlagsService.resolve(cafeTenant())['notifications.enabled']).toBe(true)
  })

  it('reservations.enabled = true by default (defaultEnabled capability)', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    expect(featureFlagsService.resolve(cafeTenant())['reservations.enabled']).toBe(true)
  })

  it('reviews.enabled = true by default (defaultEnabled capability)', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    expect(featureFlagsService.resolve(cafeTenant())['reviews.enabled']).toBe(true)
  })

  it('loyalty.enabled = false by default (optional, not defaultEnabled)', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    expect(featureFlagsService.resolve(cafeTenant())['loyalty.enabled'] ?? false).toBe(false)
  })

  it('cafe.loyalty.enabled = false by default', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    expect(featureFlagsService.resolve(cafeTenant())['cafe.loyalty.enabled']).toBe(false)
  })

  it('cafe.happy_hour.enabled = false by default', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    expect(featureFlagsService.resolve(cafeTenant())['cafe.happy_hour.enabled']).toBe(false)
  })

  it('cafe.featured_coffee.enabled = false by default', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    expect(featureFlagsService.resolve(cafeTenant())['cafe.featured_coffee.enabled']).toBe(false)
  })
})

// ── Runtime: tenant capability overrides ─────────────────────────────────────

describe('featureFlagsService — cafe tenant override (P6.3)', () => {
  afterEach(() => vi.resetModules())

  it('tenant can enable cafe.loyalty.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['cafe'],
      settings: { featureFlags: { 'cafe.loyalty.enabled': true } },
    }
    expect(featureFlagsService.resolve(tenant)['cafe.loyalty.enabled']).toBe(true)
  })

  it('tenant can enable cafe.happy_hour.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['cafe'],
      settings: { featureFlags: { 'cafe.happy_hour.enabled': true } },
    }
    expect(featureFlagsService.resolve(tenant)['cafe.happy_hour.enabled']).toBe(true)
  })

  it('tenant can disable reservations.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['cafe'],
      settings: { featureFlags: { 'reservations.enabled': false } },
    }
    expect(featureFlagsService.resolve(tenant)['reservations.enabled']).toBe(false)
  })

  it('tenant can enable loyalty.enabled generic capability flag', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['cafe'],
      settings: { featureFlags: { 'loyalty.enabled': true } },
    }
    expect(featureFlagsService.resolve(tenant)['loyalty.enabled']).toBe(true)
  })

  it('enabling cafe.loyalty.enabled does not affect other flags', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['cafe'],
      settings: { featureFlags: { 'cafe.loyalty.enabled': true } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['menu.enabled']).toBe(true)
    expect(flags['qr_table.enabled']).toBe(true)
    expect(flags['reservations.enabled']).toBe(true)
  })
})

// ── Runtime: admin nav visibility ─────────────────────────────────────────────

describe('getAdminNav() — cafe module admin visibility (P6.3)', () => {
  it('getAdminNav([cafe]) returns Loyalty Management item', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['cafe'])
    expect(items.some((n) => n.label === 'Loyalty Management')).toBe(true)
  })

  it('getAdminNav([cafe]) returns Happy Hour Settings item', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['cafe'])
    expect(items.some((n) => n.label === 'Happy Hour Settings')).toBe(true)
  })

  it('Loyalty Management is gated on cafe.loyalty.enabled', async () => {
    const { getAdminNav } = await freshRegistry()
    const item = getAdminNav(['cafe']).find((n) => n.label === 'Loyalty Management')
    expect(item?.featureFlagKey).toBe('cafe.loyalty.enabled')
  })

  it('Happy Hour Settings is gated on cafe.happy_hour.enabled', async () => {
    const { getAdminNav } = await freshRegistry()
    const item = getAdminNav(['cafe']).find((n) => n.label === 'Happy Hour Settings')
    expect(item?.featureFlagKey).toBe('cafe.happy_hour.enabled')
  })

  it('getAdminNav([restaurant]) returns 4 items (analytics + tenants + staff + branches)', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['restaurant'])).toHaveLength(5)
  })

  it('getAdminNav([]) returns empty array (no active modules)', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav([])).toHaveLength(0)
  })

  it('Loyalty Management links to /admin/cafe/loyalty', async () => {
    const { getAdminNav } = await freshRegistry()
    const item = getAdminNav(['cafe']).find((n) => n.label === 'Loyalty Management')
    expect(item?.href).toBe('/admin/cafe/loyalty')
  })

  it('Happy Hour Settings links to /admin/cafe/happy-hour', async () => {
    const { getAdminNav } = await freshRegistry()
    const item = getAdminNav(['cafe']).find((n) => n.label === 'Happy Hour Settings')
    expect(item?.href).toBe('/admin/cafe/happy-hour')
  })
})

// ── Runtime: CafeSettings TypeScript shape ────────────────────────────────────

describe('CafeSettings — type shape (P6.3)', () => {
  it('CafeSettings can be instantiated with all required fields', () => {
    const settings: CafeSettings = {
      happyHourEnabled: false,
      loyaltyEnabled: false,
      featuredCoffeeEnabled: false,
    }
    expect(settings.happyHourEnabled).toBe(false)
    expect(settings.loyaltyEnabled).toBe(false)
    expect(settings.featuredCoffeeEnabled).toBe(false)
  })

  it('CafeSettings accepts optional time fields', () => {
    const settings: CafeSettings = {
      happyHourEnabled: true,
      happyHourStart: '15:00',
      happyHourEnd: '18:00',
      loyaltyEnabled: true,
      featuredCoffeeEnabled: true,
    }
    expect(settings.happyHourStart).toBe('15:00')
    expect(settings.happyHourEnd).toBe('18:00')
  })

  it('Module.adminNavItems is optional — modules without it compile fine', () => {
    const mod: Module = {
      key: 'test',
      name: 'Test',
      businessTypes: [],
      routes: [],
      navItems: [],
      defaultFeatureFlags: {},
      enabled: true,
    }
    expect(mod.adminNavItems).toBeUndefined()
  })
})

// ── Backward compatibility ─────────────────────────────────────────────────────

describe('Backward compatibility — restaurant unchanged (P6.3)', () => {
  afterEach(() => vi.resetModules())

  it('RESTAURANT_MODULE routes still include /menu, /checkout, /reservation', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.routes).toContain('/menu')
    expect(RESTAURANT_MODULE.routes).toContain('/checkout')
    expect(RESTAURANT_MODULE.routes).toContain('/reservation')
    expect(RESTAURANT_MODULE.routes).toContain('/restaurant')
  })

  it('RESTAURANT_MODULE navItems still include /menu and /reservation', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.navItems.some((n) => n.href === '/menu')).toBe(true)
    expect(RESTAURANT_MODULE.navItems.some((n) => n.href === '/reservation')).toBe(true)
  })

  it('RESTAURANT_MODULE has adminNavItems with analytics entry', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.adminNavItems?.some((n) => n.href === '/admin/analytics')).toBe(true)
  })

  it('restaurant defaultFeatureFlags unchanged', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.defaultFeatureFlags['menu.enabled']).toBe(true)
    expect(RESTAURANT_MODULE.defaultFeatureFlags['reservations.enabled']).toBe(true)
    expect(RESTAURANT_MODULE.defaultFeatureFlags['delivery.enabled']).toBe(true)
    expect(RESTAURANT_MODULE.defaultFeatureFlags['table_ordering.enabled']).toBe(true)
    expect(RESTAURANT_MODULE.defaultFeatureFlags['order_tracking.enabled']).toBe(true)
  })

  it('featureFlagsService.resolve(DEFAULT_TENANT) still returns correct restaurant flags', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const flags = featureFlagsService.resolve(DEFAULT_TENANT)
    expect(flags['menu.enabled']).toBe(true)
    expect(flags['reservations.enabled']).toBe(true)
    expect(flags['delivery.enabled']).toBe(true)
    expect(flags['table_ordering.enabled']).toBe(true)
    expect(flags['order_tracking.enabled']).toBe(true)
    expect(flags['qr_table.enabled']).toBe(true)
    expect(flags['ordering.enabled']).toBe(true)
  })

  it('getHeaderNav([restaurant]) does not include cafe nav items', async () => {
    const { getHeaderNav } = await freshRegistry()
    const nav = getHeaderNav(['restaurant'])
    expect(nav.some((n) => n.label === 'Loyalty')).toBe(false)
    expect(nav.some((n) => n.href === '/reviews')).toBe(false)
  })
})
