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
 * A tenant-scoped staff member record.
 * Never conflated with the auth User — staff is a workforce concern, not an identity concern.
 *
 * P7.3 branch readiness: branchIds is optional and currently unused.
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
  /** P7.3 — Branch assignment readiness. Populated by P7.3 Branch Management. */
  branchIds?: string[]
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
