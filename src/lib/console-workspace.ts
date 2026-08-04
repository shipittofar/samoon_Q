import type { MembershipBranch, TenantMembership } from '@/types/rbac'
import type { Branch, BranchResolutionState } from '@/types/branch'
import type { TenantLifecycle } from '@/types'
import { DEFAULT_BRANCH_CHECKOUT } from '@/lib/branch-checkout'

type ConsoleWorkspacePhase =
  | 'idle'
  | 'initializing'
  | 'switching_tenant'
  | 'switching_branch'
  | 'ready'
  | 'error'

/**
 * Resolves the Console default tenant — ONLY from activeMembership.tenantId.
 *
 * Returns null when activeMembership.tenantId is missing or not in memberships.
 * Does not auto-select from the memberships list; the user may pick manually.
 */
export function resolveConsoleActiveTenantId(
  memberships: readonly TenantMembership[] | null | undefined,
  activeMembership: Pick<TenantMembership, 'tenantId'> | null | undefined,
): string | null {
  const activeId = activeMembership?.tenantId
  if (!activeId) return null
  if (!memberships?.some((m) => m.tenantId === activeId)) return null
  return activeId
}

/** @deprecated Use resolveConsoleActiveTenantId — kept for import stability during migration. */
export const resolveConsoleDefaultTenantId = resolveConsoleActiveTenantId

/** Converts a /auth/me membership branch summary into a full Branch for the store. */
export function membershipBranchToBranch(mb: MembershipBranch, tenantId: string): Branch {
  return {
    id: mb.id,
    tenantId,
    name: mb.name,
    slug: mb.slug,
    status: mb.status,
    type: 'physical',
    location: { address: '', city: '', country: '' },
    contact: {},
    businessHours: [],
    checkout: { ...DEFAULT_BRANCH_CHECKOUT },
    marketplaceVisible: true,
    reservationsEnabled: false,
    isDefault: mb.isDefault,
    created_at: '',
    updated_at: '',
  }
}

export function membershipBranchesToBranches(
  membershipBranches: readonly MembershipBranch[],
  tenantId: string,
): Branch[] {
  return membershipBranches.map((b) => membershipBranchToBranch(b, tenantId))
}

/**
 * Resolves the Console active branch — ONLY from activeMembership.branchId.
 *
 * Returns null when branchId is missing or not in the loaded branch list.
 * Does not fall back to persisted ids, isDefault, or array position.
 */
export function resolveConsoleActiveBranch(
  branches: readonly Branch[],
  activeBranchId: string | null | undefined,
): Branch | null {
  if (!activeBranchId) return null
  return branches.find((b) => b.id === activeBranchId) ?? null
}

/**
 * @deprecated Use resolveConsoleActiveBranch — kept for import stability during migration.
 */
export function resolveConsoleDefaultBranch(
  branches: readonly Branch[],
  activeBranchId: string | null | undefined,
): Branch | null {
  return resolveConsoleActiveBranch(branches, activeBranchId)
}

export function membershipLabel(membership: TenantMembership): string {
  return membership.tenantName ?? membership.tenantSlug ?? membership.tenantId
}

const UNSETTLED_WORKSPACE_PHASES: ReadonlySet<ConsoleWorkspacePhase> = new Set([
  'idle',
  'initializing',
  'switching_tenant',
  'switching_branch',
])

const SETTLED_BRANCH_STATES: ReadonlySet<BranchResolutionState> = new Set([
  'ready',
  'empty',
  'error',
])

/**
 * Single readiness gate for Console tenant + branch selectors.
 * Both switchers must stay hidden/skeleton until this returns true.
 */
export function isConsoleSelectorsReady(params: {
  sessionMemberships: readonly TenantMembership[] | null
  workspacePhase: ConsoleWorkspacePhase
  tenantState: TenantLifecycle
  branchState: BranchResolutionState
  activeTenantId?: string | null
}): boolean {
  const { sessionMemberships, workspacePhase, tenantState, branchState, activeTenantId } = params
  if (sessionMemberships === null) return false
  if (UNSETTLED_WORKSPACE_PHASES.has(workspacePhase)) return false

  // Boot finished but no active tenant pointer — tenant switcher must remain usable.
  if (!activeTenantId) {
    return workspacePhase === 'ready' || workspacePhase === 'error'
  }

  if (tenantState !== 'resolved') return false
  if (!SETTLED_BRANCH_STATES.has(branchState)) return false
  return true
}

/** True when /auth/me provided a non-empty branches list for this membership. */
export function hasMembershipBranches(
  membership: Pick<TenantMembership, 'branches'> | null | undefined,
): membership is TenantMembership & { branches: MembershipBranch[] } {
  return Array.isArray(membership?.branches) && membership.branches.length > 0
}
