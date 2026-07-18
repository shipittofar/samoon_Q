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
  BranchAccess,
  TenantMembership,
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
  'branches.create',
  'branches.update',
  'branches.delete',
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
  // Dashboard (console entry) — granted to every assignable role
  'dashboard:access',
]

// ── Role → Permission matrix (single source of truth) ────────────────────────

const BASE_ROLE_PERMISSION_MAP: Record<Role, readonly P7Permission[]> = {
  /**
   * P10.2.2 — everything except tenant ownership actions (`tenant.manage`,
   * `tenant.view`). Per docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md §4.2/§4.3
   * (closing P10.0 finding J1): tenant-level ownership actions are
   * Owner-exclusive, never delegable to any Staff role including `admin`.
   */
  admin: ALL_PERMISSIONS.filter((p) => p !== 'tenant.manage' && p !== 'tenant.view'),

  /**
   * Full access — every permission including tenant ownership actions.
   *
   * Phase 2 (RBAC unification) — previously `owner` held a hand-maintained
   * subset here and received the rest (customers.manage, orders.delete,
   * analytics.export, settings.manage, audit.export/manage,
   * notifications.manage/preferences, operations.manage, tenant.*) via a
   * parallel client-side "ownership short-circuit"
   * (src/services/ownership-resolution.service.ts, now removed). That
   * engine decided access from browser-held mock Owner/StaffAssignment
   * data — an authorization decision that must never be made client-side.
   * This role map is now the ONLY permission source; Owner's full access
   * is expressed directly here instead of being reconstructed by a second
   * system.
   */
  owner: ALL_PERMISSIONS,


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

/**
 * Every assignable role grants `dashboard:access` — holding any tenant-scoped
 * role is what makes the Console reachable at all. Previously this specific
 * permission was granted by the (now-removed) ownership/StaffAssignment
 * engine rather than this map; folding it in here makes ROLE_PERMISSION_MAP
 * the single, complete permission source (see BASE_ROLE_PERMISSION_MAP).
 */
export const ROLE_PERMISSION_MAP: Readonly<Record<Role, readonly P7Permission[]>> = Object.fromEntries(
  (Object.entries(BASE_ROLE_PERMISSION_MAP) as [Role, readonly P7Permission[]][]).map(([role, perms]) => [
    role,
    perms.includes('dashboard:access') ? perms : [...perms, 'dashboard:access'],
  ]),
) as Record<Role, readonly P7Permission[]>

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
 * Phase 9 — the single place that decides `branchAccess` when the caller
 * doesn't have (or doesn't trust) an explicit value from the backend.
 * Shared by `normalizeTenantPermissions()` below and
 * `useRbacStore.setCurrentTenantSession()` (stores/index.ts) so there is
 * exactly one implementation of "what branch scope does this role set
 * get by default," not two.
 *
 * Safety rule (Phase 9 architecture doc §"Default behavior for legacy
 * sessions"): a missing or malformed `explicit` value must NEVER be
 * treated as "all branches" — that would silently grant access this
 * session was never actually issued. The one deliberate exception is
 * `owner`: Owner already holds every P7Permission unconditionally
 * (`ROLE_PERMISSION_MAP.owner === ALL_PERMISSIONS`), so branch-restricting
 * an Owner via a missing-data fallback would be a functional regression,
 * not a security tightening — it would just break Owner without stopping
 * anyone who actually shouldn't have access.
 */
export function resolveBranchAccess(
  explicit: BranchAccess | null | undefined,
  roles: readonly Role[],
): BranchAccess {
  if (
    explicit &&
    (explicit.scope === 'all' ||
      (explicit.scope === 'assigned' && Array.isArray(explicit.branchIds)))
  ) {
    return explicit
  }
  if (roles.includes('owner')) return { scope: 'all' }
  return { scope: 'assigned', branchIds: [] }
}

/**
 * Phase 9 — selects which `TenantMembership` a `{ memberships, activeMembership }`
 * response describes the CURRENT session for. Never guesses across an
 * ambiguous multi-membership list with no hint to disambiguate — see
 * `normalizeTenantPermissions()`'s handling of an unresolved selection.
 *
 * Priority: `activeMembership` (the backend's own assertion of "this is
 * the one," when it bothers to send it) → a membership matching
 * `currentTenantId` (the tenant the frontend has already resolved via
 * slug — see `useTenantStore.tenant`) → the sole entry, if the list has
 * exactly one and nothing else disambiguates it.
 */
function selectActiveMembership(
  memberships: readonly TenantMembership[] | null | undefined,
  activeMembership: TenantMembership | null | undefined,
  currentTenantId: string | undefined,
): TenantMembership | undefined {
  if (activeMembership) return activeMembership
  if (!memberships || memberships.length === 0) return undefined
  if (currentTenantId) {
    const match = memberships.find((m) => m.tenantId === currentTenantId)
    if (match) return match
  }
  return memberships.length === 1 ? memberships[0] : undefined
}

/**
 * Phase 2 (RBAC unification) — the ONE place that translates a raw auth
 * response into `{ tenantId, roles, permissions, branchAccess }`. Every
 * auth entry point (login, register, verify-otp, getMe, tenant switch)
 * has historically used a different field name for the same roles concept
 * (`p7Roles` at login/register/verify-otp, `tenantRoles` from getMe()) —
 * no consumer downstream of this function needs to know which one it was.
 *
 * `permissions` is derived from `roles` via ROLE_PERMISSION_MAP (the single
 * role→permission source — see BASE_ROLE_PERMISSION_MAP above) purely
 * because no backend exists yet to return a pre-resolved permission set.
 * Once a real backend implements `TenantSession` (types/index.ts) and
 * starts returning `permissions` directly, this function's body becomes
 * `{ roles: response.roles, permissions: response.permissions }` — its
 * call sites do not change.
 *
 * Phase 9 — also accepts the target `{ memberships, activeMembership }`
 * shape (see `TenantMembership` in types/rbac.ts) alongside the legacy
 * `roles`/`p7Roles`/`tenantRoles` shape, and always resolves a
 * `branchAccess` value (see `resolveBranchAccess()` above) — neither
 * input shape can produce a session with a missing/undefined branch
 * scope. `currentTenantId` (normally `useTenantStore.tenant?.id`) is used
 * only to disambiguate which membership applies when a `memberships` list
 * has more than one entry and no `activeMembership` was sent — it has no
 * effect on the legacy shape, which has no per-tenant structure to select
 * from in the first place.
 *
 * No backend sends the `memberships`/`activeMembership` shape yet (mock
 * mode and the real-mode contract both still only ever produce
 * `tenantRoles`) — this is data-model preparation (Phase 9.2), not a
 * behavior change for any call site that exists today.
 */
export function normalizeTenantPermissions(
  response:
    | {
        roles?: Role[] | null
        p7Roles?: Role[] | null
        tenantRoles?: Role[] | null
        permissions?: P7Permission[] | null
        memberships?: TenantMembership[] | null
        activeMembership?: TenantMembership | null
      }
    | Role[]
    | null
    | undefined,
  currentTenantId?: string,
): { tenantId?: string; roles: Role[]; permissions: P7Permission[]; branchAccess: BranchAccess } {
  if (Array.isArray(response)) {
    const roles = response
    return {
      tenantId: currentTenantId,
      roles,
      permissions: [...getPermissionsForRole(roles)],
      branchAccess: resolveBranchAccess(undefined, roles),
    }
  }

  // Phase 9 — the new, tenant-mapped shape takes priority when present.
  // `memberships` (even an empty array) signals the caller is on the new
  // contract; only fall through to the legacy fields when `memberships`
  // itself is absent, so a backend mid-migration can't have both fields
  // half-trusted at once.
  if (response?.memberships !== undefined && response?.memberships !== null) {
    const selected = selectActiveMembership(response.memberships, response.activeMembership, currentTenantId)
    if (!selected) {
      // Ambiguous (multiple memberships, no hint to pick one) or an empty
      // list — deny by default, exactly like a missing branchAccess: never
      // guess which tenant's roles apply.
      return { tenantId: currentTenantId, roles: [], permissions: [], branchAccess: resolveBranchAccess(undefined, []) }
    }
    const roles = selected.roles
    return {
      tenantId: selected.tenantId,
      roles,
      permissions: [...getPermissionsForRole(roles)],
      branchAccess: resolveBranchAccess(selected.branchAccess, roles),
    }
  }

  const roles = response?.roles ?? response?.p7Roles ?? response?.tenantRoles ?? []
  const permissions = response?.permissions ?? [...getPermissionsForRole(roles)]
  return {
    tenantId: currentTenantId,
    roles,
    permissions,
    branchAccess: resolveBranchAccess(undefined, roles),
  }
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

export const MOCK_TENANT_ID = 'tenant-samoon-01'
export const MOCK_TENANT_B_ID = 'tenant-brew-cafe-01'

export const MOCK_RBAC_USERS: readonly MockRbacUser[] = [
  {
    id: 'user-owner-01',
    email: 'owner@samoon.com',
    first_name: 'Olivia',
    last_name: 'Owner',
    tenantAssignments: [
      { userId: 'user-owner-01', tenantId: MOCK_TENANT_ID, roles: ['owner'] },
    ],
  },
  {
    id: 'user-admin-01',
    email: 'admin@samoon.com',
    first_name: 'Alex',
    last_name: 'Admin',
    tenantAssignments: [
      { userId: 'user-admin-01', tenantId: MOCK_TENANT_ID, roles: ['admin'] },
    ],
  },
  {
    id: 'user-manager-01',
    email: 'manager@samoon.com',
    first_name: 'Maria',
    last_name: 'Manager',
    tenantAssignments: [
      { userId: 'user-manager-01', tenantId: MOCK_TENANT_ID, roles: ['manager'] },
    ],
  },
  {
    id: 'user-cashier-01',
    email: 'cashier@samoon.com',
    first_name: 'Casey',
    last_name: 'Cashier',
    tenantAssignments: [
      { userId: 'user-cashier-01', tenantId: MOCK_TENANT_ID, roles: ['cashier'] },
    ],
  },
  {
    id: 'user-waiter-01',
    email: 'waiter@samoon.com',
    first_name: 'Will',
    last_name: 'Waiter',
    tenantAssignments: [
      { userId: 'user-waiter-01', tenantId: MOCK_TENANT_ID, roles: ['waiter'] },
    ],
  },
  {
    id: 'user-kitchen-01',
    email: 'kitchen@samoon.com',
    first_name: 'Kai',
    last_name: 'Kitchen',
    tenantAssignments: [
      { userId: 'user-kitchen-01', tenantId: MOCK_TENANT_ID, roles: ['kitchen'] },
    ],
  },
  {
    id: 'user-marketing-01',
    email: 'marketing@samoon.com',
    first_name: 'Morgan',
    last_name: 'Marketing',
    tenantAssignments: [
      { userId: 'user-marketing-01', tenantId: MOCK_TENANT_ID, roles: ['marketing'] },
    ],
  },
  {
    id: 'user-support-01',
    email: 'support@samoon.com',
    first_name: 'Sam',
    last_name: 'Support',
    tenantAssignments: [
      { userId: 'user-support-01', tenantId: MOCK_TENANT_ID, roles: ['support'] },
    ],
  },
  {
    // Multi-tenant: manager on Tenant A, cashier on Tenant B
    id: 'user-multi-01',
    email: 'multi@samoon.com',
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
    permissions: ['branches.view', 'branches.manage', 'branches.create', 'branches.update', 'branches.delete'],
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
  'branches.create': { permission: 'branches.create', requires: ['branches.view'] },
  'branches.update': { permission: 'branches.update', requires: ['branches.view'] },
  'branches.delete': { permission: 'branches.delete', requires: ['branches.view', 'branches.update'] },
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
  normalizeTenantPermissions,
  resolveBranchAccess,
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
