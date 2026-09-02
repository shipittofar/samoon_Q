/**
 * Public branch resolution — Branch API only.
 */

import { branchManagementService } from '@/services/branch.service'
import { publicBranchFromDetail, type PublicBranchInfo } from '@/types/marketplace'
import type { Branch } from '@/types/branch'

/** Whether a branch entity should appear on public marketplace surfaces. */
export function isPublicMarketplaceBranch(branch: Branch): boolean {
  return branch.marketplaceVisible !== false
}

/** Maps canonical branch entities into the public display shape. */
export function publicBranchListFromEntities(branches: Branch[]): PublicBranchInfo[] {
  return branches.filter(isPublicMarketplaceBranch).map((b) => publicBranchFromDetail(b))
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
