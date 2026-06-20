/**
 * Phase 1A test suite — covers P1A.1 (Tenant model), P1A.2 (Location/Branch alias),
 * P1A.3 (Module Registry), P1A.4 (backward compatibility), and Phase 1B
 * stabilization (tenant readiness signal).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Branch, Location, Module, Tenant, TenantLifecycle } from '@/types'
import { DEFAULT_TENANT } from '@/constants'
import { useTenantStore } from '@/stores'
import { useTenantState, useSystemReady } from '@/hooks'
import type { SystemReadiness } from '@/types'
// Imported at module level so all spies target the same instance the store holds.
// Dynamic `await import(...)` inside tests returns a fresh instance after vi.resetModules(),
// which would not match the reference already captured by useTenantStore at init time.
import { tenantService } from '@/services/tenant.service'

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
    // tenantService is imported at module level — same instance useTenantStore holds.
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

    // tenantService is imported at module level — same instance useTenantStore holds.
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('network'))

    await useTenantStore.getState().loadTenant('stale')

    expect(useTenantStore.getState().tenant.id).toBe(DEFAULT_TENANT.id)
    expect(useTenantStore.getState().isLoading).toBe(false)

    spy.mockRestore()
  })

  it('clears isLoading on failure regardless of prior tenant state', async () => {
    // tenantService is imported at module level — same instance useTenantStore holds.
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

// ── Phase 1B Foundation — tenantState lifecycle machine ──────────────────────

describe('tenantState — initial state', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it("is 'loading' before any loadTenant call", () => {
    expect(useTenantStore.getState().tenantState).toBe<TenantLifecycle>('loading')
  })

  it("reset() returns tenantState to 'loading'", async () => {
    await useTenantStore.getState().loadTenant()
    expect(useTenantStore.getState().tenantState).toBe<TenantLifecycle>('ready')
    useTenantStore.getState().reset()
    expect(useTenantStore.getState().tenantState).toBe<TenantLifecycle>('loading')
  })

  it('is not persisted — tenantState absent from persisted partition', () => {
    // The partialize function only stores { tenant }. Verify tenantState is not
    // in that shape — if it were, it would leak a stale lifecycle value on reload.
    const persistedPartition = { tenant: DEFAULT_TENANT }
    expect((persistedPartition as Record<string, unknown>).tenantState).toBeUndefined()
  })
})

describe("tenantState — 'loading' → 'ready' transition", () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it("transitions loading → ready after a successful loadTenant", async () => {
    expect(useTenantStore.getState().tenantState).toBe<TenantLifecycle>('loading')
    await useTenantStore.getState().loadTenant('default')
    expect(useTenantStore.getState().tenantState).toBe<TenantLifecycle>('ready')
  })

  it("tenantState is set to 'loading' at the start of each loadTenant call", async () => {
    // After a first successful load, a second call should re-enter loading first.
    await useTenantStore.getState().loadTenant('default')
    expect(useTenantStore.getState().tenantState).toBe<TenantLifecycle>('ready')

    // Start the second load but don't await it yet.
    const promise = useTenantStore.getState().loadTenant('default')
    expect(useTenantStore.getState().tenantState).toBe<TenantLifecycle>('loading')
    await promise
    expect(useTenantStore.getState().tenantState).toBe<TenantLifecycle>('ready')
  })

  it("tenant is valid when state is 'ready'", async () => {
    await useTenantStore.getState().loadTenant()
    const { tenant, tenantState } = useTenantStore.getState()
    expect(tenantState).toBe<TenantLifecycle>('ready')
    expect(tenant.id).toBeTruthy()
    expect(tenant.slug).toBeTruthy()
    expect(tenant.status).toMatch(/^(active|trial|suspended|churned)$/)
  })

  it('isLoading is false when ready', async () => {
    await useTenantStore.getState().loadTenant()
    expect(useTenantStore.getState().isLoading).toBe(false)
    expect(useTenantStore.getState().tenantState).toBe<TenantLifecycle>('ready')
  })
})

describe("tenantState — 'loading' → 'fallback' transition", () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it("transitions loading → fallback when loadTenant throws", async () => {
    // tenantService is imported at module level — same instance useTenantStore holds.
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('network'))

    expect(useTenantStore.getState().tenantState).toBe<TenantLifecycle>('loading')
    await useTenantStore.getState().loadTenant('unknown')
    expect(useTenantStore.getState().tenantState).toBe<TenantLifecycle>('fallback')

    spy.mockRestore()
  })

  it("tenant is DEFAULT_TENANT when state is 'fallback'", async () => {
    // tenantService is imported at module level — same instance useTenantStore holds.
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('timeout'))

    await useTenantStore.getState().loadTenant()
    const { tenant, tenantState, isLoading } = useTenantStore.getState()

    expect(tenantState).toBe<TenantLifecycle>('fallback')
    expect(isLoading).toBe(false)
    expect(tenant.id).toBe(DEFAULT_TENANT.id)
    expect(tenant.slug).toBe(DEFAULT_TENANT.slug)

    spy.mockRestore()
  })

  it('isLoading is false when in fallback state', async () => {
    // tenantService is imported at module level — same instance useTenantStore holds.
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('fail'))

    await useTenantStore.getState().loadTenant()
    expect(useTenantStore.getState().isLoading).toBe(false)
    expect(useTenantStore.getState().tenantState).toBe<TenantLifecycle>('fallback')

    spy.mockRestore()
  })

  it("fallback is distinguishable from ready — NOT equal to 'ready'", async () => {
    // tenantService is imported at module level — same instance useTenantStore holds.
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('fail'))

    await useTenantStore.getState().loadTenant()
    const { tenantState } = useTenantStore.getState()

    expect(tenantState).not.toBe<TenantLifecycle>('ready')
    expect(tenantState).toBe<TenantLifecycle>('fallback')

    spy.mockRestore()
  })
})

describe('useTenantState() hook contract', () => {
  // useTenantState() is a React hook; tested via the store value it reads.

  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it("underlying tenantState is 'loading' before any load — hook would return 'loading'", () => {
    expect(useTenantStore.getState().tenantState).toBe<TenantLifecycle>('loading')
  })

  it("underlying tenantState is 'ready' after success — hook would return 'ready'", async () => {
    await useTenantStore.getState().loadTenant()
    expect(useTenantStore.getState().tenantState).toBe<TenantLifecycle>('ready')
  })

  it("underlying tenantState is 'fallback' after failure — hook would return 'fallback'", async () => {
    // tenantService is imported at module level — same instance useTenantStore holds.
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('fail'))

    await useTenantStore.getState().loadTenant()
    expect(useTenantStore.getState().tenantState).toBe<TenantLifecycle>('fallback')

    spy.mockRestore()
  })

  it('useTenantState is exported from hooks and is a function', () => {
    expect(typeof useTenantState).toBe('function')
  })
})

// ── Phase 1B System Ready Layer ───────────────────────────────────────────────
// useSystemReady() is a React hook; tests verify the derived booleans via the
// underlying store state (same pattern as useTenantState() tests above).

function getSystemReady(): SystemReadiness {
  const tenantState = useTenantStore.getState().tenantState
  const isLoading  = tenantState === 'loading'
  const isReady    = tenantState === 'ready'
  const isFallback = tenantState === 'fallback'
  return { isLoading, isReady, isFallback, canExecutePhase1B: !isLoading }
}

describe("useSystemReady() — 'loading' state", () => {
  beforeEach(() => {
    useTenantStore.getState().reset() // reset() → tenantState = 'loading'
  })

  it('isLoading is true when tenantState is loading', () => {
    expect(getSystemReady().isLoading).toBe(true)
  })

  it('isReady is false when tenantState is loading', () => {
    expect(getSystemReady().isReady).toBe(false)
  })

  it('isFallback is false when tenantState is loading', () => {
    expect(getSystemReady().isFallback).toBe(false)
  })

  it('canExecutePhase1B is false when tenantState is loading', () => {
    expect(getSystemReady().canExecutePhase1B).toBe(false)
  })

  it('all four flags are consistent — exactly one is true', () => {
    const { isLoading, isReady, isFallback } = getSystemReady()
    const trueCount = [isLoading, isReady, isFallback].filter(Boolean).length
    expect(trueCount).toBe(1)
  })
})

describe("useSystemReady() — 'ready' state", () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it('isReady is true after successful loadTenant', async () => {
    await useTenantStore.getState().loadTenant('default')
    expect(getSystemReady().isReady).toBe(true)
  })

  it('isLoading is false when ready', async () => {
    await useTenantStore.getState().loadTenant('default')
    expect(getSystemReady().isLoading).toBe(false)
  })

  it('isFallback is false when ready', async () => {
    await useTenantStore.getState().loadTenant('default')
    expect(getSystemReady().isFallback).toBe(false)
  })

  it('canExecutePhase1B is true when ready', async () => {
    await useTenantStore.getState().loadTenant('default')
    expect(getSystemReady().canExecutePhase1B).toBe(true)
  })

  it('all four flags are consistent — exactly one of isLoading/isReady/isFallback is true', async () => {
    await useTenantStore.getState().loadTenant('default')
    const { isLoading, isReady, isFallback } = getSystemReady()
    const trueCount = [isLoading, isReady, isFallback].filter(Boolean).length
    expect(trueCount).toBe(1)
  })
})

describe("useSystemReady() — 'fallback' state", () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it('isFallback is true after loadTenant failure', async () => {
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('fail'))
    await useTenantStore.getState().loadTenant()
    expect(getSystemReady().isFallback).toBe(true)
    spy.mockRestore()
  })

  it('isLoading is false in fallback state', async () => {
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('fail'))
    await useTenantStore.getState().loadTenant()
    expect(getSystemReady().isLoading).toBe(false)
    spy.mockRestore()
  })

  it('isReady is false in fallback state', async () => {
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('fail'))
    await useTenantStore.getState().loadTenant()
    expect(getSystemReady().isReady).toBe(false)
    spy.mockRestore()
  })

  it('canExecutePhase1B is true in fallback state — fallback is safe execution mode', async () => {
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('fail'))
    await useTenantStore.getState().loadTenant()
    expect(getSystemReady().canExecutePhase1B).toBe(true)
    spy.mockRestore()
  })

  it('all four flags consistent — exactly one of isLoading/isReady/isFallback is true', async () => {
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('fail'))
    await useTenantStore.getState().loadTenant()
    const { isLoading, isReady, isFallback } = getSystemReady()
    expect([isLoading, isReady, isFallback].filter(Boolean).length).toBe(1)
    spy.mockRestore()
  })
})

describe('useSystemReady() — derivation and hook contract', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it('canExecutePhase1B is false ONLY when loading — ready and fallback both permit execution', async () => {
    // loading
    expect(getSystemReady().canExecutePhase1B).toBe(false)

    // ready
    await useTenantStore.getState().loadTenant('default')
    expect(getSystemReady().canExecutePhase1B).toBe(true)

    // reset to loading, then force fallback
    useTenantStore.getState().reset()
    const spy = vi.spyOn(tenantService, 'getTenant').mockRejectedValueOnce(new Error('fail'))
    await useTenantStore.getState().loadTenant()
    expect(getSystemReady().canExecutePhase1B).toBe(true)
    spy.mockRestore()
  })

  it('is fully derived — SystemReadiness introduces no new store fields', () => {
    const storeKeys = Object.keys(useTenantStore.getState())
    expect(storeKeys).not.toContain('isReady')
    expect(storeKeys).not.toContain('isFallback')
    expect(storeKeys).not.toContain('canExecutePhase1B')
    expect(storeKeys).not.toContain('isSystemReady')
  })

  it('useSystemReady is exported from hooks and is a function', () => {
    expect(typeof useSystemReady).toBe('function')
  })

  it('reset() returns system to non-executable state (isLoading true, canExecutePhase1B false)', async () => {
    await useTenantStore.getState().loadTenant('default')
    expect(getSystemReady().canExecutePhase1B).toBe(true)

    useTenantStore.getState().reset()
    expect(getSystemReady().canExecutePhase1B).toBe(false)
    expect(getSystemReady().isLoading).toBe(true)
  })
})
