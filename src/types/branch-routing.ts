import type { Role } from '@/types/rbac'

/** Describes the scope of branch visibility for a given access context. */
export type BranchScope = 'all' | 'assigned' | 'none'

/** Criteria used to filter records to a set of branches. */
export interface BranchFilter {
  tenantId: string
  branchIds?: string[]
  scope: BranchScope
}

/** The identity and assignment context of the actor performing a branch-scoped operation. */
export interface BranchAccessContext {
  tenantId: string
  staffId: string
  roles: Role[]
  branchIds: string[]
}

/** The result of filtering a record set through the branch isolation engine. */
export interface BranchIsolationResult<T> {
  records: T[]
  scope: BranchScope
  accessibleBranchIds: string[]
}

/** A declarative rule that maps an order type to a branch-selection strategy. */
export interface BranchAssignmentRule {
  orderType: 'dine_in' | 'delivery' | 'pickup'
  branchSelectionStrategy: 'table' | 'customer_choice' | 'nearest' | 'current_route'
  requiresActiveBranch: boolean
}
