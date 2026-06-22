import { hasPermission } from '@/services/permission.service'
import type { BranchAccessContext, BranchIsolationResult, BranchScope } from '@/types/branch-routing'
import type { Branch as BranchEntity } from '@/types/branch'

export class BranchAccessError extends Error {
  constructor(
    public readonly branchId: string,
    public readonly staffId: string,
  ) {
    super(`Staff ${staffId} does not have access to branch ${branchId}`)
    this.name = 'BranchAccessError'
  }
}

export const branchAccessService = {
  /** Returns branches the actor is permitted to see.
   *  Actors with branches.manage see all tenant branches; others see only assigned ones. */
  getAccessibleBranches(
    context: BranchAccessContext,
    allBranches: BranchEntity[],
  ): BranchEntity[] {
    const tenantBranches = allBranches.filter((b) => b.tenantId === context.tenantId)
    if (hasPermission(context.roles, 'branches.manage')) {
      return tenantBranches
    }
    return tenantBranches.filter((b) => context.branchIds.includes(b.id))
  },

  /** Returns true if the actor is permitted to access the given branch. */
  canAccessBranch(
    branchId: string,
    context: BranchAccessContext,
    allBranches: BranchEntity[],
  ): boolean {
    return this.getAccessibleBranches(context, allBranches).some((b) => b.id === branchId)
  },

  /** Filters an arbitrary record set to records belonging to accessible branches.
   *  getBranchId must extract the branch identifier from a record. */
  filterByAccessibleBranches<T>(
    records: T[],
    getBranchId: (record: T) => string,
    context: BranchAccessContext,
    allBranches: BranchEntity[],
  ): BranchIsolationResult<T> {
    const accessible = this.getAccessibleBranches(context, allBranches)
    const accessibleIds = new Set(accessible.map((b) => b.id))
    const scope: BranchScope = hasPermission(context.roles, 'branches.manage') ? 'all' : 'assigned'
    return {
      records: records.filter((r) => accessibleIds.has(getBranchId(r))),
      scope,
      accessibleBranchIds: [...accessibleIds],
    }
  },

  /** Throws BranchAccessError when the actor cannot access the given branch. */
  assertBranchAccess(
    branchId: string,
    context: BranchAccessContext,
    allBranches: BranchEntity[],
  ): void {
    if (!this.canAccessBranch(branchId, context, allBranches)) {
      throw new BranchAccessError(branchId, context.staffId)
    }
  },

  /** Derives the scope label for the given access context. */
  getScopeForContext(context: BranchAccessContext): BranchScope {
    if (hasPermission(context.roles, 'branches.manage')) return 'all'
    if (context.branchIds.length > 0) return 'assigned'
    return 'none'
  },
}
