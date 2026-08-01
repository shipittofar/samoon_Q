import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeEach } from 'vitest'
import { tenantService, TenantNotFoundError } from '@/services/tenant.service'
import { branchManagementService } from '@/services/branch.service'
import { getMockRoles } from '@/services/permission.service'
import { hrefToPublicUrl } from '@/utils/public-url'
import { getMarketplaceMeta } from '@/types/marketplace'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ── P8.7.7.4 Context Integrity Regression Tests ───────────────────────────────

describe('Bug 1 / Bug 6 — RBAC role availability for all tenants', () => {
  it('getMockRoles returns roles for the multi-tenant user in both tenants', () => {
    const managerRoles = getMockRoles('user-multi-01', 'tenant-samoon-01')
    expect(managerRoles).toContain('manager')

    const cashierRoles = getMockRoles('user-multi-01', 'tenant-brew-cafe-01')
    expect(cashierRoles).toContain('cashier')
  })

  it('getMockRoles returns empty array for tenant with no explicit assignment', () => {
    // owner-01 is only assigned to samoon; brew-cafe has no explicit assignment
    const roles = getMockRoles('user-owner-01', 'tenant-brew-cafe-01')
    expect(roles).toEqual([])
  })

  it('every known tenant can be resolved by getTenant', async () => {
    const slugs = ['samoon', 'brew-cafe', 'the-oak-bar', 'central-food-court', 'wheels-and-brews', 'road-bites']
    for (const slug of slugs) {
      const tenant = await tenantService.getTenantBySlug(slug)
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
      'tenant-samoon-01',
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
      'tenant-samoon-01',
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
    expect(hrefToPublicUrl('/', 'samoon', 'main')).toBe('/samoon')
    expect(hrefToPublicUrl('/', 'brew-cafe', 'main')).toBe('/brew-cafe')
    expect(hrefToPublicUrl('/', 'the-oak-bar', 'main')).toBe('/the-oak-bar')
  })

  it('hrefToPublicUrl generates branch-scoped menu URL', () => {
    expect(hrefToPublicUrl('/menu', 'samoon', 'main')).toBe('/samoon/main/menu')
    expect(hrefToPublicUrl('/menu', 'brew-cafe', 'brooklyn-cafe')).toBe('/brew-cafe/brooklyn-cafe/menu')
  })

  it('hrefToPublicUrl falls back gracefully when no tenant context', () => {
    const url = hrefToPublicUrl('/menu', null, null)
    expect(url).toBe('/menu')
  })

  it('hrefToPublicUrl falls back to tenant-level when no branch context', () => {
    const url = hrefToPublicUrl('/menu', 'samoon', null)
    expect(url).toBe('/samoon/menu')
  })

  it('hrefToPublicUrl never returns bare "/" for known tenant', () => {
    const url = hrefToPublicUrl('/restaurant', 'samoon', 'main')
    expect(url).not.toBe('/')
    expect(url).toBe('/samoon')
  })
})

describe('Bug 7 — Public context initialization', () => {
  beforeEach(() => {
    tenantService._resetMockList()
  })

  it('usePublicTenant equivalent: unknown slug throws TenantNotFoundError instead of returning a fake tenant', async () => {
    await expect(tenantService.getTenantBySlug('nonexistent-slug')).rejects.toBeInstanceOf(TenantNotFoundError)
  })

  it('usePublicBranch equivalent: unknown branch returns undefined from marketplace meta', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const meta = getMarketplaceMeta(tenant.settings)
    const branch = meta?.branches?.find((b) => b.slug === 'nonexistent-branch')
    expect(branch).toBeUndefined()
  })

  it('known tenant + known branch slug resolves to correct PublicBranchInfo', async () => {
    const tenant = await tenantService.getTenantBySlug('brew-cafe')
    const meta = getMarketplaceMeta(tenant.settings)
    const branch = meta?.branches?.find((b) => b.slug === 'brooklyn-cafe')
    expect(branch).toBeDefined()
    expect(branch?.city).toBe('Brooklyn')
  })
})

describe('R-06 — CapabilityGuard loyalty flag consistency (P8.7.7.8)', () => {
  it('brew-cafe featureFlags includes loyalty.enabled: true so CapabilityGuard passes', async () => {
    const tenant = await tenantService.getTenantBySlug('brew-cafe')
    const flags = (tenant.settings?.featureFlags ?? {}) as Record<string, boolean>
    // CapabilityGuard checks CAPABILITY_FLAG_MAP['loyalty'] = 'loyalty.enabled'
    expect(flags['loyalty.enabled']).toBe(true)
  })

  it('wheels-and-brews featureFlags does not explicitly disable loyalty.enabled', async () => {
    const tenant = await tenantService.getTenantBySlug('wheels-and-brews')
    const flags = (tenant.settings?.featureFlags ?? {}) as Record<string, boolean>
    // mobile_cafe has loyalty in defaultEnabled → Layer 2 sets loyalty.enabled=true
    // tenant Layer 3 override must not actively disable it
    expect(flags['loyalty.enabled']).not.toBe(false)
  })

  it('samoon tenant does not explicitly enable loyalty.enabled', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const flags = (tenant.settings?.featureFlags ?? {}) as Record<string, boolean>
    expect(flags['loyalty.enabled']).toBeUndefined()
  })
})

describe('R-07 — Reservation branch list is tenant-scoped (P8.7.7.10)', () => {
  it('MOCK_TENANT_BRANCHES contains entries for all 6 tenants', async () => {
    const { MOCK_TENANT_BRANCHES } = await import('@/lib/mock-data')
    const expectedTenants = [
      'tenant-samoon-01',
      'tenant-brew-cafe-01',
      'tenant-oak-bar-01',
      'tenant-central-fc-01',
      'tenant-wheels-brews-01',
      'tenant-road-bites-01',
    ]
    for (const tenantId of expectedTenants) {
      expect(MOCK_TENANT_BRANCHES[tenantId]).toBeDefined()
      expect(MOCK_TENANT_BRANCHES[tenantId].length).toBeGreaterThanOrEqual(1)
    }
  })

  it('MOCK_TENANT_BRANCHES branches use slug as id (consistent with publicBranchToLocation)', async () => {
    const { MOCK_TENANT_BRANCHES } = await import('@/lib/mock-data')
    for (const branches of Object.values(MOCK_TENANT_BRANCHES)) {
      for (const b of branches) {
        expect(b.id).toBe(b.slug)
      }
    }
  })

  it('brew-cafe branches are Midtown Cafe and Brooklyn Cafe — not samoon branches', async () => {
    const { MOCK_TENANT_BRANCHES } = await import('@/lib/mock-data')
    const brewBranches = MOCK_TENANT_BRANCHES['tenant-brew-cafe-01']
    const names = brewBranches.map((b) => b.name)
    expect(names).toContain('Midtown Cafe')
    expect(names).toContain('Brooklyn Cafe')
    expect(names).not.toContain('Main Branch')
    expect(names).not.toContain('Downtown Branch')
    expect(names).not.toContain('Airport Branch')
  })

  it('branchService.getBranches(tenantId) returns tenant-specific branches', async () => {
    const { branchService } = await import('@/services/combined.service')
    const samoonBranches = await branchService.getBranches('tenant-samoon-01')
    expect(samoonBranches.length).toBe(3)
    expect(samoonBranches.map((b) => b.slug)).toContain('airport')

    const brewBranches = await branchService.getBranches('tenant-brew-cafe-01')
    expect(brewBranches.length).toBe(2)
    expect(brewBranches.map((b) => b.slug)).toContain('brooklyn-cafe')
    expect(brewBranches.map((b) => b.slug)).not.toContain('airport')
  })

  it('branchService.getBranches() without tenantId falls back to MOCK_BRANCHES', async () => {
    const { branchService } = await import('@/services/combined.service')
    const branches = await branchService.getBranches()
    expect(branches.length).toBeGreaterThanOrEqual(1)
  })

  it('tenant-scoped branch ids match slug (activeBranch.id compatibility)', async () => {
    const { branchService } = await import('@/services/combined.service')
    const branches = await branchService.getBranches('tenant-brew-cafe-01')
    const main = branches.find((b) => b.slug === 'main')
    expect(main).toBeDefined()
    expect(main?.id).toBe('main')
  })
})

describe('R-08 — Platform-wide context integrity (P8.7.7.11)', () => {
  it('MOCK_TENANT_BRANCHES has no cross-tenant branch contamination', async () => {
    const { MOCK_TENANT_BRANCHES } = await import('@/lib/mock-data')
    const samoon = MOCK_TENANT_BRANCHES['tenant-samoon-01'].map((b) => b.slug)
    const brew = MOCK_TENANT_BRANCHES['tenant-brew-cafe-01'].map((b) => b.slug)
    // brooklyn-cafe belongs only to brew-cafe, not samoon
    expect(samoon).not.toContain('brooklyn-cafe')
    // airport belongs only to samoon, not brew-cafe
    expect(brew).not.toContain('airport')
  })

  it('useLogout clears cart, recently-viewed, dine-in, and RBAC', async () => {
    // Source-text verification: useLogout must call clearCart, clear(), clearTable
    const hooksSrc = readFileSync(
      join(__dirname, '..', 'hooks', 'index.ts'),
      'utf-8',
    )
    expect(hooksSrc).toContain('useCartStore.getState().clearCart()')
    expect(hooksSrc).toContain('useRecentlyViewedStore.getState().clear()')
    expect(hooksSrc).toContain('useDineInStore.getState().clearTable()')
    expect(hooksSrc).toContain('qc.clear()')
  })

  it('TenantLayout clears cart on tenant switch', async () => {
    const src = readFileSync(
      join(__dirname, '..', 'app', '[tenantSlug]', 'layout.tsx'),
      'utf-8',
    )
    expect(src).toContain('clearCart()')
    expect(src).toContain('useCartStore')
  })

  it('useFeaturedItems query key includes tenantId (D-06 fix)', async () => {
    const src = readFileSync(
      join(__dirname, '..', 'hooks', 'index.ts'),
      'utf-8',
    )
    // Verify the queryKey for useFeaturedItems includes tenantId
    expect(src).toMatch(/queryKey.*featured-items.*tenantId|tenantId.*featured-items/)
  })

  it('useMenuSearch query key includes tenantId (D-07 fix)', async () => {
    const src = readFileSync(
      join(__dirname, '..', 'hooks', 'index.ts'),
      'utf-8',
    )
    expect(src).toMatch(/queryKey.*menu-search.*tenantId|tenantId.*menu-search/)
  })

  it('useRelatedItems query key includes tenantId (D-08 fix)', async () => {
    const src = readFileSync(
      join(__dirname, '..', 'hooks', 'index.ts'),
      'utf-8',
    )
    expect(src).toMatch(/queryKey.*related-items.*tenantId|tenantId.*related-items/)
  })

  it('all 6 tenants have isolated MOCK_TENANT_BRANCHES entries with at least 1 branch', async () => {
    const { MOCK_TENANT_BRANCHES } = await import('@/lib/mock-data')
    const tenants = [
      'tenant-samoon-01',
      'tenant-brew-cafe-01',
      'tenant-oak-bar-01',
      'tenant-central-fc-01',
      'tenant-wheels-brews-01',
      'tenant-road-bites-01',
    ]
    for (const t of tenants) {
      expect(MOCK_TENANT_BRANCHES[t]?.length).toBeGreaterThanOrEqual(1)
    }
  })
})
