/**
 * Maps GET /api/public/discover/ wire types into existing UI shapes so
 * Discover components require no contract changes.
 */

import type { Tenant } from '@/types'
import type { DiscoverBranch, DiscoverResponse, DiscoverTenant } from '@/types/discover'
import type { MarketplaceMeta, PublicBranchInfo } from '@/types/marketplace'

/** Adapted discover row — TenantWithMeta plus pre-resolved branches for BusinessCard. */
export type DiscoverItem = {
  tenant: Tenant
  meta: MarketplaceMeta
  branches: PublicBranchInfo[]
}

export function mapDiscoverBranchToPublicBranchInfo(branch: DiscoverBranch): PublicBranchInfo {
  return {
    id: branch.id,
    slug: branch.slug,
    name: branch.name,
    address: branch.location.address,
    city: branch.location.city,
    openNow: branch.openNow,
    todayHours: branch.todayHours,
    image: branch.image,
  }
}

export function mapDiscoverTenantToItem(item: DiscoverTenant): DiscoverItem {
  const branches = (item.branches ?? []).map(mapDiscoverBranchToPublicBranchInfo)

  const marketplaceInput = item.marketplace ?? {}
  const meta: MarketplaceMeta = {
    ...marketplaceInput,
    branchCount: marketplaceInput.branchCount ?? branches.length,
    openNow:
      marketplaceInput.openNow !== undefined
        ? marketplaceInput.openNow
        : branches.length > 0
          ? branches.some((b) => b.openNow)
          : undefined,
    primaryBranchSlug:
      marketplaceInput.primaryBranchSlug ?? branches[0]?.slug,
    branches,
  }

  const tenant: Tenant = {
    id: item.id,
    slug: item.slug,
    name: item.name,
    status: item.status,
    created_at: item.created_at,
    businessTypes: item.businessTypes ?? [],
    settings: {
      featureFlags: item.featureFlags,
      theme: item.theme,
      marketplace: meta,
    },
  }

  return { tenant, meta, branches }
}

/** Filters to the same public tenants Discover showed before migration. */
export function isPublicDiscoverTenant(item: DiscoverTenant): boolean {
  return (
    item.slug !== 'default' &&
    (item.status === 'active' || item.status === 'trial')
  )
}

export function adaptDiscoverResponse(response: DiscoverResponse): DiscoverItem[] {
  return response.results.filter(isPublicDiscoverTenant).map(mapDiscoverTenantToItem)
}
