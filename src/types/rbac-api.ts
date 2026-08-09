/**
 * RBAC D2 — wire shapes and normalized frontend contracts.
 * Location-based assignments (no branch_id / branch fields).
 */

export type AssignmentMode = 'read' | 'manage'
export type AssignmentStatus = 'active' | 'future' | 'revoked' | 'expired'

export interface PermissionCatalogEntry {
  id?: string
  key: string
  resource: string
  action: string
  description: string
}

export interface RoleCatalogEntry {
  id: string
  name: string
  slug: string
  description?: string
  permissions: string[]
  isSystemRole?: boolean
  editable?: boolean
}

export interface LocationRef {
  id: string
  name: string
  slug?: string
  status?: string
}

/** Normalized assignment — canonical frontend shape after API ingest. */
export interface RbacAssignment {
  assignmentId: string
  membershipId?: string
  userId?: string
  tenantId: string
  role: string
  roleId?: string
  locations: LocationRef[]
  allLocations: boolean
  mode: AssignmentMode
  status: AssignmentStatus
  validFrom: string | null
  validUntil: string | null
  grantedBy: string
  grantedAt: string
  revokedBy: string | null
  revokedAt: string | null
}

export interface CreateAssignmentPayload {
  membership_id?: string
  user_id?: string
  role_id: string
  location_ids: string[]
  all_locations: boolean
  mode: AssignmentMode
  valid_from?: string | null
  valid_until?: string | null
}

export interface UpdateAssignmentPayload {
  location_ids?: string[]
  all_locations?: boolean
  mode?: AssignmentMode
  valid_from?: string | null
  valid_until?: string | null
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface StaffMembershipSummary {
  membershipId: string
  userId: string
  email: string
  firstName: string
  lastName: string
  status: string
  assignments: RbacAssignment[]
}

// ── Wave 4 — Permission overrides, effective permissions, audit ─────────────

export type PermissionOverrideEffect = 'allow' | 'deny'

export interface PermissionOverride {
  id: string
  tenantId: string
  membershipId?: string
  userId?: string
  permission: string
  permissionId?: string
  effect: PermissionOverrideEffect
  createdAt: string
  createdBy: string
}

export interface CreatePermissionOverridePayload {
  membership_id?: string
  user_id?: string
  permission_id: string
  effect: PermissionOverrideEffect
}

/** Membership-scoped create payload (membership id is in URL path). */
export interface MembershipPermissionOverridePayload {
  permission_id: string
  effect: PermissionOverrideEffect
}

export interface UpdatePermissionOverridePayload {
  effect?: PermissionOverrideEffect
  permission_id?: string
}

export interface EffectivePermissionOverrideEntry {
  permission: string
  effect: PermissionOverrideEffect
}

export interface EffectivePermissionsResponse {
  inherited: string[]
  overrides: EffectivePermissionOverrideEntry[]
  effective: string[]
}

export interface PermissionAuditEntry {
  id: string
  timestamp: string
  actorId: string
  actorName?: string
  action: string
  membershipId?: string
  permission?: string
  role?: string
  metadata?: Record<string, unknown>
}

export interface ListPermissionAuditParams {
  page?: number
  page_size?: number
  action?: string
  actor_id?: string
  membership_id?: string
  ordering?: string
}

export interface RolePermissionsResponse {
  roleId: string
  permissionIds: string[]
  permissions: string[]
}

export interface ReplaceRolePermissionsPayload {
  permission_ids: string[]
}
