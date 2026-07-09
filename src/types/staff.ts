// ============================================================
// P7.2 — Staff Management Domain Types
// ============================================================
import type { Role } from './rbac'

export type StaffStatus = 'pending' | 'active' | 'suspended' | 'removed'
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'cancelled'

export type StaffAuditAction =
  | 'staff.invited'
  | 'staff.role_changed'
  | 'staff.suspended'
  | 'staff.activated'
  | 'staff.removed'
  | 'staff.ownership_transferred'

/**
 * A staff member record.
 * Never conflated with the auth User — staff is a workforce concern, not an identity concern.
 *
 * P7.3 branch readiness: branchIds is optional and currently unused.
 *
 * P10.2.1: per docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md §1.1, Staff's
 * primary identity is moving from "belongs to one Tenant" to "belongs to
 * one Owner, independently scoped into any number of that Owner's Tenants
 * via StaffAssignment (src/types/ownership.ts)." `tenantId` is kept,
 * unchanged and required, for backward compatibility with every existing
 * consumer (staff.service.ts, the Staff Management console pages,
 * branch-access.service.ts) — it is NOT removed. It should be read as
 * "this staff member's original/home tenant record" going forward, not as
 * an access grant; access is determined by `StaffAssignment` rows once
 * P10.2.2 wires permission resolution to read them (§4.4), not by this
 * field. New code should prefer `ownerId` + `StaffAssignment` over
 * `tenantId` wherever a choice exists.
 */
export interface StaffMember {
  id: string
  tenantId: string
  userId: string
  email: string
  firstName: string
  lastName: string
  avatar?: string
  status: StaffStatus
  roles: Role[]
  invitedAt: string
  activatedAt?: string
  lastSeenAt?: string
  createdBy: string
  /** P7.3 — Branch assignment readiness. Superseded by StaffAssignment
   *  (P10.1 §1.1/§10.3 — "no live consumer today"); kept, unused, pending
   *  a P10.2+ cleanup removal per the architecture doc's migration notes. */
  branchIds?: string[]
  /**
   * P10.2.1 — FK to Owner.ownerId (src/types/ownership.ts). Additive and
   * optional during the migration window (P10.1 §10.2/§10.3). Backfilled
   * via `ownership-migration.service.ts`'s `backfillTenantOwnership()`,
   * which also derives the matching value for this field.
   */
  ownerId?: string
  metadata?: Record<string, unknown>
}

/**
 * A pending invitation to join a tenant's staff.
 * Lifecycle: pending → accepted | expired | cancelled.
 */
export interface StaffInvite {
  id: string
  tenantId: string
  email: string
  roles: Role[]
  invitedBy: string
  expiresAt: string
  status: InviteStatus
}

/**
 * Represents a user's membership record for a specific tenant.
 * Supports the multi-tenant scenario: one User → many TenantMemberships.
 */
export interface TenantMembership {
  userId: string
  tenantId: string
  staffMemberId: string
  roles: Role[]
  status: StaffStatus
  joinedAt: string
}

/**
 * Aggregate analytics for the staff management dashboard.
 * Derived client-side from the staff list — no separate endpoint needed.
 */
export interface StaffAnalytics {
  totalStaff: number
  activeStaff: number
  pendingInvites: number
  suspendedStaff: number
  byRole: Record<Role, number>
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface InviteStaffPayload {
  email: string
  roles: Role[]
  firstName?: string
  lastName?: string
}

export interface UpdateStaffRolesPayload {
  roles: Role[]
}

export interface TransferOwnershipPayload {
  targetMemberId: string
}

/**
 * Structured audit event for staff actions.
 * Attach a listener via staffService.staffAuditHooks.subscribe() for P7.6 integration.
 */
export interface StaffAuditEvent {
  action: StaffAuditAction
  staffMemberId?: string
  inviteId?: string
  tenantId: string
  performedBy?: string
  metadata?: Record<string, unknown>
  timestamp: string
}
