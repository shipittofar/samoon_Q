import { describe, it, expect, beforeEach, vi } from 'vitest'
import { branchManagementService } from '@/services/branch.service'
import { tenantService } from '@/services/tenant.service'
import { getMarketplaceMeta } from '@/types/marketplace'
import {
  findPublicBranchBySlug,
  getLegacyMarketplaceBranches,
  resolvePublicBranchList,
} from '@/lib/public-branches'

beforeEach(() => {
  branchManagementService._resetMockStore()
  tenantService._resetMockList()
})

describe('public-branches adapter', () => {
  it('getLegacyMarketplaceBranches reads settings.marketplace.branches', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const legacy = getLegacyMarketplaceBranches(tenant.settings)
    const meta = getMarketplaceMeta(tenant.settings)
    expect(legacy).toEqual(meta?.branches)
    expect(legacy.length).toBe(3)
  })

  it('resolvePublicBranchList prefers tenant branch API over legacy settings', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const branches = await resolvePublicBranchList(tenant.id, tenant.settings)

    expect(branches.length).toBeGreaterThan(0)
    expect(branches.every((b) => b.id && b.slug && b.name)).toBe(true)
    expect(findPublicBranchBySlug(branches, 'main')?.slug).toBe('main')
  })

  it('resolvePublicBranchList falls back to legacy when API returns empty', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    vi.spyOn(branchManagementService, 'getTenantsBranches').mockResolvedValueOnce([])

    const branches = await resolvePublicBranchList(tenant.id, tenant.settings)
    expect(branches).toEqual(getLegacyMarketplaceBranches(tenant.settings))
  })

  it('resolvePublicBranchList falls back to legacy when API fails', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    vi.spyOn(branchManagementService, 'getTenantsBranches').mockRejectedValueOnce(
      new Error('network'),
    )

    const branches = await resolvePublicBranchList(tenant.id, tenant.settings)
    expect(branches).toEqual(getLegacyMarketplaceBranches(tenant.settings))
  })
})
