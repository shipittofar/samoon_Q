import { describe, it, expect, beforeEach } from 'vitest'
import { tenantService } from '@/services/tenant.service'
import { branchManagementService } from '@/services/branch.service'
import { getMockRoles } from '@/services/permission.service'
import { hrefToPublicUrl } from '@/utils/public-url'
import { getMarketplaceMeta } from '@/types/marketplace'

// ── P8.7.7.4 Context Integrity Regression Tests ───────────────────────────────

describe('Bug 1 / Bug 6 — RBAC role availability for all tenants', () => {
  it('getMockRoles returns roles for the multi-tenant user in both tenants', () => {
    const managerRoles = getMockRoles('user-multi-01', 'tenant-savor-01')
    expect(managerRoles).toContain('manager')

    const cashierRoles = getMockRoles('user-multi-01', 'tenant-brew-cafe-01')
    expect(cashierRoles).toContain('cashier')
  })

  it('getMockRoles returns empty array for tenant with no explicit assignment', () => {
    // owner-01 is only assigned to savor; brew-cafe has no explicit assignment
    const roles = getMockRoles('user-owner-01', 'tenant-brew-cafe-01')
    expect(roles).toEqual([])
  })

  it('every known tenant can be resolved by getTenant', async () => {
    const slugs = ['savor', 'brew-cafe', 'the-oak-bar', 'central-food-court', 'wheels-and-brews', 'road-bites']
    for (const slug of slugs) {
      const tenant = await tenantService.getTenant(slug)
      expect(tenant.slug).toBe(slug)
    }
  })
})

describe('Bug 2 / Bug 3 — Branch ownership and selector availability', () => {
  it('road-bites has at least 1 branch record in branchManagementService', async () => {
    const branches = await branchManagementService.getBranches('tenant-road-bites-01')
    expect(branches.length).toBeGreaterThanOrEqual(1)
  })

  it('road-bites branch belongs only to road-bites tenant', async () => {
    const branches = await branchManagementService.getBranches('tenant-road-bites-01')
    branches.forEach((b) => {
      expect(b.tenantId).toBe('tenant-road-bites-01')
    })
  })

  it('no cross-tenant branch contamination — each tenant only has its own branches', async () => {
    const tenantIds = [
      'tenant-savor-01',
      'tenant-brew-cafe-01',
      'tenant-oak-bar-01',
      'tenant-central-fc-01',
      'tenant-wheels-brews-01',
      'tenant-road-bites-01',
    ]
    for (const tenantId of tenantIds) {
      const branches = await branchManagementService.getBranches(tenantId)
      branches.forEach((b) => {
        expect(b.tenantId).toBe(tenantId)
      })
    }
  })

  it('all tenants have at least 1 branch record', async () => {
    const tenantIds = [
      'tenant-savor-01',
      'tenant-brew-cafe-01',
      'tenant-oak-bar-01',
      'tenant-central-fc-01',
      'tenant-wheels-brews-01',
      'tenant-road-bites-01',
    ]
    for (const tenantId of tenantIds) {
      const branches = await branchManagementService.getBranches(tenantId)
      expect(branches.length).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('Bug 5 — PreviewButton URL generation', () => {
  it('hrefToPublicUrl generates tenant homepage for "/" href', () => {
    expect(hrefToPublicUrl('/', 'savor', 'main')).toBe('/savor')
    expect(hrefToPublicUrl('/', 'brew-cafe', 'main')).toBe('/brew-cafe')
    expect(hrefToPublicUrl('/', 'the-oak-bar', 'main')).toBe('/the-oak-bar')
  })

  it('hrefToPublicUrl generates branch-scoped menu URL', () => {
    expect(hrefToPublicUrl('/menu', 'savor', 'main')).toBe('/savor/main/menu')
    expect(hrefToPublicUrl('/menu', 'brew-cafe', 'brooklyn-cafe')).toBe('/brew-cafe/brooklyn-cafe/menu')
  })

  it('hrefToPublicUrl falls back gracefully when no tenant context', () => {
    const url = hrefToPublicUrl('/menu', null, null)
    expect(url).toBe('/menu')
  })

  it('hrefToPublicUrl falls back to tenant-level when no branch context', () => {
    const url = hrefToPublicUrl('/menu', 'savor', null)
    expect(url).toBe('/savor/menu')
  })

  it('hrefToPublicUrl never returns bare "/" for known tenant', () => {
    const url = hrefToPublicUrl('/restaurant', 'savor', 'main')
    expect(url).not.toBe('/')
    expect(url).toBe('/savor')
  })
})

describe('Bug 7 — Public context initialization', () => {
  beforeEach(() => {
    tenantService._resetMockList()
  })

  it('usePublicTenant equivalent: unknown slug returns default tenant', async () => {
    const tenant = await tenantService.getTenant('nonexistent-slug')
    expect(tenant.slug).toBe('default')
  })

  it('usePublicBranch equivalent: unknown branch returns undefined from marketplace meta', async () => {
    const tenant = await tenantService.getTenant('savor')
    const meta = getMarketplaceMeta(tenant.settings)
    const branch = meta?.branches?.find((b) => b.slug === 'nonexistent-branch')
    expect(branch).toBeUndefined()
  })

  it('known tenant + known branch slug resolves to correct PublicBranchInfo', async () => {
    const tenant = await tenantService.getTenant('brew-cafe')
    const meta = getMarketplaceMeta(tenant.settings)
    const branch = meta?.branches?.find((b) => b.slug === 'brooklyn-cafe')
    expect(branch).toBeDefined()
    expect(branch?.city).toBe('Brooklyn')
  })
})

describe('R-06 — CapabilityGuard loyalty flag consistency (P8.7.7.8)', () => {
  it('brew-cafe featureFlags includes loyalty.enabled: true so CapabilityGuard passes', async () => {
    const tenant = await tenantService.getTenant('brew-cafe')
    const flags = (tenant.settings?.featureFlags ?? {}) as Record<string, boolean>
    // CapabilityGuard checks CAPABILITY_FLAG_MAP['loyalty'] = 'loyalty.enabled'
    expect(flags['loyalty.enabled']).toBe(true)
  })

  it('wheels-and-brews featureFlags does not explicitly disable loyalty.enabled', async () => {
    const tenant = await tenantService.getTenant('wheels-and-brews')
    const flags = (tenant.settings?.featureFlags ?? {}) as Record<string, boolean>
    // mobile_cafe has loyalty in defaultEnabled → Layer 2 sets loyalty.enabled=true
    // tenant Layer 3 override must not actively disable it
    expect(flags['loyalty.enabled']).not.toBe(false)
  })

  it('savor tenant does not explicitly enable loyalty.enabled', async () => {
    const tenant = await tenantService.getTenant('savor')
    const flags = (tenant.settings?.featureFlags ?? {}) as Record<string, boolean>
    expect(flags['loyalty.enabled']).toBeUndefined()
  })
})
