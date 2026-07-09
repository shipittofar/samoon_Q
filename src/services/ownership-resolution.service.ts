// ============================================================
// P10.2.2 — Ownership Permission Resolution Engine
//
// Implements the algorithm from docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md
// §4.4, EXTENDING `usePermissions()` (src/hooks/index.ts) rather than
// replacing it — see that hook for exactly where this plugs in and what
// stays byte-for-byte unchanged (override application, capability/flag
// composition).
//
// This is the ONLY new source of ownership-aware permission logic in the
// codebase. It:
//   - reuses `ROLE_PERMISSION_MAP`/`ALL_PERMISSIONS` from
//     permission.service.ts (imported, never redefined or duplicated)
//   - reuses the pure data helpers in ownership.service.ts
//     (`ownerOwnsTenant`, `isAssignmentEffective`, `resolveAssignmentBranchIds`)
//   - reuses `staffAssignmentService.getEffectiveAssignments()` (already
//     synchronous — no change needed there)
//   - introduces exactly one new concept not present anywhere else: the
//     `mode: 'read'` → `.view`-only downgrade (P10.1 §3.4), which by
//     definition cannot have existed before StaffAssignment existed.
//
// Priority order (P10.1 §4.4 / this phase's Phase C):
//   1. Platform Admin — deliberately NOT handled here. Platform Admin uses
//      a wholly separate guard/hook/permission system
//      (PlatformPermissionGuard / usePlatformPermission /
//      src/platform-admin/permissions.ts) that never calls usePermissions()
//      or anything in this file. P10.1 §4.1 states this is correct and
//      must not be forced into this model — so "priority 1" is enforced by
//      ROUTING SEPARATION (different guard, different route tree), not by
//      a shared code path. See docs/P10.2.2_OWNERSHIP_RESOLUTION_ENGINE.md
//      Phase B for the full resolution graph.
//   2. Owner — `resolveOwnerPermissions()` below.
//   3. Staff (StaffAssignment) — `resolveStaffAssignmentPermissions()` below.
//   4. Customer — deliberately NOT handled here either. Per P10.1 §4.5,
//      Customers hold zero P7Permission/PlatformPermission grants; their
//      access is a data-scoping rule (`BusinessCustomer.platformUserId ===
//      self.id`), not a permission-set computation. Nothing in this file
//      returns permissions for a Customer identity, which is the correct
//      behavior — an actor with no Owner and no StaffAssignment resolves
//      to an empty set from both functions below, exactly as a Customer
//      should.
//
// Known limitation (documented, not fixed — see the final report):
// bridging the live session (`useAuthStore.user`) to the Owner/Staff mock
// fixtures requires an email lookup because `User.id` (auth mock ids
// '1'..'10') and `StaffMember.userId`/`Owner.userId` ('user-owner-01' etc.)
// are two disjoint id spaces in this codebase's mock data (P10.0 J12/J13).
// Consolidating those id spaces is out of scope for a permission-resolution
// phase — it would mean editing `auth.service.ts`'s login flow and
// `mock-data.ts`'s User fixtures, not permission logic.
// ============================================================
import { ROLE_PERMISSION_MAP, ALL_PERMISSIONS } from './permission.service'
import { ownerOwnsTenant, resolveAssignmentBranchIds } from './ownership.service'
import { ownerService } from './owner.service'
import { staffAssignmentService } from './staff-assignment.service'
import { staffService } from './staff.service'
import { tenantService } from './tenant.service'
import { branchManagementService } from './branch.service'
import { branchAccessService, BranchAccessError } from './branch-access.service'
import type { P7Permission, Role } from '@/types/rbac'
import type { Owner, StaffAssignment } from '@/types/ownership'
import type { StaffMember } from '@/types/staff'
import type { Tenant } from '@/types'
import type { Branch } from '@/types/branch'
import type { BranchAccessContext } from '@/types/branch-routing'

export interface OwnershipIdentity {
  owner?: Owner
  staffMember?: StaffMember
}

// ── P10.3 — centralized eligibility predicates ───────────────────────────────
//
// Phase A/B/C: the resolution engine previously granted permissions purely
// from ownership/assignment structure, never checking whether the Owner,
// Staff, or Tenant record itself was in a state that should grant access
// at all (P10.2.3 findings F-1, F-2, F-8). These three predicates are the
// single, centralized place that decides "is this record eligible to
// participate in permission resolution" — every function below calls
// these instead of re-deriving `.status` checks inline, and any future
// caller (e.g. the Phase D/E branch/tenant access guards) reuses the same
// predicates rather than duplicating the check.

/** P10.3 Phase A — an Owner only grants access while `status === 'active'`. */
export function isOwnerEligible(owner: Owner): boolean {
  return owner.status === 'active'
}

/** P10.3 Phase B — a Staff member only grants access while `status === 'active'`. */
export function isStaffMemberEligible(staffMember: StaffMember): boolean {
  return staffMember.status === 'active'
}

/**
 * P10.3 Phase C — a Tenant only grants access while not `'archived'`.
 * Scoped exactly to the verified finding (P10.2.3 F-8: "archived tenants
 * don't lose access") — `'trial'`/`'suspended'`/`'churned'` tenants are
 * unaffected by this phase; broadening the check to those states was not
 * a verified finding and is left as documented remaining debt (see the
 * P10.3 report).
 */
export function isTenantEligible(tenant: Pick<Tenant, 'status'>): boolean {
  return tenant.status !== 'archived'
}

/**
 * Resolves the Owner/Staff identity for a session email. Synchronous,
 * mock-mode only (see file header for why) — returns `{}` for any email
 * with no matching StaffMember (correct: an actor who is neither Owner
 * nor Staff is a Customer or an anonymous/public visitor, per P10.1 §4.5).
 */
export function resolveOwnershipIdentity(email: string | null | undefined): OwnershipIdentity {
  if (!email) return {}
  const staffMember = staffService.findStaffMemberByEmail(email)
  if (!staffMember) return {}
  const owner = staffMember.ownerId
    ? ownerService.getOwnerByUserIdSync(staffMember.userId)
    : undefined
  return { owner, staffMember }
}

/**
 * P10.1 §4.2 — Owner short-circuit. An Owner has every `P7Permission` for
 * a Tenant they own, structurally, with no assignment record — including
 * the now owner-exclusive `tenant.manage`/`tenant.view` (§7.2). Returns
 * an empty array (never null/undefined) when the identity isn't the
 * owner of `activeTenant`, so callers can safely treat the return value
 * as "permissions to union in," not "a signal to branch on."
 */
export function resolveOwnerPermissions(
  identity: OwnershipIdentity,
  activeTenant: Pick<Tenant, 'id' | 'ownerId' | 'status'> | undefined,
): readonly P7Permission[] {
  if (!identity.owner || !activeTenant) return []
  if (!isOwnerEligible(identity.owner)) return []
  if (!isTenantEligible(activeTenant)) return []
  if (!ownerOwnsTenant(identity.owner.ownerId, activeTenant.id, [activeTenant as Tenant])) return []
  return ALL_PERMISSIONS
}

/**
 * P10.1 §3.4 — mode: 'read' downgrades a role's permission set to the
 * `.view`-suffixed subset only, mechanically derived from `ALL_PERMISSIONS`
 * rather than hand-maintained per role. A permission whose resource has no
 * `.view` sibling (e.g. `payments.process`) is dropped entirely in read
 * mode — there is no "read-only" projection of an action that has no view
 * counterpart.
 */
export function downgradeToReadOnly(permissions: readonly P7Permission[]): P7Permission[] {
  const result = new Set<P7Permission>()
  for (const permission of permissions) {
    const resource = permission.split('.')[0]
    if (permission.endsWith('.view')) {
      result.add(permission)
      continue
    }
    const viewEquivalent = `${resource}.view` as P7Permission
    if (ALL_PERMISSIONS.includes(viewEquivalent)) {
      result.add(viewEquivalent)
    }
  }
  return [...result]
}

/**
 * P10.1 §4.4 step 3 — resolves permissions granted by this Staff member's
 * active `StaffAssignment` rows scoped to `tenantId`, unioned across every
 * matching assignment (a staff member may hold more than one assignment
 * to the same tenant with different branch scopes). `ROLE_PERMISSION_MAP`
 * is reused as-is; only the `mode: 'read'` downgrade is new logic.
 * `staffAssignmentService.getEffectiveAssignments()` already applies
 * `resolveAssignmentStatus()`, so future/expired/revoked rows are already
 * excluded before this function ever sees them.
 */
export function resolveStaffAssignmentPermissions(
  identity: OwnershipIdentity,
  activeTenant: Pick<Tenant, 'id' | 'status'> | undefined,
  now: Date = new Date(),
): readonly P7Permission[] {
  if (!identity.staffMember || !activeTenant) return []
  if (!isStaffMemberEligible(identity.staffMember)) return []
  if (!isTenantEligible(activeTenant)) return []
  const assignments = staffAssignmentService
    .getEffectiveAssignments(identity.staffMember.id, now)
    .filter((a) => a.tenantId === activeTenant.id)

  const result = new Set<P7Permission>()
  for (const assignment of assignments) {
    const rolePermissions = ROLE_PERMISSION_MAP[assignment.role as Role] ?? []
    const effective = assignment.mode === 'read' ? downgradeToReadOnly(rolePermissions) : rolePermissions
    effective.forEach((p) => result.add(p))
  }
  return [...result]
}

/**
 * The full P10.1 §4.4 priority chain for tenant-scoped `P7Permission`s
 * (steps 2 and 3 — see the file header for why steps 1 and 4 are
 * intentionally absent from this function). Owner short-circuits and
 * returns immediately; otherwise falls through to StaffAssignment-derived
 * permissions. Returns `[]` for a Customer/anonymous identity, which is
 * correct — see `usePermissions()` in src/hooks/index.ts for how this is
 * UNIONED (not substituted) with the existing tenantRoles-based grants,
 * preserving every current mock-login/PermissionGuard test unchanged.
 */
export function resolveOwnershipDrivenPermissions(
  email: string | null | undefined,
  activeTenant: Pick<Tenant, 'id' | 'ownerId' | 'status'> | undefined,
  now: Date = new Date(),
): readonly P7Permission[] {
  const identity = resolveOwnershipIdentity(email)
  const ownerPermissions = resolveOwnerPermissions(identity, activeTenant)
  if (ownerPermissions.length > 0) return ownerPermissions
  return resolveStaffAssignmentPermissions(identity, activeTenant, now)
}

/**
 * P10.1 §4.4 branch-scope step, phase D wiring: builds a `BranchAccessContext`
 * (src/types/branch-routing.ts, consumed unchanged by
 * `branch-access.service.ts` / `useAccessibleBranches()`) from this Staff
 * member's active StaffAssignment rows for `tenantId`, expanding each
 * assignment's `branchIds` (`'all'` or an explicit list) via
 * `ownership.service.ts`'s `resolveAssignmentBranchIds()`. Does not call
 * `branch-access.service.ts` itself — produces its input, once, so the
 * existing branch-filtering logic there is reused unchanged, never
 * duplicated. Returns `null` when the identity has no Staff record or no
 * assignments to this tenant (an Owner doesn't need this — ownership
 * already grants full branch access via `resolveOwnerPermissions()`
 * above; callers should check ownership first).
 */
export function buildBranchAccessContextFromAssignments(
  email: string | null | undefined,
  tenantId: string,
  tenantBranches: Branch[],
  now: Date = new Date(),
): BranchAccessContext | null {
  const identity = resolveOwnershipIdentity(email)
  if (!identity.staffMember) return null

  const assignments = staffAssignmentService
    .getEffectiveAssignments(identity.staffMember.id, now)
    .filter((a) => a.tenantId === tenantId)
  if (assignments.length === 0) return null

  const branchIds = new Set<string>()
  const roles = new Set<Role>()
  for (const assignment of assignments) {
    resolveAssignmentBranchIds(assignment, tenantBranches).forEach((id) => branchIds.add(id))
    roles.add(assignment.role as Role)
  }

  return {
    tenantId,
    staffId: identity.staffMember.id,
    roles: [...roles],
    branchIds: [...branchIds],
  }
}

/**
 * P10.3 Phase D — branch isolation enforcement (highest priority; P10.2.3
 * finding F-4: `BranchAccessContext`/`branchAccessService` existed but no
 * read path ever called them). This is the single reusable guard every
 * branch-scoped read hook calls before returning data — it does not
 * reimplement branch filtering, it only decides "may this identity see
 * this branch" and reuses exactly the same building blocks §4.4 already
 * established: `resolveOwnershipIdentity`, `isOwnerEligible`,
 * `isTenantEligible`, `ownerOwnsTenant` (ownership.service.ts),
 * `buildBranchAccessContextFromAssignments` (above), and
 * `branchAccessService.assertBranchAccess` (branch-access.service.ts,
 * P7.4 — previously built but never called from a live read path).
 *
 * An eligible Owner of the branch's tenant always passes (ownership grants
 * full branch access, mirroring `resolveOwnerPermissions()`). Otherwise
 * the caller must hold a StaffAssignment whose resolved `branchIds`
 * include `branchId`. Throws `BranchAccessError` — imported and reused
 * unchanged, not a new error type — on any denial, including an
 * ineligible/archived tenant or a branch that doesn't exist.
 */
export async function assertOwnershipBranchAccess(
  email: string | null | undefined,
  branchId: string,
): Promise<void> {
  const branch = await branchManagementService.getBranch(branchId)
  const tenants = await tenantService.getTenants()
  const tenant = tenants.find((t) => t.id === branch.tenantId)
  if (!tenant || !isTenantEligible(tenant)) {
    throw new BranchAccessError(branchId, 'unknown')
  }

  const identity = resolveOwnershipIdentity(email)

  if (
    identity.owner &&
    isOwnerEligible(identity.owner) &&
    ownerOwnsTenant(identity.owner.ownerId, tenant.id, tenants)
  ) {
    return
  }

  const tenantBranches = await branchManagementService.getBranches(tenant.id)
  const context = buildBranchAccessContextFromAssignments(email, tenant.id, tenantBranches)
  if (!context) {
    throw new BranchAccessError(branchId, identity.staffMember?.id ?? 'unknown')
  }
  branchAccessService.assertBranchAccess(branchId, context, tenantBranches)
}

/** Re-exported for tests/consumers that only need the type, not the logic. */
export type { StaffAssignment }
