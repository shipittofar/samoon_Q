/**
 * P6.8 — Capability Enforcement Layer tests
 *
 * Covers:
 *   A. requireCapability() — throws CapabilityError when capability absent
 *   B. CapabilityError     — shape, message, fields
 *   C. isCapabilityEnabled() — resolved flag check (tenant-override-aware)
 *   D. getCapabilityFlagKey() — CAPABILITY_FLAG_MAP wrapper
 *   E. hasCapability() re-export — still works via capability-guard module
 *   F. Restaurant capability matrix
 *   G. Cafe capability matrix
 *   H. Bar capability matrix
 *   I. Food Court capability matrix
 *   J. Food Truck capability matrix
 *   K. Mobile Cafe capability matrix
 *   L. Cross-module: no hardcoded business-type checks
 *   M. Navigation enforcement — getHeaderNav filtered by featureFlagKey
 *   N. Admin nav enforcement — getAdminNav filtered by featureFlagKey
 *   O. useModuleNav / useAdminModuleNav source-text (hook existence)
 *   P. CapabilityGuard source-text (component existence)
 *   Q. Tenant-override capability enforcement
 *   R. Empty / invalid module keys
 *   S. CapabilityGuard component structure
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { DEFAULT_TENANT } from '@/constants'
import type { Capability, Tenant } from '@/types'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

async function freshGuard() {
  vi.resetModules()
  return import('@/modules/capability-guard')
}

async function freshRegistry() {
  vi.resetModules()
  return import('@/modules/registry')
}

// ── A. requireCapability() ────────────────────────────────────────────────────

describe('A. requireCapability()', () => {
  afterEach(() => vi.resetModules())

  it('does not throw when capability is in required', async () => {
    const { requireCapability } = await freshGuard()
    expect(() => requireCapability(['cafe'], 'menu')).not.toThrow()
  })

  it('does not throw when capability is in defaultEnabled', async () => {
    const { requireCapability } = await freshGuard()
    expect(() => requireCapability(['cafe'], 'reservations')).not.toThrow()
  })

  it('throws CapabilityError when capability is absent (optional, not defaultEnabled)', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    expect(() => requireCapability(['bar'], 'reviews')).toThrow(CapabilityError)
  })

  it('throws CapabilityError when module key is unknown', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    expect(() => requireCapability(['nonexistent'], 'menu')).toThrow(CapabilityError)
  })

  it('throws CapabilityError when activeModuleKeys is empty', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    expect(() => requireCapability([], 'menu')).toThrow(CapabilityError)
  })

  it('does not throw for food_truck with reviews (defaultEnabled)', async () => {
    const { requireCapability } = await freshGuard()
    expect(() => requireCapability(['food_truck'], 'reviews')).not.toThrow()
  })

  it('throws for food_truck with reservations (optional, not defaultEnabled)', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    expect(() => requireCapability(['food_truck'], 'reservations')).toThrow(CapabilityError)
  })

  it('throws for food_truck with loyalty (optional, not defaultEnabled)', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    expect(() => requireCapability(['food_truck'], 'loyalty')).toThrow(CapabilityError)
  })

  it('does not throw for mobile_cafe with loyalty (defaultEnabled)', async () => {
    const { requireCapability } = await freshGuard()
    expect(() => requireCapability(['mobile_cafe'], 'loyalty')).not.toThrow()
  })

  it('throws for bar with reviews (optional, not defaultEnabled)', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    expect(() => requireCapability(['bar'], 'reviews')).toThrow(CapabilityError)
  })

  it('does not throw for bar with reservations (defaultEnabled)', async () => {
    const { requireCapability } = await freshGuard()
    expect(() => requireCapability(['bar'], 'reservations')).not.toThrow()
  })
})

// ── B. CapabilityError ────────────────────────────────────────────────────────

describe('B. CapabilityError', () => {
  afterEach(() => vi.resetModules())

  it('is an instance of Error', async () => {
    const { CapabilityError } = await freshGuard()
    const err = new CapabilityError('loyalty', ['food_truck'])
    expect(err).toBeInstanceOf(Error)
  })

  it('has name "CapabilityError"', async () => {
    const { CapabilityError } = await freshGuard()
    const err = new CapabilityError('loyalty', ['food_truck'])
    expect(err.name).toBe('CapabilityError')
  })

  it('exposes capability field', async () => {
    const { CapabilityError } = await freshGuard()
    const err = new CapabilityError('loyalty', ['food_truck'])
    expect(err.capability).toBe('loyalty')
  })

  it('exposes activeModuleKeys field', async () => {
    const { CapabilityError } = await freshGuard()
    const err = new CapabilityError('loyalty', ['food_truck'])
    expect(err.activeModuleKeys).toEqual(['food_truck'])
  })

  it('message includes capability name', async () => {
    const { CapabilityError } = await freshGuard()
    const err = new CapabilityError('loyalty', ['food_truck'])
    expect(err.message).toContain('loyalty')
  })

  it('message includes module key', async () => {
    const { CapabilityError } = await freshGuard()
    const err = new CapabilityError('loyalty', ['food_truck'])
    expect(err.message).toContain('food_truck')
  })

  it('caught via requireCapability has correct capability', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    try {
      requireCapability(['food_truck'], 'loyalty')
    } catch (e) {
      expect(e).toBeInstanceOf(CapabilityError)
      expect((e as InstanceType<typeof CapabilityError>).capability).toBe('loyalty')
    }
  })
})

// ── C. isCapabilityEnabled() ──────────────────────────────────────────────────

describe('C. isCapabilityEnabled()', () => {
  afterEach(() => vi.resetModules())

  it('returns true when flag is true in resolved map', async () => {
    const { isCapabilityEnabled } = await freshGuard()
    expect(isCapabilityEnabled('menu', { 'menu.enabled': true })).toBe(true)
  })

  it('returns false when flag is false in resolved map', async () => {
    const { isCapabilityEnabled } = await freshGuard()
    expect(isCapabilityEnabled('loyalty', { 'loyalty.enabled': false })).toBe(false)
  })

  it('returns false when flag is absent from resolved map (safe default)', async () => {
    const { isCapabilityEnabled } = await freshGuard()
    expect(isCapabilityEnabled('loyalty', {})).toBe(false)
  })

  it('respects tenant override enabling loyalty', async () => {
    const { isCapabilityEnabled } = await freshGuard()
    expect(isCapabilityEnabled('loyalty', { 'loyalty.enabled': true })).toBe(true)
  })

  it('respects tenant override disabling reservations', async () => {
    const { isCapabilityEnabled } = await freshGuard()
    expect(isCapabilityEnabled('reservations', { 'reservations.enabled': false })).toBe(false)
  })

  it('works for qr_table', async () => {
    const { isCapabilityEnabled } = await freshGuard()
    expect(isCapabilityEnabled('qr_table', { 'qr_table.enabled': true })).toBe(true)
  })

  it('works for reviews', async () => {
    const { isCapabilityEnabled } = await freshGuard()
    expect(isCapabilityEnabled('reviews', { 'reviews.enabled': true })).toBe(true)
  })

  it('works with full featureFlagsService resolved map', async () => {
    vi.resetModules()
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const { isCapabilityEnabled } = await import('@/modules/capability-guard')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['mobile_cafe'],
      settings: {},
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(isCapabilityEnabled('loyalty', flags)).toBe(true)
    expect(isCapabilityEnabled('reservations', flags)).toBe(false)
  })
})

// ── D. getCapabilityFlagKey() ─────────────────────────────────────────────────

describe('D. getCapabilityFlagKey()', () => {
  afterEach(() => vi.resetModules())

  it('returns "menu.enabled" for "menu"', async () => {
    const { getCapabilityFlagKey } = await freshGuard()
    expect(getCapabilityFlagKey('menu')).toBe('menu.enabled')
  })

  it('returns "loyalty.enabled" for "loyalty"', async () => {
    const { getCapabilityFlagKey } = await freshGuard()
    expect(getCapabilityFlagKey('loyalty')).toBe('loyalty.enabled')
  })

  it('returns "reservations.enabled" for "reservations"', async () => {
    const { getCapabilityFlagKey } = await freshGuard()
    expect(getCapabilityFlagKey('reservations')).toBe('reservations.enabled')
  })

  it('returns "qr_table.enabled" for "qr_table"', async () => {
    const { getCapabilityFlagKey } = await freshGuard()
    expect(getCapabilityFlagKey('qr_table')).toBe('qr_table.enabled')
  })

  it('returns "reviews.enabled" for "reviews"', async () => {
    const { getCapabilityFlagKey } = await freshGuard()
    expect(getCapabilityFlagKey('reviews')).toBe('reviews.enabled')
  })

  it('returns "notifications.enabled" for "notifications"', async () => {
    const { getCapabilityFlagKey } = await freshGuard()
    expect(getCapabilityFlagKey('notifications')).toBe('notifications.enabled')
  })

  it('returns "ordering.enabled" for "ordering"', async () => {
    const { getCapabilityFlagKey } = await freshGuard()
    expect(getCapabilityFlagKey('ordering')).toBe('ordering.enabled')
  })
})

// ── E. hasCapability re-export ────────────────────────────────────────────────

describe('E. hasCapability re-export from capability-guard', () => {
  afterEach(() => vi.resetModules())

  it('hasCapability is exported from capability-guard module', async () => {
    const mod = await freshGuard()
    expect(typeof mod.hasCapability).toBe('function')
  })

  it('hasCapability(["cafe"], "loyalty") returns false (not defaultEnabled)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['cafe'], 'loyalty')).toBe(false)
  })

  it('hasCapability(["mobile_cafe"], "loyalty") returns true (defaultEnabled)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['mobile_cafe'], 'loyalty')).toBe(true)
  })
})

// ── F. Restaurant capability matrix ──────────────────────────────────────────

describe('F. Restaurant capability matrix', () => {
  afterEach(() => vi.resetModules())

  it('restaurant: menu required → hasCapability=true', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['restaurant'], 'menu')).toBe(true)
  })

  it('restaurant: ordering required → hasCapability=true', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['restaurant'], 'ordering')).toBe(true)
  })

  it('restaurant: qr_table required → hasCapability=true', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['restaurant'], 'qr_table')).toBe(true)
  })

  it('restaurant: notifications required → hasCapability=true', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['restaurant'], 'notifications')).toBe(true)
  })

  it('restaurant: reservations defaultEnabled → hasCapability=true', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['restaurant'], 'reservations')).toBe(true)
  })

  it('restaurant: reviews defaultEnabled → hasCapability=true', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['restaurant'], 'reviews')).toBe(true)
  })

  it('restaurant: loyalty optional only → hasCapability=false', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['restaurant'], 'loyalty')).toBe(false)
  })

  it('restaurant: requireCapability loyalty throws', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    expect(() => requireCapability(['restaurant'], 'loyalty')).toThrow(CapabilityError)
  })
})

// ── G. Cafe capability matrix ─────────────────────────────────────────────────

describe('G. Cafe capability matrix', () => {
  afterEach(() => vi.resetModules())

  it('cafe: menu=true, ordering=true, qr_table=true, notifications=true (required)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['cafe'], 'menu')).toBe(true)
    expect(hasCapability(['cafe'], 'ordering')).toBe(true)
    expect(hasCapability(['cafe'], 'qr_table')).toBe(true)
    expect(hasCapability(['cafe'], 'notifications')).toBe(true)
  })

  it('cafe: reservations=true, reviews=true (defaultEnabled)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['cafe'], 'reservations')).toBe(true)
    expect(hasCapability(['cafe'], 'reviews')).toBe(true)
  })

  it('cafe: loyalty=false (optional, not defaultEnabled)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['cafe'], 'loyalty')).toBe(false)
  })

  it('cafe: requireCapability loyalty throws', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    expect(() => requireCapability(['cafe'], 'loyalty')).toThrow(CapabilityError)
  })
})

// ── H. Bar capability matrix ──────────────────────────────────────────────────

describe('H. Bar capability matrix', () => {
  afterEach(() => vi.resetModules())

  it('bar: menu=true, ordering=true, qr_table=true, notifications=true (required)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['bar'], 'menu')).toBe(true)
    expect(hasCapability(['bar'], 'ordering')).toBe(true)
    expect(hasCapability(['bar'], 'qr_table')).toBe(true)
    expect(hasCapability(['bar'], 'notifications')).toBe(true)
  })

  it('bar: reservations=true (defaultEnabled)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['bar'], 'reservations')).toBe(true)
  })

  it('bar: reviews=false (optional, not defaultEnabled)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['bar'], 'reviews')).toBe(false)
  })

  it('bar: loyalty=false (optional, not defaultEnabled)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['bar'], 'loyalty')).toBe(false)
  })

  it('bar: requireCapability reviews throws', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    expect(() => requireCapability(['bar'], 'reviews')).toThrow(CapabilityError)
  })

  it('bar: requireCapability loyalty throws', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    expect(() => requireCapability(['bar'], 'loyalty')).toThrow(CapabilityError)
  })
})

// ── I. Food Court capability matrix ──────────────────────────────────────────

describe('I. Food Court capability matrix', () => {
  afterEach(() => vi.resetModules())

  it('food_court: menu, ordering, qr_table, notifications, reservations all required', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['food_court'], 'menu')).toBe(true)
    expect(hasCapability(['food_court'], 'ordering')).toBe(true)
    expect(hasCapability(['food_court'], 'qr_table')).toBe(true)
    expect(hasCapability(['food_court'], 'notifications')).toBe(true)
    expect(hasCapability(['food_court'], 'reservations')).toBe(true)
  })

  it('food_court: reviews=true (defaultEnabled)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['food_court'], 'reviews')).toBe(true)
  })

  it('food_court: loyalty=false (optional, not defaultEnabled)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['food_court'], 'loyalty')).toBe(false)
  })

  it('food_court: requireCapability loyalty throws', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    expect(() => requireCapability(['food_court'], 'loyalty')).toThrow(CapabilityError)
  })
})

// ── J. Food Truck capability matrix ──────────────────────────────────────────

describe('J. Food Truck capability matrix', () => {
  afterEach(() => vi.resetModules())

  it('food_truck: menu, ordering, qr_table, notifications required', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['food_truck'], 'menu')).toBe(true)
    expect(hasCapability(['food_truck'], 'ordering')).toBe(true)
    expect(hasCapability(['food_truck'], 'qr_table')).toBe(true)
    expect(hasCapability(['food_truck'], 'notifications')).toBe(true)
  })

  it('food_truck: reviews=true (defaultEnabled)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['food_truck'], 'reviews')).toBe(true)
  })

  it('food_truck: reservations=false (optional, not defaultEnabled)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['food_truck'], 'reservations')).toBe(false)
  })

  it('food_truck: loyalty=false (optional, not defaultEnabled)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['food_truck'], 'loyalty')).toBe(false)
  })

  it('food_truck: requireCapability reservations throws', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    expect(() => requireCapability(['food_truck'], 'reservations')).toThrow(CapabilityError)
  })

  it('food_truck: requireCapability loyalty throws', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    expect(() => requireCapability(['food_truck'], 'loyalty')).toThrow(CapabilityError)
  })
})

// ── K. Mobile Cafe capability matrix ─────────────────────────────────────────

describe('K. Mobile Cafe capability matrix', () => {
  afterEach(() => vi.resetModules())

  it('mobile_cafe: menu, ordering, qr_table, notifications required', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['mobile_cafe'], 'menu')).toBe(true)
    expect(hasCapability(['mobile_cafe'], 'ordering')).toBe(true)
    expect(hasCapability(['mobile_cafe'], 'qr_table')).toBe(true)
    expect(hasCapability(['mobile_cafe'], 'notifications')).toBe(true)
  })

  it('mobile_cafe: reviews=true, loyalty=true (defaultEnabled)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['mobile_cafe'], 'reviews')).toBe(true)
    expect(hasCapability(['mobile_cafe'], 'loyalty')).toBe(true)
  })

  it('mobile_cafe: reservations=false (optional, not defaultEnabled)', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['mobile_cafe'], 'reservations')).toBe(false)
  })

  it('mobile_cafe: requireCapability reservations throws', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    expect(() => requireCapability(['mobile_cafe'], 'reservations')).toThrow(CapabilityError)
  })

  it('mobile_cafe: requireCapability loyalty does NOT throw', async () => {
    const { requireCapability } = await freshGuard()
    expect(() => requireCapability(['mobile_cafe'], 'loyalty')).not.toThrow()
  })
})

// ── L. No hardcoded business-type checks ─────────────────────────────────────

describe('L. No hardcoded business-type checks (source-text audit)', () => {
  const capabilityGuardSrc = readSrc('modules/capability-guard.ts')
  const hooksSrc = readSrc('hooks/index.ts')

  it('capability-guard.ts does not contain hardcoded business-type conditional checks', () => {
    // GOOD: capability checks. BAD: if (type === 'cafe') pattern in executable code.
    // Only match against non-comment lines: look for the pattern outside of JSDoc strings.
    const executableLines = capabilityGuardSrc
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('/'))
      .join('\n')
    expect(executableLines).not.toMatch(/=== ['"]cafe['"]/)
    expect(executableLines).not.toMatch(/=== ['"]bar['"]/)
    expect(executableLines).not.toMatch(/=== ['"]restaurant['"]/)
    expect(executableLines).not.toMatch(/=== ['"]food_truck['"]/)
  })

  it('hooks/index.ts useCapability does not hardcode business types', () => {
    expect(hooksSrc).not.toMatch(/tenant\.type === ['"]cafe['"]/)
    expect(hooksSrc).not.toMatch(/businessType === ['"]bar['"]/)
  })

  it('capability-guard.ts uses hasCapability() for all checks', () => {
    expect(capabilityGuardSrc).toContain('hasCapability')
  })

  it('Header.tsx uses useModuleNav() not getHeaderNav() directly', () => {
    const headerSrc = readSrc('components/layout/Header.tsx')
    expect(headerSrc).toContain('useModuleNav()')
    expect(headerSrc).not.toContain('getHeaderNav(')
  })
})

// ── M. Navigation enforcement ─────────────────────────────────────────────────

describe('M. Navigation enforcement via featureFlagKey filtering', () => {
  afterEach(() => vi.resetModules())

  it('getHeaderNav(["food_truck"]) includes Reservations nav item (gated but present)', async () => {
    const { getHeaderNav } = await freshRegistry()
    const items = getHeaderNav(['food_truck'])
    expect(items.some((n) => n.href === '/reservation')).toBe(true)
  })

  it('food_truck Reservations nav item has featureFlagKey (consumer must filter)', async () => {
    const { getHeaderNav } = await freshRegistry()
    const item = getHeaderNav(['food_truck']).find((n) => n.href === '/reservation')
    expect(item!.featureFlagKey).toBe('reservations.enabled')
  })

  it('getHeaderNav(["cafe"]) Loyalty nav item has featureFlagKey cafe.loyalty.enabled', async () => {
    const { getHeaderNav } = await freshRegistry()
    const item = getHeaderNav(['cafe']).find((n) => n.href === '/loyalty')
    expect(item!.featureFlagKey).toBe('cafe.loyalty.enabled')
  })

  it('getHeaderNav(["bar"]) Events nav item has featureFlagKey bar.events.enabled', async () => {
    const { getHeaderNav } = await freshRegistry()
    const item = getHeaderNav(['bar']).find((n) => n.href === '/events')
    expect(item!.featureFlagKey).toBe('bar.events.enabled')
  })

  it('getHeaderNav(["food_court"]) Vendors nav item gated by food_court.vendor_management.enabled', async () => {
    const { getHeaderNav } = await freshRegistry()
    const item = getHeaderNav(['food_court']).find((n) => n.href === '/vendors')
    expect(item!.featureFlagKey).toBe('food_court.vendor_management.enabled')
  })

  it('getHeaderNav(["mobile_cafe"]) Loyalty nav item gated by mobile_cafe.loyalty.enabled', async () => {
    const { getHeaderNav } = await freshRegistry()
    const item = getHeaderNav(['mobile_cafe']).find((n) => n.href === '/loyalty')
    expect(item!.featureFlagKey).toBe('mobile_cafe.loyalty.enabled')
  })

  it('getHeaderNav(["restaurant"]) Menu item has no featureFlagKey (always shown)', async () => {
    const { getHeaderNav } = await freshRegistry()
    const item = getHeaderNav(['restaurant']).find((n) => n.href === '/menu')
    expect(item!.featureFlagKey).toBeUndefined()
  })
})

// ── N. Admin nav enforcement ──────────────────────────────────────────────────

describe('N. Admin nav enforcement', () => {
  afterEach(() => vi.resetModules())

  it('getAdminNav(["cafe"]) most items have featureFlagKey (customers is always visible)', async () => {
    const { getAdminNav } = await freshRegistry()
    const items = getAdminNav(['cafe'])
    // CUSTOMERS_NAV_ITEM intentionally has no featureFlagKey (P8.9.4 C7 fix)
    const gatedItems = items.filter((n) => n.featureFlagKey !== undefined)
    expect(gatedItems.length).toBeGreaterThan(items.length / 2)
  })

  it('getAdminNav(["bar"]) Event Management gated by bar.events.enabled', async () => {
    const { getAdminNav } = await freshRegistry()
    const item = getAdminNav(['bar']).find((n) => n.label === 'Event Management')
    expect(item!.featureFlagKey).toBe('bar.events.enabled')
  })

  it('getAdminNav(["food_court"]) Vendor Management gated by food_court.vendor_management.enabled', async () => {
    const { getAdminNav } = await freshRegistry()
    const item = getAdminNav(['food_court']).find((n) => n.label === 'Vendor Management')
    expect(item!.featureFlagKey).toBe('food_court.vendor_management.enabled')
  })

  it('getAdminNav(["food_truck"]) Route Management gated by food_truck.route_tracking.enabled', async () => {
    const { getAdminNav } = await freshRegistry()
    const item = getAdminNav(['food_truck']).find((n) => n.label === 'Route Management')
    expect(item!.featureFlagKey).toBe('food_truck.route_tracking.enabled')
  })

  it('getAdminNav(["mobile_cafe"]) Loyalty Management gated by mobile_cafe.loyalty.enabled', async () => {
    const { getAdminNav } = await freshRegistry()
    const item = getAdminNav(['mobile_cafe']).find((n) => n.label === 'Loyalty Management')
    expect(item!.featureFlagKey).toBe('mobile_cafe.loyalty.enabled')
  })

  it('getAdminNav([]) returns empty array', async () => {
    const { getAdminNav } = await freshRegistry()
    expect(getAdminNav([])).toHaveLength(0)
  })
})

// ── O. Hook source-text checks ────────────────────────────────────────────────

describe('O. Hook existence (source-text)', () => {
  const hooksSrc = readSrc('hooks/index.ts')

  it('useCapability hook is exported from hooks/index.ts', () => {
    expect(hooksSrc).toContain('export function useCapability(')
  })

  it('useCapabilityFlag hook is exported from hooks/index.ts', () => {
    expect(hooksSrc).toContain('export function useCapabilityFlag(')
  })

  it('useAdminModuleNav hook is exported from hooks/index.ts', () => {
    expect(hooksSrc).toContain('export function useAdminModuleNav(')
  })

  it('useModuleNav hook is exported from hooks/index.ts', () => {
    expect(hooksSrc).toContain('export function useModuleNav(')
  })

  it('useCapability calls hasCapability()', () => {
    expect(hooksSrc).toContain('hasCapability(')
  })

  it('useCapabilityFlag reads from CAPABILITY_FLAG_MAP', () => {
    expect(hooksSrc).toContain('CAPABILITY_FLAG_MAP')
  })

  it('useAdminModuleNav uses getAdminNav() (via getAdminNavForBusinessTypes)', () => {
    expect(hooksSrc).toContain('getAdminNavForBusinessTypes(')
  })

  it('useModuleNav filters by featureFlagKey', () => {
    expect(hooksSrc).toContain('featureFlagKey')
  })
})

// ── P. CapabilityGuard component ──────────────────────────────────────────────

describe('P. CapabilityGuard source-text', () => {
  const src = readSrc('components/guards/CapabilityGuard.tsx')

  it('CapabilityGuard is exported', () => {
    expect(src).toContain('export function CapabilityGuard(')
  })

  it('CapabilityNotAvailable is exported', () => {
    expect(src).toContain('export function CapabilityNotAvailable(')
  })

  it('CapabilityGuard accepts capability prop', () => {
    expect(src).toContain('capability:')
  })

  it('CapabilityGuard accepts fallback prop', () => {
    expect(src).toContain('fallback')
  })

  it('CapabilityGuard uses useCapabilityFlag hook', () => {
    expect(src).toContain('useCapabilityFlag(')
  })

  it('CapabilityGuard is a client component', () => {
    expect(src).toContain("'use client'")
  })

  it('CapabilityGuard renders null (fallback) when disabled', () => {
    expect(src).toContain('fallback = null')
  })

  it('CapabilityNotAvailable renders role="status"', () => {
    expect(src).toContain('role="status"')
  })
})

// ── Q. Tenant-override capability enforcement ─────────────────────────────────

describe('Q. Tenant-override enforcement via isCapabilityEnabled()', () => {
  afterEach(() => vi.resetModules())

  it('food_truck with loyalty override=true → isCapabilityEnabled loyalty=true', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const { isCapabilityEnabled } = await import('@/modules/capability-guard')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['food_truck'],
      settings: { featureFlags: { 'loyalty.enabled': true } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(isCapabilityEnabled('loyalty', flags)).toBe(true)
  })

  it('mobile_cafe with loyalty override=false → isCapabilityEnabled loyalty=false', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const { isCapabilityEnabled } = await import('@/modules/capability-guard')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['mobile_cafe'],
      settings: { featureFlags: { 'loyalty.enabled': false } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(isCapabilityEnabled('loyalty', flags)).toBe(false)
  })

  it('bar with reviews override=true → isCapabilityEnabled reviews=true', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const { isCapabilityEnabled } = await import('@/modules/capability-guard')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['bar'],
      settings: { featureFlags: { 'reviews.enabled': true } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(isCapabilityEnabled('reviews', flags)).toBe(true)
  })

  it('restaurant with loyalty override=true → isCapabilityEnabled loyalty=true', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const { isCapabilityEnabled } = await import('@/modules/capability-guard')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['restaurant'],
      settings: { featureFlags: { 'loyalty.enabled': true } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(isCapabilityEnabled('loyalty', flags)).toBe(true)
  })

  it('cafe with reservations override=false → isCapabilityEnabled reservations=false', async () => {
    const { featureFlagsService } = await import('@/services/feature-flags.service')
    const { isCapabilityEnabled } = await import('@/modules/capability-guard')
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      businessTypes: ['cafe'],
      settings: { featureFlags: { 'reservations.enabled': false } },
    }
    const flags = featureFlagsService.resolve(tenant)
    expect(isCapabilityEnabled('reservations', flags)).toBe(false)
  })
})

// ── R. Empty / invalid module keys ────────────────────────────────────────────

describe('R. Empty and invalid module keys', () => {
  afterEach(() => vi.resetModules())

  it('hasCapability([], "menu") returns false', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability([], 'menu')).toBe(false)
  })

  it('hasCapability(["nonexistent"], "menu") returns false', async () => {
    const { hasCapability } = await freshGuard()
    expect(hasCapability(['nonexistent'], 'menu')).toBe(false)
  })

  it('requireCapability([], "menu") throws CapabilityError', async () => {
    const { requireCapability, CapabilityError } = await freshGuard()
    expect(() => requireCapability([], 'menu')).toThrow(CapabilityError)
  })

  it('getCapabilityFeatureFlags([]) falls back to all modules (non-empty)', async () => {
    const { getCapabilityFeatureFlags } = await freshGuard()
    const flags = getCapabilityFeatureFlags([])
    expect(flags['menu.enabled']).toBe(true)
  })

  it('isCapabilityEnabled("menu", {}) returns false (absent = safe default)', async () => {
    const { isCapabilityEnabled } = await freshGuard()
    expect(isCapabilityEnabled('menu', {})).toBe(false)
  })
})

// ── S. CapabilityGuard page stubs existence ───────────────────────────────────

describe('S. Capability-guarded page stubs', () => {
  it('/reviews page exists with CapabilityGuard', () => {
    const src = readSrc('app/reviews/page.tsx')
    expect(src).toContain('CapabilityGuard')
    expect(src).toContain('reviews')
  })

  it('/loyalty page exists with CapabilityGuard', () => {
    const src = readSrc('app/loyalty/page.tsx')
    expect(src).toContain('CapabilityGuard')
    expect(src).toContain('loyalty')
  })

  it('/events page exists with CapabilityGuard', () => {
    const src = readSrc('app/events/page.tsx')
    expect(src).toContain('CapabilityGuard')
  })

  it('/vendors page exists with CapabilityGuard', () => {
    const src = readSrc('app/vendors/VendorsClientPage.tsx')
    expect(src).toContain('CapabilityGuard')
  })

  it('/location page exists with CapabilityGuard', () => {
    const src = readSrc('app/location/page.tsx')
    expect(src).toContain('CapabilityGuard')
  })

  it('capability-guard.ts exports requireCapability', () => {
    const src = readSrc('modules/capability-guard.ts')
    expect(src).toContain('export function requireCapability(')
  })

  it('capability-guard.ts exports CapabilityError', () => {
    const src = readSrc('modules/capability-guard.ts')
    expect(src).toContain('export class CapabilityError')
  })

  it('capability-guard.ts exports isCapabilityEnabled', () => {
    const src = readSrc('modules/capability-guard.ts')
    expect(src).toContain('export function isCapabilityEnabled(')
  })

  it('capability-guard.ts exports getCapabilityFlagKey', () => {
    const src = readSrc('modules/capability-guard.ts')
    expect(src).toContain('export function getCapabilityFlagKey(')
  })
})
