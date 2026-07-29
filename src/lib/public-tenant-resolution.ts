import { cache } from 'react'
import { notFound } from 'next/navigation'
import { tenantService, TenantNotFoundError, TenantForbiddenError } from '@/services/tenant.service'
import { branchManagementService } from '@/services/branch.service'
import {
  findPublicBranchBySlug,
  getLegacyMarketplaceBranches,
  resolvePublicBranchList,
} from '@/lib/public-branches'
import { getMarketplaceMeta, publicBranchFromDetail, type PublicBranchInfo } from '@/types/marketplace'
import type { Tenant } from '@/types'

/** React Query key for the Discover tenant list — shared with usePublicTenants(). */
export const PUBLIC_TENANTS_QUERY_KEY = ['public-tenants'] as const

export type ResolvePublicTenantOptions = {
  /**
   * Pre-fetched tenants (e.g. React Query discover cache).
   * When a match is found, avoids an extra GET /tenants/ list round-trip.
   */
  cachedTenants?: Tenant[]
}

export type PublicBranchPageData = {
  tenant: Tenant
  meta: ReturnType<typeof getMarketplaceMeta>
  marketplaceBranch: PublicBranchInfo
  branch: PublicBranchInfo
}

function findTenantIdBySlug(tenants: Tenant[], slug: string): string | undefined {
  return tenants.find((t) => t.slug === slug)?.id
}

/**
 * Single source of truth: map a public URL slug to the canonical tenant UUID.
 *
 * Priority:
 *   1. `cachedTenants` (Discover / usePublicTenants React Query cache)
 *   2. GET /api/tenants/ list lookup
 *
 * Never calls GET /api/tenants/{slug}/ — the production backend is UUID-only.
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

/**
 * Fetch full tenant detail for a public URL slug via the UUID detail endpoint.
 */
export async function fetchPublicTenantBySlug(
  slug: string,
  options: ResolvePublicTenantOptions = {},
): Promise<Tenant> {
  const tenantId = await resolvePublicTenantId(slug, options)
  return tenantService.getTenantById(tenantId)
}

/**
 * SSR/RSC tenant resolver — dedupes across generateMetadata() and page() within
 * one Next.js request via React.cache().
 */
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

/**
 * SSR/RSC branch page resolver — reuses the cached tenant fetch above and
 * dedupes the full branch bootstrap across generateMetadata() and page().
 */
export const resolvePublicBranchPageForPage = cache(async (
  tenantSlug: string,
  branchSlug: string,
): Promise<PublicBranchPageData> => {
  const tenant = await resolvePublicTenantForPage(tenantSlug)
  const meta = getMarketplaceMeta(tenant.settings)
  const branchList = await resolvePublicBranchList(tenant.id, tenant.settings)
  const listMatch = findPublicBranchBySlug(branchList, branchSlug)

  if (!listMatch?.id) {
    notFound()
  }

  const legacyMatch = getLegacyMarketplaceBranches(tenant.settings).find(
    (b) => b.slug === branchSlug,
  )

  let branch: PublicBranchInfo
  try {
    const detail = await branchManagementService.getPublicBranch(tenant.id, listMatch.id)
    branch = publicBranchFromDetail(detail, legacyMatch ?? listMatch)
  } catch {
    notFound()
  }

  return { tenant, meta, marketplaceBranch: legacyMatch ?? listMatch, branch }
})
