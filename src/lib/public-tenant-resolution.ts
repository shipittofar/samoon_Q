import { cache } from 'react'
import { notFound } from 'next/navigation'
import { tenantService, TenantNotFoundError, TenantForbiddenError } from '@/services/tenant.service'
import { branchManagementService } from '@/services/branch.service'
import {
  findPublicBranchBySlug,
  resolvePublicBranchList,
} from '@/lib/public-branches'
import {
  composeMarketplacePresentation,
  getMarketplaceMeta,
  publicBranchFromDetail,
  type MarketplaceMeta,
  type PublicBranchInfo,
} from '@/types/marketplace'
import { pickTenantContact } from '@/lib/tenant-settings'
import type { Tenant } from '@/types'

/** React Query key for the Discover tenant list — shared with usePublicTenants(). */
export const PUBLIC_TENANTS_QUERY_KEY = ['public-tenants'] as const

export type ResolvePublicTenantOptions = {
  cachedTenants?: Tenant[]
  /** Bypass the same-slug skip so a public page can reload after a Console mutation. */
  force?: boolean
}

export type PublicBranchPageData = {
  tenant: Tenant
  meta: MarketplaceMeta
  marketplaceBranch: PublicBranchInfo
  branch: PublicBranchInfo
}

function findTenantIdBySlug(tenants: Tenant[], slug: string): string | undefined {
  return tenants.find((t) => t.slug === slug)?.id
}

/**
 * Single source of truth: map a public URL slug to the canonical tenant UUID.
 */
export async function resolvePublicTenantId(
  slug: string,
  options: ResolvePublicTenantOptions = {},
): Promise<string> {
  const { cachedTenants } = options

  if (cachedTenants?.length) {
    const cachedId = findTenantIdBySlug(cachedTenants, slug)
    if (cachedId) return cachedId
  }

  const tenants = await tenantService.getTenants()
  const tenantId = findTenantIdBySlug(tenants, slug)
  if (!tenantId) throw new TenantNotFoundError(slug)
  return tenantId
}

export async function fetchPublicTenantBySlug(
  slug: string,
  options: ResolvePublicTenantOptions = {},
): Promise<Tenant> {
  const tenantId = await resolvePublicTenantId(slug, options)
  return tenantService.getTenantById(tenantId)
}

export const resolvePublicTenantForPage = cache(async (slug: string): Promise<Tenant> => {
  try {
    return await fetchPublicTenantBySlug(slug)
  } catch (err) {
    if (err instanceof TenantNotFoundError || err instanceof TenantForbiddenError) {
      notFound()
    }
    throw err
  }
})

export const resolvePublicBranchPageForPage = cache(async (
  tenantSlug: string,
  branchSlug: string,
): Promise<PublicBranchPageData> => {
  const tenant = await resolvePublicTenantForPage(tenantSlug)
  const branchList = await resolvePublicBranchList(tenant.id)
  const listMatch = findPublicBranchBySlug(branchList, branchSlug)

  if (!listMatch?.id) {
    notFound()
  }

  let branch: PublicBranchInfo
  try {
    const detail = await branchManagementService.getPublicBranch(tenant.id, listMatch.id)
    branch = publicBranchFromDetail(detail)
  } catch {
    notFound()
  }

  const meta = composeMarketplacePresentation({
    listing: getMarketplaceMeta(tenant.settings),
    branches: branchList,
    tenantContact: pickTenantContact(tenant.settings),
  })

  return { tenant, meta, marketplaceBranch: listMatch, branch }
})
