import type { MembershipBranch, TenantMembership } from '@/types/rbac'
import type { Branch } from '@/types/branch'

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
    settings: {
      deliveryEnabled: false,
      pickupEnabled: true,
      tableOrderingEnabled: false,
      reservationsEnabled: false,
    },
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
 * Picks the branch the Console workspace should activate.
 *
 * Membership source (respectMembershipDefault):
 *   1. persisted id when still in list
 *   2. branch with isDefault === true
 *   3. first branch
 *
 * API fallback (default):
 *   1. persisted id when still in list
 *   2. first branch (or sole branch auto-select)
 */
export function resolveConsoleDefaultBranch(
  branches: readonly Branch[],
  persistedBranchId: string | null | undefined,
  options?: { respectMembershipDefault?: boolean },
): Branch | null {
  if (branches.length === 0) return null
  if (branches.length === 1) return branches[0]!

  if (persistedBranchId) {
    const match = branches.find((b) => b.id === persistedBranchId)
    if (match) return match
  }

  if (options?.respectMembershipDefault) {
    const defaultBranch = branches.find((b) => b.isDefault === true)
    if (defaultBranch) return defaultBranch
  }

  return branches[0]!
}

export function membershipLabel(membership: TenantMembership): string {
  return membership.tenantName ?? membership.tenantSlug ?? membership.tenantId
}

/** True when /auth/me provided a non-empty branches list for this membership. */
export function hasMembershipBranches(
  membership: Pick<TenantMembership, 'branches'> | null | undefined,
): membership is TenantMembership & { branches: MembershipBranch[] } {
  return Array.isArray(membership?.branches) && membership.branches.length > 0
}
