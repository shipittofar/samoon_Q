/**
 * Public branch lists.
 * resolvePublicBranchList always uses GET /tenants/{id}/branches/.
 * Public branch pages may use branches already on the Discover catalog row.
 */

import { branchManagementService } from '@/services/branch.service'
import { publicBranchFromDetail, type PublicBranchInfo } from '@/types/marketplace'
import type { DiscoverBranch } from '@/types/discover'
import type { Branch } from '@/types/branch'
import type { Tenant } from '@/types'

/** Whether a branch entity should appear on public marketplace surfaces. */
export function isPublicMarketplaceBranch(branch: Branch): boolean {
  return branch.marketplaceVisible !== false
}

/** Maps canonical branch entities into the public display shape. */
export function publicBranchListFromEntities(branches: Branch[]): PublicBranchInfo[] {
  return branches.filter(isPublicMarketplaceBranch).map((b) => publicBranchFromDetail(b))
}

function isDiscoverBranch(value: unknown): value is DiscoverBranch {
  if (!value || typeof value !== 'object') return false
  const branch = value as DiscoverBranch
  return typeof branch.id === 'string' && typeof branch.slug === 'string' && typeof branch.name === 'string'
}

/** Maps a Discover catalog branch into the public display shape. No branch API call. */
export function publicBranchFromDiscover(branch: DiscoverBranch): PublicBranchInfo {
  return {
    id: branch.id,
    slug: branch.slug,
    name: branch.name,
    address: branch.location?.address ?? '',
    city: branch.location?.city ?? '',
    phone_number: branch.phone_number,
    email: branch.email,
    description: branch.description,
    openNow: branch.openNow === true,
    todayHours: branch.todayHours,
    logo: branch.image,
    coverImage: branch.coverImage,
    heroImage: branch.heroImage,
    checkout: branch.checkout,
    businessHours: branch.businessHours,
    currency: branch.currency,
    marketplaceVisible: branch.marketplaceVisible,
    reservationsEnabled: branch.reservationsEnabled,
    maxCapacity: branch.maxCapacity,
    cuisines: branch.cuisines,
    amenities: branch.amenities,
    latitude: branch.location?.latitude,
    longitude: branch.location?.longitude,
    serviceArea: branch.serviceArea,
    locationVerifiedAt: branch.locationVerifiedAt,
    menuItemNames: branch.menuItemNames,
    menuCategoryNames: branch.menuCategoryNames,
  }
}

/**
 * Branches embedded on the Discover tenant row.
 * Returns undefined when the catalog did not include a branches array.
 */
export function publicBranchesFromCatalog(tenant: Tenant): PublicBranchInfo[] | undefined {
  const raw = (tenant as Tenant & { branches?: unknown }).branches
  if (!Array.isArray(raw)) return undefined
  return raw.filter(isDiscoverBranch).map(publicBranchFromDiscover).filter(
    (branch) => branch.marketplaceVisible !== false,
  )
}

/** Resolves the public branch list for a tenant from GET /tenants/{tenantId}/branches/. */
export async function resolvePublicBranchList(tenantId: string): Promise<PublicBranchInfo[]> {
  const entities = await branchManagementService.getTenantsBranches(tenantId)
  return publicBranchListFromEntities(entities)
}

export function findPublicBranchBySlug(
  branches: PublicBranchInfo[],
  slug: string,
): PublicBranchInfo | undefined {
  return branches.find((b) => b.slug === slug)
}

/** Resolves a single public branch by URL slug, enriched with branch detail when possible. */
export async function resolvePublicBranchBySlug(
  tenantId: string,
  branchSlug: string,
): Promise<PublicBranchInfo | null> {
  const branches = await resolvePublicBranchList(tenantId)
  const match = findPublicBranchBySlug(branches, branchSlug)
  if (!match?.id) return null

  try {
    const detail = await branchManagementService.getPublicBranch(tenantId, match.id)
    return publicBranchFromDetail(detail)
  } catch {
    return match
  }
}
