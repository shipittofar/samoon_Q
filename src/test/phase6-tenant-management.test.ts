/**
 * P6.15 — Tenant Management Finalization
 * A=route registration, B=ADMIN_TENANT_ROUTES constant, C=tenant listing,
 * D=getTenants mock data, E=activateTenant, F=suspendTenant, G=archiveTenant,
 * H=status transitions, I=clone preserves businessType, J=clone preserves flags,
 * K=clone preserves branding, L=clone validation, M=endpoints,
 * N=hooks, O=admin tenants page, P=tenant detail page, Q=analytics summary,
 * R=TenantStatus type, S=status management ui, T=mock data coverage,
 * U=copy semantics, V=regression adminNavItems, W=ADMIN_TENANT_ROUTES spread,
 * X=tenant detail sections
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.resolve(__dirname, '../..')

function readSrc(rel: string) {
  return fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8')
}

async function freshRegistry() {
  vi.resetModules()
  return import('@/modules/registry')
}

async function freshTenantService() {
  vi.resetModules()
  const mod = await import('@/services/tenant.service')
  mod.tenantService._resetMockList()
  return mod.tenantService
}

async function freshProvisioningService() {
  vi.resetModules()
  const mod = await import('@/services/tenant-provisioning.service')
  mod.tenantProvisioningService._resetMockSlugs()
  return mod.tenantProvisioningService
}

const ALL_MODULES = ['restaurant', 'cafe', 'bar', 'food_court', 'food_truck', 'mobile_cafe']

// ── A: Route Registration ─────────────────────────────────────────────────────

describe('A — route registration: /admin/tenants in all modules', () => {
  afterEach(() => vi.resetModules())

  for (const moduleKey of ALL_MODULES) {
    it(`${moduleKey} module routes include /admin/tenants`, async () => {
      const reg = await freshRegistry()
      const mod = reg.getModule(moduleKey)
      expect(mod?.routes).toContain('/admin/tenants')
    })

    it(`${moduleKey} module routes include /admin/tenants/new`, async () => {
      const reg = await freshRegistry()
      const mod = reg.getModule(moduleKey)
      expect(mod?.routes).toContain('/admin/tenants/new')
    })
  }
})

// ── B: ADMIN_TENANT_ROUTES constant ──────────────────────────────────────────

describe('B — ADMIN_TENANT_ROUTES constant', () => {
  it('is exported from registry', () => {
    const src = readSrc('modules/registry.ts')
    expect(src).toContain('ADMIN_TENANT_ROUTES')
    expect(src).toContain("export const ADMIN_TENANT_ROUTES")
  })

  it('contains /admin/tenants', async () => {
    const { ADMIN_TENANT_ROUTES } = await freshRegistry()
    expect(ADMIN_TENANT_ROUTES).toContain('/admin/tenants')
  })

  it('contains /admin/tenants/new', async () => {
    const { ADMIN_TENANT_ROUTES } = await freshRegistry()
    expect(ADMIN_TENANT_ROUTES).toContain('/admin/tenants/new')
  })

  it('has exactly 2 entries', async () => {
    const { ADMIN_TENANT_ROUTES } = await freshRegistry()
    expect(ADMIN_TENANT_ROUTES).toHaveLength(2)
  })

  it('is spread into module routes (no per-module duplication)', () => {
    const src = readSrc('modules/registry.ts')
    const spreadCount = (src.match(/\.\.\.ADMIN_TENANT_ROUTES/g) ?? []).length
    expect(spreadCount).toBe(6)
  })
})

// ── C: Tenant Listing ─────────────────────────────────────────────────────────

describe('C — tenantService.getTenants()', () => {
  it('returns an array', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    expect(Array.isArray(tenants)).toBe(true)
  })

  it('returns at least 6 tenants (one per business type)', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    expect(tenants.length).toBeGreaterThanOrEqual(6)
  })

  it('each tenant has id, name, slug, businessTypes, status', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    for (const t of tenants) {
      expect(typeof t.id).toBe('string')
      expect(typeof t.name).toBe('string')
      expect(typeof t.slug).toBe('string')
      expect(Array.isArray(t.businessTypes)).toBe(true)
      expect(typeof t.status).toBe('string')
    }
  })

  it('returns a copy — mutations do not affect subsequent calls', async () => {
    const svc = await freshTenantService()
    const t1 = await svc.getTenants()
    t1[0].name = 'MUTATED'
    const t2 = await svc.getTenants()
    expect(t2[0].name).not.toBe('MUTATED')
  })
})

// ── D: Mock tenant data coverage ──────────────────────────────────────────────

describe('D — mock tenant data covers all 6 business types', () => {
  it('restaurant tenant exists', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    expect(tenants.some((t) => t.businessTypes.includes('restaurant'))).toBe(true)
  })

  it('cafe tenant exists', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    expect(tenants.some((t) => t.businessTypes.includes('cafe'))).toBe(true)
  })

  it('bar tenant exists', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    expect(tenants.some((t) => t.businessTypes.includes('bar'))).toBe(true)
  })

  it('food_court tenant exists', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    expect(tenants.some((t) => t.businessTypes.includes('food_court'))).toBe(true)
  })

  it('food_truck tenant exists', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    expect(tenants.some((t) => t.businessTypes.includes('food_truck'))).toBe(true)
  })

  it('mobile_cafe tenant exists', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    expect(tenants.some((t) => t.businessTypes.includes('mobile_cafe'))).toBe(true)
  })

  it('at least one tenant has settings.featureFlags', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    const withFlags = tenants.filter((t) => t.settings?.featureFlags)
    expect(withFlags.length).toBeGreaterThan(0)
  })

  it('at least one tenant has settings.theme.primaryColor', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    const withColor = tenants.filter((t) => (t.settings?.theme as Record<string, string>)?.primaryColor)
    expect(withColor.length).toBeGreaterThan(0)
  })
})

// ── E: activateTenant ─────────────────────────────────────────────────────────

describe('E — activateTenant()', () => {
  it('sets suspended tenant to active', async () => {
    const svc = await freshTenantService()
    const updated = await svc.activateTenant('road-bites')
    expect(updated.status).toBe('active')
  })

  it('sets trial tenant to active', async () => {
    const svc = await freshTenantService()
    const updated = await svc.activateTenant('central-food-court')
    expect(updated.status).toBe('active')
  })

  it('returns a Tenant object with name and slug', async () => {
    const svc = await freshTenantService()
    const updated = await svc.activateTenant('road-bites')
    expect(typeof updated.name).toBe('string')
    expect(typeof updated.slug).toBe('string')
  })

  it('status persists in subsequent getTenants()', async () => {
    const svc = await freshTenantService()
    await svc.activateTenant('road-bites')
    const tenants = await svc.getTenants()
    const t = tenants.find((x) => x.slug === 'road-bites')
    expect(t?.status).toBe('active')
  })
})

// ── F: suspendTenant ──────────────────────────────────────────────────────────

describe('F — suspendTenant()', () => {
  it('sets active tenant to suspended', async () => {
    const svc = await freshTenantService()
    const updated = await svc.suspendTenant('savor')
    expect(updated.status).toBe('suspended')
  })

  it('returns Tenant object with id', async () => {
    const svc = await freshTenantService()
    const updated = await svc.suspendTenant('brew-cafe')
    expect(typeof updated.id).toBe('string')
  })

  it('status persists in subsequent getTenants()', async () => {
    const svc = await freshTenantService()
    await svc.suspendTenant('savor')
    const tenants = await svc.getTenants()
    const t = tenants.find((x) => x.slug === 'savor')
    expect(t?.status).toBe('suspended')
  })
})

// ── G: archiveTenant ──────────────────────────────────────────────────────────

describe('G — archiveTenant()', () => {
  it('sets active tenant to archived', async () => {
    const svc = await freshTenantService()
    const updated = await svc.archiveTenant('savor')
    expect(updated.status).toBe('archived')
  })

  it('sets suspended tenant to archived', async () => {
    const svc = await freshTenantService()
    const updated = await svc.archiveTenant('road-bites')
    expect(updated.status).toBe('archived')
  })

  it('status persists in subsequent getTenants()', async () => {
    const svc = await freshTenantService()
    await svc.archiveTenant('brew-cafe')
    const tenants = await svc.getTenants()
    const t = tenants.find((x) => x.slug === 'brew-cafe')
    expect(t?.status).toBe('archived')
  })
})

// ── H: Status Transitions ─────────────────────────────────────────────────────

describe('H — status transitions', () => {
  it('activate → suspend → archive lifecycle', async () => {
    const svc = await freshTenantService()
    let t = await svc.activateTenant('road-bites')
    expect(t.status).toBe('active')
    t = await svc.suspendTenant('road-bites')
    expect(t.status).toBe('suspended')
    t = await svc.archiveTenant('road-bites')
    expect(t.status).toBe('archived')
  })

  it('TenantStatus includes archived', () => {
    const src = readSrc('types/index.ts')
    expect(src).toContain("'archived'")
    expect(src).toContain('TenantStatus')
  })

  it('tenant.service.ts has activateTenant method', () => {
    const src = readSrc('services/tenant.service.ts')
    expect(src).toContain('activateTenant')
  })

  it('tenant.service.ts has suspendTenant method', () => {
    const src = readSrc('services/tenant.service.ts')
    expect(src).toContain('suspendTenant')
  })

  it('tenant.service.ts has archiveTenant method', () => {
    const src = readSrc('services/tenant.service.ts')
    expect(src).toContain('archiveTenant')
  })
})

// ── I: Clone preserves businessType ──────────────────────────────────────────

describe('I — cloneTenant preserves source businessType', () => {
  it('clone of cafe tenant has cafe businessType', async () => {
    const svc = await freshProvisioningService()
    const result = await svc.cloneTenant('tenant-brew-cafe-01', 'cafe-clone', 'Cafe Clone')
    expect(result.success).toBe(true)
    expect(result.tenant?.businessTypes).toContain('cafe')
  })

  it('clone of bar tenant has bar businessType', async () => {
    const svc = await freshProvisioningService()
    const result = await svc.cloneTenant('tenant-oak-bar-01', 'bar-clone', 'Bar Clone')
    expect(result.success).toBe(true)
    expect(result.tenant?.businessTypes).toContain('bar')
  })

  it('clone of food_truck tenant has food_truck businessType', async () => {
    const svc = await freshProvisioningService()
    const result = await svc.cloneTenant('tenant-road-bites-01', 'truck-clone', 'Truck Clone')
    expect(result.success).toBe(true)
    expect(result.tenant?.businessTypes).toContain('food_truck')
  })

  it('clone of food_court tenant has food_court businessType', async () => {
    const svc = await freshProvisioningService()
    const result = await svc.cloneTenant('tenant-central-fc-01', 'fc-clone', 'FC Clone')
    expect(result.success).toBe(true)
    expect(result.tenant?.businessTypes).toContain('food_court')
  })

  it('clone of mobile_cafe tenant has mobile_cafe businessType', async () => {
    const svc = await freshProvisioningService()
    const result = await svc.cloneTenant('tenant-wheels-brews-01', 'mc-clone', 'MC Clone')
    expect(result.success).toBe(true)
    expect(result.tenant?.businessTypes).toContain('mobile_cafe')
  })

  it('clone of restaurant tenant has restaurant businessType', async () => {
    const svc = await freshProvisioningService()
    const result = await svc.cloneTenant('tenant-savor-01', 'rest-clone', 'Rest Clone')
    expect(result.success).toBe(true)
    expect(result.tenant?.businessTypes).toContain('restaurant')
  })
})

// ── J: Clone preserves feature flags ─────────────────────────────────────────

describe('J — cloneTenant preserves feature flags', () => {
  it('clone of cafe preserves cafe.loyalty.enabled flag', async () => {
    const svc = await freshProvisioningService()
    const result = await svc.cloneTenant('tenant-brew-cafe-01', 'cafe-flags-clone', 'Cafe Flags Clone')
    const flags = result.tenant?.settings?.featureFlags as Record<string, boolean>
    expect(flags?.['cafe.loyalty.enabled']).toBe(true)
  })

  it('clone of food_truck preserves food_truck.live_location.enabled flag', async () => {
    const svc = await freshProvisioningService()
    const result = await svc.cloneTenant('tenant-road-bites-01', 'truck-flags-clone', 'Truck Flags Clone')
    const flags = result.tenant?.settings?.featureFlags as Record<string, boolean>
    expect(flags?.['food_truck.live_location.enabled']).toBe(true)
  })

  it('clone of food_court preserves vendor_management flag', async () => {
    const svc = await freshProvisioningService()
    const result = await svc.cloneTenant('tenant-central-fc-01', 'fc-flags-clone', 'FC Flags Clone')
    const flags = result.tenant?.settings?.featureFlags as Record<string, boolean>
    expect(flags?.['food_court.vendor_management.enabled']).toBe(true)
  })

  it('clone of mobile_cafe preserves loyalty flag', async () => {
    const svc = await freshProvisioningService()
    const result = await svc.cloneTenant('tenant-wheels-brews-01', 'mc-flags-clone', 'MC Flags Clone')
    const flags = result.tenant?.settings?.featureFlags as Record<string, boolean>
    expect(flags?.['mobile_cafe.loyalty.enabled']).toBe(true)
  })
})

// ── K: Clone preserves branding ───────────────────────────────────────────────

describe('K — cloneTenant preserves branding', () => {
  it('clone of cafe preserves cafe primaryColor', async () => {
    const svc = await freshProvisioningService()
    const result = await svc.cloneTenant('tenant-brew-cafe-01', 'cafe-brand-clone', 'Cafe Brand Clone')
    const theme = result.tenant?.settings?.theme as Record<string, string>
    expect(theme?.primaryColor).toBe('#6f4e37')
  })

  it('clone of bar preserves bar primaryColor', async () => {
    const svc = await freshProvisioningService()
    const result = await svc.cloneTenant('tenant-oak-bar-01', 'bar-brand-clone', 'Bar Brand Clone')
    const theme = result.tenant?.settings?.theme as Record<string, string>
    expect(theme?.primaryColor).toBe('#1a1a2e')
  })

  it('clone of food_truck preserves food_truck primaryColor', async () => {
    const svc = await freshProvisioningService()
    const result = await svc.cloneTenant('tenant-road-bites-01', 'truck-brand-clone', 'Truck Brand Clone')
    const theme = result.tenant?.settings?.theme as Record<string, string>
    expect(theme?.primaryColor).toBe('#f4a261')
  })

  it('clone uses newName not source name', async () => {
    const svc = await freshProvisioningService()
    const result = await svc.cloneTenant('tenant-savor-01', 'named-clone-01', 'Brand New Name')
    expect(result.tenant?.name).toBe('Brand New Name')
  })
})

// ── L: Clone validation ───────────────────────────────────────────────────────

describe('L — cloneTenant validation', () => {
  it('rejects duplicate slug', async () => {
    const svc = await freshProvisioningService()
    const r = await svc.cloneTenant('src', 'default', 'Dup')
    expect(r.success).toBe(false)
  })

  it('rejects invalid slug', async () => {
    const svc = await freshProvisioningService()
    const r = await svc.cloneTenant('src', 'INVALID!', 'Name')
    expect(r.success).toBe(false)
  })

  it('rejects short name', async () => {
    const svc = await freshProvisioningService()
    const r = await svc.cloneTenant('src', 'ok-slug-cl', 'X')
    expect(r.success).toBe(false)
  })

  it('second clone of same source with different slug succeeds', async () => {
    const svc = await freshProvisioningService()
    const r1 = await svc.cloneTenant('tenant-savor-01', 'clone-a', 'Clone A')
    const r2 = await svc.cloneTenant('tenant-savor-01', 'clone-b', 'Clone B')
    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
  })
})

// ── M: Endpoints ──────────────────────────────────────────────────────────────

describe('M — endpoints', () => {
  it('TENANTS.ACTIVATE is defined', () => {
    const src = readSrc('services/endpoints.ts')
    expect(src).toContain('ACTIVATE')
    expect(src).toContain('/activate/')
  })

  it('TENANTS.SUSPEND is defined', () => {
    const src = readSrc('services/endpoints.ts')
    expect(src).toContain('SUSPEND')
    expect(src).toContain('/suspend/')
  })

  it('TENANTS.ARCHIVE is defined', () => {
    const src = readSrc('services/endpoints.ts')
    expect(src).toContain('ARCHIVE')
    expect(src).toContain('/archive/')
  })

  it('TENANTS.LIST is defined', () => {
    const src = readSrc('services/endpoints.ts')
    expect(src).toContain("LIST: '/tenants/'")
  })

  it('TENANTS.PROVISION is defined', () => {
    const src = readSrc('services/endpoints.ts')
    expect(src).toContain('PROVISION')
  })
})

// ── N: Hooks ──────────────────────────────────────────────────────────────────

describe('N — hooks', () => {
  const src = () => readSrc('hooks/index.ts')

  it('exports useTenants', () => {
    expect(src()).toContain('useTenants')
  })

  it('exports useActivateTenant', () => {
    expect(src()).toContain('useActivateTenant')
  })

  it('exports useSuspendTenant', () => {
    expect(src()).toContain('useSuspendTenant')
  })

  it('exports useArchiveTenant', () => {
    expect(src()).toContain('useArchiveTenant')
  })

  it('useTenants uses useQuery', () => {
    const content = src()
    const fnIdx = content.indexOf('function useTenants')
    const qIdx = content.indexOf('useQuery', fnIdx)
    expect(qIdx).toBeGreaterThan(fnIdx)
  })

  it('useActivateTenant uses useMutation', () => {
    const content = src()
    const fnIdx = content.indexOf('function useActivateTenant')
    const mIdx = content.indexOf('useMutation', fnIdx)
    expect(mIdx).toBeGreaterThan(fnIdx)
  })

  it('useSuspendTenant uses useMutation', () => {
    const content = src()
    const fnIdx = content.indexOf('function useSuspendTenant')
    const mIdx = content.indexOf('useMutation', fnIdx)
    expect(mIdx).toBeGreaterThan(fnIdx)
  })

  it('useArchiveTenant uses useMutation', () => {
    const content = src()
    const fnIdx = content.indexOf('function useArchiveTenant')
    const mIdx = content.indexOf('useMutation', fnIdx)
    expect(mIdx).toBeGreaterThan(fnIdx)
  })

  it('imports tenantService', () => {
    expect(src()).toContain('tenantService')
  })
})

// ── O: Admin Tenants Page ─────────────────────────────────────────────────────

describe('O — admin tenants page (/admin/tenants)', () => {
  const src = () => readSrc('app/admin/tenants/page.tsx')

  it('is a client component', () => {
    expect(src()).toContain("'use client'")
  })

  it('has aria-label "Tenant Management"', () => {
    expect(src()).toContain('Tenant Management')
  })

  it('uses useTenants hook (not just templates)', () => {
    expect(src()).toContain('useTenants')
  })

  it('has a link to /admin/tenants/new', () => {
    expect(src()).toContain('/admin/tenants/new')
  })

  it('shows tenant list table', () => {
    expect(src()).toContain('Tenant List')
  })

  it('has analytics summary section', () => {
    expect(src()).toContain('Tenant Analytics')
  })

  it('shows Total Tenants KPI', () => {
    expect(src()).toContain('Total Tenants')
  })

  it('shows Active count KPI', () => {
    expect(src()).toContain('Active')
  })

  it('shows Suspended count KPI', () => {
    expect(src()).toContain('Suspended')
  })

  it('shows business type distribution', () => {
    expect(src()).toContain('Business Type')
  })

  it('has activate action', () => {
    expect(src()).toContain('Activate')
  })

  it('has suspend action', () => {
    expect(src()).toContain('Suspend')
  })

  it('has archive action', () => {
    expect(src()).toContain('Archive')
  })

  it('links to tenant detail page', () => {
    expect(src()).toContain('/admin/tenants/${')
  })
})

// ── P: Tenant Detail Page ─────────────────────────────────────────────────────

describe('P — tenant detail page (/admin/tenants/[slug])', () => {
  const src = () => readSrc('app/admin/tenants/[slug]/page.tsx')

  it('is a client component', () => {
    expect(src()).toContain("'use client'")
  })

  it('has aria-label "Tenant Detail"', () => {
    expect(src()).toContain('Tenant Detail')
  })

  it('has Profile section', () => {
    expect(src()).toContain('Tenant Profile')
  })

  it('has Branding section', () => {
    expect(src()).toContain('Branding')
  })

  it('has Capabilities section', () => {
    expect(src()).toContain('Capabilities')
  })

  it('has Business Type section', () => {
    expect(src()).toContain('Business Type')
  })

  it('has Status Management section', () => {
    expect(src()).toContain('Status Management')
  })

  it('has activate action', () => {
    expect(src()).toContain('Activate')
  })

  it('has suspend action', () => {
    expect(src()).toContain('Suspend')
  })

  it('has archive action', () => {
    expect(src()).toContain('Archive')
  })

  it('uses tenantService.getTenant', () => {
    expect(src()).toContain('tenantService')
    expect(src()).toContain('getTenant')
  })

  it('shows feature flags enabled/disabled', () => {
    expect(src()).toContain('Feature Flags')
  })

  it('has back link to /admin/tenants', () => {
    expect(src()).toContain('/admin/tenants')
  })

  it('uses useActivateTenant hook', () => {
    expect(src()).toContain('useActivateTenant')
  })

  it('uses useSuspendTenant hook', () => {
    expect(src()).toContain('useSuspendTenant')
  })

  it('uses useArchiveTenant hook', () => {
    expect(src()).toContain('useArchiveTenant')
  })
})

// ── Q: Analytics Summary ──────────────────────────────────────────────────────

describe('Q — tenant analytics computed from list', () => {
  it('page computes active count from tenant list', () => {
    const src = readSrc('app/admin/tenants/page.tsx')
    expect(src).toContain('active')
    expect(src).toContain('suspended')
  })

  it('getTenants() returns tenants that can be counted by status', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    const active = tenants.filter((t) => t.status === 'active')
    const suspended = tenants.filter((t) => t.status === 'suspended')
    expect(active.length).toBeGreaterThan(0)
    expect(suspended.length).toBeGreaterThan(0)
  })

  it('getTenants() supports grouping by businessType', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    const byType = new Map<string, number>()
    tenants.forEach((t) => {
      const bt = t.businessTypes?.[0] ?? 'unknown'
      byType.set(bt, (byType.get(bt) ?? 0) + 1)
    })
    expect(byType.size).toBeGreaterThan(1)
  })
})

// ── R: TenantStatus type ──────────────────────────────────────────────────────

describe('R — TenantStatus type', () => {
  it('includes active', () => {
    expect(readSrc('types/index.ts')).toContain("'active'")
  })

  it('includes trial', () => {
    expect(readSrc('types/index.ts')).toContain("'trial'")
  })

  it('includes suspended', () => {
    expect(readSrc('types/index.ts')).toContain("'suspended'")
  })

  it('includes churned', () => {
    expect(readSrc('types/index.ts')).toContain("'churned'")
  })

  it('includes archived', () => {
    expect(readSrc('types/index.ts')).toContain("'archived'")
  })
})

// ── S: Status management in mock mode ────────────────────────────────────────

describe('S — status management resolves in mock mode without network', () => {
  it('activateTenant resolves', async () => {
    const svc = await freshTenantService()
    await expect(svc.activateTenant('road-bites')).resolves.toBeTruthy()
  })

  it('suspendTenant resolves', async () => {
    const svc = await freshTenantService()
    await expect(svc.suspendTenant('savor')).resolves.toBeTruthy()
  })

  it('archiveTenant resolves', async () => {
    const svc = await freshTenantService()
    await expect(svc.archiveTenant('brew-cafe')).resolves.toBeTruthy()
  })

  it('getTenants resolves', async () => {
    const svc = await freshTenantService()
    await expect(svc.getTenants()).resolves.toBeTruthy()
  })
})

// ── T: Mock data completeness ────────────────────────────────────────────────

describe('T — mock data has required fields on all tenants', () => {
  it('all tenants have createdAt', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    for (const t of tenants) {
      expect(t.createdAt).toBeTruthy()
    }
  })

  it('all tenants have at least one businessType', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    for (const t of tenants) {
      expect(t.businessTypes.length).toBeGreaterThan(0)
    }
  })

  it('all tenants have valid status', async () => {
    const svc = await freshTenantService()
    const tenants = await svc.getTenants()
    const validStatuses = new Set(['active', 'trial', 'suspended', 'churned', 'archived'])
    for (const t of tenants) {
      expect(validStatuses.has(t.status)).toBe(true)
    }
  })
})

// ── U: Copy semantics ─────────────────────────────────────────────────────────

describe('U — copy semantics', () => {
  it('getTenants returns new array on each call', async () => {
    const svc = await freshTenantService()
    const a = await svc.getTenants()
    const b = await svc.getTenants()
    expect(a).not.toBe(b)
  })

  it('getTenant returns copy of tenant object', async () => {
    const svc = await freshTenantService()
    const t1 = await svc.getTenant('savor')
    t1.name = 'MUTATED'
    const t2 = await svc.getTenant('savor')
    expect(t2.name).not.toBe('MUTATED')
  })
})

// ── V: Regression adminNavItems counts ───────────────────────────────────────

describe('V — adminNavItems counts after P6.15 (all modules +1 Tenants item)', () => {
  afterEach(() => vi.resetModules())

  it('restaurant has 3 adminNavItems', async () => {
    const { RESTAURANT_MODULE } = await freshRegistry()
    expect(RESTAURANT_MODULE.adminNavItems).toHaveLength(3)
  })

  it('cafe has 6 adminNavItems', async () => {
    const { CAFE_MODULE } = await freshRegistry()
    expect(CAFE_MODULE.adminNavItems).toHaveLength(6)
  })

  it('bar has 6 adminNavItems', async () => {
    const { BAR_MODULE } = await freshRegistry()
    expect(BAR_MODULE.adminNavItems).toHaveLength(6)
  })

  it('food_court has 5 adminNavItems', async () => {
    const { FOOD_COURT_MODULE } = await freshRegistry()
    expect(FOOD_COURT_MODULE.adminNavItems).toHaveLength(5)
  })

  it('food_truck has 5 adminNavItems', async () => {
    const { FOOD_TRUCK_MODULE } = await freshRegistry()
    expect(FOOD_TRUCK_MODULE.adminNavItems).toHaveLength(5)
  })

  it('mobile_cafe has 5 adminNavItems', async () => {
    const { MOBILE_CAFE_MODULE } = await freshRegistry()
    expect(MOBILE_CAFE_MODULE.adminNavItems).toHaveLength(5)
  })

  it('all modules have Tenants nav item', async () => {
    const reg = await freshRegistry()
    for (const key of ALL_MODULES) {
      const mod = reg.getModule(key)
      const hasTenantsItem = mod?.adminNavItems?.some((n) => n.href === '/admin/tenants')
      expect(hasTenantsItem).toBe(true)
    }
  })
})

// ── W: ADMIN_TENANT_ROUTES spread into all modules ────────────────────────────

describe('W — getModuleRoutes includes tenant routes for all modules', () => {
  afterEach(() => vi.resetModules())

  for (const key of ALL_MODULES) {
    it(`getModuleRoutes(['${key}']) includes /admin/tenants`, async () => {
      const { getModuleRoutes } = await freshRegistry()
      expect(getModuleRoutes([key])).toContain('/admin/tenants')
    })

    it(`getModuleRoutes(['${key}']) includes /admin/tenants/new`, async () => {
      const { getModuleRoutes } = await freshRegistry()
      expect(getModuleRoutes([key])).toContain('/admin/tenants/new')
    })
  }
})

// ── X: Tenant detail sections ────────────────────────────────────────────────

describe('X — tenant detail page sections', () => {
  const src = () => readSrc('app/admin/tenants/[slug]/page.tsx')

  it('ProfileSection renders tenant.name', () => {
    expect(src()).toContain('tenant.name')
  })

  it('ProfileSection renders tenant.slug', () => {
    expect(src()).toContain('tenant.slug')
  })

  it('ProfileSection renders tenant.id', () => {
    expect(src()).toContain('tenant.id')
  })

  it('BrandingSection reads settings.theme', () => {
    expect(src()).toContain('theme')
  })

  it('CapabilitiesSection reads settings.featureFlags', () => {
    expect(src()).toContain('featureFlags')
  })

  it('BusinessTypeSection renders businessTypes', () => {
    expect(src()).toContain('businessTypes')
  })

  it('StatusActionsSection checks for archived state', () => {
    expect(src()).toContain('archived')
  })

  it('archived tenant shows no action buttons', () => {
    expect(src()).toContain('isArchived')
  })
})
