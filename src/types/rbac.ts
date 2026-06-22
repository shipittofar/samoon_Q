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
 */
export type P7Permission =
  | 'orders.view'
  | 'orders.manage'
  | 'menu.view'
  | 'menu.manage'
  | 'reservations.view'
  | 'reservations.manage'
  | 'customers.view'
  | 'customers.manage'
  | 'vendors.view'
  | 'vendors.manage'
  | 'promotions.view'
  | 'promotions.manage'
  | 'loyalty.view'
  | 'loyalty.manage'
  | 'analytics.view'
  | 'staff.view'
  | 'staff.manage'
  | 'branches.view'
  | 'branches.manage'
  | 'settings.view'
  | 'settings.manage'
  | 'tenant.view'
  | 'tenant.manage'
  | 'audit.view'
  | 'audit.export'
  | 'audit.manage'
  | 'notifications.view'
  | 'notifications.manage'
  | 'notifications.preferences'

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
