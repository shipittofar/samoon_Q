import { describe, it, expect, beforeEach } from 'vitest'
import { tenantService } from '@/services/tenant.service'
import { branchManagementService } from '@/services/branch.service'
import { staffService } from '@/services/staff.service'
import { hrefToPublicUrl, buildPublicUrl } from '@/utils/public-url'
import { getMarketplaceMeta } from '@/types/marketplace'

// ── P8.7.7.5 Ownership Audit Regression Tests ─────────────────────────────────

describe('Staff ownership — every tenant has at least one staff member', () => {
  beforeEach(() => {
    staffService._resetMockStore()
  })

  const TENANT_IDS = [
    'tenant-samoon-01',
    'tenant-brew-cafe-01',
    'tenant-oak-bar-01',
    'tenant-central-fc-01',
    'tenant-wheels-brews-01',
    'tenant-road-bites-01',
  ]

  it('samoon has at least 1 staff member', async () => {
    const staff = await staffService.getStaff('tenant-samoon-01')
    expect(staff.length).toBeGreaterThanOrEqual(1)
  })

  it('brew-cafe has at least 1 staff member (P8.7.7.5 fix)', async () => {
    const staff = await staffService.getStaff('tenant-brew-cafe-01')
    expect(staff.length).toBeGreaterThanOrEqual(1)
  })

  it('the-oak-bar has at least 1 staff member (P8.7.7.5 fix)', async () => {
    const staff = await staffService.getStaff('tenant-oak-bar-01')
    expect(staff.length).toBeGreaterThanOrEqual(1)
  })

  it('central-food-court has at least 1 staff member (P8.7.7.5 fix)', async () => {
    const staff = await staffService.getStaff('tenant-central-fc-01')
    expect(staff.length).toBeGreaterThanOrEqual(1)
  })

  it('wheels-and-brews has at least 1 staff member (P8.7.7.5 fix)', async () => {
    const staff = await staffService.getStaff('tenant-wheels-brews-01')
    expect(staff.length).toBeGreaterThanOrEqual(1)
  })

  it('road-bites has at least 1 staff member (P8.7.7.5 fix)', async () => {
    const staff = await staffService.getStaff('tenant-road-bites-01')
    expect(staff.length).toBeGreaterThanOrEqual(1)
  })

  it('no cross-tenant staff contamination', async () => {
    for (const tenantId of TENANT_IDS) {
      const staff = await staffService.getStaff(tenantId)
      staff.forEach((s) => {
        expect(s.tenantId).toBe(tenantId)
      })
    }
  })

  it('unknown tenant returns empty staff list', async () => {
    const staff = await staffService.getStaff('tenant-does-not-exist')
    expect(staff).toEqual([])
  })
})

describe('Branch ownership — each tenant owns only its branches', () => {
  const TENANT_IDS = [
    'tenant-samoon-01',
    'tenant-brew-cafe-01',
    'tenant-oak-bar-01',
    'tenant-central-fc-01',
    'tenant-wheels-brews-01',
    'tenant-road-bites-01',
  ]

  it('all 6 tenants have at least 1 branch', async () => {
    for (const tenantId of TENANT_IDS) {
      const branches = await branchManagementService.getBranches(tenantId)
      expect(branches.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('no branch belongs to two different tenants', async () => {
    const allBranchSets = await Promise.all(
      TENANT_IDS.map((id) => branchManagementService.getBranches(id))
    )
    const allIds = allBranchSets.flatMap((branches) => branches.map((b) => b.id))
    const uniqueIds = new Set(allIds)
    expect(uniqueIds.size).toBe(allIds.length)
  })
})

describe('Gallery and marketplace ownership per tenant', () => {
  beforeEach(() => {
    tenantService._resetMockList()
  })

  it('each tenant with marketplace data has its own gallery (no shared URLs)', async () => {
    const tenants = await tenantService.getTenants()
    const gallerySets: string[][] = []

    tenants
      .filter((t) => t.slug !== 'default')
      .forEach((t) => {
        const meta = getMarketplaceMeta(t.settings)
        if (meta?.gallery && meta.gallery.length > 0) {
          gallerySets.push(meta.gallery)
        }
      })

    // Each tenant's gallery should be an independent array (not the same reference)
    for (let i = 0; i < gallerySets.length; i++) {
      for (let j = i + 1; j < gallerySets.length; j++) {
        expect(gallerySets[i]).not.toBe(gallerySets[j])
      }
    }
  })

  it('samoon tenant has its own gallery images', async () => {
    const tenant = await tenantService.getTenant('samoon')
    const meta = getMarketplaceMeta(tenant.settings)
    expect(meta?.gallery?.length).toBeGreaterThanOrEqual(1)
  })
})

describe('URL ownership — preview URLs always include tenant context', () => {
  it('buildPublicUrl never returns "/" for known tenant', () => {
    expect(buildPublicUrl({ tenantSlug: 'samoon', branchSlug: 'main', module: '' })).toBe('/samoon/main')
    expect(buildPublicUrl({ tenantSlug: 'brew-cafe', branchSlug: 'main' })).toBe('/brew-cafe/main')
  })

  it('hrefToPublicUrl falls back to flat href when tenantSlug missing, not to default tenant', () => {
    const url = hrefToPublicUrl('/menu', null, null)
    expect(url).not.toContain('default')
    expect(url).toBe('/menu')
  })

  it('hrefToPublicUrl generates per-tenant preview URL for all known tenants', () => {
    const tenantSlugs = ['samoon', 'brew-cafe', 'the-oak-bar', 'central-food-court', 'wheels-and-brews']
    tenantSlugs.forEach((slug) => {
      const url = hrefToPublicUrl('/menu', slug, 'main')
      expect(url).toBe(`/${slug}/main/menu`)
    })
  })
})
