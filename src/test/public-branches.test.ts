import { describe, it, expect, beforeEach, vi } from 'vitest'
import { branchManagementService } from '@/services/branch.service'
import { tenantService } from '@/services/tenant.service'
import { findPublicBranchBySlug, resolvePublicBranchList } from '@/lib/public-branches'

beforeEach(() => {
  branchManagementService._resetMockStore()
  tenantService._resetMockList()
})

describe('public-branches adapter', () => {
  it('resolvePublicBranchList reads Branch API, not Tenant.settings.marketplace.branches', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const branches = await resolvePublicBranchList(tenant.id)

    expect(branches.length).toBeGreaterThan(0)
    expect(branches.every((b) => b.id && b.slug && b.name)).toBe(true)
    expect(findPublicBranchBySlug(branches, 'main')?.slug).toBe('main')
    expect(getMarketplaceMetaHasNoBranches(tenant.settings)).toBe(true)
  })

  it('resolvePublicBranchList returns empty when API returns empty', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    vi.spyOn(branchManagementService, 'getTenantsBranches').mockResolvedValueOnce([])

    const branches = await resolvePublicBranchList(tenant.id)
    expect(branches).toEqual([])
  })

  it('resolvePublicBranchList does not fall back to tenant settings when API fails', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    vi.spyOn(branchManagementService, 'getTenantsBranches').mockRejectedValueOnce(
      new Error('network'),
    )

    await expect(resolvePublicBranchList(tenant.id)).rejects.toThrow('network')
  })
})

function getMarketplaceMetaHasNoBranches(settings: unknown): boolean {
  const marketplace = (settings as { marketplace?: Record<string, unknown> } | undefined)?.marketplace
  return !marketplace || !('branches' in marketplace)
}
