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

/**
 * Role assignment scoped to a specific branch within a tenant.
 * Effective permissions in a branch context = union of tenant roles + branch roles.
 */
export interface BranchRoleAssignment {
  tenantId: string
  branchId: string
  roles: Role[]
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
