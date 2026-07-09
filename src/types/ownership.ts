// ============================================================
// P10.2.1 — Ownership & RBAC Data Model Foundation
//
// Implements the Owner and StaffAssignment entities exactly as specified
// in docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md §1.1 / §3. Additive only —
// nothing in src/types/rbac.ts, src/services/permission.service.ts, or
// src/services/branch-access.service.ts is modified by this file's
// existence. See docs/P10.2.1_OWNERSHIP_DATA_MODEL_IMPLEMENTATION.md for
// the full implementation report.
// ============================================================
import type { Role } from './rbac'

/**
 * Role values assignable via StaffAssignment — identical to `Role` minus
 * `'owner'` (P10.1 §4.3). `Role` itself is unchanged; this narrower alias
 * is used only where an assignment's role is read or written, so `'owner'`
 * can never be granted through a StaffAssignment.
 */
export type StaffRole = Exclude<Role, 'owner'>

export type OwnerStatus = 'active' | 'suspended' | 'pending_verification'

/**
 * Opaque reference into the Payments/Subscriptions modules (P10.1 §1.1).
 * Deliberately minimal — billing itself is out of scope for this phase.
 */
export interface BillingRef {
  customerId: string | null
  billingEmail: string
}

/**
 * Owner (P10.1 §1.1) — a business entity distinct from Tenant and from any
 * `Role`/`StaffRole` value. Owns zero or more Tenants via `Tenant.ownerId`.
 * `currentTenantCount` is intentionally NOT a field here — P10.1 states it
 * is "derived, not stored authoritatively"; see
 * `ownership.service.ts`'s `countOwnedTenants()`.
 */
export interface Owner {
  ownerId: string
  userId: string
  status: OwnerStatus
  /** Billing plan id — references the Subscriptions module (P9.5). */
  plan: string
  /** Plan-derived ceiling on owned tenants. `null` = unlimited. */
  maxTenants: number | null
  billing: BillingRef
  createdAt: string
  verifiedAt?: string
}

export type StaffAssignmentMode = 'read' | 'manage'
export type StaffAssignmentStatus = 'active' | 'future' | 'revoked' | 'expired'

/**
 * StaffAssignment (P10.1 §1.1 / §3) — formalizes the previously-unpopulated
 * `StaffMember.branchIds` primitive into one row per
 * (staff, tenant, branch-scope, role, mode) grant. A single Staff member
 * may hold any number of these across any number of Tenants owned by
 * their Owner. The invariant that `tenantId`'s Tenant must be owned by the
 * same Owner as the assignment's Staff record (P10.1 §3.3) is enforced by
 * `ownership.service.ts`'s `validateAssignment()`, not by the type system.
 */
export interface StaffAssignment {
  assignmentId: string
  staffId: string
  tenantId: string
  /** `'all'` = every current AND future branch of this tenant. */
  branchIds: string[] | 'all'
  role: StaffRole
  mode: StaffAssignmentMode
  /**
   * Authoritative status as last set by an explicit action (grant/revoke).
   * `'future'` and `'expired'` are also derivable at read time from
   * `validFrom`/`validUntil` — see `resolveAssignmentStatus()` in
   * `ownership.service.ts`, which is the source of truth for "is this
   * assignment effective right now."
   */
  status: StaffAssignmentStatus
  validFrom?: string
  validUntil?: string
  grantedBy: string
  grantedAt: string
  revokedBy?: string
  revokedAt?: string
}

// ── DTOs — mirror docs/BACKEND_API_CONTRACT.md §39.5 ─────────────────────────

export interface GrantStaffAssignmentPayload {
  staffId: string
  tenantId: string
  branchIds: string[] | 'all'
  role: StaffRole
  mode: StaffAssignmentMode
  validFrom?: string
  validUntil?: string
  grantedBy: string
}

export interface UpdateStaffAssignmentPayload {
  branchIds?: string[] | 'all'
  role?: StaffRole
  mode?: StaffAssignmentMode
  validFrom?: string
  validUntil?: string
}

export interface RevokeStaffAssignmentPayload {
  revokedBy: string
  reason?: string
}

/**
 * A "Move" (P10.1 §3.5/§3.6) is modeled as revoke-old + grant-new, never an
 * in-place mutation of `tenantId` — this DTO is a convenience wrapper the
 * service layer expands into exactly those two operations, preserving the
 * audit trail the architecture document requires.
 */
export interface MoveStaffAssignmentPayload {
  fromAssignmentId: string
  to: GrantStaffAssignmentPayload
}
