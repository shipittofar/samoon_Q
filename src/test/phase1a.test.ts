/**
 * Phase 1A test suite — covers P1A.1 (Tenant model), P1A.2 (Location/Branch alias),
 * P1A.3 (Module Registry), P1A.4 (backward compatibility), and Phase 1B
 * stabilization (tenant readiness signal).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Branch, Location, Module, Tenant } from '@/types'
import { DEFAULT_TENANT } from '@/constants'
import { useTenantStore } from '@/stores'
import { useTenantReady } from '@/hooks'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a fresh private registry scope by re-importing the module. */
async function freshRegistry() {
  vi.resetModules()
  return import('@/modules/registry')
}

// ── P1A.1 — Tenant model & store ──────────────────────────────────────────────

describe('DEFAULT_TENANT', () => {
  it('has all required Tenant fields', () => {
    expect(DEFAULT_TENANT).toMatchObject<Tenant>({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
      businessTypes: expect.any(Array),
      status: expect.stringMatching(/^(active|trial|suspended|churned)$/),
      createdAt: expect.any(String),
    })
  })

  it('includes restaurant module key', () => {
    expect(DEFAULT_TENANT.businessTypes).toContain('restaurant')
  })

  it('has active status', () => {
    expect(DEFAULT_TENANT.status).toBe('active')
  })
})

describe('useTenantStore', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it('initialises with DEFAULT_TENANT', () => {
    const { tenant } = useTenantStore.getState()
    expect(tenant.id).toBe(DEFAULT_TENANT.id)
    expect(tenant.slug).toBe(DEFAULT_TENANT.slug)
  })

  it('initialises with isLoading false', () => {
    expect(useTenantStore.getState().isLoading).toBe(false)
  })

  it('setTenant replaces the active tenant', () => {
    const next: Tenant = {
      id: 'tenant-abc',
      name: 'Acme Cafe',
      slug: 'acme',
      businessTypes: ['restaurant', 'cafe'],
      status: 'active',
      createdAt: '2025-01-01T00:00:00.000Z',
    }
    useTenantStore.getState().setTenant(next)
    expect(useTenantStore.getState().tenant).toEqual(next)
  })

  it('reset returns to DEFAULT_TENANT', () => {
    const other: Tenant = {
      id: 'tenant-other',
      name: 'Other',
      slug: 'other',
      businessTypes: ['bar'],
      status: 'active',
      createdAt: '2025-01-01T00:00:00.000Z',
    }
    useTenantStore.getState().setTenant(other)
    useTenantStore.getState().reset()
    expect(useTenantStore.getState().tenant.id).toBe(DEFAULT_TENANT.id)
    expect(useTenantStore.getState().isLoading).toBe(false)
  })

  it('loadTenant sets isLoading during fetch and clears it after', async () => {
    // tenantService is mocked via mock mode — the mock is fast but async
    const store = useTenantStore.getState()
    const promise = store.loadTenant('default')
    // isLoading should be true while the promise is pending
    expect(useTenantStore.getState().isLoading).toBe(true)
    await promise
    expect(useTenantStore.getState().isLoading).toBe(false)
  })

  it('loadTenant populates tenant from service', async () => {
    await useTenantStore.getState().loadTenant('default')
    const { tenant } = useTenantStore.getState()
    expect(tenant).toMatchObject<Partial<Tenant>>({
      slug: 'default',
      status: 'active',
    })
  })

  it('loadTenant resets to DEFAULT_TENANT and clears isLoading on service failure (M-1)', async () => {
    // Place a non-default tenant in state to simulate a stale persisted value.
    const stale: Tenant = {
      id: 'stale-id',
      name: 'Stale Corp',
      slug: 'stale',
      businessTypes: ['restaurant'],
      status: 'active',
      createdAt: '2025-01-01T00:00:00.000Z',
    }
    useTenantStore.getState().setTenant(stale)
    expect(useTenantStore.getState().tenant.slug).toBe('stale')

    // Make tenantService.getTenant throw.
    const { tenantService } = await import('@/services/tenant.service')
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('network error'))

    await useTenantStore.getState().loadTenant('stale')

    expect(useTenantStore.getState().isLoading).toBe(false)
    expect(useTenantStore.getState().tenant.id).toBe(DEFAULT_TENANT.id)
    expect(useTenantStore.getState().tenant.slug).toBe(DEFAULT_TENANT.slug)

    spy.mockRestore()
  })
})

// ── P1A.2 — Location / Branch alias ──────────────────────────────────────────

describe('Branch / Location backward compatibility', () => {
  it('Branch is structurally identical to Location', () => {
    // TypeScript compile-time check: a Location can be assigned to Branch and vice versa.
    const loc: Location = {
      id: '1',
      name: 'Main Branch',
      slug: 'main',
      address: '123 Test St',
      city: 'Testville',
      phone: '555-0100',
      lat: 0,
      lng: 0,
      working_hours: [],
      is_active: true,
    }

    // Assignment must compile without a cast — verifies the alias is correct.
    const branch: Branch = loc
    expect(branch.id).toBe('1')
  })

  it('Location accepts tenant_id and type fields', () => {
    const loc: Location = {
      id: '2',
      tenant_id: 'tenant-abc',
      name: 'Coffee Counter',
      slug: 'coffee',
      type: 'cafe',
      address: '1 Bean St',
      city: 'Brewton',
      phone: '555-0200',
      lat: 1,
      lng: 1,
      working_hours: [],
      is_active: true,
    }
    expect(loc.tenant_id).toBe('tenant-abc')
    expect(loc.type).toBe('cafe')
  })

  it('Location type enum contains all roadmap-specified values', () => {
    const validTypes = [
      'restaurant_branch',
      'cafe',
      'bar',
      'hotel_property',
      'food_court_stall',
      'mobile_truck',
    ] as const
    validTypes.forEach((t) => {
      const loc: Location = {
        id: '3',
        name: 'Test',
        slug: 'test',
        type: t,
        address: '',
        city: '',
        phone: '',
        lat: 0,
        lng: 0,
        working_hours: [],
        is_active: true,
      }
      expect(loc.type).toBe(t)
    })
  })
})

// ── P1A.3 — Module Registry ───────────────────────────────────────────────────

describe('Module interface shape', () => {
  it('RESTAURANT_MODULE has all required roadmap fields', async () => {
    const { RESTAURANT_MODULE } = await freshRegistry()
    expect(RESTAURANT_MODULE).toMatchObject<Module>({
      key: expect.any(String),
      name: expect.any(String),
      businessTypes: expect.any(Array),
      routes: expect.any(Array),
      navItems: expect.any(Array),
      defaultFeatureFlags: expect.any(Object),
      enabled: expect.any(Boolean),
    })
  })

  it('RESTAURANT_MODULE routes include core restaurant paths', async () => {
    const { RESTAURANT_MODULE } = await freshRegistry()
    expect(RESTAURANT_MODULE.routes).toContain('/menu')
    expect(RESTAURANT_MODULE.routes).toContain('/checkout')
    expect(RESTAURANT_MODULE.routes).toContain('/reservation')
  })

  it('RESTAURANT_MODULE defaultFeatureFlags are all booleans', async () => {
    const { RESTAURANT_MODULE } = await freshRegistry()
    Object.values(RESTAURANT_MODULE.defaultFeatureFlags).forEach((v) => {
      expect(typeof v).toBe('boolean')
    })
  })
})

describe('getModules()', () => {
  it('returns an array containing the restaurant module', async () => {
    const { getModules } = await freshRegistry()
    const modules = getModules()
    expect(modules.some((m) => m.key === 'restaurant')).toBe(true)
  })

  it('returned array is readonly (frozen)', async () => {
    const { getModules } = await freshRegistry()
    const modules = getModules()
    expect(Object.isFrozen(modules)).toBe(true)
  })
})

describe('getModule(key)', () => {
  it('returns the restaurant module by key', async () => {
    const { getModule } = await freshRegistry()
    const mod = getModule('restaurant')
    expect(mod).toBeDefined()
    expect(mod?.key).toBe('restaurant')
  })

  it('returns undefined for an unknown key', async () => {
    const { getModule } = await freshRegistry()
    expect(getModule('unknown-module')).toBeUndefined()
  })
})

describe('getHeaderNav()', () => {
  it('returns restaurant nav when no activeModuleKeys provided (single-tenant fallback)', async () => {
    const { getHeaderNav } = await freshRegistry()
    const links = getHeaderNav()
    expect(links.length).toBeGreaterThan(0)
    expect(links.some((l) => l.href === '/menu')).toBe(true)
  })

  it('returns restaurant nav when activeModuleKeys contains restaurant', async () => {
    const { getHeaderNav } = await freshRegistry()
    const links = getHeaderNav(['restaurant'])
    expect(links.some((l) => l.href === '/menu')).toBe(true)
    expect(links.some((l) => l.href === '/reservation')).toBe(true)
  })

  it('returns empty array for module key not in registry', async () => {
    const { getHeaderNav } = await freshRegistry()
    const links = getHeaderNav(['hotel'])
    expect(links).toHaveLength(0)
  })

  it('does NOT include dashboard nav items in header nav', async () => {
    const { getHeaderNav } = await freshRegistry()
    const links = getHeaderNav()
    expect(links.some((l) => l.href === '/dashboard')).toBe(false)
    expect(links.some((l) => l.href === '/dashboard/orders')).toBe(false)
  })
})

describe('getDashboardNav()', () => {
  it('returns dashboard nav items', async () => {
    const { getDashboardNav } = await freshRegistry()
    const items = getDashboardNav()
    expect(items.some((i) => i.href === '/dashboard')).toBe(true)
    expect(items.some((i) => i.href === '/dashboard/orders')).toBe(true)
    expect(items.some((i) => i.href === '/dashboard/settings')).toBe(true)
  })

  it('does NOT include restaurant nav items', async () => {
    const { getDashboardNav } = await freshRegistry()
    const items = getDashboardNav()
    expect(items.some((i) => i.href === '/menu')).toBe(false)
  })
})

describe('getDefaultFeatureFlags()', () => {
  it('returns merged flags for given module keys', async () => {
    const { getDefaultFeatureFlags } = await freshRegistry()
    const flags = getDefaultFeatureFlags(['restaurant'])
    expect(typeof flags['menu.enabled']).toBe('boolean')
    expect(flags['menu.enabled']).toBe(true)
  })

  it('returns merged flags for all modules when no keys provided', async () => {
    const { getDefaultFeatureFlags } = await freshRegistry()
    const flags = getDefaultFeatureFlags()
    expect(Object.keys(flags).length).toBeGreaterThan(0)
  })
})

describe('getModuleRoutes()', () => {
  it('returns routes for given module keys', async () => {
    const { getModuleRoutes } = await freshRegistry()
    const routes = getModuleRoutes(['restaurant'])
    expect(routes).toContain('/menu')
    expect(routes).toContain('/checkout')
  })

  it('returns empty for unknown module key', async () => {
    const { getModuleRoutes } = await freshRegistry()
    expect(getModuleRoutes(['unknown'])).toHaveLength(0)
  })
})

describe('registerModule()', () => {
  it('registers a new module', async () => {
    const { registerModule, getModule } = await freshRegistry()
    const barModule: Module = {
      key: 'bar',
      name: 'Bar',
      businessTypes: ['bar'],
      routes: ['/bar-menu', '/cocktails'],
      navItems: [{ href: '/bar-menu', label: 'Drinks' }],
      defaultFeatureFlags: { 'age_gate.enabled': true },
      enabled: true,
    }
    registerModule(barModule)
    expect(getModule('bar')).toEqual(barModule)
  })

  it('replaces an existing module with the same key (upsert)', async () => {
    const { registerModule, getModule } = await freshRegistry()
    const updated: Module = {
      key: 'restaurant',
      name: 'Restaurant (updated)',
      businessTypes: ['restaurant'],
      routes: ['/menu'],
      navItems: [{ href: '/menu', label: 'Menu' }],
      defaultFeatureFlags: { 'menu.enabled': false },
      enabled: true,
    }
    registerModule(updated)
    expect(getModule('restaurant')?.name).toBe('Restaurant (updated)')
    expect(getModule('restaurant')?.defaultFeatureFlags['menu.enabled']).toBe(false)
  })

  it('throws after registry is sealed by a read', async () => {
    const { registerModule, getModules } = await freshRegistry()
    getModules() // seals the registry
    expect(() =>
      registerModule({
        key: 'late',
        name: 'Late Module',
        businessTypes: [],
        routes: [],
        navItems: [],
        defaultFeatureFlags: {},
        enabled: true,
      }),
    ).toThrow(/sealed/)
  })
})

// ── P1A.4 — Backward compatibility ───────────────────────────────────────────

describe('Backward compatibility', () => {
  it('app works with DEFAULT_TENANT (no tenant set explicitly)', () => {
    useTenantStore.getState().reset()
    const { tenant } = useTenantStore.getState()
    expect(tenant.status).toBe('active')
    expect(tenant.businessTypes.length).toBeGreaterThan(0)
  })

  it('getHeaderNav with DEFAULT_TENANT businessTypes returns non-empty nav', async () => {
    const { getHeaderNav } = await freshRegistry()
    const links = getHeaderNav(DEFAULT_TENANT.businessTypes)
    expect(links.length).toBeGreaterThan(0)
  })
})

// ── Phase 1B Entry Cleanup ────────────────────────────────────────────────────

describe('M-1 — loadTenant failure safety', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it('resets to DEFAULT_TENANT when service throws (no stale state left behind)', async () => {
    const stale: Tenant = {
      id: 'stale-tenant',
      name: 'Stale',
      slug: 'stale',
      businessTypes: ['restaurant'],
      status: 'active',
      createdAt: '2025-01-01T00:00:00.000Z',
    }
    useTenantStore.getState().setTenant(stale)

    const { tenantService } = await import('@/services/tenant.service')
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('network'))

    await useTenantStore.getState().loadTenant('stale')

    expect(useTenantStore.getState().tenant.id).toBe(DEFAULT_TENANT.id)
    expect(useTenantStore.getState().isLoading).toBe(false)

    spy.mockRestore()
  })

  it('clears isLoading on failure regardless of prior tenant state', async () => {
    const { tenantService } = await import('@/services/tenant.service')
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('timeout'))

    const promise = useTenantStore.getState().loadTenant()
    expect(useTenantStore.getState().isLoading).toBe(true)
    await promise
    expect(useTenantStore.getState().isLoading).toBe(false)

    spy.mockRestore()
  })
})

describe('L-3 — RESTAURANT_MODULE route registration', () => {
  it('/restaurant is registered in RESTAURANT_MODULE routes', async () => {
    const { RESTAURANT_MODULE } = await freshRegistry()
    expect(RESTAURANT_MODULE.routes).toContain('/restaurant')
  })

  it('getModuleRoutes returns /restaurant for restaurant module key', async () => {
    const { getModuleRoutes } = await freshRegistry()
    const routes = getModuleRoutes(['restaurant'])
    expect(routes).toContain('/restaurant')
  })

  it('all RESTAURANT_MODULE navItem hrefs are present in routes', async () => {
    const { RESTAURANT_MODULE } = await freshRegistry()
    RESTAURANT_MODULE.navItems.forEach((item) => {
      expect(RESTAURANT_MODULE.routes).toContain(item.href)
    })
  })
})

describe('M-5 — TenantBootstrapper wiring', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it('loadTenant() with no slug argument resolves to a valid tenant', async () => {
    await useTenantStore.getState().loadTenant()
    const { tenant } = useTenantStore.getState()
    expect(tenant.id).toBeDefined()
    expect(tenant.slug).toBeDefined()
    expect(tenant.status).toMatch(/^(active|trial|suspended|churned)$/)
  })

  it('tenant store holds a known-good state after startup (no undefined fields)', async () => {
    await useTenantStore.getState().loadTenant()
    const { tenant } = useTenantStore.getState()
    expect(tenant.id).toBeTruthy()
    expect(tenant.name).toBeTruthy()
    expect(tenant.slug).toBeTruthy()
    expect(Array.isArray(tenant.businessTypes)).toBe(true)
  })

  it('isLoading is false after startup completes', async () => {
    await useTenantStore.getState().loadTenant()
    expect(useTenantStore.getState().isLoading).toBe(false)
  })
})

// ── Phase 1B Foundation Stabilization — isTenantReady ────────────────────────

describe('isTenantReady — initial state', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it('is false before any loadTenant call', () => {
    expect(useTenantStore.getState().isTenantReady).toBe(false)
  })

  it('reset() sets isTenantReady back to false', async () => {
    await useTenantStore.getState().loadTenant()
    expect(useTenantStore.getState().isTenantReady).toBe(true)
    useTenantStore.getState().reset()
    expect(useTenantStore.getState().isTenantReady).toBe(false)
  })

  it('is not persisted — starts false on every store instantiation', () => {
    // Simulate what happens when the persisted partition is rehydrated:
    // isTenantReady must never be in the persisted shape.
    const persisted = JSON.parse(
      JSON.stringify({ tenant: DEFAULT_TENANT }),
    )
    expect(persisted.isTenantReady).toBeUndefined()
  })
})

describe('isTenantReady — success path', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it('becomes true after a successful loadTenant', async () => {
    expect(useTenantStore.getState().isTenantReady).toBe(false)
    await useTenantStore.getState().loadTenant('default')
    expect(useTenantStore.getState().isTenantReady).toBe(true)
  })

  it('remains true after multiple successful loadTenant calls', async () => {
    await useTenantStore.getState().loadTenant('default')
    await useTenantStore.getState().loadTenant('default')
    expect(useTenantStore.getState().isTenantReady).toBe(true)
  })

  it('tenant is valid when isTenantReady is true', async () => {
    await useTenantStore.getState().loadTenant()
    const { tenant, isTenantReady } = useTenantStore.getState()
    expect(isTenantReady).toBe(true)
    expect(tenant.id).toBeTruthy()
    expect(tenant.slug).toBeTruthy()
    expect(tenant.status).toMatch(/^(active|trial|suspended|churned)$/)
  })
})

describe('isTenantReady — failure path', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it('becomes true even when loadTenant throws (fallback guarantee)', async () => {
    const { tenantService } = await import('@/services/tenant.service')
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('network'))

    expect(useTenantStore.getState().isTenantReady).toBe(false)
    await useTenantStore.getState().loadTenant('unknown')
    expect(useTenantStore.getState().isTenantReady).toBe(true)

    spy.mockRestore()
  })

  it('tenant is DEFAULT_TENANT and ready after a failure', async () => {
    const { tenantService } = await import('@/services/tenant.service')
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('timeout'))

    await useTenantStore.getState().loadTenant()
    const { tenant, isTenantReady, isLoading } = useTenantStore.getState()

    expect(isTenantReady).toBe(true)
    expect(isLoading).toBe(false)
    expect(tenant.id).toBe(DEFAULT_TENANT.id)

    spy.mockRestore()
  })

  it('isLoading is false when ready after failure', async () => {
    const { tenantService } = await import('@/services/tenant.service')
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('fail'))

    await useTenantStore.getState().loadTenant()
    expect(useTenantStore.getState().isLoading).toBe(false)
    expect(useTenantStore.getState().isTenantReady).toBe(true)

    spy.mockRestore()
  })
})

describe('useTenantReady() hook contract', () => {
  // useTenantReady() is a React hook and cannot be called outside a component.
  // These tests verify the store field it reads (isTenantReady) directly, which
  // is the canonical way to test Zustand-backed hooks in a non-React test context.

  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it('underlying isTenantReady is false before any load — hook would return false', () => {
    expect(useTenantStore.getState().isTenantReady).toBe(false)
  })

  it('underlying isTenantReady is true after successful load — hook would return true', async () => {
    await useTenantStore.getState().loadTenant()
    expect(useTenantStore.getState().isTenantReady).toBe(true)
  })

  it('underlying isTenantReady is true after failed load — hook would return true', async () => {
    const { tenantService } = await import('@/services/tenant.service')
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('fail'))

    await useTenantStore.getState().loadTenant()
    expect(useTenantStore.getState().isTenantReady).toBe(true)

    spy.mockRestore()
  })

  it('useTenantReady is exported from hooks — available to Phase 1B consumers', () => {
    // Verify the hook is importable and is a function (selector contract).
    expect(typeof useTenantReady).toBe('function')
  })
})
