// ============================================================
// P7.1 — Enterprise RBAC Types
// ============================================================

/**
 * Enterprise role set for the P7.1 RBAC system.
 * Role assignments are always tenant-scoped — no global role assumptions.
 */
export type Role =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'cashier'
  | 'waiter'
  | 'kitchen'
  | 'marketing'
  | 'support'

/**
 * P7 permissions — dot-notation format.
 * Authorization formula: Permission AND Capability AND FeatureFlag.
 * Never check roles directly — always go through permission.service.ts.
 *
 * P8.5: Extended with granular action permissions.
 * Each action is independently grantable per user via overrides.
 */
export type P7Permission =
  // ── Orders ────────────────────────────────────────────────
  | 'orders.view'
  | 'orders.manage'
  | 'orders.create'
  | 'orders.edit'
  | 'orders.cancel'
  | 'orders.delete'
  // ── Menu ──────────────────────────────────────────────────
  | 'menu.view'
  | 'menu.manage'
  // ── Categories (sub-resource of Menu) ─────────────────────
  | 'category.view'
  | 'category.create'
  | 'category.update'
  | 'category.delete'
  // ── Extras (sub-resource of Menu) ─────────────────────────
  | 'extras.view'
  | 'extras.create'
  | 'extras.update'
  | 'extras.delete'
  // ── Reservations ──────────────────────────────────────────
  | 'reservations.view'
  | 'reservations.manage'
  // ── Customers ─────────────────────────────────────────────
  | 'customers.view'
  | 'customers.manage'
  | 'customers.create'
  | 'customers.edit'
  // ── Payments ──────────────────────────────────────────────
  | 'payments.process'
  | 'payments.refund'
  // ── Tables ────────────────────────────────────────────────
  | 'tables.view'
  | 'tables.assign'
  // ── Kitchen ───────────────────────────────────────────────
  | 'kitchen.view'
  | 'kitchen.manage'
  // ── Vendors ───────────────────────────────────────────────
  | 'vendors.view'
  | 'vendors.manage'
  // ── Promotions ────────────────────────────────────────────
  | 'promotions.view'
  | 'promotions.manage'
  // ── Loyalty ───────────────────────────────────────────────
  | 'loyalty.view'
  | 'loyalty.manage'
  // ── Analytics ─────────────────────────────────────────────
  | 'analytics.view'
  | 'analytics.export'
  // ── Staff ─────────────────────────────────────────────────
  | 'staff.view'
  | 'staff.manage'
  | 'staff.create'
  | 'staff.edit'
  | 'staff.delete'
  // ── Branches ──────────────────────────────────────────────
  | 'branches.view'
  | 'branches.manage'
  | 'branches.create'
  | 'branches.update'
  | 'branches.delete'
  // ── Settings ──────────────────────────────────────────────
  | 'settings.view'
  | 'settings.manage'
  | 'featureflags.manage'
  // ── Tenant ────────────────────────────────────────────────
  | 'tenant.view'
  | 'tenant.manage'
  // ── Audit ─────────────────────────────────────────────────
  | 'audit.view'
  | 'audit.export'
  | 'audit.manage'
  // ── Notifications ─────────────────────────────────────────
  | 'notifications.view'
  | 'notifications.manage'
  | 'notifications.preferences'
  // ── Operations ────────────────────────────────────────────
  | 'operations.view'
  | 'operations.manage'
  // ── Reviews (P8.8.5) ──────────────────────────────────────
  | 'reviews.view'
  | 'reviews.manage'
  // ── Console access (legacy compat) ────────────────────────
  | 'dashboard:access'

/** Alias for P7Permission — used at call sites that don't need the P7-specific name. */
export type Permission = P7Permission

/** A user's role assignment scoped to a specific tenant. */
export interface UserTenantRole {
  userId: string
  tenantId: string
  roles: Role[]
}

/** Active session role assignments per tenant. */
export interface TenantRoleAssignment {
  tenantId: string
  roles: Role[]
}

/**
 * Phase 9 — describes WHERE (which branches) a tenant-scoped session may
 * operate, as distinct from Permission (WHAT it may do) and Role (the
 * grant that produced the permission set). Deliberately a separate field
 * from Permission/P7Permission — see docs/ Phase 9 architecture doc
 * ("Permission answers can, BranchAccess answers where") — never folded
 * into the permission string itself.
 *
 * 'all' = every current and future branch of the tenant (owner/admin).
 * 'assigned' = exactly the listed branch ids — an empty `branchIds` array
 * is a valid, meaningful value: "assigned scope, but assigned to nothing
 * (yet)," which must deny every branch-scoped read, not be mistaken for
 * 'all'.
 */
export type BranchAccess =
  | { scope: 'all' }
  | { scope: 'assigned'; branchIds: string[] }

/**
 * Phase 9 — one tenant a user belongs to, carrying the roles and branch
 * scope granted within THAT tenant specifically. This is the shape a
 * future backend contract is expected to send instead of the flat,
 * tenant-less `tenantRoles: Role[]` field the current contract uses (see
 * docs/P10.10_AUTH_BACKEND_API_CONTRACT.md) — replacing an array of bare
 * role strings with an array of these lets one auth response describe
 * memberships across multiple tenants unambiguously.
 *
 * NOT YET sent by the mock layer or any real backend as of Phase 9.2 —
 * `normalizeTenantPermissions()` (permission.service.ts) accepts this
 * shape in addition to the legacy one purely so the frontend type system
 * and normalization logic are ready the moment a backend starts sending
 * it, with no breaking change to what already works today.
 *
 * `tenantSlug`/`tenantName`/`status` are optional because nothing
 * populates them yet (no caller constructs a real `TenantMembership`
 * today) — they exist so the shape matches the target wire contract in
 * full, without forcing every current call site to fabricate values for
 * fields it doesn't have.
 */
export interface TenantMembership {
  tenantId: string
  tenantSlug?: string
  tenantName?: string
  roles: Role[]
  branchAccess: BranchAccess
  status?: 'active' | 'suspended' | 'revoked'
}

/**
 * Phase 2 (RBAC unification) — the single, active-tenant-scoped permission
 * record every permission check reads from (`useRbacStore.currentTenantSession`).
 * Deliberately holds ONLY the active tenant's roles/permissions — no
 * cross-tenant cache, no ownership data, no staff-assignment data. Never
 * persisted; reconstructed after login, refresh, and every tenant switch
 * (see normalizeTenantPermissions() in permission.service.ts).
 *
 * Phase 9 — extended with `branchAccess`. Every session ALWAYS carries a
 * real (never undefined) `branchAccess` value: `setCurrentTenantSession()`
 * computes a safe default (`{ scope: 'assigned', branchIds: [] }`, or
 * `{ scope: 'all' }` for an `owner` role) whenever a caller doesn't supply
 * one explicitly, so no session can silently end up with an ambiguous or
 * over-permissive branch scope. Nothing reads this field for an actual
 * access decision yet (Phase 9.2 is data-model preparation only) — see
 * the Phase 9 architecture doc for the consuming design (Phase 9.4).
 */
export interface CurrentTenantSession {
  tenantId: string
  roles: Role[]
  permissions: Permission[]
  branchAccess: BranchAccess
}

/** Options for capability/featureFlag-aware permission checks. */
export interface PermissionCheckOptions {
  /** Resolved feature flags — checked against permission's resource gate. */
  featureFlags?: Record<string, boolean>
  /** Resolved capabilities — if resource capability is false, deny. */
  capabilities?: Record<string, boolean>
}

/**
 * Audit event emitted on every permission-sensitive action.
 * Attach a listener via permissionService.auditHooks.subscribe() for P7.6 audit log integration.
 */
export interface AuditEvent {
  permission: P7Permission
  granted: boolean
  roles: Role[]
  tenantId?: string
  userId?: string
  timestamp: string
}

/** Mock user fixture for testing RBAC without a backend. */
export interface MockRbacUser {
  id: string
  email: string
  first_name: string
  last_name: string
  tenantAssignments: UserTenantRole[]
}

// ── P8.5 Enterprise Extensions ────────────────────────────────────────────────

/**
 * Per-user, per-tenant permission override.
 * Evaluation order: User Deny → User Allow → Role Permissions → Default Deny.
 */
export interface UserPermissionOverride {
  userId: string
  tenantId: string
  /** Permissions explicitly granted on top of role permissions. */
  allow: P7Permission[]
  /** Permissions explicitly denied even if granted by a role. */
  deny: P7Permission[]
}

/** Resolved effective permissions with source breakdown for the admin UI. */
export interface EffectivePermissionResult {
  permission: P7Permission
  /** True when the permission is part of the user's role grants. */
  fromRole: boolean
  /** True when the permission was explicitly granted as a user override. */
  fromOverride: boolean
  /** True when the permission was explicitly denied as a user override. */
  denied: boolean
  /** True when the permission is currently effective (not denied). */
  effective: boolean
}

/** Read-only metadata for a role as displayed in the role management UI. */
export interface RoleTemplate {
  role: Role
  label: string
  description: string
  /** Whether this role is a system role that cannot be deleted or renamed. */
  system: boolean
  permissions: readonly P7Permission[]
}

// ── P8.6 Enterprise Extensions ────────────────────────────────────────────────

/**
 * Custom role template created by a tenant admin.
 * Unlike system roles (RoleTemplate.system=true), these can be edited/deleted.
 */
export interface CustomRoleTemplate {
  id: string
  name: string
  description: string
  color: string
  icon?: string
  permissions: P7Permission[]
  tenantId: string
  createdBy: string
  created_at: string
  updated_at: string
  enabled: boolean
  clonedFrom?: Role
}

/**
 * Describes dependency relationships between permissions.
 * Used by the dependency engine to warn and auto-resolve when granting/denying.
 */
export interface PermissionDependency {
  permission: P7Permission
  /** Granting this permission also requires these to be effective */
  requires?: P7Permission[]
  /** Granting this permission automatically implies these (shown as info) */
  implies?: P7Permission[]
  /** Granting this permission conflicts with these (shown as warning) */
  conflicts?: P7Permission[]
}

/**
 * Audit event for every RBAC state change — role assignments, overrides, templates.
 * Stored in the store for in-session audit trail; backend-compatible shape.
 */
export interface RbacAuditEvent {
  id: string
  type:
    | 'role_assigned'
    | 'role_removed'
    | 'role_disabled'
    | 'role_enabled'
    | 'permission_granted'
    | 'permission_denied'
    | 'permission_reset'
    | 'override_cleared'
    | 'custom_role_created'
    | 'custom_role_edited'
    | 'custom_role_deleted'
    | 'branch_role_set'
    | 'branch_role_cleared'
  actorId: string
  targetUserId: string
  tenantId: string
  branchId?: string
  role?: Role | string
  permission?: P7Permission
  oldValue?: unknown
  newValue?: unknown
  reason?: string
  timestamp: string
}

/**
 * Result of simulating a user's permissions under a given role or custom config.
 * Used by the Permission Simulator (Phase 6) — no state changes, preview only.
 */
export interface SimulationResult {
  label: string
  roles: (Role | string)[]
  effectivePermissions: P7Permission[]
  deniedPermissions: P7Permission[]
  grantedByOverride: P7Permission[]
  permissionCount: number
}

/**
 * Dependency validation result returned by the permission dependency engine.
 */
export interface DependencyValidationResult {
  permission: P7Permission
  /** Permissions required but missing from the current effective set */
  missingRequirements: P7Permission[]
  /** Permissions that would be auto-implied when this is granted */
  impliedGrants: P7Permission[]
  /** Permissions that conflict with granting this */
  conflicts: P7Permission[]
  hasIssues: boolean
}
