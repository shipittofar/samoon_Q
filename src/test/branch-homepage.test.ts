import { describe, it, expect, beforeEach } from 'vitest'
import { tenantService, TenantNotFoundError } from '@/services/tenant.service'
import { branchManagementService } from '@/services/branch.service'
import { resolvePublicBranchList, findPublicBranchBySlug } from '@/lib/public-branches'

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

describe('each public tenant has Branch API locations', () => {
  beforeEach(() => {
    tenantService._resetMockList()
    branchManagementService._resetMockStore()
  })

  it('samoon public branches include main, downtown, airport', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const branches = await resolvePublicBranchList(tenant.id)
    const slugs = branches.map((b) => b.slug)
    expect(slugs).toEqual(expect.arrayContaining(['main', 'downtown', 'airport']))
  })

  it('brew-cafe public branches match branch service slugs', async () => {
    const tenant = await tenantService.getTenantBySlug('brew-cafe')
    const publicSlugs = (await resolvePublicBranchList(tenant.id)).map((b) => b.slug).sort()
    const serviceSlugs = (await branchManagementService.getBranches(tenant.id)).map((b) => b.slug).sort()
    expect(publicSlugs).toEqual(serviceSlugs)
  })
})

describe('PublicBranchInfo shape from Branch API', () => {
  beforeEach(() => {
    tenantService._resetMockList()
    branchManagementService._resetMockStore()
  })

  it('each public branch has required fields', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const branches = await resolvePublicBranchList(tenant.id)
    expect(branches.length).toBeGreaterThan(0)
    branches.forEach((b) => {
      expect(b.id.length).toBeGreaterThan(0)
      expect(b.slug.length).toBeGreaterThan(0)
      expect(typeof b.name).toBe('string')
      expect(typeof b.address).toBe('string')
      expect(typeof b.city).toBe('string')
      expect(typeof b.openNow).toBe('boolean')
    })
  })
})

describe('branch slug resolution for homepage', () => {
  beforeEach(() => {
    tenantService._resetMockList()
    branchManagementService._resetMockStore()
  })

  it('known tenant + known branch slug resolves to PublicBranchInfo', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const branches = await resolvePublicBranchList(tenant.id)
    const branch = findPublicBranchBySlug(branches, 'main')
    expect(branch?.name).toBe('Main Branch')
  })

  it('known tenant + downtown slug resolves in New York', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const branches = await resolvePublicBranchList(tenant.id)
    const branch = findPublicBranchBySlug(branches, 'downtown')
    expect(branch?.city).toBe('New York')
  })

  it('known tenant + unknown branch slug returns undefined', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const branches = await resolvePublicBranchList(tenant.id)
    expect(findPublicBranchBySlug(branches, 'nonexistent-location')).toBeUndefined()
  })

  it('unknown tenant slug throws TenantNotFoundError instead of silently returning a fake tenant', async () => {
    await expect(tenantService.getTenantBySlug('nonexistent-business')).rejects.toBeInstanceOf(TenantNotFoundError)
  })

  it('brew-cafe main branch resolves to Midtown Cafe', async () => {
    const tenant = await tenantService.getTenantBySlug('brew-cafe')
    const branches = await resolvePublicBranchList(tenant.id)
    expect(findPublicBranchBySlug(branches, 'main')?.name).toBe('Midtown Cafe')
  })

  it('brew-cafe brooklyn-cafe branch is in Brooklyn', async () => {
    const tenant = await tenantService.getTenantBySlug('brew-cafe')
    const branches = await resolvePublicBranchList(tenant.id)
    expect(findPublicBranchBySlug(branches, 'brooklyn-cafe')?.city).toBe('Brooklyn')
  })
})
