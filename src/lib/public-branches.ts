/**
 * Public branch resolution — single adapter for tenant → branch relation.
 *
 * Prefer canonical branch records (GET /tenants/{tenantId}/branches/*).
 * Fall back to legacy settings.marketplace.branches during migration.
 */

import { branchManagementService } from '@/services/branch.service'
import {
  getMarketplaceMeta,
  publicBranchFromDetail,
  type PublicBranchInfo,
} from '@/types/marketplace'
import type { Branch } from '@/types/branch'
import type { Tenant } from '@/types'

/** Legacy branch list embedded in tenant settings (migration fallback). */
export function getLegacyMarketplaceBranches(
  settings?: Tenant['settings'],
): PublicBranchInfo[] {
  return getMarketplaceMeta(settings)?.branches ?? []
}

/** Whether a branch entity should appear on public marketplace surfaces. */
export function isPublicMarketplaceBranch(branch: Branch): boolean {
  return branch.marketplaceVisible !== false
}

/** Maps canonical branch entities into the public display shape. */
export function publicBranchListFromEntities(
  branches: Branch[],
  legacyBranches: PublicBranchInfo[] = [],
): PublicBranchInfo[] {
  const legacyBySlug = new Map(legacyBranches.map((b) => [b.slug, b]))
  return branches
    .filter(isPublicMarketplaceBranch)
    .map((b) => publicBranchFromDetail(b, legacyBySlug.get(b.slug)))
}

/**
 * Resolves the public branch list for a tenant.
 *
 * Fallback order:
 *   1. GET /tenants/{tenantId}/branches/ (canonical)
 *   2. tenant.settings.marketplace.branches (legacy)
 */
export async function resolvePublicBranchList(
  tenantId: string,
  settings?: Tenant['settings'],
): Promise<PublicBranchInfo[]> {
  const legacy = getLegacyMarketplaceBranches(settings)

  try {
    const entities = await branchManagementService.getTenantsBranches(tenantId)
    const publicEntities = entities.filter(isPublicMarketplaceBranch)
    if (publicEntities.length > 0) {
      return publicBranchListFromEntities(publicEntities, legacy)
    }
  } catch {
    // fall through to legacy
  }

  return legacy.filter((b) => b.marketplaceVisible !== false)
}

export function findPublicBranchBySlug(
  branches: PublicBranchInfo[],
  slug: string,
): PublicBranchInfo | undefined {
  return branches.find((b) => b.slug === slug)
}

/**
 * Resolves a single public branch by URL slug.
 * Enriches with GET /tenants/{tenantId}/branches/{branchId}/ when possible.
 */
export async function resolvePublicBranchBySlug(
  tenantId: string,
  branchSlug: string,
  settings?: Tenant['settings'],
): Promise<PublicBranchInfo | null> {
  const branches = await resolvePublicBranchList(tenantId, settings)
  const match = findPublicBranchBySlug(branches, branchSlug)
  if (!match?.id) return null

  const legacyMatch = getLegacyMarketplaceBranches(settings).find(
    (b) => b.slug === branchSlug,
  )

  try {
    const detail = await branchManagementService.getPublicBranch(tenantId, match.id)
    return publicBranchFromDetail(detail, legacyMatch ?? match)
  } catch {
    return match
  }
}
