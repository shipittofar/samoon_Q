/**
 * Maps GET /api/public/discover/ wire types into existing UI shapes so
 * Discover components require no contract changes.
 */

import type { Tenant } from '@/types'
import type { DiscoverBranch, DiscoverResponse, DiscoverTenant } from '@/types/discover'
import type { MarketplaceMeta, PublicBranchInfo } from '@/types/marketplace'
import { resolveBranchHoursStatus } from '@/lib/branch-hours'
import { resolveTenantBranding } from '@/lib/tenant-branding'

/** Adapted discover row — TenantWithMeta plus pre-resolved branches for BusinessCard. */
export type DiscoverItem = {
  tenant: Tenant
  meta: MarketplaceMeta
  branches: PublicBranchInfo[]
}

export function mapDiscoverBranchToPublicBranchInfo(branch: DiscoverBranch): PublicBranchInfo {
  const hoursStatus = branch.businessHours?.length
    ? resolveBranchHoursStatus(branch.businessHours)
    : { openNow: branch.openNow, todayHours: branch.todayHours }

  return {
    id: branch.id,
    slug: branch.slug,
    name: branch.name,
    address: branch.location.address,
    city: branch.location.city,
    openNow: hoursStatus.openNow,
    todayHours: hoursStatus.todayHours,
    image: branch.image,
    checkout: branch.checkout,
    currency: branch.currency,
    businessHours: branch.businessHours,
    marketplaceVisible: branch.marketplaceVisible,
    reservationsEnabled: branch.reservationsEnabled,
    maxCapacity: branch.maxCapacity,
  }
}

export function mapDiscoverTenantToItem(item: DiscoverTenant): DiscoverItem {
  const branches = (item.branches ?? [])
    .map(mapDiscoverBranchToPublicBranchInfo)
    .filter((b) => b.marketplaceVisible !== false)

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

  // Prefer Discover `branding`; fall back to legacy `theme` for older responses.
  const branding = resolveTenantBranding({
    branding: item.branding,
    theme: item.theme,
  })

  const tenant: Tenant = {
    id: item.id,
    slug: item.slug,
    name: item.name,
    status: item.status,
    created_at: item.created_at,
    businessTypes: item.businessTypes ?? [],
    image: item.image,
    settings: {
      featureFlags: item.featureFlags,
      // CRUD-shaped store: settings.theme holds branding values for shared consumers
      theme: branding,
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
