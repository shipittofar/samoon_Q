/**
 * Maps GET /api/public/discover/ wire types into existing UI shapes.
 * One-way toward Branch-owned location/contact/media and Tenant listing metadata.
 */

import type { Tenant } from '@/types'
import type { DiscoverBranch, DiscoverResponse, DiscoverTenant } from '@/types/discover'
import {
  composeMarketplacePresentation,
  pickTenantMarketplace,
  type PublicBranchInfo,
} from '@/types/marketplace'
import { resolveBranchHoursStatus } from '@/lib/branch-hours'
import { pickTenantContact } from '@/lib/tenant-settings'
import { resolveTenantBranding } from '@/lib/tenant-branding'

/** Adapted discover row — TenantWithMeta plus pre-resolved branches for BusinessCard. */
export type DiscoverItem = {
  tenant: Tenant
  meta: ReturnType<typeof composeMarketplacePresentation>
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
    description: branch.description,
    address: branch.location.address,
    city: branch.location.city,
    phone_number: branch.phone_number,
    email: branch.email,
    openNow: hoursStatus.openNow,
    todayHours: hoursStatus.todayHours,
    logo: branch.image,
    coverImage: branch.coverImage,
    heroImage: branch.heroImage,
    checkout: branch.checkout,
    currency: branch.currency,
    businessHours: branch.businessHours,
    marketplaceVisible: branch.marketplaceVisible,
    reservationsEnabled: branch.reservationsEnabled,
    maxCapacity: branch.maxCapacity,
    cuisines: branch.cuisines,
    amenities: branch.amenities,
    latitude: branch.location.latitude,
    longitude: branch.location.longitude,
    serviceArea: branch.serviceArea,
    locationVerifiedAt: branch.locationVerifiedAt,
    menuItemNames: branch.menuItemNames,
    menuCategoryNames: branch.menuCategoryNames,
  }
}

export function mapDiscoverTenantToItem(item: DiscoverTenant): DiscoverItem {
  const branches = (item.branches ?? [])
    .map(mapDiscoverBranchToPublicBranchInfo)
    .filter((b) => b.marketplaceVisible !== false)

  const listing = pickTenantMarketplace(item.marketplace)
  const tenantContact = pickTenantContact({
    contactEmail: item.contactEmail,
    contactPhone: item.contactPhone,
  })

  const meta = composeMarketplacePresentation({
    listing,
    branches,
    tenantContact,
    computed: {
      openNow: item.marketplace?.openNow,
      branchCount: item.marketplace?.branchCount,
      primaryBranchSlug: item.marketplace?.primaryBranchSlug,
    },
  })

  const branding = resolveTenantBranding({
    branding: item.branding,
    theme: item.theme,
  })

  const tenant: Tenant = {
    id: item.id,
    slug: item.slug,
    name: item.name,
    description: item.description,
    is_active: item.is_active === true,
    status: item.status,
    created_at: item.created_at,
    businessTypes: item.businessTypes ?? [],
    image: item.image,
    discoverAvatar: item.discoverAvatar ?? (item as DiscoverTenant & { discover_avatar?: string }).discover_avatar,
    discoverCover: item.discoverCover ?? (item as DiscoverTenant & { discover_cover?: string }).discover_cover,
    heroImage: item.heroImage ?? (item as DiscoverTenant & { hero_image?: string }).hero_image,
    settings: {
      featureFlags: item.featureFlags,
      theme: branding,
      marketplace: listing,
      contactEmail: item.contactEmail,
      contactPhone: item.contactPhone,
    },
  }

  return { tenant, meta, branches }
}

/** Filters to publicly visible discover tenants (`is_active`, not status). */
export function isPublicDiscoverTenant(item: DiscoverTenant): boolean {
  return item.slug !== 'default' && item.is_active === true
}

export function adaptDiscoverResponse(response: DiscoverResponse): DiscoverItem[] {
  return response.results.filter(isPublicDiscoverTenant).map(mapDiscoverTenantToItem)
}
