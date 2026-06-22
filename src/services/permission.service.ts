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
} from '@/types/rbac'

// ── All permissions (canonical list) ──────────────────────────────────────────

export const ALL_PERMISSIONS: readonly P7Permission[] = [
  'orders.view',
  'orders.manage',
  'menu.view',
  'menu.manage',
  'reservations.view',
  'reservations.manage',
  'customers.view',
  'customers.manage',
  'vendors.view',
  'vendors.manage',
  'promotions.view',
  'promotions.manage',
  'loyalty.view',
  'loyalty.manage',
  'analytics.view',
  'staff.view',
  'staff.manage',
  'branches.view',
  'branches.manage',
  'settings.view',
  'settings.manage',
  'tenant.view',
  'tenant.manage',
  'audit.view',
  'audit.export',
  'audit.manage',
  'notifications.view',
  'notifications.manage',
  'notifications.preferences',
]

// ── Role → Permission matrix (single source of truth) ────────────────────────

export const ROLE_PERMISSION_MAP: Readonly<Record<Role, readonly P7Permission[]>> = {
  /** Full access — every permission including tenant ownership actions. */
  owner: ALL_PERMISSIONS,

  /** Everything except tenant ownership (tenant.manage). */
  admin: ALL_PERMISSIONS.filter((p) => p !== 'tenant.manage'),

  /** Operational management — runs the floor, staff, promotions, analytics. */
  manager: [
    'orders.view',
    'orders.manage',
    'menu.view',
    'menu.manage',
    'reservations.view',
    'reservations.manage',
    'customers.view',
    'customers.manage',
    'vendors.view',
    'vendors.manage',
    'promotions.view',
    'promotions.manage',
    'loyalty.view',
    'loyalty.manage',
    'analytics.view',
    'staff.view',
    'staff.manage',
    'branches.view',
    'settings.view',
    'audit.view',
    'notifications.view',
    'notifications.preferences',
  ],

  /** Orders and payments only. */
  cashier: [
    'orders.view',
    'orders.manage',
    'menu.view',
    'customers.view',
    'reservations.view',
    'notifications.view',
    'notifications.preferences',
  ],

  /** Tables and orders. */
  waiter: [
    'orders.view',
    'orders.manage',
    'menu.view',
    'reservations.view',
    'reservations.manage',
    'customers.view',
    'notifications.view',
    'notifications.preferences',
  ],

  /** Kitchen display + order status updates only. */
  kitchen: ['orders.view', 'orders.manage', 'menu.view', 'notifications.view', 'notifications.preferences'],

  /** Promotions, loyalty, analytics. */
  marketing: [
    'menu.view',
    'customers.view',
    'promotions.view',
    'promotions.manage',
    'loyalty.view',
    'loyalty.manage',
    'analytics.view',
    'notifications.view',
    'notifications.preferences',
  ],

  /** Read-only operational access. */
  support: [
    'orders.view',
    'menu.view',
    'reservations.view',
    'customers.view',
    'vendors.view',
    'analytics.view',
    'branches.view',
    'settings.view',
    'audit.view',
    'notifications.view',
    'notifications.preferences',
  ],
}

// ── Capability gate map ───────────────────────────────────────────────────────
// Maps permission resource prefix → feature flag key used to gate capability.
// If the flag resolves to false, the permission is denied regardless of role.

const PERMISSION_RESOURCE_FLAG: Partial<Record<string, string>> = {
  orders: 'ordering.enabled',
  menu: 'menu.enabled',
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
    ;(ROLE_PERMISSION_MAP[r] ?? []).forEach((p) => set.add(p))
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

// ── Public service object ─────────────────────────────────────────────────────

export const permissionService = {
  ROLE_PERMISSION_MAP,
  ALL_PERMISSIONS,
  getPermissionsForRole,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  checkPermission,
  getMockRoles,
  auditHooks,
  MOCK_RBAC_USERS,
  MOCK_TENANT_ID,
  MOCK_TENANT_B_ID,
}
