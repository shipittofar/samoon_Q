// ============================================================
// P10.2.1 — Ownership & RBAC Data Model Foundation
//
// Pure, stateless data-level helpers for the Owner/StaffAssignment model
// (docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md §3.3/§3.5). These are
// deliberately NOT permission-resolution logic:
//
//   - They do not import from or call permission.service.ts.
//   - They do not touch P7Permission, ROLE_PERMISSION_MAP, or `mode`'s
//     read/manage downgrade semantics (P10.1 §3.4).
//   - They are not wired into usePermissions(), branch-access.service.ts,
//     any hook, any store, or any UI component.
//
// The full effective-permission resolution algorithm (P10.1 §4.4 — the
// ownership short-circuit + StaffAssignment lookup + existing
// override/capability/flag composition) is explicitly OUT OF SCOPE for
// this phase per its own instructions ("Do NOT yet change permission
// resolution. Only update the model") and is scoped to P10.2.2 — see
// docs/P10.2.1_OWNERSHIP_DATA_MODEL_IMPLEMENTATION.md's "Remaining work"
// section.
// ============================================================
import type { StaffAssignment, StaffAssignmentStatus, GrantStaffAssignmentPayload } from '@/types/ownership'
import type { StaffMember } from '@/types/staff'
import type { Tenant } from '@/types'
import type { Branch } from '@/types/branch'

/**
 * Derives the effective status of an assignment from its stored `status`
 * plus `validFrom`/`validUntil`, per the lifecycle in P10.1 §3.5:
 *
 *   future --> active: validFrom reached
 *   active --> expired: validUntil reached
 *
 * `'revoked'` is authoritative and never derived away from — an explicit
 * revoke always wins regardless of dates. This is the single source of
 * truth for "is this assignment effective right now"; the stored
 * `status` field on the record itself may be stale between date
 * boundaries (e.g. a `'future'` row whose `validFrom` has since passed)
 * until a write recomputes it, which is why callers should prefer this
 * function over reading `.status` directly.
 */
export function resolveAssignmentStatus(
  assignment: StaffAssignment,
  now: Date = new Date(),
): StaffAssignmentStatus {
  if (assignment.status === 'revoked') return 'revoked'

  if (assignment.validFrom && new Date(assignment.validFrom) > now) {
    return 'future'
  }
  if (assignment.validUntil && new Date(assignment.validUntil) <= now) {
    return 'expired'
  }
  return 'active'
}

/** Convenience wrapper — true only when `resolveAssignmentStatus` is `'active'`. */
export function isAssignmentEffective(assignment: StaffAssignment, now: Date = new Date()): boolean {
  return resolveAssignmentStatus(assignment, now) === 'active'
}

export interface AssignmentValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Enforces the P10.1 §3.3 invariant: a StaffAssignment's `tenantId` must
 * reference a Tenant owned by the same Owner as the assignment's Staff
 * record. This is a data-integrity check, not a permission check — it
 * answers "is this assignment structurally well-formed," never "is this
 * actor allowed to do X."
 *
 * Accepts either a full `StaffAssignment` or the narrower
 * `GrantStaffAssignmentPayload` (both carry `staffId`/`tenantId`), so it
 * can validate a grant request before the row exists.
 */
export function validateAssignment(
  assignment: Pick<StaffAssignment | GrantStaffAssignmentPayload, 'staffId' | 'tenantId'>,
  staff: StaffMember[],
  tenants: Tenant[],
): AssignmentValidationResult {
  const errors: string[] = []

  const staffMember = staff.find((s) => s.id === assignment.staffId)
  if (!staffMember) {
    errors.push(`Staff member not found: ${assignment.staffId}`)
    return { valid: false, errors }
  }
  if (!staffMember.ownerId) {
    errors.push(`Staff member ${assignment.staffId} has no ownerId — cannot validate assignment (pre-migration record)`)
    return { valid: false, errors }
  }

  const tenant = tenants.find((t) => t.id === assignment.tenantId)
  if (!tenant) {
    errors.push(`Tenant not found: ${assignment.tenantId}`)
    return { valid: false, errors }
  }
  if (!tenant.ownerId) {
    errors.push(`Tenant ${assignment.tenantId} has no ownerId — cannot validate assignment (pre-migration record)`)
    return { valid: false, errors }
  }

  if (tenant.ownerId !== staffMember.ownerId) {
    errors.push(
      `Tenant ${assignment.tenantId} is owned by ${tenant.ownerId}, but staff ${assignment.staffId} belongs to ${staffMember.ownerId} — an Owner may only grant access to their own tenants`,
    )
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Structural ownership check — P10.1 §4.2's short-circuit condition
 * ("actor.ownerId === Tenant.ownerId"), expressed here as a pure data
 * lookup only. Returning `true` means "this Owner owns this Tenant"; it
 * does NOT compute or return a permission set (see the file header).
 */
export function ownerOwnsTenant(ownerId: string, tenantId: string, tenants: Tenant[]): boolean {
  const tenant = tenants.find((t) => t.id === tenantId)
  return !!tenant && tenant.ownerId === ownerId
}

/**
 * Expands an assignment's `branchIds` (`string[] | 'all'`) against the
 * tenant's actual branch list. Pure data expansion — mirrors the shape
 * `branch-access.service.ts`'s `getAccessibleBranches` already expects
 * (a concrete `branchIds: string[]`), so a future P10.2.2 wiring pass can
 * feed this output straight into `BranchAccessContext.branchIds` without
 * another transformation step. Does not itself call
 * `branch-access.service.ts` — that remains untouched by this phase.
 */
export function resolveAssignmentBranchIds(
  assignment: Pick<StaffAssignment, 'tenantId' | 'branchIds'>,
  tenantBranches: Branch[],
): string[] {
  if (assignment.branchIds === 'all') {
    return tenantBranches.filter((b) => b.tenantId === assignment.tenantId).map((b) => b.id)
  }
  return [...assignment.branchIds]
}
