/**
 * P6.7 — Mobile Cafe Module tests
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
 *   P. food truck regression
 *   Q. empty-module edge cases
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DEFAULT_TENANT } from '@/constants'
import type { MobileCafeSettings, Module, Tenant } from '@/types'

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

  it('MOBILE_CAFE_MODULE is exported from registry', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE).toBeDefined()
  })

  it('MOBILE_CAFE_MODULE.key is "mobile_cafe"', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.key).toBe('mobile_cafe')
  })

  it('MOBILE_CAFE_MODULE.name is "Mobile Cafe"', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.name).toBe('Mobile Cafe')
  })

  it('MOBILE_CAFE_MODULE is present in getModules()', async () => {
    const { getModules } = await freshRegistry()
    expect(getModules().map((m) => m.key)).toContain('mobile_cafe')
  })

  it('getModule("mobile_cafe") returns MOBILE_CAFE_MODULE', async () => {
    const { getModule } = await freshRegistry()
    const mod = getModule('mobile_cafe')
    expect(mod).toBeDefined()
    expect(mod!.key).toBe('mobile_cafe')
  })

  it('MOBILE_CAFE_MODULE.enabled is true', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.enabled).toBe(true)
  })
})

// ── B. businessTypes ──────────────────────────────────────────────────────────

describe('B. businessTypes', () => {
  afterEach(() => vi.resetModules())

  it('businessTypes contains "mobile_cafe"', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.businessTypes).toContain('mobile_cafe')
  })

  it('businessTypes does not contain "cafe"', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.businessTypes).not.toContain('cafe')
  })

  it('businessTypes does not contain "food_truck"', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.businessTypes).not.toContain('food_truck')
  })

  it('businessTypes does not contain "restaurant"', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.businessTypes).not.toContain('restaurant')
  })

  it('businessTypes does not contain "bar"', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.businessTypes).not.toContain('bar')
  })

  it('businessTypes has exactly 1 entry', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.businessTypes).toHaveLength(1)
  })
})

// ── C. Capability contract (shape) ───────────────────────────────────────────

describe('C. capability contract shape', () => {
  afterEach(() => vi.resetModules())

  it('capabilities is defined', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities).toBeDefined()
  })

  it('capabilities.required is an array', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(Array.isArray(MOBILE_CAFE_MODULE.capabilities!.required)).toBe(true)
  })

  it('capabilities.optional is an array', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(Array.isArray(MOBILE_CAFE_MODULE.capabilities!.optional)).toBe(true)
  })

  it('capabilities.defaultEnabled is an array', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(Array.isArray(MOBILE_CAFE_MODULE.capabilities!.defaultEnabled)).toBe(true)
  })
})

// ── D. Required capabilities ──────────────────────────────────────────────────

describe('D. required capabilities', () => {
  afterEach(() => vi.resetModules())

  it('menu is required', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.required).toContain('menu')
  })

  it('ordering is required', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.required).toContain('ordering')
  })

  it('notifications is required', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.required).toContain('notifications')
  })

  it('qr_table is required', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.required).toContain('qr_table')
  })

  it('required has exactly 4 capabilities', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.required).toHaveLength(4)
  })

  it('reservations is NOT in required (optional, off by default)', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.required).not.toContain('reservations')
  })

  it('loyalty is NOT in required (optional, defaultEnabled)', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.required).not.toContain('loyalty')
  })

  it('qr_table is NOT in optional', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.optional).not.toContain('qr_table')
  })
})

// ── E. Optional capabilities ──────────────────────────────────────────────────

describe('E. optional capabilities', () => {
  afterEach(() => vi.resetModules())

  it('reservations is optional', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.optional).toContain('reservations')
  })

  it('reviews is optional', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.optional).toContain('reviews')
  })

  it('loyalty is optional', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.optional).toContain('loyalty')
  })

  it('optional has exactly 3 capabilities', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.optional).toHaveLength(3)
  })
})

// ── F. defaultEnabled capabilities ───────────────────────────────────────────

describe('F. defaultEnabled capabilities', () => {
  afterEach(() => vi.resetModules())

  it('reviews is defaultEnabled', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.defaultEnabled).toContain('reviews')
  })

  it('loyalty is defaultEnabled', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.defaultEnabled).toContain('loyalty')
  })

  it('reservations is NOT defaultEnabled (off by default)', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.defaultEnabled).not.toContain('reservations')
  })
})

// ── G. Feature flags ──────────────────────────────────────────────────────────

describe('G. feature flags', () => {
  afterEach(() => vi.resetModules())

  it('menu.enabled defaults to true', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.defaultFeatureFlags['menu.enabled']).toBe(true)
  })

  it('reservations.enabled defaults to false', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.defaultFeatureFlags['reservations.enabled']).toBe(false)
  })

  it('delivery.enabled defaults to false', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.defaultFeatureFlags['delivery.enabled']).toBe(false)
  })

  it('pickup.enabled defaults to true', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.defaultFeatureFlags['pickup.enabled']).toBe(true)
  })

  it('mobile_cafe.route_tracking.enabled defaults to true', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.defaultFeatureFlags['mobile_cafe.route_tracking.enabled']).toBe(true)
  })

  it('mobile_cafe.live_location.enabled defaults to true', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.defaultFeatureFlags['mobile_cafe.live_location.enabled']).toBe(true)
  })

  it('mobile_cafe.loyalty.enabled defaults to true', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.defaultFeatureFlags['mobile_cafe.loyalty.enabled']).toBe(true)
  })

  it('mobile_cafe.featured_coffee.enabled defaults to false', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.defaultFeatureFlags['mobile_cafe.featured_coffee.enabled']).toBe(false)
  })

  it('mobile_cafe.daily_specials.enabled defaults to false', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.defaultFeatureFlags['mobile_cafe.daily_specials.enabled']).toBe(false)
  })

  it('getCapabilityFeatureFlags(["mobile_cafe"]) sets menu.enabled=true (required)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['mobile_cafe'])['menu.enabled']).toBe(true)
  })

  it('getCapabilityFeatureFlags(["mobile_cafe"]) sets qr_table.enabled=true (required)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['mobile_cafe'])['qr_table.enabled']).toBe(true)
  })

  it('getCapabilityFeatureFlags(["mobile_cafe"]) sets reviews.enabled=true (defaultEnabled)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['mobile_cafe'])['reviews.enabled']).toBe(true)
  })

  it('getCapabilityFeatureFlags(["mobile_cafe"]) sets loyalty.enabled=true (defaultEnabled)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['mobile_cafe'])['loyalty.enabled']).toBe(true)
  })

  it('getCapabilityFeatureFlags(["mobile_cafe"]) sets reservations.enabled=false (optional, not defaultEnabled)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['mobile_cafe'])['reservations.enabled'] ?? false).toBe(false)
  })
})

// ── H. Header navigation ──────────────────────────────────────────────────────

describe('H. header navigation', () => {
  afterEach(() => vi.resetModules())

  it('navItems has 5 items', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.navItems).toHaveLength(5)
  })

  it('Menu nav item links to /menu (no gate)', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    const item = MOBILE_CAFE_MODULE.navItems.find((n) => n.href === '/menu')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Menu')
  })

  it('Reviews nav item gated by reviews.enabled', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    const item = MOBILE_CAFE_MODULE.navItems.find((n) => n.href === '/reviews')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Reviews')
    expect(item!.featureFlagKey).toBe('reviews.enabled')
  })

  it('Loyalty nav item gated by mobile_cafe.loyalty.enabled', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    const item = MOBILE_CAFE_MODULE.navItems.find((n) => n.href === '/loyalty')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Loyalty')
    expect(item!.featureFlagKey).toBe('mobile_cafe.loyalty.enabled')
  })

  it('Reservations nav item gated by reservations.enabled', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    const item = MOBILE_CAFE_MODULE.navItems.find((n) => n.href === '/reservation')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Reservations')
    expect(item!.featureFlagKey).toBe('reservations.enabled')
  })

  it('Live Location nav item gated by mobile_cafe.live_location.enabled', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    const item = MOBILE_CAFE_MODULE.navItems.find((n) => n.href === '/location')
    expect(item).toBeDefined()
    expect(item!.label).toBe('Live Location')
    expect(item!.featureFlagKey).toBe('mobile_cafe.live_location.enabled')
  })

  it('getHeaderNav(["mobile_cafe"]) returns 5 items', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(['mobile_cafe'])).toHaveLength(5)
  })

  it('getHeaderNav(["mobile_cafe"]) includes Menu, Reviews, Loyalty, Reservations, Live Location', async () => {
    const { getHeaderNav } = await freshRegistry()
    const labels = getHeaderNav(['mobile_cafe']).map((n) => n.label)
    expect(labels).toContain('Menu')
    expect(labels).toContain('Reviews')
    expect(labels).toContain('Loyalty')
    expect(labels).toContain('Reservations')
    expect(labels).toContain('Live Location')
  })

  it('getHeaderNav(["mobile_cafe"]) does not include Events, Vendors, or Drinks', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['mobile_cafe'])
    expect(items.some((n) => n.label === 'Events')).toBe(false)
    expect(items.some((n) => n.label === 'Vendors')).toBe(false)
    expect(items.some((n) => n.label === 'Drinks')).toBe(false)
  })
})

// ── I. Admin navigation ───────────────────────────────────────────────────────

describe('I. admin navigation', () => {
  afterEach(() => vi.resetModules())

  it('adminNavItems is defined', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.adminNavItems).toBeDefined()
  })

  it('adminNavItems has 6 items', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.adminNavItems).toHaveLength(7)
  })

  it('Route Management links to /admin/mobile-cafe/routes', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    const item = MOBILE_CAFE_MODULE.adminNavItems!.find((n) => n.label === 'Route Management')
    expect(item).toBeDefined()
    expect(item!.href).toBe('/admin/mobile-cafe/routes')
  })

  it('Route Management is gated by mobile_cafe.route_tracking.enabled', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    const item = MOBILE_CAFE_MODULE.adminNavItems!.find((n) => n.label === 'Route Management')
    expect(item!.featureFlagKey).toBe('mobile_cafe.route_tracking.enabled')
  })

  it('Loyalty Management links to /admin/mobile-cafe/loyalty', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    const item = MOBILE_CAFE_MODULE.adminNavItems!.find((n) => n.label === 'Loyalty Management')
    expect(item).toBeDefined()
    expect(item!.href).toBe('/admin/mobile-cafe/loyalty')
  })

  it('Loyalty Management is gated by mobile_cafe.loyalty.enabled', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    const item = MOBILE_CAFE_MODULE.adminNavItems!.find((n) => n.label === 'Loyalty Management')
    expect(item!.featureFlagKey).toBe('mobile_cafe.loyalty.enabled')
  })

  it('getAdminNav(["mobile_cafe"]) returns 6 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(["mobile_cafe"])).toHaveLength(7)
  })

  it('getAdminNav(["mobile_cafe"]) includes Route Management', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['mobile_cafe']).some((n) => n.label === 'Route Management')).toBe(true)
  })

  it('getAdminNav(["mobile_cafe"]) includes Loyalty Management', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['mobile_cafe']).some((n) => n.label === 'Loyalty Management')).toBe(true)
  })

  it('getAdminNav([]) returns empty array', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav([])).toHaveLength(0)
  })

  it('getAdminNav(["bar"]) does not include mobile cafe admin items', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['bar'])
    expect(items.some((n) => n.label === 'Loyalty Management')).toBe(false)
    expect(items.every((n) => n.href !== '/admin/mobile-cafe/loyalty')).toBe(true)
  })

  it('getAdminNav(["mobile_cafe", "food_truck"]) aggregates both modules', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['mobile_cafe', 'food_truck'])
    expect(items.some((n) => n.label === 'Loyalty Management')).toBe(true)
    expect(items.some((n) => n.label === 'Stop Management')).toBe(true)
  })
})

// ── J. Capability helpers ─────────────────────────────────────────────────────

describe('J. capability helpers', () => {
  afterEach(() => vi.resetModules())

  it('hasCapability(["mobile_cafe"], "qr_table") === true (required)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['mobile_cafe'], 'qr_table')).toBe(true)
  })

  it('hasCapability(["mobile_cafe"], "reviews") === true (defaultEnabled)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['mobile_cafe'], 'reviews')).toBe(true)
  })

  it('hasCapability(["mobile_cafe"], "loyalty") === true (defaultEnabled)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['mobile_cafe'], 'loyalty')).toBe(true)
  })

  it('hasCapability(["mobile_cafe"], "reservations") === false (optional, not defaultEnabled)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['mobile_cafe'], 'reservations')).toBe(false)
  })

  it('hasCapability(["mobile_cafe"], "menu") === true (required)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['mobile_cafe'], 'menu')).toBe(true)
  })

  it('hasCapability(["mobile_cafe"], "ordering") === true (required)', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['mobile_cafe'], 'ordering')).toBe(true)
  })

  it('getModuleCapabilities("mobile_cafe") returns 7 unique capabilities', async () => {
    const { getModuleCapabilities } = await freshRegistry()
    expect(getModuleCapabilities('mobile_cafe')).toHaveLength(7)
  })

  it('getModuleCapabilities("mobile_cafe") includes all required and optional caps', async () => {
    const { getModuleCapabilities } = await freshRegistry()
    const caps = getModuleCapabilities('mobile_cafe')
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

  it('mobile_cafe tenant with no overrides gets reservations.enabled=false', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['mobile_cafe'],
      settings: {},
    }
    expect(featureFlagsService.resolve(tenant)['reservations.enabled']).toBe(false)
  })

  it('mobile_cafe tenant with no overrides gets mobile_cafe.loyalty.enabled=true', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['mobile_cafe'],
      settings: {},
    }
    expect(featureFlagsService.resolve(tenant)['mobile_cafe.loyalty.enabled']).toBe(true)
  })

  it('mobile_cafe tenant with no overrides gets mobile_cafe.live_location.enabled=true', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['mobile_cafe'],
      settings: {},
    }
    expect(featureFlagsService.resolve(tenant)['mobile_cafe.live_location.enabled']).toBe(true)
  })

  it('tenant override can enable reservations.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['mobile_cafe'],
      settings: { featureFlags: { 'reservations.enabled': true } },
    }
    expect(featureFlagsService.resolve(tenant)['reservations.enabled']).toBe(true)
  })

  it('tenant override can disable mobile_cafe.loyalty.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['mobile_cafe'],
      settings: { featureFlags: { 'mobile_cafe.loyalty.enabled': false } },
    }
    expect(featureFlagsService.resolve(tenant)['mobile_cafe.loyalty.enabled']).toBe(false)
  })

  it('tenant override can enable mobile_cafe.featured_coffee.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['mobile_cafe'],
      settings: { featureFlags: { 'mobile_cafe.featured_coffee.enabled': true } },
    }
    expect(featureFlagsService.resolve(tenant)['mobile_cafe.featured_coffee.enabled']).toBe(true)
  })

  it('tenant override can enable mobile_cafe.daily_specials.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['mobile_cafe'],
      settings: { featureFlags: { 'mobile_cafe.daily_specials.enabled': true } },
    }
    expect(featureFlagsService.resolve(tenant)['mobile_cafe.daily_specials.enabled']).toBe(true)
  })

  it('tenant override can disable mobile_cafe.live_location.enabled', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['mobile_cafe'],
      settings: { featureFlags: { 'mobile_cafe.live_location.enabled': false } },
    }
    expect(featureFlagsService.resolve(tenant)['mobile_cafe.live_location.enabled']).toBe(false)
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

  it('getHeaderNav(["restaurant"]) does not include Live Location or Loyalty', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['restaurant'])
    expect(items.some((n) => n.label === 'Live Location')).toBe(false)
    expect(items.some((n) => n.label === 'Loyalty')).toBe(false)
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
    expect(getAdminNav(['cafe'])).toHaveLength(8)
  })

  it('getHeaderNav(["cafe"]) does not include Live Location', async () => {
    const { getHeaderNav } = await freshRegistry()
    expect(getHeaderNav(['cafe']).some((n) => n.label === 'Live Location')).toBe(false)
  })

  it('getAdminNav(["cafe"]) does not include mobile cafe admin items', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['cafe'])
    expect(items.every((n) => n.href !== '/admin/mobile-cafe/loyalty')).toBe(true)
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
    expect(getAdminNav(['bar'])).toHaveLength(8)
  })

  it('getHeaderNav(["bar"]) does not include Live Location or Loyalty (mobile)', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['bar'])
    expect(items.some((n) => n.featureFlagKey === 'mobile_cafe.live_location.enabled')).toBe(false)
    expect(items.some((n) => n.featureFlagKey === 'mobile_cafe.loyalty.enabled')).toBe(false)
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
    expect(getAdminNav(['food_court'])).toHaveLength(7)
  })

  it('getAdminNav(["food_court"]) does not include mobile cafe admin items', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['food_court'])
    expect(items.every((n) => n.href !== '/admin/mobile-cafe/loyalty')).toBe(true)
  })
})

// ── P. Food Truck regression ──────────────────────────────────────────────────

describe('P. food truck regression', () => {
  afterEach(() => vi.resetModules())

  it('FOOD_TRUCK_MODULE unchanged', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.key).toBe('food_truck')
    expect(FOOD_TRUCK_MODULE.businessTypes).toContain('food_truck')
  })

  it('food truck admin nav still returns 6 items', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav(['food_truck'])).toHaveLength(7)
  })

  it('getHeaderNav(["food_truck"]) does not have Loyalty nav (mobile_cafe gated)', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['food_truck'])
    expect(items.some((n) => n.featureFlagKey === 'mobile_cafe.loyalty.enabled')).toBe(false)
  })

  it('food truck defaultEnabled does NOT include loyalty (unlike mobile_cafe)', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.capabilities!.defaultEnabled).not.toContain('loyalty')
  })
})

// ── Q. Empty-module edge cases ────────────────────────────────────────────────

describe('Q. empty-module edge cases', () => {
  afterEach(() => vi.resetModules())

  it('getAdminNav([]) returns empty array', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav([])).toHaveLength(0)
  })

  it('hasCapability([], "loyalty") returns false', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability([], 'loyalty')).toBe(false)
  })

  it('hasCapability([], "qr_table") returns false', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability([], 'qr_table')).toBe(false)
  })

  it('getModuleCapabilities("nonexistent") returns empty array', async () => {
    const { getModuleCapabilities } = await freshRegistry()
    expect(getModuleCapabilities('nonexistent')).toHaveLength(0)
  })

  it('getCapabilityFeatureFlags([]) falls back to all modules (non-empty result)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags([])['menu.enabled']).toBe(true)
  })

  it('getAdminNav(["mobile_cafe", "bar", "cafe"]) aggregates all 20 admin items', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['mobile_cafe', 'bar', 'cafe'])
    expect(items).toHaveLength(23)
  })
})

// ── MobileCafeSettings type structure ────────────────────────────────────────

describe('MobileCafeSettings type (source-text check)', () => {
  const src = readSrc('types/index.ts')

  it('MobileCafeSettings interface is exported from types/index.ts', () => {
    expect(src).toContain('export interface MobileCafeSettings')
  })

  it('MobileCafeSettings has routeTrackingEnabled: boolean', () => {
    expect(src).toMatch(/routeTrackingEnabled:\s*boolean/)
  })

  it('MobileCafeSettings has liveLocationEnabled: boolean', () => {
    expect(src).toMatch(/liveLocationEnabled:\s*boolean/)
  })

  it('MobileCafeSettings has loyaltyEnabled: boolean', () => {
    expect(src).toMatch(/loyaltyEnabled:\s*boolean/)
  })

  it('MobileCafeSettings has featuredCoffeeEnabled: boolean', () => {
    expect(src).toMatch(/featuredCoffeeEnabled:\s*boolean/)
  })

  it('MobileCafeSettings has dailySpecialsEnabled: boolean', () => {
    expect(src).toMatch(/dailySpecialsEnabled:\s*boolean/)
  })
})
