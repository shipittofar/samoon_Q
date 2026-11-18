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
  BranchAccessInput,
  MembershipBranch,
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
  // Tags (sub-resource of Menu)
  'tag.view',
  'tag.create',
  'tag.update',
  'tag.delete',
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
  'rbac.manage_roles',
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
   * Full access catalog entry for fixtures / ROLE_TEMPLATES / mock role→perm
   * expansion when the backend did NOT send an explicit permission list.
   *
   * Live feature authorization must NOT treat `owner` as ALL_PERMISSIONS.
   * When GET /auth/me (or membership) includes `permissions`, that list is
   * authoritative — see normalizeTenantPermissions() `permissionsSource`.
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
    'tag.view',
    'tag.create',
    'tag.update',
    'tag.delete',
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
    'tag.view',
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
  explicit: BranchAccessInput | null | undefined,
  roles: readonly Role[],
  membershipBranches?: readonly MembershipBranch[],
): BranchAccess {
  if (explicit?.scope === 'all') {
    return { scope: 'all' }
  }

  const isSelectedLike =
    explicit &&
    (explicit.scope === 'selected' || explicit.scope === 'assigned')

  if (isSelectedLike) {
    const branchIds = Array.isArray(explicit.branchIds) ? explicit.branchIds : []
    if (branchIds.length > 0) {
      return { scope: 'selected', branchIds }
    }
    if (membershipBranches && membershipBranches.length > 0) {
      return { scope: 'selected', branchIds: membershipBranches.map((b) => b.id) }
    }
    return { scope: 'selected', branchIds: [] }
  }

  // Missing/malformed explicit value: Owner is the one deliberate exception
  // (see doc comment above) — never restrict an Owner via missing data.
  if (roles.includes('owner')) return { scope: 'all' }
  return { scope: 'selected', branchIds: [] }
}

/**
 * Phase 9.4 — the single evaluation of "does this branchAccess grant
 * visibility into branchId." This is the ONE place that reads a
 * `BranchAccess` value to answer that question — `useBranchAccess()`
 * (hooks/index.ts) is a thin wrapper around this, never a second
 * implementation.
 *
 * Frontend-only, defense-in-depth / UX signal — NOT a security boundary.
 * The backend is the sole authority on whether a branch-scoped request
 * actually succeeds; this function exists only to avoid firing doomed
 * requests, avoid rendering branches/links the user can't use, and give
 * an immediate local "Access Denied" instead of waiting on a round trip
 * that would fail anyway once the backend enforces this. Never trust its
 * `true` result as proof of anything beyond "don't bother asking" — a
 * malicious or modified client can trivially make this return `true` for
 * any branch, which is exactly why the backend must re-check independently.
 *
 * A missing/null `branchAccess` denies by default — never an implicit
 * allow. This mirrors `resolveBranchAccess()`'s own safety rule; the two
 * functions are deliberately kept separate (one resolves what
 * `branchAccess` a session gets, this one reads an already-resolved
 * value) so neither has to guess at the other's job.
 */
export function canAccessBranch(
  branchAccess: BranchAccess | BranchAccessInput | null | undefined,
  branchId: string | null | undefined,
): boolean {
  if (!branchId || !branchAccess) return false
  if (branchAccess.scope === 'all') return true
  if (branchAccess.scope === 'selected' || branchAccess.scope === 'assigned') {
    const branchIds = 'branchIds' in branchAccess && Array.isArray(branchAccess.branchIds)
      ? branchAccess.branchIds
      : []
    if (branchIds.length === 0) return false
    return branchIds.includes(branchId)
  }
  return false
}

/**
 * Phase 9 — selects which `TenantMembership` a `{ memberships, activeMembership }`
 * response describes the CURRENT session for. Never guesses across an
 * ambiguous multi-membership list with no hint to disambiguate — see
 * `normalizeTenantPermissions()`'s handling of an unresolved selection.
 *
 * `activeMembership` is treated ONLY as a selector — "which tenantId is
 * active" — never as a source of roles/branchAccess itself. The real
 * backend contract sends it as a minimal pointer (`{ tenantId }`), not a
 * duplicate of the full membership record; `roles`/`branchAccess` only
 * ever live on the matching entry in `memberships`. Trusting
 * `activeMembership.roles` directly (pre-fix behavior) silently produced
 * an empty permission set — `getPermissionsForRole(undefined)` → `[]` —
 * for every business owner/admin whose `/auth/me/` response used this
 * pointer shape, denying Console access despite a fully-permissioned
 * membership existing in `memberships`.
 *
 * Priority for which tenantId is active: `activeMembership.tenantId` →
 * `currentTenantId` (the tenant the frontend has already resolved via
 * slug — see `useTenantStore.tenant`) → the sole entry, if the list has
 * exactly one and nothing else disambiguates it. Once a tenantId is
 * chosen, the returned record always comes from `memberships` — never
 * from `activeMembership` directly — so `roles`/`branchAccess` are
 * guaranteed complete whenever a match exists.
 */
export function selectActiveMembership(
  memberships: readonly TenantMembership[] | null | undefined,
  activeMembership: TenantMembership | null | undefined,
  currentTenantId: string | undefined,
): TenantMembership | undefined {
  if (!memberships || memberships.length === 0) return undefined
  const activeTenantId = activeMembership?.tenantId
  if (activeTenantId) {
    const match = memberships.find((m) => m.tenantId === activeTenantId)
    if (match) return match
  }
  if (currentTenantId) {
    const match = memberships.find((m) => m.tenantId === currentTenantId)
    if (match) return match
  }
  return memberships.length === 1 ? memberships[0] : undefined
}

/**
 * Phase 2 (RBAC unification) — the ONE place that translates a raw auth
 * response into `{ tenantId, roles, permissions, branchAccess }`.
 *
 * Authorization contract:
 *   role            = identity / classification (e.g. "owner")
 *   permission set  = feature authorization (menus, routes, guards)
 *
 * When the backend sends an explicit effective permission list (membership
 * `permissions`, top-level `permissions`, or legacy `tenantRoles[].permissions`
 * merged onto the membership), that list is authoritative — including `[]`.
 * `ROLE_PERMISSION_MAP` / `getPermissionsForRole()` must NEVER override it.
 *
 * Role→permission expansion remains only when no explicit list is present
 * (mock fixtures / legacy Role[] helpers). Live real-backend UI authorization
 * must not rely on that expansion: `applyTenantSessionRbac` seeds empty
 * session permissions in real mode until GET /auth/me/permissions (or an
 * explicit /auth/me list) populates the permission store.
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
): {
  tenantId?: string
  roles: Role[]
  permissions: P7Permission[]
  branchAccess: BranchAccess
  /** How `permissions` was produced — live auth must not treat role-map as backend truth. */
  permissionsSource: 'explicit' | 'role-map' | 'none'
} {
  if (Array.isArray(response)) {
    const roles = response
    return {
      tenantId: currentTenantId,
      roles,
      permissions: [...getPermissionsForRole(roles)],
      branchAccess: resolveBranchAccess(undefined, roles),
      permissionsSource: roles.length > 0 ? 'role-map' : 'none',
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
      return {
        tenantId: currentTenantId,
        roles: [],
        permissions: [],
        branchAccess: resolveBranchAccess(undefined, []),
        permissionsSource: 'none',
      }
    }
    const roles = selected.roles
    // Explicit membership permissions (including []) beat ROLE_PERMISSION_MAP.
    if (selected.permissions !== undefined) {
      return {
        tenantId: selected.tenantId,
        roles,
        permissions: [...new Set(selected.permissions)] as P7Permission[],
        branchAccess: resolveBranchAccess(selected.branchAccess, roles, selected.branches),
        permissionsSource: 'explicit',
      }
    }
    // Top-level permissions alongside memberships (rare) — still explicit.
    if (response.permissions !== undefined && response.permissions !== null) {
      return {
        tenantId: selected.tenantId,
        roles,
        permissions: [...new Set(response.permissions)] as P7Permission[],
        branchAccess: resolveBranchAccess(selected.branchAccess, roles, selected.branches),
        permissionsSource: 'explicit',
      }
    }
    return {
      tenantId: selected.tenantId,
      roles,
      permissions: [...getPermissionsForRole(roles)],
      branchAccess: resolveBranchAccess(selected.branchAccess, roles, selected.branches),
      permissionsSource: roles.length > 0 ? 'role-map' : 'none',
    }
  }

  const roles = response?.roles ?? response?.p7Roles ?? response?.tenantRoles ?? []
  if (response?.permissions !== undefined && response?.permissions !== null) {
    return {
      tenantId: currentTenantId,
      roles,
      permissions: [...new Set(response.permissions)] as P7Permission[],
      branchAccess: resolveBranchAccess(undefined, roles),
      permissionsSource: 'explicit',
    }
  }
  return {
    tenantId: currentTenantId,
    roles,
    permissions: [...getPermissionsForRole(roles)],
    branchAccess: resolveBranchAccess(undefined, roles),
    permissionsSource: roles.length > 0 ? 'role-map' : 'none',
  }
}

/**
 * Phase Z.10 — does this session-restore/login/register response prove the
 * user has AT LEAST ONE tenant membership, independent of whether a
 * specific tenant has actually resolved (subdomain lookup, membership
 * fallback, or otherwise)? Console uses this to decide full workspace vs.
 * onboarding — see docs/CONSOLE_TENANT_DEPENDENCY_REDESIGN_AUDIT.md.
 *
 * Mirrors `normalizeTenantPermissions()`'s own shape-priority rule: the
 * frozen `memberships` field, when present (even as an empty array), is
 * authoritative — `memberships.length > 0` is the answer directly, no
 * further inference. Only when `memberships` is entirely absent (a
 * backend still on the legacy `roles`/`p7Roles`/`tenantRoles` shape) do
 * we fall back to "a non-empty legacy role list IS proof of at least one
 * tenant membership" — the legacy shape never names which tenant, but a
 * role assignment cannot exist without one.
 */
export function hasAnyMembership(
  response:
    | {
        roles?: Role[] | null
        p7Roles?: Role[] | null
        tenantRoles?: Role[] | null
        memberships?: TenantMembership[] | null
      }
    | Role[]
    | null
    | undefined,
): boolean {
  if (Array.isArray(response)) return response.length > 0
  if (response?.memberships !== undefined && response?.memberships !== null) {
    return response.memberships.length > 0
  }
  const legacyRoles = response?.roles ?? response?.p7Roles ?? response?.tenantRoles ?? []
  return legacyRoles.length > 0
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
      // Phase Z.1 — explicit branchIds gives this assignment a real,
      // non-empty 'assigned' branch scope (as opposed to every other
      // non-owner assignment above, which falls through to
      // resolveBranchAccess()'s empty-array default) — the mock fixture
      // for "selected branch access" test coverage. See
      // getMockMemberships() below, the only reader of this field.
      { userId: 'user-multi-01', tenantId: MOCK_TENANT_B_ID, roles: ['cashier'], branchIds: ['branch-brewcafe-01'] },
    ],
  },
]

/**
 * Phase Z.1 — tenant slug lookup for getMockMemberships() below. Mirrors
 * tenant.service.ts's MOCK_TENANTS keys (samoon → tenant-samoon-01,
 * brew-cafe → tenant-brew-cafe-01) without importing that module — this
 * file (permission.service.ts) intentionally has no dependency on
 * tenant.service.ts, and a slug is a display/UX convenience here, never
 * used for any access decision.
 */
const MOCK_TENANT_SLUGS: Record<string, string> = {
  [MOCK_TENANT_ID]: 'samoon',
  [MOCK_TENANT_B_ID]: 'brew-cafe',
}

/** Find a mock user's roles for a given tenant. */
export function getMockRoles(userId: string, tenantId: string): Role[] {
  const user = MOCK_RBAC_USERS.find((u) => u.id === userId)
  return user?.tenantAssignments.find((a) => a.tenantId === tenantId)?.roles ?? []
}

/**
 * Phase Z.1 — the single place that turns a MOCK_RBAC_USERS entry's
 * `tenantAssignments` (the pre-Phase-9 `UserTenantRole[]` shape) into the
 * target `TenantMembership[]` shape the frozen backend contract sends
 * (docs/BACKEND_CONTRACT.md §2, `GET /auth/memberships/`). Reuses
 * resolveBranchAccess() for the branchAccess computation — never a second,
 * hand-rolled scope decision — so a mock user's resolved branch access here
 * is guaranteed consistent with what setCurrentTenantSession() would
 * compute for the same roles/branchIds.
 *
 * Returns [] for a userId with no MOCK_RBAC_USERS entry (e.g. a pure
 * customer with no tenant membership at all) — never throws, matching
 * getMockRoles()'s own "unknown user → empty result" contract.
 */
export function getMockMemberships(userId: string): TenantMembership[] {
  const user = MOCK_RBAC_USERS.find((u) => u.id === userId)
  if (!user) return []
  return user.tenantAssignments.map((a) => ({
    tenantId: a.tenantId,
    tenantSlug: MOCK_TENANT_SLUGS[a.tenantId],
    roles: a.roles,
    branchAccess: a.branchIds
      ? { scope: 'selected', branchIds: a.branchIds }
      : resolveBranchAccess(undefined, a.roles),
  }))
}

/**
 * Phase X.3 — the mock stand-in for "does this user hold ANY tenant
 * membership for tenantId." Real equivalent: a `GET /auth/memberships`
 * response (see the Phase X audit's required-backend-contract section —
 * not implemented by any backend yet). Used to decide which tenants
 * AdminTenantSwitcher lists and allows a switch into — mirroring how
 * canAccessBranch() filters branches: a frontend-only, defense-in-depth
 * safety net, never the actual authorization boundary (a real backend
 * must independently reject a switch to a tenant the caller doesn't
 * belong to, exactly as it must for branches).
 */
export function hasAnyTenantAccess(userId: string, tenantId: string): boolean {
  return getMockRoles(userId, tenantId).length > 0
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
  'tag.create': { permission: 'tag.create', requires: ['tag.view'] },
  'tag.update': { permission: 'tag.update', requires: ['tag.view'] },
  'tag.delete': { permission: 'tag.delete', requires: ['tag.view', 'tag.update'] },
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
  selectActiveMembership,
  hasAnyMembership,
  resolveBranchAccess,
  canAccessBranch,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  checkPermission,
  applyOverrides,
  resolveEffectivePermissions,
  getMockRoles,
  getMockMemberships,
  hasAnyTenantAccess,
  auditHooks,
  MOCK_RBAC_USERS,
  MOCK_TENANT_ID,
  MOCK_TENANT_B_ID,
  PERMISSION_DEPENDENCIES,
  validatePermissionGrant,
  resolveWithDependencies,
}
