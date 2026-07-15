import { describe, it, expect, beforeEach } from 'vitest'
import { tenantService } from '@/services/tenant.service'
import { branchManagementService } from '@/services/branch.service'
import { getMarketplaceMeta } from '@/types/marketplace'
import type { PublicBranchInfo } from '@/types/marketplace'

// ── Branch mock data — tenantId correctness ───────────────────────────────────

describe('branch.service mock data — tenant scoping (P8.7.7.3)', () => {
  it('samoon tenant has branches including main, downtown, airport', async () => {
    const branches = await branchManagementService.getBranches('tenant-samoon-01')
    const slugs = branches.map((b) => b.slug)
    expect(slugs).toContain('main')
    expect(slugs).toContain('downtown')
    expect(slugs).toContain('airport')
  })

  it('brew-cafe tenant has 2 branches', async () => {
    const branches = await branchManagementService.getBranches('tenant-brew-cafe-01')
    expect(branches.length).toBe(2)
  })

  it('brew-cafe branches include main and brooklyn-cafe', async () => {
    const branches = await branchManagementService.getBranches('tenant-brew-cafe-01')
    const slugs = branches.map((b) => b.slug).sort()
    expect(slugs).toEqual(['brooklyn-cafe', 'main'])
  })

  it('the-oak-bar tenant has 1 branch', async () => {
    const branches = await branchManagementService.getBranches('tenant-oak-bar-01')
    expect(branches.length).toBe(1)
    expect(branches[0].slug).toBe('main')
  })

  it('central-food-court tenant has 1 branch', async () => {
    const branches = await branchManagementService.getBranches('tenant-central-fc-01')
    expect(branches.length).toBe(1)
    expect(branches[0].slug).toBe('main')
  })

  it('wheels-and-brews tenant has 1 branch', async () => {
    const branches = await branchManagementService.getBranches('tenant-wheels-brews-01')
    expect(branches.length).toBe(1)
    expect(branches[0].slug).toBe('main')
  })

  it('unknown tenant returns empty array', async () => {
    const branches = await branchManagementService.getBranches('tenant-does-not-exist')
    expect(branches).toEqual([])
  })
})

// ── Branch slugs match marketplace.branches slugs ─────────────────────────────

describe('branch slugs consistency between branch.service and tenant.service', () => {
  beforeEach(() => {
    tenantService._resetMockList()
  })

  it('samoon marketplace.branches slugs are all present in branch service', async () => {
    const tenant = await tenantService.getTenant('samoon')
    const meta = getMarketplaceMeta(tenant.settings)
    const metaSlugs = meta?.branches?.map((b: PublicBranchInfo) => b.slug) ?? []

    const branches = await branchManagementService.getBranches('tenant-samoon-01')
    const serviceSlugs = new Set(branches.map((b) => b.slug))

    // Every marketplace branch must be resolvable in the branch service
    metaSlugs.forEach((slug) => expect(serviceSlugs.has(slug)).toBe(true))
  })

  it('brew-cafe branch service slugs match marketplace.branches slugs', async () => {
    const tenant = await tenantService.getTenant('brew-cafe')
    const meta = getMarketplaceMeta(tenant.settings)
    const metaSlugs = meta?.branches?.map((b: PublicBranchInfo) => b.slug).sort() ?? []

    const branches = await branchManagementService.getBranches('tenant-brew-cafe-01')
    const serviceSlugs = branches.map((b) => b.slug).sort()

    expect(metaSlugs).toEqual(serviceSlugs)
  })

  it('the-oak-bar branch service slugs match marketplace.branches slugs', async () => {
    const tenant = await tenantService.getTenant('the-oak-bar')
    const meta = getMarketplaceMeta(tenant.settings)
    const metaSlugs = meta?.branches?.map((b: PublicBranchInfo) => b.slug).sort() ?? []

    const branches = await branchManagementService.getBranches('tenant-oak-bar-01')
    const serviceSlugs = branches.map((b) => b.slug).sort()

    expect(metaSlugs).toEqual(serviceSlugs)
  })

  it('central-food-court branch service slugs match marketplace.branches slugs', async () => {
    const tenant = await tenantService.getTenant('central-food-court')
    const meta = getMarketplaceMeta(tenant.settings)
    const metaSlugs = meta?.branches?.map((b: PublicBranchInfo) => b.slug).sort() ?? []

    const branches = await branchManagementService.getBranches('tenant-central-fc-01')
    const serviceSlugs = branches.map((b) => b.slug).sort()

    expect(metaSlugs).toEqual(serviceSlugs)
  })

  it('wheels-and-brews branch service slugs match marketplace.branches slugs', async () => {
    const tenant = await tenantService.getTenant('wheels-and-brews')
    const meta = getMarketplaceMeta(tenant.settings)
    const metaSlugs = meta?.branches?.map((b: PublicBranchInfo) => b.slug).sort() ?? []

    const branches = await branchManagementService.getBranches('tenant-wheels-brews-01')
    const serviceSlugs = branches.map((b) => b.slug).sort()

    expect(metaSlugs).toEqual(serviceSlugs)
  })
})

// ── PublicBranchInfo shape in tenant marketplace.branches ─────────────────────

describe('PublicBranchInfo shape (P8.7.7.3)', () => {
  beforeEach(() => {
    tenantService._resetMockList()
  })

  it('each branch has required fields: slug, name, address, city, openNow', async () => {
    const tenants = await tenantService.getTenants()
    tenants
      .filter((t) => t.slug !== 'default')
      .forEach((t) => {
        const meta = getMarketplaceMeta(t.settings)
        meta?.branches?.forEach((b: PublicBranchInfo) => {
          expect(typeof b.slug).toBe('string')
          expect(b.slug.length).toBeGreaterThan(0)
          expect(typeof b.name).toBe('string')
          expect(typeof b.address).toBe('string')
          expect(typeof b.city).toBe('string')
          expect(typeof b.openNow).toBe('boolean')
        })
      })
  })

  it('all branch slugs are non-empty strings', async () => {
    const tenants = await tenantService.getTenants()
    tenants.forEach((t) => {
      const meta = getMarketplaceMeta(t.settings)
      meta?.branches?.forEach((b: PublicBranchInfo) => {
        expect(typeof b.slug).toBe('string')
        expect(b.slug.length).toBeGreaterThan(0)
      })
    })
  })

  it('samoon primary branch slug resolves to a real branch', async () => {
    const tenant = await tenantService.getTenant('samoon')
    const meta = getMarketplaceMeta(tenant.settings)
    const primary = meta?.branches?.find((b: PublicBranchInfo) => b.slug === meta.primaryBranchSlug)
    expect(primary).toBeDefined()
  })

  it('brew-cafe primary branch slug resolves to a real branch', async () => {
    const tenant = await tenantService.getTenant('brew-cafe')
    const meta = getMarketplaceMeta(tenant.settings)
    const primary = meta?.branches?.find((b: PublicBranchInfo) => b.slug === meta.primaryBranchSlug)
    expect(primary).toBeDefined()
  })
})

// ── Branch homepage: unknown slug resolution ───────────────────────────────────

describe('branch slug resolution for homepage', () => {
  beforeEach(() => {
    tenantService._resetMockList()
  })

  it('known tenant + known branch slug resolves to PublicBranchInfo', async () => {
    const tenant = await tenantService.getTenant('samoon')
    const meta = getMarketplaceMeta(tenant.settings)
    const branch = meta?.branches?.find((b: PublicBranchInfo) => b.slug === 'main')
    expect(branch).toBeDefined()
    expect(branch?.name).toBe('Main Branch')
  })

  it('known tenant + known downtown slug resolves correctly', async () => {
    const tenant = await tenantService.getTenant('samoon')
    const meta = getMarketplaceMeta(tenant.settings)
    const branch = meta?.branches?.find((b: PublicBranchInfo) => b.slug === 'downtown')
    expect(branch).toBeDefined()
    expect(branch?.city).toBe('New York')
  })

  it('known tenant + unknown branch slug returns undefined', async () => {
    const tenant = await tenantService.getTenant('samoon')
    const meta = getMarketplaceMeta(tenant.settings)
    const branch = meta?.branches?.find((b: PublicBranchInfo) => b.slug === 'nonexistent-location')
    expect(branch).toBeUndefined()
  })

  it('unknown tenant returns default tenant with no matching branches', async () => {
    const tenant = await tenantService.getTenant('nonexistent-business')
    expect(tenant.slug).toBe('default')
    const meta = getMarketplaceMeta(tenant.settings)
    const branch = meta?.branches?.find((b: PublicBranchInfo) => b.slug === 'main')
    expect(branch).toBeUndefined()
  })

  it('brew-cafe main branch resolves to Midtown Cafe', async () => {
    const tenant = await tenantService.getTenant('brew-cafe')
    const meta = getMarketplaceMeta(tenant.settings)
    const branch = meta?.branches?.find((b: PublicBranchInfo) => b.slug === 'main')
    expect(branch).toBeDefined()
    expect(branch?.name).toBe('Midtown Cafe')
  })

  it('brew-cafe brooklyn-cafe branch resolves correctly', async () => {
    const tenant = await tenantService.getTenant('brew-cafe')
    const meta = getMarketplaceMeta(tenant.settings)
    const branch = meta?.branches?.find((b: PublicBranchInfo) => b.slug === 'brooklyn-cafe')
    expect(branch).toBeDefined()
    expect(branch?.city).toBe('Brooklyn')
  })
})
