/**
 * P7.1 — Enterprise RBAC & Permission System
 *
 * A = Role type coverage
 * B = Permission type coverage
 * C = ROLE_PERMISSION_MAP completeness
 * D = Owner permissions
 * E = Admin permissions
 * F = Manager permissions
 * G = Cashier permissions
 * H = Waiter permissions
 * I = Kitchen permissions
 * J = Marketing permissions
 * K = Support permissions
 * L = getPermissionsForRole — single role
 * M = getPermissionsForRole — multiple roles
 * N = hasPermission — basic checks
 * O = hasAnyPermission
 * P = hasAllPermissions
 * Q = hasPermission with featureFlags
 * R = hasPermission with capabilities
 * S = Combined Permission + Capability + FeatureFlag
 * T = UserTenantRole type structure
 * U = Tenant isolation (multi-tenant)
 * V = PermissionGuard source (component existence)
 * W = PermissionGuard props API
 * X = Navigation filtering (source checks)
 * Y = useRbacStore — state management
 * Z = Mock infrastructure
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '../../')

// ── A — Role type ──────────────────────────────────────────────────────────────

describe('A — Role type', () => {
  it('Role type includes owner', () => {
    const r: import('@/types/rbac').Role = 'owner'
    expect(r).toBe('owner')
  })
  it('Role type includes admin', () => {
    const r: import('@/types/rbac').Role = 'admin'
    expect(r).toBe('admin')
  })
  it('Role type includes manager', () => {
    const r: import('@/types/rbac').Role = 'manager'
    expect(r).toBe('manager')
  })
  it('Role type includes cashier', () => {
    const r: import('@/types/rbac').Role = 'cashier'
    expect(r).toBe('cashier')
  })
  it('Role type includes waiter', () => {
    const r: import('@/types/rbac').Role = 'waiter'
    expect(r).toBe('waiter')
  })
  it('Role type includes kitchen', () => {
    const r: import('@/types/rbac').Role = 'kitchen'
    expect(r).toBe('kitchen')
  })
  it('Role type includes marketing', () => {
    const r: import('@/types/rbac').Role = 'marketing'
    expect(r).toBe('marketing')
  })
  it('Role type includes support', () => {
    const r: import('@/types/rbac').Role = 'support'
    expect(r).toBe('support')
  })
})

// ── B — P7Permission type ──────────────────────────────────────────────────────

describe('B — P7Permission type coverage', () => {
  it('includes orders.view', () => { const p: import('@/types/rbac').P7Permission = 'orders.view'; expect(p).toBe('orders.view') })
  it('includes orders.manage', () => { const p: import('@/types/rbac').P7Permission = 'orders.manage'; expect(p).toBe('orders.manage') })
  it('includes menu.view', () => { const p: import('@/types/rbac').P7Permission = 'menu.view'; expect(p).toBe('menu.view') })
  it('includes menu.manage', () => { const p: import('@/types/rbac').P7Permission = 'menu.manage'; expect(p).toBe('menu.manage') })
  it('includes reservations.view', () => { const p: import('@/types/rbac').P7Permission = 'reservations.view'; expect(p).toBe('reservations.view') })
  it('includes reservations.manage', () => { const p: import('@/types/rbac').P7Permission = 'reservations.manage'; expect(p).toBe('reservations.manage') })
  it('includes customers.view', () => { const p: import('@/types/rbac').P7Permission = 'customers.view'; expect(p).toBe('customers.view') })
  it('includes customers.manage', () => { const p: import('@/types/rbac').P7Permission = 'customers.manage'; expect(p).toBe('customers.manage') })
  it('includes vendors.view', () => { const p: import('@/types/rbac').P7Permission = 'vendors.view'; expect(p).toBe('vendors.view') })
  it('includes vendors.manage', () => { const p: import('@/types/rbac').P7Permission = 'vendors.manage'; expect(p).toBe('vendors.manage') })
  it('includes promotions.view', () => { const p: import('@/types/rbac').P7Permission = 'promotions.view'; expect(p).toBe('promotions.view') })
  it('includes promotions.manage', () => { const p: import('@/types/rbac').P7Permission = 'promotions.manage'; expect(p).toBe('promotions.manage') })
  it('includes loyalty.view', () => { const p: import('@/types/rbac').P7Permission = 'loyalty.view'; expect(p).toBe('loyalty.view') })
  it('includes loyalty.manage', () => { const p: import('@/types/rbac').P7Permission = 'loyalty.manage'; expect(p).toBe('loyalty.manage') })
  it('includes analytics.view', () => { const p: import('@/types/rbac').P7Permission = 'analytics.view'; expect(p).toBe('analytics.view') })
  it('includes staff.view', () => { const p: import('@/types/rbac').P7Permission = 'staff.view'; expect(p).toBe('staff.view') })
  it('includes staff.manage', () => { const p: import('@/types/rbac').P7Permission = 'staff.manage'; expect(p).toBe('staff.manage') })
  it('includes branches.view', () => { const p: import('@/types/rbac').P7Permission = 'branches.view'; expect(p).toBe('branches.view') })
  it('includes branches.manage', () => { const p: import('@/types/rbac').P7Permission = 'branches.manage'; expect(p).toBe('branches.manage') })
  it('includes settings.view', () => { const p: import('@/types/rbac').P7Permission = 'settings.view'; expect(p).toBe('settings.view') })
  it('includes settings.manage', () => { const p: import('@/types/rbac').P7Permission = 'settings.manage'; expect(p).toBe('settings.manage') })
  it('includes tenant.view', () => { const p: import('@/types/rbac').P7Permission = 'tenant.view'; expect(p).toBe('tenant.view') })
  it('includes tenant.manage', () => { const p: import('@/types/rbac').P7Permission = 'tenant.manage'; expect(p).toBe('tenant.manage') })
  it('includes audit.view', () => { const p: import('@/types/rbac').P7Permission = 'audit.view'; expect(p).toBe('audit.view') })
})

// ── C — ROLE_PERMISSION_MAP completeness ──────────────────────────────────────

describe('C — ROLE_PERMISSION_MAP completeness', () => {
  it('contains owner key', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP).toHaveProperty('owner')
  })
  it('contains admin key', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP).toHaveProperty('admin')
  })
  it('contains manager key', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP).toHaveProperty('manager')
  })
  it('contains cashier key', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP).toHaveProperty('cashier')
  })
  it('contains waiter key', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP).toHaveProperty('waiter')
  })
  it('contains kitchen key', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP).toHaveProperty('kitchen')
  })
  it('contains marketing key', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP).toHaveProperty('marketing')
  })
  it('contains support key', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP).toHaveProperty('support')
  })
  it('has exactly 8 roles', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(Object.keys(ROLE_PERMISSION_MAP)).toHaveLength(8)
  })
  // Category Management added category.view/create/update/delete
  // (docs/CATEGORY_MANAGEMENT_IMPLEMENTATION.md): 48 + 4 = 52.
  it('ALL_PERMISSIONS has 52 entries', async () => {
    const { ALL_PERMISSIONS } = await import('@/services/permission.service')
    expect(ALL_PERMISSIONS).toHaveLength(52)
  })
})

// ── D — Owner permissions ──────────────────────────────────────────────────────

describe('D — Owner permissions', () => {
  it('owner has tenant.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'tenant.manage')).toBe(true)
  })
  it('owner has tenant.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'tenant.view')).toBe(true)
  })
  it('owner has all 24 permissions', async () => {
    const { ROLE_PERMISSION_MAP, ALL_PERMISSIONS } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP.owner).toHaveLength(ALL_PERMISSIONS.length)
  })
  it('owner has audit.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'audit.view')).toBe(true)
  })
  it('owner has settings.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'settings.manage')).toBe(true)
  })
  it('owner has staff.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'staff.manage')).toBe(true)
  })
})

// ── E — Admin permissions ──────────────────────────────────────────────────────

describe('E — Admin permissions', () => {
  it('admin does NOT have tenant.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('admin', 'tenant.manage')).toBe(false)
  })
  // P10.2.2 — docs/P10.1_OWNERSHIP_RBAC_ARCHITECTURE.md §4.2/§7.2: both
  // tenant.manage AND tenant.view are now owner-exclusive, structurally
  // unreachable via any Staff role including admin (closing P10.0 J1).
  // Updated from "admin has tenant.view: true" — intentional architecture
  // change, not a regression.
  it('admin does NOT have tenant.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('admin', 'tenant.view')).toBe(false)
  })
  it('admin has all permissions except tenant.manage and tenant.view', async () => {
    const { ROLE_PERMISSION_MAP, ALL_PERMISSIONS } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP.admin).toHaveLength(ALL_PERMISSIONS.length - 2)
  })
  it('admin has staff.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('admin', 'staff.manage')).toBe(true)
  })
  it('admin has settings.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('admin', 'settings.manage')).toBe(true)
  })
  it('admin has analytics.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('admin', 'analytics.view')).toBe(true)
  })
})

// ── F — Manager permissions ────────────────────────────────────────────────────

describe('F — Manager permissions', () => {
  it('manager has orders.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'orders.manage')).toBe(true)
  })
  it('manager does NOT have analytics.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'analytics.view')).toBe(false)
  })
  it('manager has staff.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'staff.manage')).toBe(true)
  })
  it('manager does NOT have settings.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'settings.manage')).toBe(false)
  })
  it('manager does NOT have tenant.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'tenant.manage')).toBe(false)
  })
  it('manager does NOT have tenant.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'tenant.view')).toBe(false)
  })
  it('manager does NOT have promotions.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'promotions.manage')).toBe(false)
  })
  it('manager does NOT have loyalty.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'loyalty.manage')).toBe(false)
  })
})

// ── G — Cashier permissions ────────────────────────────────────────────────────

describe('G — Cashier permissions', () => {
  it('cashier has orders.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'orders.view')).toBe(true)
  })
  it('cashier has orders.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'orders.manage')).toBe(true)
  })
  it('cashier does NOT have menu.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'menu.view')).toBe(false)
  })
  it('cashier does NOT have menu.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'menu.manage')).toBe(false)
  })
  it('cashier does NOT have analytics.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'analytics.view')).toBe(false)
  })
  it('cashier does NOT have staff.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'staff.view')).toBe(false)
  })
})

// ── H — Waiter permissions ─────────────────────────────────────────────────────

describe('H — Waiter permissions', () => {
  it('waiter has orders.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('waiter', 'orders.manage')).toBe(true)
  })
  it('waiter has reservations.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('waiter', 'reservations.manage')).toBe(true)
  })
  it('waiter has customers.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('waiter', 'customers.view')).toBe(true)
  })
  it('waiter does NOT have customers.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('waiter', 'customers.manage')).toBe(false)
  })
  it('waiter does NOT have analytics.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('waiter', 'analytics.view')).toBe(false)
  })
})

// ── I — Kitchen permissions ────────────────────────────────────────────────────

describe('I — Kitchen permissions', () => {
  it('kitchen has orders.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'orders.view')).toBe(true)
  })
  it('kitchen does NOT have orders.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'orders.manage')).toBe(false)
  })
  it('kitchen does NOT have menu.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'menu.view')).toBe(false)
  })
  it('kitchen does NOT have reservations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'reservations.view')).toBe(false)
  })
  it('kitchen does NOT have analytics.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'analytics.view')).toBe(false)
  })
  it('kitchen has exactly 5 permissions', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP.kitchen).toHaveLength(5)
  })
})

// ── J — Marketing permissions ──────────────────────────────────────────────────

describe('J — Marketing permissions', () => {
  it('marketing has promotions.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'promotions.manage')).toBe(true)
  })
  it('marketing has loyalty.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'loyalty.manage')).toBe(true)
  })
  it('marketing has analytics.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'analytics.view')).toBe(true)
  })
  it('marketing does NOT have orders.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'orders.manage')).toBe(false)
  })
  it('marketing does NOT have staff.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'staff.view')).toBe(false)
  })
  it('marketing does NOT have settings.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'settings.view')).toBe(false)
  })
})

// ── K — Support permissions ────────────────────────────────────────────────────

describe('K — Support permissions', () => {
  it('support does NOT have orders.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'orders.view')).toBe(false)
  })
  it('support does NOT have analytics.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'analytics.view')).toBe(false)
  })
  it('support does NOT have orders.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'orders.manage')).toBe(false)
  })
  it('support does NOT have staff.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'staff.view')).toBe(false)
  })
  it('support does NOT have promotions.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'promotions.manage')).toBe(false)
  })
  it('support does NOT have settings.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'settings.view')).toBe(false)
  })
})

// ── L — getPermissionsForRole single role ──────────────────────────────────────

describe('L — getPermissionsForRole — single role', () => {
  it('null → empty array', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    expect(getPermissionsForRole(null)).toHaveLength(0)
  })
  it('undefined → empty array', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    expect(getPermissionsForRole(undefined)).toHaveLength(0)
  })
  it('kitchen → 5 permissions', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    expect(getPermissionsForRole('kitchen')).toHaveLength(5)
  })
  it('owner → 24 permissions', async () => {
    const { getPermissionsForRole, ALL_PERMISSIONS } = await import('@/services/permission.service')
    expect(getPermissionsForRole('owner')).toHaveLength(ALL_PERMISSIONS.length)
  })
  it('returns an array', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    expect(Array.isArray(getPermissionsForRole('manager'))).toBe(true)
  })
})

// ── M — getPermissionsForRole multiple roles ───────────────────────────────────

describe('M — getPermissionsForRole — multiple roles', () => {
  it('cashier + marketing → union of both sets', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    const cashierPerms = getPermissionsForRole('cashier')
    const marketingPerms = getPermissionsForRole('marketing')
    const combined = getPermissionsForRole(['cashier', 'marketing'])
    const expected = new Set([...cashierPerms, ...marketingPerms])
    expect(combined).toHaveLength(expected.size)
  })
  it('deduplicates shared permissions', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    const combined = getPermissionsForRole(['waiter', 'cashier'])
    // both have orders.view, orders.manage, menu.view — should not be duplicated
    const ordersView = combined.filter((p) => p === 'orders.view')
    expect(ordersView).toHaveLength(1)
  })
  it('kitchen + marketing includes analytics.view', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    const combined = getPermissionsForRole(['kitchen', 'marketing'])
    expect(combined).toContain('analytics.view')
  })
  it('empty array → empty permissions', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    expect(getPermissionsForRole([])).toHaveLength(0)
  })
  it('owner + support → same as owner (owner is superset)', async () => {
    const { getPermissionsForRole, ALL_PERMISSIONS } = await import('@/services/permission.service')
    expect(getPermissionsForRole(['owner', 'support'])).toHaveLength(ALL_PERMISSIONS.length)
  })
})

// ── N — hasPermission basic checks ────────────────────────────────────────────

describe('N — hasPermission — basic checks', () => {
  it('null roles → false', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission(null, 'orders.view')).toBe(false)
  })
  it('undefined roles → false', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission(undefined, 'orders.view')).toBe(false)
  })
  it('owner has orders.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'orders.view')).toBe(true)
  })
  it('support does not have orders.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'orders.manage')).toBe(false)
  })
  it('array roles — waiter+marketing has analytics.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission(['waiter', 'marketing'], 'analytics.view')).toBe(true)
  })
  it('array roles — cashier+support has no staff.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission(['cashier', 'support'], 'staff.view')).toBe(false)
  })
  it('kitchen does not have loyalty.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'loyalty.view')).toBe(false)
  })
  it('marketing has promotions.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'promotions.view')).toBe(true)
  })
  it('cashier does NOT have reservations.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'reservations.view')).toBe(false)
  })
  it('cashier does NOT have reservations.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'reservations.manage')).toBe(false)
  })
})

// ── O — hasAnyPermission ──────────────────────────────────────────────────────

describe('O — hasAnyPermission', () => {
  it('empty permissions → false', async () => {
    const { hasAnyPermission } = await import('@/services/permission.service')
    expect(hasAnyPermission('owner', [])).toBe(false)
  })
  it('null roles → false', async () => {
    const { hasAnyPermission } = await import('@/services/permission.service')
    expect(hasAnyPermission(null, ['orders.view'])).toBe(false)
  })
  it('kitchen has any of [orders.view, analytics.view]', async () => {
    const { hasAnyPermission } = await import('@/services/permission.service')
    expect(hasAnyPermission('kitchen', ['orders.view', 'analytics.view'])).toBe(true)
  })
  it('support does not have any of [tenant.manage, staff.manage]', async () => {
    const { hasAnyPermission } = await import('@/services/permission.service')
    expect(hasAnyPermission('support', ['tenant.manage', 'staff.manage'])).toBe(false)
  })
  it('cashier has any of [orders.manage, promotions.manage]', async () => {
    const { hasAnyPermission } = await import('@/services/permission.service')
    expect(hasAnyPermission('cashier', ['orders.manage', 'promotions.manage'])).toBe(true)
  })
  it('marketing has any of [loyalty.view, staff.view]', async () => {
    const { hasAnyPermission } = await import('@/services/permission.service')
    expect(hasAnyPermission('marketing', ['loyalty.view', 'staff.view'])).toBe(true)
  })
})

// ── P — hasAllPermissions ──────────────────────────────────────────────────────

describe('P — hasAllPermissions', () => {
  it('empty permissions → false', async () => {
    const { hasAllPermissions } = await import('@/services/permission.service')
    expect(hasAllPermissions('owner', [])).toBe(false)
  })
  it('null roles → false', async () => {
    const { hasAllPermissions } = await import('@/services/permission.service')
    expect(hasAllPermissions(null, ['orders.view'])).toBe(false)
  })
  it('owner has all of [tenant.manage, tenant.view]', async () => {
    const { hasAllPermissions } = await import('@/services/permission.service')
    expect(hasAllPermissions('owner', ['tenant.manage', 'tenant.view'])).toBe(true)
  })
  it('admin does NOT have all of [tenant.manage, tenant.view]', async () => {
    const { hasAllPermissions } = await import('@/services/permission.service')
    expect(hasAllPermissions('admin', ['tenant.manage', 'tenant.view'])).toBe(false)
  })
  it('manager has all of [orders.manage, menu.manage, staff.manage]', async () => {
    const { hasAllPermissions } = await import('@/services/permission.service')
    expect(hasAllPermissions('manager', ['orders.manage', 'menu.manage', 'staff.manage'])).toBe(true)
  })
  it('kitchen does NOT have all of [orders.manage, analytics.view]', async () => {
    const { hasAllPermissions } = await import('@/services/permission.service')
    expect(hasAllPermissions('kitchen', ['orders.manage', 'analytics.view'])).toBe(false)
  })
})

// ── Q — hasPermission with featureFlags ───────────────────────────────────────

describe('Q — hasPermission with featureFlags', () => {
  it('owner with ordering.enabled=false denied orders.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'orders.manage', {
      featureFlags: { 'ordering.enabled': false },
    })).toBe(false)
  })
  it('owner with ordering.enabled=true allowed orders.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'orders.manage', {
      featureFlags: { 'ordering.enabled': true },
    })).toBe(true)
  })
  it('manager with promotions.enabled=false denied promotions.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'promotions.manage', {
      featureFlags: { 'promotions.enabled': false },
    })).toBe(false)
  })
  it('marketing with loyalty.enabled=false denied loyalty.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'loyalty.manage', {
      featureFlags: { 'loyalty.enabled': false },
    })).toBe(false)
  })
  it('missing flag key → does not gate (allows through)', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    // analytics has no flag gate in PERMISSION_RESOURCE_FLAG
    expect(hasPermission('owner', 'analytics.view', {
      featureFlags: {},
    })).toBe(true)
  })
  it('reservations.enabled=false denies reservations.manage even for owner', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'reservations.manage', {
      featureFlags: { 'reservations.enabled': false },
    })).toBe(false)
  })
})

// ── R — hasPermission with capabilities ───────────────────────────────────────

describe('R — hasPermission with capabilities', () => {
  it('capability orders=false denies orders.manage for owner', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'orders.manage', {
      capabilities: { orders: false },
    })).toBe(false)
  })
  it('capability orders=true allows orders.manage for owner', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'orders.manage', {
      capabilities: { orders: true },
    })).toBe(true)
  })
  it('capability menu=false denies menu.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'menu.view', {
      capabilities: { menu: false },
    })).toBe(false)
  })
  it('missing capability key → allows through', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'staff.manage', {
      capabilities: {},
    })).toBe(true)
  })
  it('capability loyalty=false denies loyalty.view for marketing', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('marketing', 'loyalty.view', {
      capabilities: { loyalty: false },
    })).toBe(false)
  })
})

// ── S — Combined authorization formula ───────────────────────────────────────

describe('S — Combined Permission + Capability + FeatureFlag', () => {
  it('all three pass → granted', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'orders.manage', {
      capabilities: { orders: true },
      featureFlags: { 'ordering.enabled': true },
    })).toBe(true)
  })
  it('permission fails → denied (no role)', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'orders.manage', {
      capabilities: { orders: true },
      featureFlags: { 'ordering.enabled': true },
    })).toBe(false)
  })
  it('capability fails → denied (even with role + flag)', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'orders.manage', {
      capabilities: { orders: false },
      featureFlags: { 'ordering.enabled': true },
    })).toBe(false)
  })
  it('featureFlag fails → denied (even with role + capability)', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'orders.manage', {
      capabilities: { orders: true },
      featureFlags: { 'ordering.enabled': false },
    })).toBe(false)
  })
  it('both capability and featureFlag fail → denied', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'menu.manage', {
      capabilities: { menu: false },
      featureFlags: { 'menu.enabled': false },
    })).toBe(false)
  })
})

// ── T — UserTenantRole type structure ─────────────────────────────────────────

describe('T — UserTenantRole type structure', () => {
  it('UserTenantRole has userId', () => {
    const assignment: import('@/types/rbac').UserTenantRole = {
      userId: 'u1',
      tenantId: 't1',
      roles: ['owner'],
    }
    expect(assignment.userId).toBe('u1')
  })
  it('UserTenantRole has tenantId', () => {
    const assignment: import('@/types/rbac').UserTenantRole = {
      userId: 'u1',
      tenantId: 'tenant-a',
      roles: ['manager'],
    }
    expect(assignment.tenantId).toBe('tenant-a')
  })
  it('UserTenantRole has roles array', () => {
    const assignment: import('@/types/rbac').UserTenantRole = {
      userId: 'u1',
      tenantId: 't1',
      roles: ['admin', 'manager'],
    }
    expect(assignment.roles).toEqual(['admin', 'manager'])
  })
  it('TenantRoleAssignment has tenantId and roles', () => {
    const a: import('@/types/rbac').TenantRoleAssignment = {
      tenantId: 'tenant-x',
      roles: ['cashier'],
    }
    expect(a.tenantId).toBe('tenant-x')
    expect(a.roles).toContain('cashier')
  })
  it('AuditEvent has required fields', () => {
    const ev: import('@/types/rbac').AuditEvent = {
      permission: 'orders.view',
      granted: true,
      roles: ['manager'],
      timestamp: new Date().toISOString(),
    }
    expect(ev.permission).toBe('orders.view')
    expect(ev.granted).toBe(true)
    expect(ev.timestamp).toBeTruthy()
  })
})

// ── U — Tenant isolation ───────────────────────────────────────────────────────

describe('U — Tenant isolation (multi-tenant roles)', () => {
  it('MOCK_RBAC_USERS includes multi-tenant user', async () => {
    const { MOCK_RBAC_USERS } = await import('@/services/permission.service')
    const multi = MOCK_RBAC_USERS.find((u) => u.id === 'user-multi-01')
    expect(multi).toBeDefined()
    expect(multi!.tenantAssignments).toHaveLength(2)
  })
  it('multi user has manager on tenant A', async () => {
    const { MOCK_RBAC_USERS, MOCK_TENANT_ID } = await import('@/services/permission.service')
    const multi = MOCK_RBAC_USERS.find((u) => u.id === 'user-multi-01')!
    const a = multi.tenantAssignments.find((a) => a.tenantId === MOCK_TENANT_ID)
    expect(a?.roles).toContain('manager')
  })
  it('multi user has cashier on tenant B', async () => {
    const { MOCK_RBAC_USERS, MOCK_TENANT_B_ID } = await import('@/services/permission.service')
    const multi = MOCK_RBAC_USERS.find((u) => u.id === 'user-multi-01')!
    const b = multi.tenantAssignments.find((a) => a.tenantId === MOCK_TENANT_B_ID)
    expect(b?.roles).toContain('cashier')
  })
  it('getMockRoles returns roles for correct tenant', async () => {
    const { getMockRoles, MOCK_TENANT_ID } = await import('@/services/permission.service')
    const roles = getMockRoles('user-multi-01', MOCK_TENANT_ID)
    expect(roles).toContain('manager')
  })
  it('getMockRoles returns different roles for different tenant', async () => {
    const { getMockRoles, MOCK_TENANT_B_ID } = await import('@/services/permission.service')
    const roles = getMockRoles('user-multi-01', MOCK_TENANT_B_ID)
    expect(roles).toContain('cashier')
    expect(roles).not.toContain('manager')
  })
  it('getMockRoles returns [] for unknown user', async () => {
    const { getMockRoles, MOCK_TENANT_ID } = await import('@/services/permission.service')
    expect(getMockRoles('nonexistent', MOCK_TENANT_ID)).toHaveLength(0)
  })
})

// ── V — PermissionGuard source ────────────────────────────────────────────────

describe('V — PermissionGuard component source', () => {
  const src = () =>
    fs.readFileSync(
      path.join(ROOT, 'src/components/auth/PermissionGuard.tsx'),
      'utf8',
    )

  it('file exists', () => {
    expect(() => src()).not.toThrow()
  })
  it('is a client component', () => {
    expect(src()).toContain("'use client'")
  })
  it('exports PermissionGuard', () => {
    expect(src()).toContain('export function PermissionGuard')
  })
  it('accepts permission prop', () => {
    expect(src()).toContain('permission?:')
  })
  it('accepts permissions array prop', () => {
    expect(src()).toContain('permissions?:')
  })
  it('accepts mode prop', () => {
    expect(src()).toContain("mode?:")
  })
  it('accepts fallback prop', () => {
    expect(src()).toContain('fallback?:')
  })
  it('uses usePermission hook', () => {
    expect(src()).toContain('usePermission')
  })
})

// ── W — PermissionGuard props API ──────────────────────────────────────────────

describe('W — PermissionGuard props interface', () => {
  it('PermissionGuardProps has permission field', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/components/auth/PermissionGuard.tsx'),
      'utf8',
    )
    expect(src).toContain('PermissionGuardProps')
    expect(src).toContain('permission?:')
  })
  it('PermissionGuardProps has permissions array field', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/components/auth/PermissionGuard.tsx'),
      'utf8',
    )
    expect(src).toContain('permissions?:')
  })
  it('supports mode any', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/components/auth/PermissionGuard.tsx'),
      'utf8',
    )
    expect(src).toContain("'any'")
  })
  it('supports mode all', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/components/auth/PermissionGuard.tsx'),
      'utf8',
    )
    expect(src).toContain("'all'")
  })
  it('renders SinglePermissionGuard for single permission', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/components/auth/PermissionGuard.tsx'),
      'utf8',
    )
    expect(src).toContain('SinglePermissionGuard')
  })
  it('renders AllPermissionsGuard for mode=all', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/components/auth/PermissionGuard.tsx'),
      'utf8',
    )
    expect(src).toContain('AllPermissionsGuard')
  })
  it('renders AnyPermissionGuard for mode=any', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/components/auth/PermissionGuard.tsx'),
      'utf8',
    )
    expect(src).toContain('AnyPermissionGuard')
  })
})

// ── X — Navigation filtering source ───────────────────────────────────────────

describe('X — Navigation filtering (hooks source)', () => {
  const src = () =>
    fs.readFileSync(path.join(ROOT, 'src/hooks/index.ts'), 'utf8')

  it('hooks file exports usePermissions', () => {
    expect(src()).toContain('export function usePermissions')
  })
  it('hooks file exports usePermission', () => {
    expect(src()).toContain('export function usePermission')
  })
  it('hooks file exports useAnyPermission', () => {
    expect(src()).toContain('export function useAnyPermission')
  })
  it('hooks file exports useAllPermissions', () => {
    expect(src()).toContain('export function useAllPermissions')
  })
  it('usePermission uses useMemo', () => {
    expect(src()).toContain('useMemo')
  })
  it('usePermission reads from useRbacStore', () => {
    expect(src()).toContain('useRbacStore')
  })
  it('usePermission reads featureFlags from useTenantStore', () => {
    expect(src()).toContain('featureFlags')
  })
})

// ── Y — useRbacStore ──────────────────────────────────────────────────────────

describe('Y — useRbacStore', () => {
  afterEach(() => vi.resetModules())

  it('exports useRbacStore from stores', async () => {
    const stores = await import('@/stores')
    expect(typeof stores.useRbacStore).toBe('function')
  })
  it('initial tenantRoles is empty array', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState()._resetStore()
    expect(useRbacStore.getState().tenantRoles).toHaveLength(0)
  })
  it('setTenantRoles adds entry', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState()._resetStore()
    useRbacStore.getState().setTenantRoles('t1', ['manager'])
    expect(useRbacStore.getState().tenantRoles).toHaveLength(1)
  })
  it('setTenantRoles replaces existing entry', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState()._resetStore()
    useRbacStore.getState().setTenantRoles('t1', ['manager'])
    useRbacStore.getState().setTenantRoles('t1', ['cashier'])
    expect(useRbacStore.getState().getRolesForTenant('t1')).toEqual(['cashier'])
  })
  it('getRolesForTenant returns roles for known tenant', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState()._resetStore()
    useRbacStore.getState().setTenantRoles('t1', ['owner'])
    expect(useRbacStore.getState().getRolesForTenant('t1')).toContain('owner')
  })
  it('getRolesForTenant returns [] for unknown tenant', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState()._resetStore()
    expect(useRbacStore.getState().getRolesForTenant('unknown')).toHaveLength(0)
  })
  it('addRole appends without duplicating', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState()._resetStore()
    useRbacStore.getState().setTenantRoles('t1', ['manager'])
    useRbacStore.getState().addRole('t1', 'manager')
    expect(useRbacStore.getState().getRolesForTenant('t1')).toHaveLength(1)
  })
  it('removeRole removes specific role', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState()._resetStore()
    useRbacStore.getState().setTenantRoles('t1', ['manager', 'cashier'])
    useRbacStore.getState().removeRole('t1', 'cashier')
    expect(useRbacStore.getState().getRolesForTenant('t1')).toEqual(['manager'])
  })
  it('clearRoles empties all assignments', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState()._resetStore()
    useRbacStore.getState().setTenantRoles('t1', ['owner'])
    useRbacStore.getState().setTenantRoles('t2', ['admin'])
    useRbacStore.getState().clearRoles()
    expect(useRbacStore.getState().tenantRoles).toHaveLength(0)
  })
  it('multi-tenant: two tenants with different roles', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState()._resetStore()
    useRbacStore.getState().setTenantRoles('tenant-a', ['owner'])
    useRbacStore.getState().setTenantRoles('tenant-b', ['cashier'])
    expect(useRbacStore.getState().getRolesForTenant('tenant-a')).toContain('owner')
    expect(useRbacStore.getState().getRolesForTenant('tenant-b')).toContain('cashier')
    expect(useRbacStore.getState().getRolesForTenant('tenant-b')).not.toContain('owner')
  })
})

// ── Z — Mock infrastructure ───────────────────────────────────────────────────

describe('Z — Mock infrastructure', () => {
  it('MOCK_RBAC_USERS has 9 entries (8 roles + 1 multi-tenant)', async () => {
    const { MOCK_RBAC_USERS } = await import('@/services/permission.service')
    expect(MOCK_RBAC_USERS).toHaveLength(9)
  })
  it('each mock user has id, email, first_name, last_name', async () => {
    const { MOCK_RBAC_USERS } = await import('@/services/permission.service')
    MOCK_RBAC_USERS.forEach((u) => {
      expect(u.id).toBeTruthy()
      expect(u.email).toBeTruthy()
      expect(u.first_name).toBeTruthy()
      expect(u.last_name).toBeTruthy()
    })
  })
  it('each mock user has at least one tenantAssignment', async () => {
    const { MOCK_RBAC_USERS } = await import('@/services/permission.service')
    MOCK_RBAC_USERS.forEach((u) => {
      expect(u.tenantAssignments.length).toBeGreaterThan(0)
    })
  })
  it('owner mock user has owner role', async () => {
    const { MOCK_RBAC_USERS, MOCK_TENANT_ID } = await import('@/services/permission.service')
    const user = MOCK_RBAC_USERS.find((u) => u.id === 'user-owner-01')!
    const a = user.tenantAssignments.find((a) => a.tenantId === MOCK_TENANT_ID)!
    expect(a.roles).toContain('owner')
  })
  it('kitchen mock user has kitchen role', async () => {
    const { MOCK_RBAC_USERS, MOCK_TENANT_ID } = await import('@/services/permission.service')
    const user = MOCK_RBAC_USERS.find((u) => u.id === 'user-kitchen-01')!
    const a = user.tenantAssignments.find((a) => a.tenantId === MOCK_TENANT_ID)!
    expect(a.roles).toContain('kitchen')
  })
  it('auditHooks.subscribe receives events from checkPermission', async () => {
    const { checkPermission, auditHooks } = await import('@/services/permission.service')
    auditHooks._reset()
    const events: import('@/types/rbac').AuditEvent[] = []
    const unsub = auditHooks.subscribe((e) => events.push(e))
    checkPermission('manager', 'orders.manage', { tenantId: 't1', userId: 'u1' })
    unsub()
    expect(events).toHaveLength(1)
    expect(events[0].permission).toBe('orders.manage')
    expect(events[0].granted).toBe(true)
    expect(events[0].tenantId).toBe('t1')
  })
  it('auditHooks.getLog returns emitted events', async () => {
    const { checkPermission, auditHooks } = await import('@/services/permission.service')
    auditHooks._reset()
    checkPermission('kitchen', 'analytics.view')
    const log = auditHooks.getLog()
    expect(log.length).toBeGreaterThan(0)
    expect(log[0].granted).toBe(false)
    auditHooks._reset()
  })
  it('auditHooks.subscribe returns unsubscribe fn', async () => {
    const { checkPermission, auditHooks } = await import('@/services/permission.service')
    auditHooks._reset()
    const events: import('@/types/rbac').AuditEvent[] = []
    const unsub = auditHooks.subscribe((e) => events.push(e))
    unsub()
    checkPermission('owner', 'tenant.manage')
    expect(events).toHaveLength(0)
    auditHooks._reset()
  })
})

// ── Regression: Permission type in types/index.ts ──────────────────────────────

describe('Regression — types/index.ts exports', () => {
  const src = () =>
    fs.readFileSync(path.join(ROOT, 'src/types/index.ts'), 'utf8')

  it('re-exports canonical Role type from rbac (no duplicate definition)', () => {
    expect(src()).toContain('Role,')
    expect(src()).not.toContain('export type Role =')
  })
  it('LegacyPermission is fully retired — no longer exported from types/index.ts (P10.4.12)', () => {
    expect(src()).not.toContain('LegacyPermission')
  })
  it('P7Permission is the single authoritative permission type', () => {
    // The superseded `export type Permission = ...` dot-notation duplicate
    // is gone — types/index.ts re-exports P7Permission from rbac.ts instead.
    expect(src()).not.toContain('export type Permission =')
    expect(src()).toContain('P7Permission')
    const rbacSrc = fs.readFileSync(path.join(ROOT, 'src/types/rbac.ts'), 'utf8')
    expect(rbacSrc).toContain('export type P7Permission')
    expect(rbacSrc).toContain("'orders.view'")
  })
  it('exports UserTenantRole re-export', () => {
    expect(src()).toContain('UserTenantRole')
  })
  it('exports AuditEvent re-export', () => {
    expect(src()).toContain('AuditEvent')
  })
})

// ── Regression: permission.service.ts structure ────────────────────────────────

describe('Regression — permission.service.ts structure', () => {
  const src = () =>
    fs.readFileSync(path.join(ROOT, 'src/services/permission.service.ts'), 'utf8')

  it('exports ROLE_PERMISSION_MAP', () => {
    expect(src()).toContain('export const ROLE_PERMISSION_MAP')
  })
  it('exports ALL_PERMISSIONS', () => {
    expect(src()).toContain('export const ALL_PERMISSIONS')
  })
  it('exports getPermissionsForRole', () => {
    expect(src()).toContain('export function getPermissionsForRole')
  })
  it('exports hasPermission', () => {
    expect(src()).toContain('export function hasPermission')
  })
  it('exports hasAnyPermission', () => {
    expect(src()).toContain('export function hasAnyPermission')
  })
  it('exports hasAllPermissions', () => {
    expect(src()).toContain('export function hasAllPermissions')
  })
  it('exports checkPermission (audit wrapper)', () => {
    expect(src()).toContain('export function checkPermission')
  })
  it('exports auditHooks', () => {
    expect(src()).toContain('export const auditHooks')
  })
  it('exports MOCK_RBAC_USERS', () => {
    expect(src()).toContain('export const MOCK_RBAC_USERS')
  })
  it('no hardcoded role checks (no if role === )', () => {
    // Service functions should derive permissions from map, not switch on role name
    expect(src()).not.toContain("role === 'admin'")
    expect(src()).not.toContain("role === 'owner'")
  })
})
