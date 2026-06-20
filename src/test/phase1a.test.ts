/**
 * Phase 1A test suite — covers P1A.1 (Tenant model), P1A.2 (Location/Branch alias),
 * P1A.3 (Module Registry), and P1A.4 (backward compatibility).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Branch, Location, Module, Tenant } from '@/types'
import { DEFAULT_TENANT } from '@/constants'
import { useTenantStore } from '@/stores'

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
