/**
 * P6.2 — Multi-Business Foundation: Capability Architecture tests
 *
 * Covers:
 *   - Capability type and ModuleCapabilitySet interface (source-structure)
 *   - CAPABILITY_FLAG_MAP completeness
 *   - All six business-type module constants exported
 *   - getModuleCapabilities() registry method
 *   - hasCapability() registry method
 *   - getCapabilityFeatureFlags() registry method
 *   - featureFlagsService three-layer merge with capabilities as layer 2
 *   - Tenant capability override via settings.featureFlags
 *   - BusinessType and LocationType union extensions
 *   - Backward compatibility: restaurant module, existing tests, legacy modules
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DEFAULT_TENANT } from '@/constants'
import type { Capability, Module, Tenant } from '@/types'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

/** Fresh module scope so registry seal state doesn't bleed between tests. */
async function freshRegistry() {
  vi.resetModules()
  return import('@/modules/registry')
}

// ── Source-structure: types/index.ts ─────────────────────────────────────────

describe('types/index.ts — Capability type (P6.2)', () => {
  const src = () => readSrc('types/index.ts')

  it('exports Capability type', () => expect(src()).toContain("export type Capability ="))
  it('Capability includes menu',          () => expect(src()).toContain("'menu'"))
  it('Capability includes ordering',      () => expect(src()).toContain("'ordering'"))
  it('Capability includes qr_table',      () => expect(src()).toContain("'qr_table'"))
  it('Capability includes reservations',  () => expect(src()).toContain("'reservations'"))
  it('Capability includes reviews',       () => expect(src()).toContain("'reviews'"))
  it('Capability includes loyalty',       () => expect(src()).toContain("'loyalty'"))
  it('Capability includes notifications', () => expect(src()).toContain("'notifications'"))
})

describe('types/index.ts — ModuleCapabilitySet interface (P6.2)', () => {
  const src = () => readSrc('types/index.ts')

  it('exports ModuleCapabilitySet',          () => expect(src()).toContain('ModuleCapabilitySet'))
  it('has required field',                   () => expect(src()).toContain('required'))
  it('has optional field',                   () => expect(src()).toContain('optional'))
  it('has defaultEnabled field',             () => expect(src()).toContain('defaultEnabled'))
  it('Module interface has capabilities field', () => {
    expect(src()).toContain('capabilities?: ModuleCapabilitySet')
  })
})

describe('types/index.ts — BusinessType extended (P6.2)', () => {
  const src = () => readSrc('types/index.ts')

  it('includes food_court',  () => expect(src()).toContain("'food_court'"))
  it('includes food_truck',  () => expect(src()).toContain("'food_truck'"))
  it('includes mobile_cafe', () => expect(src()).toContain("'mobile_cafe'"))
  it('still includes restaurant', () => expect(src()).toContain("'restaurant'"))
  it('still includes cafe',  () => expect(src()).toContain("'cafe'"))
  it('still includes bar',   () => expect(src()).toContain("'bar'"))
})

describe('types/index.ts — LocationType extended (P6.2)', () => {
  const src = () => readSrc('types/index.ts')

  it('includes mobile_cafe LocationType', () => {
    expect(src()).toContain("| 'mobile_cafe'")
  })
  it('still includes all original LocationType values', () => {
    expect(src()).toContain("'restaurant_branch'")
    expect(src()).toContain("'food_court_stall'")
    expect(src()).toContain("'mobile_truck'")
  })
})

// ── Source-structure: registry.ts ─────────────────────────────────────────────

describe('registry.ts — CAPABILITY_FLAG_MAP (P6.2)', () => {
  const src = () => readSrc('modules/registry.ts')

  it('exports CAPABILITY_FLAG_MAP', () => expect(src()).toContain('CAPABILITY_FLAG_MAP'))
  it('maps menu to menu.enabled',               () => expect(src()).toContain("'menu.enabled'"))
  it('maps ordering to ordering.enabled',       () => expect(src()).toContain("'ordering.enabled'"))
  it('maps qr_table to qr_table.enabled',       () => expect(src()).toContain("'qr_table.enabled'"))
  it('maps reservations to reservations.enabled', () => expect(src()).toContain("'reservations.enabled'"))
  it('maps reviews to reviews.enabled',         () => expect(src()).toContain("'reviews.enabled'"))
  it('maps loyalty to loyalty.enabled',         () => expect(src()).toContain("'loyalty.enabled'"))
  it('maps notifications to notifications.enabled', () => expect(src()).toContain("'notifications.enabled'"))
})

describe('registry.ts — new module exports (P6.2)', () => {
  const src = () => readSrc('modules/registry.ts')

  it('exports CAFE_MODULE',        () => expect(src()).toContain('export const CAFE_MODULE'))
  it('exports BAR_MODULE',         () => expect(src()).toContain('export const BAR_MODULE'))
  it('exports FOOD_COURT_MODULE',  () => expect(src()).toContain('export const FOOD_COURT_MODULE'))
  it('exports FOOD_TRUCK_MODULE',  () => expect(src()).toContain('export const FOOD_TRUCK_MODULE'))
  it('exports MOBILE_CAFE_MODULE', () => expect(src()).toContain('export const MOBILE_CAFE_MODULE'))
  it('exports getModuleCapabilities',    () => expect(src()).toContain('export function getModuleCapabilities'))
  it('exports hasCapability',            () => expect(src()).toContain('export function hasCapability'))
  it('exports getCapabilityFeatureFlags',() => expect(src()).toContain('export function getCapabilityFeatureFlags'))
})

// ── Runtime: CAPABILITY_FLAG_MAP ─────────────────────────────────────────────

describe('CAPABILITY_FLAG_MAP — completeness', () => {
  afterEach(() => vi.resetModules())

  it('has an entry for every Capability value', async () => {
    const { CAPABILITY_FLAG_MAP } = await import('@/modules/registry')
    const caps: Capability[] = ['menu', 'ordering', 'qr_table', 'reservations', 'reviews', 'loyalty', 'notifications']
    caps.forEach((c) => {
      expect(CAPABILITY_FLAG_MAP[c]).toMatch(/\.enabled$/)
    })
  })

  it('all flag keys are unique', async () => {
    const { CAPABILITY_FLAG_MAP } = await import('@/modules/registry')
    const values = Object.values(CAPABILITY_FLAG_MAP)
    expect(new Set(values).size).toBe(values.length)
  })
})

// ── Runtime: RESTAURANT_MODULE capabilities ───────────────────────────────────

describe('RESTAURANT_MODULE — capability contract', () => {
  afterEach(() => vi.resetModules())

  it('has capabilities field', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.capabilities).toBeDefined()
  })

  it('menu is required', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.capabilities!.required).toContain('menu')
  })

  it('ordering is required', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.capabilities!.required).toContain('ordering')
  })

  it('notifications is required', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.capabilities!.required).toContain('notifications')
  })

  it('qr_table is in optional', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.capabilities!.optional).toContain('qr_table')
  })

  it('reservations is in optional', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.capabilities!.optional).toContain('reservations')
  })

  it('qr_table is defaultEnabled', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.capabilities!.defaultEnabled).toContain('qr_table')
  })

  it('reservations is defaultEnabled', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.capabilities!.defaultEnabled).toContain('reservations')
  })

  it('reviews is defaultEnabled', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.capabilities!.defaultEnabled).toContain('reviews')
  })

  it('businessTypes is exactly [restaurant]', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.businessTypes).toEqual(['restaurant'])
  })
})

// ── Runtime: stub module capability contracts ─────────────────────────────────

describe('CAFE_MODULE — capability contract', () => {
  afterEach(() => vi.resetModules())

  it('key is cafe', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.key).toBe('cafe')
  })

  it('businessTypes is [cafe]', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.businessTypes).toEqual(['cafe'])
  })

  it('has capabilities', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.capabilities).toBeDefined()
  })

  it('menu is required', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.capabilities!.required).toContain('menu')
  })

  it('loyalty is optional', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.capabilities!.optional).toContain('loyalty')
  })
})

describe('BAR_MODULE — capability contract', () => {
  afterEach(() => vi.resetModules())

  it('key is bar', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.key).toBe('bar')
  })

  it('businessTypes is [bar]', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.businessTypes).toEqual(['bar'])
  })

  it('delivery is disabled by default', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.defaultFeatureFlags['delivery.enabled']).toBe(false)
  })

  it('qr_table is in defaultEnabled', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.capabilities!.defaultEnabled).toContain('qr_table')
  })
})

describe('FOOD_COURT_MODULE — capability contract', () => {
  afterEach(() => vi.resetModules())

  it('key is food_court', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.key).toBe('food_court')
  })

  it('qr_table is required (food courts always use QR)', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities!.required).toContain('qr_table')
  })
})

describe('FOOD_TRUCK_MODULE — capability contract', () => {
  afterEach(() => vi.resetModules())

  it('key is food_truck', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.key).toBe('food_truck')
  })

  it('pickup.enabled is true by default', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.defaultFeatureFlags['pickup.enabled']).toBe(true)
  })
})

describe('MOBILE_CAFE_MODULE — capability contract', () => {
  afterEach(() => vi.resetModules())

  it('key is mobile_cafe', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.key).toBe('mobile_cafe')
  })

  it('loyalty is defaultEnabled', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.capabilities!.defaultEnabled).toContain('loyalty')
  })
})

// ── Runtime: registry capability methods ─────────────────────────────────────

describe('getModuleCapabilities()', () => {
  it('returns required ∪ optional for restaurant', async () => {
    const { getModuleCapabilities } = await freshRegistry()
    const caps = getModuleCapabilities('restaurant')
    expect(caps).toContain('menu')
    expect(caps).toContain('ordering')
    expect(caps).toContain('qr_table')
    expect(caps).toContain('reservations')
    expect(caps).toContain('reviews')
  })

  it('returns empty array for unknown module', async () => {
    const { getModuleCapabilities } = await freshRegistry()
    expect(getModuleCapabilities('nonexistent')).toHaveLength(0)
  })

  it('returns empty array for module with no capabilities field', async () => {
    const { registerModule, getModuleCapabilities } = await freshRegistry()
    const bare: Module = {
      key: 'legacy',
      name: 'Legacy',
      businessTypes: [],
      routes: [],
      navItems: [],
      defaultFeatureFlags: {},
      enabled: true,
    }
    registerModule(bare)
    expect(getModuleCapabilities('legacy')).toHaveLength(0)
  })

  it('has no duplicates in result', async () => {
    const { getModuleCapabilities } = await freshRegistry()
    const caps = getModuleCapabilities('restaurant')
    expect(caps.length).toBe(new Set(caps).size)
  })
})

describe('hasCapability()', () => {
  it('returns true for a required capability', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['restaurant'], 'menu')).toBe(true)
  })

  it('returns true for a defaultEnabled capability', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['restaurant'], 'qr_table')).toBe(true)
  })

  it('returns false for optional-only capability not in defaultEnabled', async () => {
    const { hasCapability } = await freshRegistry()
    // 'loyalty' is not in restaurant capabilities at all
    expect(hasCapability(['restaurant'], 'loyalty')).toBe(false)
  })

  it('returns false for empty module key list', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability([], 'menu')).toBe(false)
  })

  it('returns false for unknown module key', async () => {
    const { hasCapability } = await freshRegistry()
    expect(hasCapability(['nonexistent'], 'menu')).toBe(false)
  })

  it('returns true when any active module has the capability', async () => {
    const { hasCapability } = await freshRegistry()
    // loyalty is defaultEnabled in mobile_cafe
    expect(hasCapability(['mobile_cafe'], 'loyalty')).toBe(true)
  })
})

describe('getCapabilityFeatureFlags()', () => {
  it('returns menu.enabled = true for restaurant', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['restaurant'])['menu.enabled']).toBe(true)
  })

  it('returns ordering.enabled = true for restaurant (required)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['restaurant'])['ordering.enabled']).toBe(true)
  })

  it('returns reservations.enabled = true for restaurant (defaultEnabled)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['restaurant'])['reservations.enabled']).toBe(true)
  })

  it('returns reviews.enabled = true for restaurant (defaultEnabled)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['restaurant'])['reviews.enabled']).toBe(true)
  })

  it('loyalty.enabled is absent/falsy for restaurant (not in its capabilities)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    const flags = getCapabilityFeatureFlags(['restaurant'])
    // loyalty is not declared in restaurant capabilities; absent keys default to false
    // via useFeatureFlag() — the raw map omits the key entirely
    expect(flags['loyalty.enabled'] ?? false).toBe(false)
  })

  it('returns loyalty.enabled = true for mobile_cafe (defaultEnabled)', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    expect(getCapabilityFeatureFlags(['mobile_cafe'])['loyalty.enabled']).toBe(true)
  })

  it('union semantics: loyalty enabled when mobile_cafe combined with restaurant', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    const flags = getCapabilityFeatureFlags(['restaurant', 'mobile_cafe'])
    expect(flags['loyalty.enabled']).toBe(true)
  })

  it('returns all capability flags when no keys provided', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    const flags = getCapabilityFeatureFlags()
    expect(Object.keys(flags).length).toBeGreaterThan(0)
    expect(flags['menu.enabled']).toBe(true)
  })

  it('returns empty object for unknown module keys', async () => {
    const { getCapabilityFeatureFlags } = await freshRegistry()
    const flags = getCapabilityFeatureFlags(['nonexistent'])
    expect(Object.keys(flags)).toHaveLength(0)
  })
})

// ── Feature flag service: three-layer merge ───────────────────────────────────

describe('featureFlagsService.resolve() — capability layer (P6.2)', () => {
  afterEach(() => vi.resetModules())

  it('restaurant tenant: ordering.enabled = true from capability layer', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const flags = featureFlagsService.resolve(DEFAULT_TENANT)
    expect(flags['ordering.enabled']).toBe(true)
  })

  it('restaurant tenant: qr_table.enabled = true from capability layer', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const flags = featureFlagsService.resolve(DEFAULT_TENANT)
    expect(flags['qr_table.enabled']).toBe(true)
  })

  it('restaurant tenant: reviews.enabled = true from capability layer', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const flags = featureFlagsService.resolve(DEFAULT_TENANT)
    expect(flags['reviews.enabled']).toBe(true)
  })

  it('restaurant tenant: notifications.enabled = true from capability layer', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const flags = featureFlagsService.resolve(DEFAULT_TENANT)
    expect(flags['notifications.enabled']).toBe(true)
  })

  it('existing defaultFeatureFlags (delivery.enabled) survive the three-layer merge', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const flags = featureFlagsService.resolve(DEFAULT_TENANT)
    expect(flags['delivery.enabled']).toBe(true)
    expect(flags['table_ordering.enabled']).toBe(true)
    expect(flags['order_tracking.enabled']).toBe(true)
  })
})

describe('featureFlagsService.resolve() — tenant capability override (P6.2)', () => {
  afterEach(() => vi.resetModules())

  it('tenant can disable a capability flag via settings.featureFlags', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      settings: { featureFlags: { 'reservations.enabled': false } },
    }
    expect(featureFlagsService.resolve(tenant)['reservations.enabled']).toBe(false)
  })

  it('tenant can enable an optional-off capability via settings.featureFlags', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      settings: { featureFlags: { 'loyalty.enabled': true } },
    }
    expect(featureFlagsService.resolve(tenant)['loyalty.enabled']).toBe(true)
  })

  it('tenant override does not affect other flags in the same resolve call', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      settings: { featureFlags: { 'reviews.enabled': false } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(flags['reviews.enabled']).toBe(false)
    expect(flags['menu.enabled']).toBe(true)
    expect(flags['ordering.enabled']).toBe(true)
  })
})

// ── Backward compatibility ────────────────────────────────────────────────────

describe('Backward compatibility — restaurant behavior unchanged', () => {
  it('RESTAURANT_MODULE still has all original fields', async () => {
    const { RESTAURANT_MODULE } = await freshRegistry()
    expect(RESTAURANT_MODULE.key).toBe('restaurant')
    expect(RESTAURANT_MODULE.routes).toContain('/menu')
    expect(RESTAURANT_MODULE.routes).toContain('/checkout')
    expect(RESTAURANT_MODULE.routes).toContain('/reservation')
    expect(RESTAURANT_MODULE.routes).toContain('/restaurant')
    expect(RESTAURANT_MODULE.navItems.some((n) => n.href === '/menu')).toBe(true)
    expect(RESTAURANT_MODULE.navItems.some((n) => n.href === '/reservation')).toBe(true)
    expect(RESTAURANT_MODULE.defaultFeatureFlags['menu.enabled']).toBe(true)
    expect(RESTAURANT_MODULE.defaultFeatureFlags['reservations.enabled']).toBe(true)
    expect(RESTAURANT_MODULE.defaultFeatureFlags['delivery.enabled']).toBe(true)
  })

  it('getHeaderNav([restaurant]) still returns /menu and /reservation', async () => {
    const { getHeaderNav } = await freshRegistry()
    const nav = getHeaderNav(['restaurant'])
    expect(nav.some((n) => n.href === '/menu')).toBe(true)
    expect(nav.some((n) => n.href === '/reservation')).toBe(true)
  })

  it('getModuleRoutes([restaurant]) still returns all original routes', async () => {
    const { getModuleRoutes } = await freshRegistry()
    const routes = getModuleRoutes(['restaurant'])
    expect(routes).toContain('/menu')
    expect(routes).toContain('/checkout')
    expect(routes).toContain('/reservation')
    expect(routes).toContain('/restaurant')
  })

  it('getDefaultFeatureFlags([restaurant]) still returns original flags', async () => {
    const { getDefaultFeatureFlags } = await freshRegistry()
    const flags = getDefaultFeatureFlags(['restaurant'])
    expect(flags['menu.enabled']).toBe(true)
    expect(flags['reservations.enabled']).toBe(true)
    expect(flags['delivery.enabled']).toBe(true)
    expect(flags['table_ordering.enabled']).toBe(true)
    expect(flags['order_tracking.enabled']).toBe(true)
  })

  it('modules without capabilities field can still be registered', async () => {
    const { registerModule, getModule } = await freshRegistry()
    const legacy: Module = {
      key: 'legacy-biz',
      name: 'Legacy',
      businessTypes: [],
      routes: ['/legacy'],
      navItems: [],
      defaultFeatureFlags: { 'legacy.enabled': true },
      enabled: true,
    }
    registerModule(legacy)
    const stored = getModule('legacy-biz')
    expect(stored?.defaultFeatureFlags['legacy.enabled']).toBe(true)
    expect(stored?.capabilities).toBeUndefined()
  })
})

describe('All six business-type modules registered in INITIAL_MODULES', () => {
  it('getModules() includes restaurant, cafe, bar, food_court, food_truck, mobile_cafe', async () => {
    const { getModules } = await freshRegistry()
    const keys = getModules().map((m) => m.key)
    expect(keys).toContain('restaurant')
    expect(keys).toContain('cafe')
    expect(keys).toContain('bar')
    expect(keys).toContain('food_court')
    expect(keys).toContain('food_truck')
    expect(keys).toContain('mobile_cafe')
  })
})
