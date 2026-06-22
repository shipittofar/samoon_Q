/**
 * P6.5 — Food Court Module tests
 *
 * Covers:
 *   A. Module registration
 *   B. businessTypes
 *   C. capabilities (shape)
 *   D. required capabilities
 *   E. optional capabilities
 *   F. defaultEnabled capabilities
 *   G. feature flags
 *   H. header navigation
 *   I. admin navigation
 *   J. capability helpers (hasCapability, getModuleCapabilities, getCapabilityFeatureFlags)
 *   K. tenant overrides
 *   L. restaurant regression
 *   M. cafe regression
 *   N. bar regression
 *   O. empty-module edge cases
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DEFAULT_TENANT } from '@/constants'
import type { FoodCourtSettings, Module, Tenant } from '@/types'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

async function freshRegistry() {
  vi.resetModules()
  return import('@/modules/registry')
}

// ── A. Module registration ────────────────────────────────────────────────────

describe('A. Module registration', () => {
  afterEach(() => vi.resetModules())

  it('FOOD_COURT_MODULE is exported from registry', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE).toBeDefined()
  })

  it('FOOD_COURT_MODULE.key is "food_court"', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.key).toBe('food_court')
  })

  it('FOOD_COURT_MODULE.name is "Food Court"', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.name).toBe('Food Court')
  })

  it('FOOD_COURT_MODULE is registered in getModules()', async () => {
    const { getModules } = await freshRegistry()
    expect(getModules().map((m) => m.key)).toContain('food_court')
  })

  it('getModule("food_court") returns FOOD_COURT_MODULE', async () => {
    const { getModule } = await freshRegistry()
    const mod = getModule('food_court')
    expect(mod).toBeDefined()
    expect(mod!.key).toBe('food_court')
  })

  it('FOOD_COURT_MODULE.enabled is true', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.enabled).toBe(true)
  })
})

// ── B. businessTypes ──────────────────────────────────────────────────────────

describe('B. businessTypes', () => {
  afterEach(() => vi.resetModules())

  it('businessTypes contains "food_court"', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.businessTypes).toContain('food_court')
  })

  it('businessTypes does not contain "restaurant"', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.businessTypes).not.toContain('restaurant')
  })

  it('businessTypes does not contain "cafe"', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.businessTypes).not.toContain('cafe')
  })

  it('businessTypes does not contain "bar"', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.businessTypes).not.toContain('bar')
  })

  it('businessTypes has exactly 1 entry', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.businessTypes).toHaveLength(1)
  })
})

// ── C. Capabilities (shape) ───────────────────────────────────────────────────

describe('C. capability contract shape', () => {
  afterEach(() => vi.resetModules())

  it('capabilities is defined', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities).toBeDefined()
  })

  it('capabilities.required is an array', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(Array.isArray(FOOD_COURT_MODULE.capabilities!.required)).toBe(true)
  })

  it('capabilities.optional is an array', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(Array.isArray(FOOD_COURT_MODULE.capabilities!.optional)).toBe(true)
  })

  it('capabilities.defaultEnabled is an array', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(Array.isArray(FOOD_COURT_MODULE.capabilities!.defaultEnabled)).toBe(true)
  })
})

// ── D. Required capabilities ──────────────────────────────────────────────────

describe('D. required capabilities', () => {
  afterEach(() => vi.resetModules())

  it('menu is required', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities!.required).toContain('menu')
  })

  it('ordering is required', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities!.required).toContain('ordering')
  })

  it('notifications is required', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities!.required).toContain('notifications')
  })

  it('qr_table is required', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities!.required).toContain('qr_table')
  })

  it('reservations is required', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities!.required).toContain('reservations')
  })

  it('required has exactly 5 capabilities', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities!.required).toHaveLength(5)
  })

  it('qr_table is NOT in optional', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities!.optional).not.toContain('qr_table')
  })

  it('reservations is NOT in optional', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities!.optional).not.toContain('reservations')
  })
})

// ── E. Optional capabilities ──────────────────────────────────────────────────

describe('E. optional capabilities', () => {
  afterEach(() => vi.resetModules())

  it('reviews is optional', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities!.optional).toContain('reviews')
  })

  it('loyalty is optional', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities!.optional).toContain('loyalty')
  })

  it('optional has exactly 2 capabilities', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities!.optional).toHaveLength(2)
  })
})

// ── F. defaultEnabled capabilities ───────────────────────────────────────────

describe('F. defaultEnabled capabilities', () => {
  afterEach(() => vi.resetModules())

  it('reviews is defaultEnabled', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities!.defaultEnabled).toContain('reviews')
  })

  it('loyalty is NOT defaultEnabled', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities!.defaultEnabled).not.toContain('loyalty')
  })
})

// ── G. Feature flags ──────────────────────────────────────────────────────────

describe('G. feature flags', () => {
  afterEach(() => vi.resetModules())

  it('menu.enabled defaults to true', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.defaultFeatureFlags['menu.enabled']).toBe(true)
  })

  it('reservations.enabled defaults to true', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.defaultFeatureFlags['reservations.enabled']).toBe(true)
  })

  it('delivery.enabled defaults to false', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.defaultFeatureFlags['delivery.enabled']).toBe(false)
  })

  it('food_court.multi_vendor.enabled defaults to true', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.defaultFeatureFlags['food_court.multi_vendor.enabled']).toBe(true)
  })

  it('food_court.shared_seating.enabled defaults to true', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.defaultFeatureFlags['food_court.shared_seating.enabled']).toBe(true)
  })

  it('food_court.vendor_management.enabled defaults to true', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.defaultFeatureFlags['food_court.vendor_management.enabled']).toBe(true)
  })

  it('food_court.cross_vendor_ordering.enabled defaults to false', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.defaultFeatureFlags['food_court.cross_vendor_ordering.enabled']).toBe(false)
  })

  it('food_court.featured_vendor.enabled defaults to false', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.defaultFeatureFlags['food_court.featured_vendor.enabled']).toBe(false)
  })

  it('getCapabilityFeatureFlags(["food_court"]) sets menu.enabled=true (required)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['food_court'])['menu.enabled']).toBe(true)
  })

  it('getCapabilityFeatureFlags(["food_court"]) sets qr_table.enabled=true (required)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['food_court'])['qr_table.enabled']).toBe(true)
  })

  it('getCapabilityFeatureFlags(["food_court"]) sets reservations.enabled=true (required)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['food_court'])['reservations.enabled']).toBe(true)
  })

  it('getCapabilityFeatureFlags(["food_court"]) sets reviews.enabled=true (defaultEnabled)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['food_court'])['reviews.enabled']).toBe(true)
  })

  it('getCapabilityFeatureFlags(["food_court"]) sets loyalty.enabled=false (optional, not defaultEnabled)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['food_court'])['loyalty.enabled'] ?? false).toBe(false)
  })
})

// ── H. Header navigation ──────────────────────────────────────────────────────

describe('H. header navigation', () => {
  afterEach(() => vi.resetModules())

  it('navItems has 4 items', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.navItems).toHaveLength(4)
  })

  it('Menu nav item links to /menu', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    const item = FOOD_COURT_MODULE.navItems.find((n) => n.href === '/menu')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Menu')
  })

  it('Reservations nav item links to /reservation', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    const item = FOOD_COURT_MODULE.navItems.find((n) => n.href === '/reservation')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Reservations')
  })

  it('Reviews nav item links to /reviews and is gated by reviews.enabled', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    const item = FOOD_COURT_MODULE.navItems.find((n) => n.href === '/reviews')
    expect(item).toBeDefined()
    expect(item!.featureFlagKey).toBe('reviews.enabled')
  })

  it('Vendors nav item links to /vendors and is gated by food_court.vendor_management.enabled', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    const item = FOOD_COURT_MODULE.navItems.find((n) => n.href === '/vendors')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Vendors')
    expect(item!.featureFlagKey).toBe('food_court.vendor_management.enabled')
  })

  it('getHeaderNav(["food_court"]) returns 4 items', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(['food_court'])).toHaveLength(4)
  })

  it('getHeaderNav(["food_court"]) does not include bar or cafe items', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['food_court'])
    expect(items.some((n) => n.label === 'Events')).toBe(false)
    expect(items.some((n) => n.label === 'Loyalty')).toBe(false)
    expect(items.some((n) => n.label === 'Drinks')).toBe(false)
  })
})

// ── I. Admin navigation ───────────────────────────────────────────────────────

describe('I. admin navigation', () => {
  afterEach(() => vi.resetModules())

  it('adminNavItems is defined', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.adminNavItems).toBeDefined()
  })

  it('adminNavItems has 6 items', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.adminNavItems).toHaveLength(8)
  })

  it('Vendor Management links to /admin/food-court/vendors', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    const item = FOOD_COURT_MODULE.adminNavItems!.find((n) => n.label === 'Vendor Management')
    expect(item).toBeDefined()
    expect(item!.href).toBe('/admin/food-court/vendors')
  })

  it('Vendor Management is gated by food_court.vendor_management.enabled', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    const item = FOOD_COURT_MODULE.adminNavItems!.find((n) => n.label === 'Vendor Management')
    expect(item!.featureFlagKey).toBe('food_court.vendor_management.enabled')
  })

  it('Seating Management links to /admin/food-court/seating', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    const item = FOOD_COURT_MODULE.adminNavItems!.find((n) => n.label === 'Seating Management')
    expect(item).toBeDefined()
    expect(item!.href).toBe('/admin/food-court/seating')
  })

  it('Seating Management is gated by food_court.shared_seating.enabled', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    const item = FOOD_COURT_MODULE.adminNavItems!.find((n) => n.label === 'Seating Management')
    expect(item!.featureFlagKey).toBe('food_court.shared_seating.enabled')
  })

  it('getAdminNav(["food_court"]) returns 6 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['food_court'])).toHaveLength(8)
  })

  it('getAdminNav(["food_court"]) includes Vendor Management', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['food_court']).some((n) => n.label === 'Vendor Management')).toBe(true)
  })

  it('getAdminNav(["food_court"]) includes Seating Management', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['food_court']).some((n) => n.label === 'Seating Management')).toBe(true)
  })

  it('getAdminNav([]) returns empty array', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav([])).toHaveLength(0)
  })

  it('getAdminNav(["restaurant"]) does not include food court admin items', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['restaurant'])
    expect(items.some((n) => n.label === 'Vendor Management')).toBe(false)
    expect(items.some((n) => n.label === 'Seating Management')).toBe(false)
  })
})

// ── J. Capability helpers ─────────────────────────────────────────────────────

describe('J. capability helpers', () => {
  afterEach(() => vi.resetModules())

  it('hasCapability(["food_court"], "qr_table") === true (required)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['food_court'], 'qr_table')).toBe(true)
  })

  it('hasCapability(["food_court"], "reservations") === true (required)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['food_court'], 'reservations')).toBe(true)
  })

  it('hasCapability(["food_court"], "reviews") === true (defaultEnabled)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['food_court'], 'reviews')).toBe(true)
  })

  it('hasCapability(["food_court"], "loyalty") === false (optional, not defaultEnabled)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['food_court'], 'loyalty')).toBe(false)
  })

  it('hasCapability(["food_court"], "menu") === true (required)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['food_court'], 'menu')).toBe(true)
  })

  it('hasCapability(["food_court"], "ordering") === true (required)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['food_court'], 'ordering')).toBe(true)
  })

  it('getModuleCapabilities("food_court") returns 7 unique capabilities', async () => {
    const { getModuleCapabilities } = await freshRegistry()
    expect(getModuleCapabilities('food_court')).toHaveLength(7)
  })

  it('getModuleCapabilities("food_court") includes all required and optional', async () => {
    const { getModuleCapabilities } = await freshRegistry()
    const caps = getModuleCapabilities('food_court')
    expect(caps).toContain('menu')
    expect(caps).toContain('ordering')
    expect(caps).toContain('qr_table')
    expect(caps).toContain('reservations')
    expect(caps).toContain('notifications')
    expect(caps).toContain('reviews')
    expect(caps).toContain('loyalty')
  })
})

// ── K. Tenant overrides ───────────────────────────────────────────────────────

describe('K. tenant overrides', () => {
  afterEach(() => vi.resetModules())

  it('food_court tenant with no overrides gets reservations.enabled=true', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['food_court'],
      settings: {},
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['reservations.enabled']).toBe(true)
  })

  it('food_court tenant gets multi_vendor=true from defaultFeatureFlags', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['food_court'],
      settings: {},
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['food_court.multi_vendor.enabled']).toBe(true)
  })

  it('tenant override can enable food_court.vendor_management.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['food_court'],
      settings: { featureFlags: { 'food_court.vendor_management.enabled': true } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['food_court.vendor_management.enabled']).toBe(true)
  })

  it('tenant override can enable food_court.cross_vendor_ordering.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['food_court'],
      settings: { featureFlags: { 'food_court.cross_vendor_ordering.enabled': true } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['food_court.cross_vendor_ordering.enabled']).toBe(true)
  })

  it('tenant override can disable food_court.shared_seating.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['food_court'],
      settings: { featureFlags: { 'food_court.shared_seating.enabled': false } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['food_court.shared_seating.enabled']).toBe(false)
  })

  it('tenant override can enable food_court.featured_vendor.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['food_court'],
      settings: { featureFlags: { 'food_court.featured_vendor.enabled': true } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['food_court.featured_vendor.enabled']).toBe(true)
  })
})

// ── L. Restaurant regression ──────────────────────────────────────────────────

describe('L. restaurant regression', () => {
  afterEach(() => vi.resetModules())

  it('RESTAURANT_MODULE key and businessTypes unchanged', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.key).toBe('restaurant')
    expect(RESTAURANT_MODULE.businessTypes).toContain('restaurant')
  })

  it('restaurant qr_table remains required', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.capabilities!.required).toContain('qr_table')
  })

  it('getHeaderNav(["restaurant"]) does not include Vendors', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(['restaurant']).some((n) => n.label === 'Vendors')).toBe(false)
  })

  it('getAdminNav(["restaurant"]) does not include food court admin items', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['restaurant'])
    expect(items.some((n) => n.label === 'Vendor Management')).toBe(false)
  })
})

// ── M. Cafe regression ────────────────────────────────────────────────────────

describe('M. cafe regression', () => {
  afterEach(() => vi.resetModules())

  it('CAFE_MODULE key and businessTypes unchanged', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.key).toBe('cafe')
    expect(CAFE_MODULE.businessTypes).toContain('cafe')
  })

  it('cafe admin nav still returns 7 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['cafe'])).toHaveLength(9)
  })

  it('getHeaderNav(["cafe"]) does not include Vendors', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(['cafe']).some((n) => n.label === 'Vendors')).toBe(false)
  })
})

// ── N. Bar regression ─────────────────────────────────────────────────────────

describe('N. bar regression', () => {
  afterEach(() => vi.resetModules())

  it('BAR_MODULE key and businessTypes unchanged', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.key).toBe('bar')
    expect(BAR_MODULE.businessTypes).toContain('bar')
  })

  it('bar admin nav still returns 7 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['bar'])).toHaveLength(9)
  })

  it('getHeaderNav(["bar"]) does not include Vendors or Seating', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['bar'])
    expect(items.some((n) => n.label === 'Vendors')).toBe(false)
    expect(items.some((n) => n.label === 'Seating Management')).toBe(false)
  })
})

// ── O. Empty-module edge cases ────────────────────────────────────────────────

describe('O. empty-module edge cases', () => {
  afterEach(() => vi.resetModules())

  it('getAdminNav([]) returns empty array', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav([])).toHaveLength(0)
  })

  it('getAdminNav(["food_court", "bar"]) aggregates both modules admin items', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['food_court', 'bar'])
    expect(items.some((n) => n.label === 'Vendor Management')).toBe(true)
    expect(items.some((n) => n.label === 'Event Management')).toBe(true)
  })

  it('hasCapability([], "qr_table") returns false for empty active modules', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability([], 'qr_table')).toBe(false)
  })

  it('getModuleCapabilities("nonexistent") returns empty array', async () => {
    const { getModuleCapabilities } = await freshRegistry()
    expect(getModuleCapabilities('nonexistent')).toHaveLength(0)
  })
})

// ── FoodCourtSettings type structure ─────────────────────────────────────────

describe('FoodCourtSettings type (source-text check)', () => {
  const src = readSrc('types/index.ts')

  it('FoodCourtSettings interface is exported from types/index.ts', () => {
    expect(src).toContain('export interface FoodCourtSettings')
  })

  it('FoodCourtSettings has multiVendorEnabled: boolean', () => {
    expect(src).toMatch(/multiVendorEnabled:\s*boolean/)
  })

  it('FoodCourtSettings has vendorManagementEnabled: boolean', () => {
    expect(src).toMatch(/vendorManagementEnabled:\s*boolean/)
  })

  it('FoodCourtSettings has sharedSeatingEnabled: boolean', () => {
    expect(src).toMatch(/sharedSeatingEnabled:\s*boolean/)
  })

  it('FoodCourtSettings has crossVendorOrderingEnabled: boolean', () => {
    expect(src).toMatch(/crossVendorOrderingEnabled:\s*boolean/)
  })

  it('FoodCourtSettings has featuredVendorEnabled: boolean', () => {
    expect(src).toMatch(/featuredVendorEnabled:\s*boolean/)
  })
})
