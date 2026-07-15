/**
 * P7.1 — Permission Service
 *
 * Single source of truth for all RBAC authorization.
 * Never import this from React components — use the hooks in hooks/index.ts instead.
 *
 * Authorization formula:  Permission AND Capability AND FeatureFlag
 *
 * Extension path (P7.2+): swap ROLE_PERMISSION_MAP values for server-fetched
 * sets without changing any call site.
 */
import type {
  Role,
  P7Permission,
  PermissionCheckOptions,
  AuditEvent,
  MockRbacUser,
  UserTenantRole,
  UserPermissionOverride,
  EffectivePermissionResult,
  RoleTemplate,
} from '@/types/rbac'

// ── All permissions (canonical list) ──────────────────────────────────────────

export const ALL_PERMISSIONS: readonly P7Permission[] = [
  // Orders
  'orders.view',
  'orders.manage',
  'orders.create',
  'orders.edit',
  'orders.cancel',
  'orders.delete',
  // Menu
  'menu.view',
  'menu.manage',
  // Categories (sub-resource of Menu)
  'category.view',
  'category.create',
  'category.update',
  'category.delete',
  // Extras (sub-resource of Menu)
  'extras.view',
  'extras.create',
  'extras.update',
  'extras.delete',
  // Reservations
  'reservations.view',
  'reservations.manage',
  // Customers
  'customers.view',
  'customers.manage',
  'customers.create',
  'customers.edit',
  // Payments
  'payments.process',
  'payments.refund',
  // Tables
  'tables.view',
  'tables.assign',
  // Kitchen
  'kitchen.view',
  'kitchen.manage',
  // Vendors
  'vendors.view',
  'vendors.manage',
  // Promotions
  'promotions.view',
  'promotions.manage',
  // Loyalty
  'loyalty.view',
  'loyalty.manage',
  // Analytics
  'analytics.view',
  'analytics.export',
  // Staff
  'staff.view',
  'staff.manage',
  'staff.create',
  'staff.edit',
  'staff.delete',
  // Branches
  'branches.view',
  'branches.manage',
  // Settings
  'settings.view',
  'settings.manage',
  'featureflags.manage',
  // Tenant
  'tenant.view',
  'tenant.manage',
  // Audit
  'audit.view',
  'audit.export',
  'audit.manage',
  // Notifications
  'notifications.view',
  'notifications.manage',
  'notifications.preferences',
  // Operations
  'operations.view',
  'operations.manage',
]

// ── Role → Permission matrix (single source of truth) ────────────────────────

export const ROLE_PERMISSION_MAP: Readonly<Record<Role, readonly P7Permission[]>> = {
  /** Full access — every permission including tenant ownership actions. */
  // owner: ALL_PERMISSIONS.filter((p) => p !== 'customers.manage','customers.create'),
  /**owner: ALL_PERMISSIONS,*/

  /**
   * P10.2.2 — everything except tenant ownership actions (`tenant.manage`,
   * `tenant.view`). Per docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md §4.2/§4.3
   * (closing P10.0 finding J1): tenant-level ownership actions are
   * Owner-exclusive, never delegable to any Staff role including `admin`.
   * `admin` previously received these implicitly via `ALL_PERMISSIONS`
   * with no structural way to say "only the actual owner can do this" —
   * this was the exact bug the architecture rewrite exists to fix. An
   * Owner still receives every permission, including both of these, via
   * the ownership short-circuit in
   * src/services/ownership-resolution.service.ts, not via this map.
   */
  admin: ALL_PERMISSIONS.filter((p) => p !== 'tenant.manage' && p !== 'tenant.view'),

  /** Full access — every permission including tenant ownership actions. */
  owner: [
    // Orders
    'orders.view',
    'orders.manage',
    'orders.create',
    'orders.edit',
    'orders.cancel',
    // 'orders.delete',
    // Menu
    'menu.view',
    'menu.manage',
    // Categories
    'category.view',
    'category.create',
    'category.update',
    'category.delete',
    // Extras
    'extras.view',
    'extras.create',
    'extras.update',
    'extras.delete',
    // Reservations
    'reservations.view',
    'reservations.manage',
    // Customers
    'customers.view',
    // 'customers.manage',
    // Payments
    'payments.process',
    'payments.refund',
    // Tables
    'tables.view',
    'tables.assign',
    // Kitchen
    'kitchen.view',
    'kitchen.manage',
    // Vendors
    'vendors.view',
    'vendors.manage',
    // Promotions
    'promotions.view',
    'promotions.manage',
    // Loyalty
    'loyalty.view',
    'loyalty.manage',
    // Analytics
    'analytics.view',
    // 'analytics.export',
    // Staff
    'staff.view',
    'staff.manage',
    'staff.create',
    'staff.edit',
    'staff.delete',
    // Branches
    'branches.view',
    'branches.manage',
    // Settings
    'settings.view',
    // 'settings.manage',
    // 'featureflags.manage',
    // Tenant
    'tenant.view',
    'tenant.manage',
    // Audit
    'audit.view',
    // 'audit.export',
    // 'audit.manage',
    // Notifications
    'notifications.view',
    // 'notifications.manage',
    // 'notifications.preferences',
    // Operations
    'operations.view',
    // 'operations.manage',
  ],


  /** Operational management — runs the floor, staff, schedules, branches. */
  manager: [
    'orders.view',
    'orders.manage',
    'orders.create',
    'orders.edit',
    'orders.cancel',
    'menu.view',
    'menu.manage',
    'category.view',
    'category.create',
    'category.update',
    'category.delete',
    'extras.view',
    'extras.create',
    'extras.update',
    'extras.delete',
    'reservations.view',
    'reservations.manage',
    'customers.view',
    'customers.manage',
    'customers.create',
    'customers.edit',
    'payments.process',
    'tables.view',
    'tables.assign',
    'staff.view',
    'staff.manage',
    'staff.create',
    'staff.edit',
    'staff.delete',
    'branches.view',
    'notifications.view',
    'operations.view',
  ],

  /** Orders, payments, and POS operations. */
  cashier: [
    'orders.view',
    'orders.manage',
    'orders.create',
    'orders.cancel',
    'customers.view',
    'payments.process',
    'payments.refund',
    'tables.view',
    'tables.assign',
    'notifications.view',
    'operations.view',
  ],

  /** Tables, orders, and reservations. */
  waiter: [
    'orders.view',
    'orders.manage',
    'orders.create',
    'orders.edit',
    'menu.view',
    'category.view',
    'extras.view',
    'reservations.view',
    'reservations.manage',
    'customers.view',
    'payments.process',
    'tables.view',
    'tables.assign',
    'notifications.view',
    'notifications.preferences',
    'operations.view',
  ],

  /** Kitchen display + order status updates + queue management. */
  kitchen: [
    'orders.view',
    'kitchen.view',
    'kitchen.manage',
    'operations.view',
    'notifications.view',
  ],

  /** Promotions, loyalty, analytics, and campaign management. */
  marketing: [
    'analytics.view',
    'analytics.export',
    'customers.view',
    'promotions.view',
    'promotions.manage',
    'loyalty.view',
    'loyalty.manage',
    'notifications.view',
  ],

  /** Read-only customer assistance — no mutations, no financials. */
  support: [
    'customers.view',
    'reservations.view',
    'branches.view',
    'notifications.view',
  ],
}

// ── Capability gate map ───────────────────────────────────────────────────────
// Maps permission resource prefix → feature flag key used to gate capability.
// If the flag resolves to false, the permission is denied regardless of role.

const PERMISSION_RESOURCE_FLAG: Partial<Record<string, string>> = {
  orders: 'ordering.enabled',
  menu: 'menu.enabled',
  // Categories are a sub-resource of Menu — gated by the same capability flag.
  category: 'menu.enabled',
  // Extras are a sub-resource of Menu — gated by the same capability flag.
  extras: 'menu.enabled',
  reservations: 'reservations.enabled',
  loyalty: 'loyalty.enabled',
  promotions: 'promotions.enabled',
  vendors: 'food_court.vendor_management.enabled',
  reviews: 'reviews.enabled',
  // analytics, staff, branches, settings, tenant, audit → no capability gate
}

// ── Audit hook (P7.6 readiness) ───────────────────────────────────────────────

type AuditListener = (event: AuditEvent) => void
let _auditListeners: AuditListener[] = []
const _auditLog: AuditEvent[] = []

export const auditHooks = {
  /** Subscribe to every permission check event. Returns an unsubscribe function. */
  subscribe(fn: AuditListener): () => void {
    _auditListeners.push(fn)
    return () => {
      _auditListeners = _auditListeners.filter((l) => l !== fn)
    }
  },
  /** Retrieve a copy of all emitted audit events. */
  getLog(): AuditEvent[] {
    return [..._auditLog]
  },
  /** Test helper — clears listeners and log. */
  _reset(): void {
    _auditListeners = []
    _auditLog.length = 0
  },
}

function _emit(event: AuditEvent): void {
  _auditLog.push(event)
  _auditListeners.forEach((fn) => fn(event))
}

// ── Core permission functions ─────────────────────────────────────────────────

/**
 * Returns the deduplicated union of permissions for one or more roles.
 * Null / undefined → empty array (safe default deny).
 */
export function getPermissionsForRole(
  role: Role | Role[] | null | undefined,
): readonly P7Permission[] {
  if (!role) return []
  const roles = Array.isArray(role) ? role : [role]
  const set = new Set<P7Permission>()
  roles.forEach((r) => {
    ; (ROLE_PERMISSION_MAP[r] ?? []).forEach((p) => set.add(p))
  })
  return [...set]
}

/**
 * Checks whether the given role(s) grant a specific permission.
 *
 * Authorization formula: Permission AND Capability AND FeatureFlag
 * - Permission: role must be in ROLE_PERMISSION_MAP for this permission
 * - Capability: if opts.capabilities provided, resource capability must not be false
 * - FeatureFlag: if opts.featureFlags provided, resource flag must not be false
 */
export function hasPermission(
  roles: Role | Role[] | null | undefined,
  permission: P7Permission,
  opts?: PermissionCheckOptions,
): boolean {
  if (!roles) return false

  // 1. Permission gate
  const granted = getPermissionsForRole(roles).includes(permission)
  if (!granted) return false

  const resource = permission.split('.')[0]!

  // 2. Capability gate
  if (opts?.capabilities) {
    const capKey = resource
    const explicit = opts.capabilities[capKey]
    if (explicit === false) return false
  }

  // 3. Feature flag gate
  if (opts?.featureFlags) {
    const flagKey = PERMISSION_RESOURCE_FLAG[resource]
    if (flagKey !== undefined) {
      const flagVal = opts.featureFlags[flagKey]
      if (flagVal === false) return false
    }
  }

  return true
}

/**
 * Returns true if the role(s) have AT LEAST ONE of the given permissions.
 * Empty permissions array → false.
 */
export function hasAnyPermission(
  roles: Role | Role[] | null | undefined,
  permissions: P7Permission[],
  opts?: PermissionCheckOptions,
): boolean {
  if (permissions.length === 0) return false
  return permissions.some((p) => hasPermission(roles, p, opts))
}

/**
 * Returns true if the role(s) have ALL of the given permissions.
 * Empty permissions array → false.
 */
export function hasAllPermissions(
  roles: Role | Role[] | null | undefined,
  permissions: P7Permission[],
  opts?: PermissionCheckOptions,
): boolean {
  if (permissions.length === 0) return false
  return permissions.every((p) => hasPermission(roles, p, opts))
}

/**
 * Audit-aware wrapper around hasPermission.
 * Emits an AuditEvent regardless of outcome — use for permission-sensitive mutations.
 */
export function checkPermission(
  roles: Role | Role[] | null | undefined,
  permission: P7Permission,
  opts?: PermissionCheckOptions & { userId?: string; tenantId?: string },
): boolean {
  const granted = hasPermission(roles, permission, opts)
  _emit({
    permission,
    granted,
    roles: roles ? (Array.isArray(roles) ? [...roles] : [roles]) : [],
    tenantId: opts?.tenantId,
    userId: opts?.userId,
    timestamp: new Date().toISOString(),
  })
  return granted
}

// ── Mock infrastructure ───────────────────────────────────────────────────────

export const MOCK_TENANT_ID = 'tenant-savor-01'
export const MOCK_TENANT_B_ID = 'tenant-brew-cafe-01'

export const MOCK_RBAC_USERS: readonly MockRbacUser[] = [
  {
    id: 'user-owner-01',
    email: 'owner@savor.com',
    first_name: 'Olivia',
    last_name: 'Owner',
    tenantAssignments: [
      { userId: 'user-owner-01', tenantId: MOCK_TENANT_ID, roles: ['owner'] },
    ],
  },
  {
    id: 'user-admin-01',
    email: 'admin@savor.com',
    first_name: 'Alex',
    last_name: 'Admin',
    tenantAssignments: [
      { userId: 'user-admin-01', tenantId: MOCK_TENANT_ID, roles: ['admin'] },
    ],
  },
  {
    id: 'user-manager-01',
    email: 'manager@savor.com',
    first_name: 'Maria',
    last_name: 'Manager',
    tenantAssignments: [
      { userId: 'user-manager-01', tenantId: MOCK_TENANT_ID, roles: ['manager'] },
    ],
  },
  {
    id: 'user-cashier-01',
    email: 'cashier@savor.com',
    first_name: 'Casey',
    last_name: 'Cashier',
    tenantAssignments: [
      { userId: 'user-cashier-01', tenantId: MOCK_TENANT_ID, roles: ['cashier'] },
    ],
  },
  {
    id: 'user-waiter-01',
    email: 'waiter@savor.com',
    first_name: 'Will',
    last_name: 'Waiter',
    tenantAssignments: [
      { userId: 'user-waiter-01', tenantId: MOCK_TENANT_ID, roles: ['waiter'] },
    ],
  },
  {
    id: 'user-kitchen-01',
    email: 'kitchen@savor.com',
    first_name: 'Kai',
    last_name: 'Kitchen',
    tenantAssignments: [
      { userId: 'user-kitchen-01', tenantId: MOCK_TENANT_ID, roles: ['kitchen'] },
    ],
  },
  {
    id: 'user-marketing-01',
    email: 'marketing@savor.com',
    first_name: 'Morgan',
    last_name: 'Marketing',
    tenantAssignments: [
      { userId: 'user-marketing-01', tenantId: MOCK_TENANT_ID, roles: ['marketing'] },
    ],
  },
  {
    id: 'user-support-01',
    email: 'support@savor.com',
    first_name: 'Sam',
    last_name: 'Support',
    tenantAssignments: [
      { userId: 'user-support-01', tenantId: MOCK_TENANT_ID, roles: ['support'] },
    ],
  },
  {
    // Multi-tenant: manager on Tenant A, cashier on Tenant B
    id: 'user-multi-01',
    email: 'multi@savor.com',
    first_name: 'Max',
    last_name: 'Multi',
    tenantAssignments: [
      { userId: 'user-multi-01', tenantId: MOCK_TENANT_ID, roles: ['manager'] },
      { userId: 'user-multi-01', tenantId: MOCK_TENANT_B_ID, roles: ['cashier'] },
    ],
  },
]

/** Find a mock user's roles for a given tenant. */
export function getMockRoles(userId: string, tenantId: string): Role[] {
  const user = MOCK_RBAC_USERS.find((u) => u.id === userId)
  return user?.tenantAssignments.find((a) => a.tenantId === tenantId)?.roles ?? []
}

// ── P8.5 — Override-aware permission helpers ──────────────────────────────────

/**
 * Applies user-level allow/deny overrides on top of role-derived permissions.
 * Evaluation order: User Deny → User Allow → Role Permissions → Default Deny.
 */
export function applyOverrides(
  rolePermissions: readonly P7Permission[],
  override?: Pick<UserPermissionOverride, 'allow' | 'deny'>,
): P7Permission[] {
  if (!override) return [...rolePermissions]
  const merged = new Set<P7Permission>([...rolePermissions, ...override.allow])
  override.deny.forEach((p) => merged.delete(p))
  return [...merged]
}

/**
 * Returns a detailed breakdown of each permission for admin display.
 * Shows whether each permission is from a role, from an override, or denied.
 */
export function resolveEffectivePermissions(
  roles: Role[],
  override?: Pick<UserPermissionOverride, 'allow' | 'deny'>,
): EffectivePermissionResult[] {
  const rolePerms = new Set(getPermissionsForRole(roles))
  const allowSet = new Set(override?.allow ?? [])
  const denySet = new Set(override?.deny ?? [])

  return ALL_PERMISSIONS.map((permission): EffectivePermissionResult => {
    const fromRole = rolePerms.has(permission)
    const fromOverride = allowSet.has(permission)
    const denied = denySet.has(permission)
    const effective = (fromRole || fromOverride) && !denied
    return { permission, fromRole, fromOverride, denied, effective }
  })
}

// ── P8.5 — Role Templates ────────────────────────────────────────────────────

export const ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    role: 'owner',
    label: 'Owner',
    description: 'Full platform access including tenant ownership and billing operations.',
    system: true,
    permissions: ROLE_PERMISSION_MAP.owner,
  },
  {
    role: 'admin',
    label: 'Admin',
    description: 'Full operational administration. Cannot perform tenant ownership actions.',
    system: true,
    permissions: ROLE_PERMISSION_MAP.admin,
  },
  {
    role: 'manager',
    label: 'Manager',
    description: 'Restaurant management — floor, staff, schedules, menus, and orders.',
    system: true,
    permissions: ROLE_PERMISSION_MAP.manager,
  },
  {
    role: 'cashier',
    label: 'Cashier',
    description: 'Orders, payments, and POS. No kitchen, analytics, or settings access.',
    system: true,
    permissions: ROLE_PERMISSION_MAP.cashier,
  },
  {
    role: 'waiter',
    label: 'Waiter',
    description: 'Tables, orders, and reservations. No settings, analytics, or kitchen.',
    system: true,
    permissions: ROLE_PERMISSION_MAP.waiter,
  },
  {
    role: 'kitchen',
    label: 'Kitchen',
    description: 'Kitchen display, order queue, and preparation status only.',
    system: true,
    permissions: ROLE_PERMISSION_MAP.kitchen,
  },
  {
    role: 'marketing',
    label: 'Marketing',
    description: 'Promotions, loyalty, campaigns, and analytics. No payments or settings.',
    system: true,
    permissions: ROLE_PERMISSION_MAP.marketing,
  },
  {
    role: 'support',
    label: 'Support',
    description: 'Read-only customer assistance — customers, reservations, and notifications.',
    system: true,
    permissions: ROLE_PERMISSION_MAP.support,
  },
]

// ── P8.5 — Permission categories for UI grouping ──────────────────────────────

export const PERMISSION_CATEGORIES: Record<string, { label: string; permissions: P7Permission[] }> = {
  orders: {
    label: 'Orders',
    permissions: ['orders.view', 'orders.manage', 'orders.create', 'orders.edit', 'orders.cancel', 'orders.delete'],
  },
  payments: {
    label: 'Payments',
    permissions: ['payments.process', 'payments.refund'],
  },
  tables: {
    label: 'Tables',
    permissions: ['tables.view', 'tables.assign'],
  },
  kitchen: {
    label: 'Kitchen',
    permissions: ['kitchen.view', 'kitchen.manage'],
  },
  menu: {
    label: 'Menu',
    permissions: ['menu.view', 'menu.manage'],
  },
  customers: {
    label: 'Customers',
    permissions: ['customers.view', 'customers.manage', 'customers.create', 'customers.edit'],
  },
  reservations: {
    label: 'Reservations',
    permissions: ['reservations.view', 'reservations.manage'],
  },
  staff: {
    label: 'Staff',
    permissions: ['staff.view', 'staff.manage', 'staff.create', 'staff.edit', 'staff.delete'],
  },
  branches: {
    label: 'Branches',
    permissions: ['branches.view', 'branches.manage'],
  },
  analytics: {
    label: 'Analytics',
    permissions: ['analytics.view', 'analytics.export'],
  },
  promotions: {
    label: 'Promotions',
    permissions: ['promotions.view', 'promotions.manage'],
  },
  loyalty: {
    label: 'Loyalty',
    permissions: ['loyalty.view', 'loyalty.manage'],
  },
  vendors: {
    label: 'Vendors',
    permissions: ['vendors.view', 'vendors.manage'],
  },
  notifications: {
    label: 'Notifications',
    permissions: ['notifications.view', 'notifications.manage', 'notifications.preferences'],
  },
  operations: {
    label: 'Operations',
    permissions: ['operations.view', 'operations.manage'],
  },
  settings: {
    label: 'Settings',
    permissions: ['settings.view', 'settings.manage', 'featureflags.manage'],
  },
  tenant: {
    label: 'Tenant',
    permissions: ['tenant.view', 'tenant.manage'],
  },
  audit: {
    label: 'Audit',
    permissions: ['audit.view', 'audit.export', 'audit.manage'],
  },
}

// ── P8.6 — Permission Dependency Engine ──────────────────────────────────────

import type { PermissionDependency, DependencyValidationResult } from '@/types/rbac'

/**
 * Dependency rules for the permission system.
 * When an admin grants/denies a permission, the engine checks these rules
 * and returns warnings, implied grants, and missing requirements.
 */
export const PERMISSION_DEPENDENCIES: Readonly<Partial<Record<P7Permission, PermissionDependency>>> = {
  'orders.manage': { permission: 'orders.manage', requires: ['orders.view'] },
  'orders.create': { permission: 'orders.create', requires: ['orders.view'] },
  'orders.edit': { permission: 'orders.edit', requires: ['orders.view'] },
  'orders.cancel': { permission: 'orders.cancel', requires: ['orders.view'] },
  'orders.delete': { permission: 'orders.delete', requires: ['orders.view', 'orders.manage'] },
  'menu.manage': { permission: 'menu.manage', requires: ['menu.view'] },
  'category.create': { permission: 'category.create', requires: ['category.view'] },
  'category.update': { permission: 'category.update', requires: ['category.view'] },
  'category.delete': { permission: 'category.delete', requires: ['category.view', 'category.update'] },
  'extras.create': { permission: 'extras.create', requires: ['extras.view'] },
  'extras.update': { permission: 'extras.update', requires: ['extras.view'] },
  'extras.delete': { permission: 'extras.delete', requires: ['extras.view', 'extras.update'] },
  'reservations.manage': { permission: 'reservations.manage', requires: ['reservations.view'] },
  'customers.manage': { permission: 'customers.manage', requires: ['customers.view'] },
  'customers.create': { permission: 'customers.create', requires: ['customers.view'] },
  'customers.edit': { permission: 'customers.edit', requires: ['customers.view'] },
  'payments.refund': { permission: 'payments.refund', requires: ['payments.process'] },
  'kitchen.manage': { permission: 'kitchen.manage', requires: ['kitchen.view'] },
  'analytics.export': { permission: 'analytics.export', requires: ['analytics.view'] },
  'staff.manage': { permission: 'staff.manage', requires: ['staff.view'], implies: ['staff.view'] },
  'staff.create': { permission: 'staff.create', requires: ['staff.view', 'staff.manage'] },
  'staff.edit': { permission: 'staff.edit', requires: ['staff.view', 'staff.manage'] },
  'staff.delete': { permission: 'staff.delete', requires: ['staff.view', 'staff.manage'] },
  'branches.manage': { permission: 'branches.manage', requires: ['branches.view'] },
  'settings.manage': { permission: 'settings.manage', requires: ['settings.view'] },
  'featureflags.manage': { permission: 'featureflags.manage', requires: ['settings.view', 'settings.manage'] },
  'tenant.manage': { permission: 'tenant.manage', requires: ['tenant.view'] },
  'audit.export': { permission: 'audit.export', requires: ['audit.view'] },
  'audit.manage': { permission: 'audit.manage', requires: ['audit.view'] },
  'notifications.manage': { permission: 'notifications.manage', requires: ['notifications.view'] },
  'operations.manage': { permission: 'operations.manage', requires: ['operations.view'] },
  'vendors.manage': { permission: 'vendors.manage', requires: ['vendors.view'] },
  'promotions.manage': { permission: 'promotions.manage', requires: ['promotions.view'] },
  'loyalty.manage': { permission: 'loyalty.manage', requires: ['loyalty.view'] },
  'tables.assign': { permission: 'tables.assign', requires: ['tables.view'] },
}

/**
 * Validates granting a permission against the dependency rules.
 * Returns missing requirements, implied grants, and conflicts.
 */
export function validatePermissionGrant(
  permission: P7Permission,
  currentEffective: readonly P7Permission[],
): DependencyValidationResult {
  const dep = PERMISSION_DEPENDENCIES[permission]
  if (!dep) {
    return { permission, missingRequirements: [], impliedGrants: [], conflicts: [], hasIssues: false }
  }
  const missingRequirements = (dep.requires ?? []).filter((r) => !currentEffective.includes(r))
  const impliedGrants = dep.implies ?? []
  const conflicts = (dep.conflicts ?? []).filter((c) => currentEffective.includes(c))
  return {
    permission,
    missingRequirements,
    impliedGrants,
    conflicts,
    hasIssues: missingRequirements.length > 0 || conflicts.length > 0,
  }
}

/**
 * Auto-resolves permission dependencies: when granting P, also grants all implied permissions
 * and all required permissions that are missing from the current set.
 */
export function resolveWithDependencies(
  toGrant: P7Permission,
  currentEffective: readonly P7Permission[],
): P7Permission[] {
  const toAdd = new Set<P7Permission>([toGrant])
  const dep = PERMISSION_DEPENDENCIES[toGrant]
  if (dep) {
    ; (dep.requires ?? []).forEach((r) => toAdd.add(r))
      ; (dep.implies ?? []).forEach((i) => toAdd.add(i))
  }
  return [...toAdd].filter((p) => !currentEffective.includes(p))
}

// ── Public service object ─────────────────────────────────────────────────────

export const permissionService = {
  ROLE_PERMISSION_MAP,
  ALL_PERMISSIONS,
  ROLE_TEMPLATES,
  PERMISSION_CATEGORIES,
  getPermissionsForRole,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  checkPermission,
  applyOverrides,
  resolveEffectivePermissions,
  getMockRoles,
  auditHooks,
  MOCK_RBAC_USERS,
  MOCK_TENANT_ID,
  MOCK_TENANT_B_ID,
  PERMISSION_DEPENDENCIES,
  validatePermissionGrant,
  resolveWithDependencies,
}
