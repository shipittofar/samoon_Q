/**
 * P6.6 — Food Truck Module tests
 *
 * Covers:
 *   A. Module registration
 *   B. businessTypes
 *   C. capability contract (shape)
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
 *   O. food court regression
 *   P. empty-module edge cases
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DEFAULT_TENANT } from '@/constants'
import type { FoodTruckSettings, Module, Tenant } from '@/types'

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

  it('FOOD_TRUCK_MODULE is exported from registry', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE).toBeDefined()
  })

  it('FOOD_TRUCK_MODULE.key is "food_truck"', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.key).toBe('food_truck')
  })

  it('FOOD_TRUCK_MODULE.name is "Food Truck"', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.name).toBe('Food Truck')
  })

  it('FOOD_TRUCK_MODULE is present in getModules()', async () => {
    const { getModules } = await freshRegistry()
    expect(getModules().map((m) => m.key)).toContain('food_truck')
  })

  it('getModule("food_truck") returns FOOD_TRUCK_MODULE', async () => {
    const { getModule } = await freshRegistry()
    const mod = getModule('food_truck')
    expect(mod).toBeDefined()
    expect(mod!.key).toBe('food_truck')
  })

  it('FOOD_TRUCK_MODULE.enabled is true', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.enabled).toBe(true)
  })
})

// ── B. businessTypes ──────────────────────────────────────────────────────────

describe('B. businessTypes', () => {
  afterEach(() => vi.resetModules())

  it('businessTypes contains "food_truck"', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.businessTypes).toContain('food_truck')
  })

  it('businessTypes does not contain "restaurant"', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.businessTypes).not.toContain('restaurant')
  })

  it('businessTypes does not contain "cafe"', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.businessTypes).not.toContain('cafe')
  })

  it('businessTypes does not contain "bar"', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.businessTypes).not.toContain('bar')
  })

  it('businessTypes does not contain "food_court"', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.businessTypes).not.toContain('food_court')
  })

  it('businessTypes has exactly 1 entry', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.businessTypes).toHaveLength(1)
  })
})

// ── C. Capability contract (shape) ───────────────────────────────────────────

describe('C. capability contract shape', () => {
  afterEach(() => vi.resetModules())

  it('capabilities is defined', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities).toBeDefined()
  })

  it('capabilities.required is an array', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(Array.isArray(FOOD_TRUCK_MODULE.capabilities!.required)).toBe(true)
  })

  it('capabilities.optional is an array', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(Array.isArray(FOOD_TRUCK_MODULE.capabilities!.optional)).toBe(true)
  })

  it('capabilities.defaultEnabled is an array', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(Array.isArray(FOOD_TRUCK_MODULE.capabilities!.defaultEnabled)).toBe(true)
  })
})

// ── D. Required capabilities ──────────────────────────────────────────────────

describe('D. required capabilities', () => {
  afterEach(() => vi.resetModules())

  it('menu is required', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.required).toContain('menu')
  })

  it('ordering is required', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.required).toContain('ordering')
  })

  it('notifications is required', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.required).toContain('notifications')
  })

  it('qr_table is required', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.required).toContain('qr_table')
  })

  it('required has exactly 4 capabilities', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.required).toHaveLength(4)
  })

  it('reservations is NOT in required (it is optional, off by default)', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.required).not.toContain('reservations')
  })

  it('qr_table is NOT in optional', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.optional).not.toContain('qr_table')
  })
})

// ── E. Optional capabilities ──────────────────────────────────────────────────

describe('E. optional capabilities', () => {
  afterEach(() => vi.resetModules())

  it('reservations is optional', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.optional).toContain('reservations')
  })

  it('reviews is optional', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.optional).toContain('reviews')
  })

  it('loyalty is optional', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.optional).toContain('loyalty')
  })

  it('optional has exactly 3 capabilities', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.optional).toHaveLength(3)
  })
})

// ── F. defaultEnabled capabilities ───────────────────────────────────────────

describe('F. defaultEnabled capabilities', () => {
  afterEach(() => vi.resetModules())

  it('reviews is defaultEnabled', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.defaultEnabled).toContain('reviews')
  })

  it('reservations is NOT defaultEnabled (off by default)', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.defaultEnabled).not.toContain('reservations')
  })

  it('loyalty is NOT defaultEnabled', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.defaultEnabled).not.toContain('loyalty')
  })
})

// ── G. Feature flags ──────────────────────────────────────────────────────────

describe('G. feature flags', () => {
  afterEach(() => vi.resetModules())

  it('menu.enabled defaults to true', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.defaultFeatureFlags['menu.enabled']).toBe(true)
  })

  it('reservations.enabled defaults to false', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.defaultFeatureFlags['reservations.enabled']).toBe(false)
  })

  it('delivery.enabled defaults to false', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.defaultFeatureFlags['delivery.enabled']).toBe(false)
  })

  it('pickup.enabled defaults to true', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.defaultFeatureFlags['pickup.enabled']).toBe(true)
  })

  it('food_truck.route_tracking.enabled defaults to true', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.defaultFeatureFlags['food_truck.route_tracking.enabled']).toBe(true)
  })

  it('food_truck.live_location.enabled defaults to true', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.defaultFeatureFlags['food_truck.live_location.enabled']).toBe(true)
  })

  it('food_truck.scheduled_stops.enabled defaults to false', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.defaultFeatureFlags['food_truck.scheduled_stops.enabled']).toBe(false)
  })

  it('food_truck.pre_order.enabled defaults to false', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.defaultFeatureFlags['food_truck.pre_order.enabled']).toBe(false)
  })

  it('food_truck.featured_route.enabled defaults to false', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.defaultFeatureFlags['food_truck.featured_route.enabled']).toBe(false)
  })

  it('getCapabilityFeatureFlags(["food_truck"]) sets menu.enabled=true (required)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['food_truck'])['menu.enabled']).toBe(true)
  })

  it('getCapabilityFeatureFlags(["food_truck"]) sets qr_table.enabled=true (required)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['food_truck'])['qr_table.enabled']).toBe(true)
  })

  it('getCapabilityFeatureFlags(["food_truck"]) sets reviews.enabled=true (defaultEnabled)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['food_truck'])['reviews.enabled']).toBe(true)
  })

  it('getCapabilityFeatureFlags(["food_truck"]) sets reservations.enabled=false (optional, not defaultEnabled)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['food_truck'])['reservations.enabled'] ?? false).toBe(false)
  })

  it('getCapabilityFeatureFlags(["food_truck"]) sets loyalty.enabled=false (optional, not defaultEnabled)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['food_truck'])['loyalty.enabled'] ?? false).toBe(false)
  })
})

// ── H. Header navigation ──────────────────────────────────────────────────────

describe('H. header navigation', () => {
  afterEach(() => vi.resetModules())

  it('navItems has 4 items', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.navItems).toHaveLength(4)
  })

  it('Menu nav item links to /menu (no gate)', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    const item = FOOD_TRUCK_MODULE.navItems.find((n) => n.href === '/menu')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Menu')
  })

  it('Reviews nav item links to /reviews gated by reviews.enabled', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    const item = FOOD_TRUCK_MODULE.navItems.find((n) => n.href === '/reviews')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Reviews')
    expect(item!.featureFlagKey).toBe('reviews.enabled')
  })

  it('Reservations nav item links to /reservation gated by reservations.enabled', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    const item = FOOD_TRUCK_MODULE.navItems.find((n) => n.href === '/reservation')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Reservations')
    expect(item!.featureFlagKey).toBe('reservations.enabled')
  })

  it('Live Location nav item links to /location gated by food_truck.live_location.enabled', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    const item = FOOD_TRUCK_MODULE.navItems.find((n) => n.href === '/location')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Live Location')
    expect(item!.featureFlagKey).toBe('food_truck.live_location.enabled')
  })

  it('getHeaderNav(["food_truck"]) returns 4 items', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(['food_truck'])).toHaveLength(4)
  })

  it('getHeaderNav(["food_truck"]) includes Menu', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(['food_truck']).some((n) => n.label === 'Menu')).toBe(true)
  })

  it('getHeaderNav(["food_truck"]) includes Live Location', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(['food_truck']).some((n) => n.label === 'Live Location')).toBe(true)
  })

  it('getHeaderNav(["food_truck"]) does not include Events or Vendors', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['food_truck'])
    expect(items.some((n) => n.label === 'Events')).toBe(false)
    expect(items.some((n) => n.label === 'Vendors')).toBe(false)
  })

  it('getHeaderNav(["food_truck"]) does not include Loyalty or Drinks', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['food_truck'])
    expect(items.some((n) => n.label === 'Loyalty')).toBe(false)
    expect(items.some((n) => n.label === 'Drinks')).toBe(false)
  })
})

// ── I. Admin navigation ───────────────────────────────────────────────────────

describe('I. admin navigation', () => {
  afterEach(() => vi.resetModules())

  it('adminNavItems is defined', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.adminNavItems).toBeDefined()
  })

  it('adminNavItems has 6 items', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.adminNavItems).toHaveLength(24)
  })

  it('Route Management links to /console/food-truck/routes', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    const item = FOOD_TRUCK_MODULE.adminNavItems!.find((n) => n.label === 'Route Management')
    expect(item).toBeDefined()
    expect(item!.href).toBe('/console/food-truck/routes')
  })

  it('Route Management is gated by food_truck.route_tracking.enabled', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    const item = FOOD_TRUCK_MODULE.adminNavItems!.find((n) => n.label === 'Route Management')
    expect(item!.featureFlagKey).toBe('food_truck.route_tracking.enabled')
  })

  it('Stop Management links to /console/food-truck/stops', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    const item = FOOD_TRUCK_MODULE.adminNavItems!.find((n) => n.label === 'Stop Management')
    expect(item).toBeDefined()
    expect(item!.href).toBe('/console/food-truck/stops')
  })

  it('Stop Management is gated by food_truck.scheduled_stops.enabled', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    const item = FOOD_TRUCK_MODULE.adminNavItems!.find((n) => n.label === 'Stop Management')
    expect(item!.featureFlagKey).toBe('food_truck.scheduled_stops.enabled')
  })

  it('getAdminNav(["food_truck"]) returns 6 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['food_truck'])).toHaveLength(24)
  })

  it('getAdminNav(["food_truck"]) includes Route Management', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['food_truck']).some((n) => n.label === 'Route Management')).toBe(true)
  })

  it('getAdminNav(["food_truck"]) includes Stop Management', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['food_truck']).some((n) => n.label === 'Stop Management')).toBe(true)
  })

  it('getAdminNav([]) returns empty array', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav([])).toHaveLength(0)
  })

  it('getAdminNav(["bar"]) does not include food truck admin items', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['bar'])
    expect(items.some((n) => n.label === 'Route Management')).toBe(false)
    expect(items.some((n) => n.label === 'Stop Management')).toBe(false)
  })
})

// ── J. Capability helpers ─────────────────────────────────────────────────────

describe('J. capability helpers', () => {
  afterEach(() => vi.resetModules())

  it('hasCapability(["food_truck"], "qr_table") === true (required)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['food_truck'], 'qr_table')).toBe(true)
  })

  it('hasCapability(["food_truck"], "reviews") === true (defaultEnabled)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['food_truck'], 'reviews')).toBe(true)
  })

  it('hasCapability(["food_truck"], "reservations") === false (optional, not defaultEnabled)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['food_truck'], 'reservations')).toBe(false)
  })

  it('hasCapability(["food_truck"], "loyalty") === false (optional, not defaultEnabled)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['food_truck'], 'loyalty')).toBe(false)
  })

  it('hasCapability(["food_truck"], "menu") === true (required)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['food_truck'], 'menu')).toBe(true)
  })

  it('hasCapability(["food_truck"], "ordering") === true (required)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['food_truck'], 'ordering')).toBe(true)
  })

  it('getModuleCapabilities("food_truck") returns 7 unique capabilities', async () => {
    const { getModuleCapabilities } = await freshRegistry()
    expect(getModuleCapabilities('food_truck')).toHaveLength(7)
  })

  it('getModuleCapabilities("food_truck") includes all required and optional caps', async () => {
    const { getModuleCapabilities } = await freshRegistry()
    const caps = getModuleCapabilities('food_truck')
    expect(caps).toContain('menu')
    expect(caps).toContain('ordering')
    expect(caps).toContain('qr_table')
    expect(caps).toContain('notifications')
    expect(caps).toContain('reservations')
    expect(caps).toContain('reviews')
    expect(caps).toContain('loyalty')
  })
})

// ── K. Tenant overrides ───────────────────────────────────────────────────────

describe('K. tenant overrides', () => {
  afterEach(() => vi.resetModules())

  it('food_truck tenant with no overrides gets reservations.enabled=false', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['food_truck'],
      settings: {},
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['reservations.enabled']).toBe(false)
  })

  it('food_truck tenant with no overrides gets food_truck.live_location.enabled=true', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['food_truck'],
      settings: {},
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['food_truck.live_location.enabled']).toBe(true)
  })

  it('tenant override can enable reservations.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['food_truck'],
      settings: { featureFlags: { 'reservations.enabled': true } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['reservations.enabled']).toBe(true)
  })

  it('tenant override can enable food_truck.scheduled_stops.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['food_truck'],
      settings: { featureFlags: { 'food_truck.scheduled_stops.enabled': true } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['food_truck.scheduled_stops.enabled']).toBe(true)
  })

  it('tenant override can enable food_truck.pre_order.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['food_truck'],
      settings: { featureFlags: { 'food_truck.pre_order.enabled': true } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['food_truck.pre_order.enabled']).toBe(true)
  })

  it('tenant override can disable food_truck.live_location.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['food_truck'],
      settings: { featureFlags: { 'food_truck.live_location.enabled': false } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['food_truck.live_location.enabled']).toBe(false)
  })

  it('tenant override can enable food_truck.featured_route.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['food_truck'],
      settings: { featureFlags: { 'food_truck.featured_route.enabled': true } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['food_truck.featured_route.enabled']).toBe(true)
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

  it('getHeaderNav(["restaurant"]) does not include Live Location', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(['restaurant']).some((n) => n.label === 'Live Location')).toBe(false)
  })

  it('getAdminNav(["restaurant"]) does not include Route Management', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['restaurant']).some((n) => n.label === 'Route Management')).toBe(false)
  })
})

// ── M. Cafe regression ────────────────────────────────────────────────────────

describe('M. cafe regression', () => {
  afterEach(() => vi.resetModules())

  it('CAFE_MODULE unchanged', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.key).toBe('cafe')
    expect(CAFE_MODULE.businessTypes).toContain('cafe')
  })

  it('cafe admin nav still returns 7 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['cafe'])).toHaveLength(25)
  })

  it('getHeaderNav(["cafe"]) does not include Live Location', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(['cafe']).some((n) => n.label === 'Live Location')).toBe(false)
  })
})

// ── N. Bar regression ─────────────────────────────────────────────────────────

describe('N. bar regression', () => {
  afterEach(() => vi.resetModules())

  it('BAR_MODULE unchanged', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.key).toBe('bar')
    expect(BAR_MODULE.businessTypes).toContain('bar')
  })

  it('bar admin nav still returns 7 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['bar'])).toHaveLength(26)
  })

  it('getHeaderNav(["bar"]) does not include Live Location or Stop Management', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['bar'])
    expect(items.some((n) => n.label === 'Live Location')).toBe(false)
    expect(items.some((n) => n.label === 'Stop Management')).toBe(false)
  })
})

// ── O. Food Court regression ──────────────────────────────────────────────────

describe('O. food court regression', () => {
  afterEach(() => vi.resetModules())

  it('FOOD_COURT_MODULE unchanged', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.key).toBe('food_court')
    expect(FOOD_COURT_MODULE.businessTypes).toContain('food_court')
  })

  it('food court admin nav still returns 6 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['food_court'])).toHaveLength(25)
  })

  it('getHeaderNav(["food_court"]) does not include Live Location', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(['food_court']).some((n) => n.label === 'Live Location')).toBe(false)
  })

  it('getAdminNav(["food_court"]) does not include Route Management', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['food_court']).some((n) => n.label === 'Route Management')).toBe(false)
  })
})

// ── P. Empty-module edge cases ────────────────────────────────────────────────

describe('P. empty-module edge cases', () => {
  afterEach(() => vi.resetModules())

  it('getAdminNav([]) returns empty array', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav([])).toHaveLength(0)
  })

  it('hasCapability([], "qr_table") returns false', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability([], 'qr_table')).toBe(false)
  })

  it('getModuleCapabilities("nonexistent") returns empty array', async () => {
    const { getModuleCapabilities } = await freshRegistry()
    expect(getModuleCapabilities('nonexistent')).toHaveLength(0)
  })

  it('getAdminNav(["food_truck", "food_court"]) aggregates both modules admin items', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['food_truck', 'food_court'])
    expect(items.some((n) => n.label === 'Route Management')).toBe(true)
    expect(items.some((n) => n.label === 'Vendor Management')).toBe(true)
  })
})

// ── FoodTruckSettings type structure ──────────────────────────────────────────

describe('FoodTruckSettings type (source-text check)', () => {
  const src = readSrc('types/index.ts')

  it('FoodTruckSettings interface is exported from types/index.ts', () => {
    expect(src).toContain('export interface FoodTruckSettings')
  })

  it('FoodTruckSettings has routeTrackingEnabled: boolean', () => {
    expect(src).toMatch(/routeTrackingEnabled:\s*boolean/)
  })

  it('FoodTruckSettings has liveLocationEnabled: boolean', () => {
    expect(src).toMatch(/liveLocationEnabled:\s*boolean/)
  })

  it('FoodTruckSettings has scheduledStopsEnabled: boolean', () => {
    expect(src).toMatch(/scheduledStopsEnabled:\s*boolean/)
  })

  it('FoodTruckSettings has preOrderEnabled: boolean', () => {
    expect(src).toMatch(/preOrderEnabled:\s*boolean/)
  })

  it('FoodTruckSettings has featuredRouteEnabled: boolean', () => {
    expect(src).toMatch(/featuredRouteEnabled:\s*boolean/)
  })
})
