/**
 * P8.5 — Enterprise RBAC & Permission Management
 *
 * A = Multi-role user: union of permissions
 * B = Override: allow — grant permission beyond role
 * C = Override: deny — revoke permission from role
 * D = Override: combined allow + deny
 * E = resolveEffectivePermissions — detailed breakdown
 * F = applyOverrides — edge cases
 * G = ROLE_TEMPLATES completeness
 * H = PERMISSION_CATEGORIES completeness
 * I = UserPermissionOverride type structure
 * J = BranchRoleAssignment type structure
 * K = EffectivePermissionResult type structure
 * L = useRbacStore P8.5 extensions
 */

import { describe, it, expect, beforeEach } from 'vitest'

// ── A — Multi-role: union of permissions ──────────────────────────────────────

describe('A — Multi-role permission union', () => {
  it('cashier + kitchen → union includes kitchen.view', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    const combined = getPermissionsForRole(['cashier', 'kitchen'])
    expect(combined).toContain('kitchen.view')
  })
  it('cashier + kitchen → union includes payments.process', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    const combined = getPermissionsForRole(['cashier', 'kitchen'])
    expect(combined).toContain('payments.process')
  })
  it('cashier + kitchen → orders.view not duplicated', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    const combined = getPermissionsForRole(['cashier', 'kitchen'])
    expect(combined.filter((p) => p === 'orders.view')).toHaveLength(1)
  })
  it('cashier + kitchen → correct total (union)', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    const cashier = new Set(getPermissionsForRole('cashier'))
    const kitchen = new Set(getPermissionsForRole('kitchen'))
    const union = new Set([...cashier, ...kitchen])
    const combined = getPermissionsForRole(['cashier', 'kitchen'])
    expect(combined).toHaveLength(union.size)
  })
  it('manager + cashier → union includes both payments.refund and staff.manage', async () => {
    const { getPermissionsForRole } = await import('@/services/permission.service')
    const combined = getPermissionsForRole(['manager', 'cashier'])
    expect(combined).toContain('payments.refund')
    expect(combined).toContain('staff.manage')
  })
  it('all 8 roles combined → equals ALL_PERMISSIONS', async () => {
    const { getPermissionsForRole, ALL_PERMISSIONS } = await import('@/services/permission.service')
    const all = getPermissionsForRole(['owner', 'admin', 'manager', 'cashier', 'waiter', 'kitchen', 'marketing', 'support'])
    // owner already has everything, so union = ALL_PERMISSIONS
    expect(all).toHaveLength(ALL_PERMISSIONS.length)
  })
})

// ── B — Override: allow ───────────────────────────────────────────────────────

describe('B — Override: allow (grant beyond role)', () => {
  it('support + allow analytics.view → effective includes analytics.view', async () => {
    const { applyOverrides, getPermissionsForRole } = await import('@/services/permission.service')
    const rolePerms = getPermissionsForRole('support')
    const effective = applyOverrides(rolePerms, { allow: ['analytics.view'], deny: [] })
    expect(effective).toContain('analytics.view')
  })
  it('kitchen + allow payments.process → effective includes payments.process', async () => {
    const { applyOverrides, getPermissionsForRole } = await import('@/services/permission.service')
    const rolePerms = getPermissionsForRole('kitchen')
    const effective = applyOverrides(rolePerms, { allow: ['payments.process'], deny: [] })
    expect(effective).toContain('payments.process')
  })
  it('no override → identical to role permissions', async () => {
    const { applyOverrides, getPermissionsForRole } = await import('@/services/permission.service')
    const rolePerms = getPermissionsForRole('cashier')
    const effective = applyOverrides(rolePerms)
    expect(effective).toHaveLength(rolePerms.length)
  })
  it('allow already-granted permission → no duplication', async () => {
    const { applyOverrides, getPermissionsForRole } = await import('@/services/permission.service')
    const rolePerms = getPermissionsForRole('cashier')
    const effective = applyOverrides(rolePerms, { allow: ['orders.view'], deny: [] })
    expect(effective.filter((p) => p === 'orders.view')).toHaveLength(1)
  })
})

// ── C — Override: deny ────────────────────────────────────────────────────────

describe('C — Override: deny (revoke from role)', () => {
  it('manager + deny staff.manage → effective excludes staff.manage', async () => {
    const { applyOverrides, getPermissionsForRole } = await import('@/services/permission.service')
    const rolePerms = getPermissionsForRole('manager')
    const effective = applyOverrides(rolePerms, { allow: [], deny: ['staff.manage'] })
    expect(effective).not.toContain('staff.manage')
  })
  it('cashier + deny orders.manage → effective excludes orders.manage', async () => {
    const { applyOverrides, getPermissionsForRole } = await import('@/services/permission.service')
    const rolePerms = getPermissionsForRole('cashier')
    const effective = applyOverrides(rolePerms, { allow: [], deny: ['orders.manage'] })
    expect(effective).not.toContain('orders.manage')
  })
  it('deny permission not in role → no-op (still excluded)', async () => {
    const { applyOverrides, getPermissionsForRole } = await import('@/services/permission.service')
    const rolePerms = getPermissionsForRole('kitchen')
    const effective = applyOverrides(rolePerms, { allow: [], deny: ['tenant.manage'] })
    expect(effective).not.toContain('tenant.manage')
    expect(effective).toHaveLength(rolePerms.length)
  })
})

// ── D — Override: combined allow + deny ───────────────────────────────────────

describe('D — Override: combined allow + deny', () => {
  it('deny takes precedence over allow for same permission', async () => {
    const { applyOverrides, getPermissionsForRole } = await import('@/services/permission.service')
    const rolePerms = getPermissionsForRole('support')
    // allow analytics.view AND deny analytics.view → deny wins
    const effective = applyOverrides(rolePerms, {
      allow: ['analytics.view'],
      deny: ['analytics.view'],
    })
    expect(effective).not.toContain('analytics.view')
  })
  it('can grant and revoke simultaneously', async () => {
    const { applyOverrides, getPermissionsForRole } = await import('@/services/permission.service')
    const rolePerms = getPermissionsForRole('cashier')
    const effective = applyOverrides(rolePerms, {
      allow: ['analytics.view', 'staff.view'],
      deny: ['orders.manage'],
    })
    expect(effective).toContain('analytics.view')
    expect(effective).toContain('staff.view')
    expect(effective).not.toContain('orders.manage')
  })
  it('empty override → same as role permissions', async () => {
    const { applyOverrides, getPermissionsForRole } = await import('@/services/permission.service')
    const rolePerms = getPermissionsForRole('marketing')
    const effective = applyOverrides(rolePerms, { allow: [], deny: [] })
    expect(effective).toHaveLength(rolePerms.length)
  })
})

// ── E — resolveEffectivePermissions ───────────────────────────────────────────

describe('E — resolveEffectivePermissions', () => {
  it('returns an entry for every permission in ALL_PERMISSIONS', async () => {
    const { resolveEffectivePermissions, ALL_PERMISSIONS } = await import('@/services/permission.service')
    const results = resolveEffectivePermissions(['cashier'])
    expect(results).toHaveLength(ALL_PERMISSIONS.length)
  })
  it('role-granted permission: fromRole=true, effective=true', async () => {
    const { resolveEffectivePermissions } = await import('@/services/permission.service')
    const results = resolveEffectivePermissions(['cashier'])
    const ordersView = results.find((r) => r.permission === 'orders.view')!
    expect(ordersView.fromRole).toBe(true)
    expect(ordersView.effective).toBe(true)
    expect(ordersView.fromOverride).toBe(false)
    expect(ordersView.denied).toBe(false)
  })
  it('not-granted permission: fromRole=false, effective=false', async () => {
    const { resolveEffectivePermissions } = await import('@/services/permission.service')
    const results = resolveEffectivePermissions(['kitchen'])
    const analytics = results.find((r) => r.permission === 'analytics.view')!
    expect(analytics.fromRole).toBe(false)
    expect(analytics.effective).toBe(false)
  })
  it('allowed override: fromOverride=true, effective=true', async () => {
    const { resolveEffectivePermissions } = await import('@/services/permission.service')
    const results = resolveEffectivePermissions(['support'], { allow: ['analytics.view'], deny: [] })
    const analytics = results.find((r) => r.permission === 'analytics.view')!
    expect(analytics.fromOverride).toBe(true)
    expect(analytics.effective).toBe(true)
    expect(analytics.fromRole).toBe(false)
  })
  it('denied override: denied=true, effective=false', async () => {
    const { resolveEffectivePermissions } = await import('@/services/permission.service')
    const results = resolveEffectivePermissions(['manager'], { allow: [], deny: ['staff.manage'] })
    const staffManage = results.find((r) => r.permission === 'staff.manage')!
    expect(staffManage.denied).toBe(true)
    expect(staffManage.effective).toBe(false)
    expect(staffManage.fromRole).toBe(true)
  })
  it('multi-role: cashier+kitchen → kitchen.view effective', async () => {
    const { resolveEffectivePermissions } = await import('@/services/permission.service')
    const results = resolveEffectivePermissions(['cashier', 'kitchen'])
    const kitchenView = results.find((r) => r.permission === 'kitchen.view')!
    expect(kitchenView.effective).toBe(true)
    expect(kitchenView.fromRole).toBe(true)
  })
})

// ── F — applyOverrides edge cases ─────────────────────────────────────────────

describe('F — applyOverrides edge cases', () => {
  it('undefined override → returns copy of role permissions', async () => {
    const { applyOverrides } = await import('@/services/permission.service')
    const perms = ['orders.view', 'orders.manage'] as const
    const result = applyOverrides(perms, undefined)
    expect(result).toEqual(['orders.view', 'orders.manage'])
  })
  it('empty role permissions + allow → only allow permissions', async () => {
    const { applyOverrides } = await import('@/services/permission.service')
    const result = applyOverrides([], { allow: ['analytics.view'], deny: [] })
    expect(result).toEqual(['analytics.view'])
  })
  it('empty role permissions + deny → still empty', async () => {
    const { applyOverrides } = await import('@/services/permission.service')
    const result = applyOverrides([], { allow: [], deny: ['analytics.view'] })
    expect(result).toHaveLength(0)
  })
})

// ── G — ROLE_TEMPLATES ────────────────────────────────────────────────────────

describe('G — ROLE_TEMPLATES completeness', () => {
  it('has exactly 8 templates (one per role)', async () => {
    const { ROLE_TEMPLATES } = await import('@/services/permission.service')
    expect(ROLE_TEMPLATES).toHaveLength(8)
  })
  it('all templates are system roles', async () => {
    const { ROLE_TEMPLATES } = await import('@/services/permission.service')
    ROLE_TEMPLATES.forEach((t) => expect(t.system).toBe(true))
  })
  it('each template has role, label, description, permissions', async () => {
    const { ROLE_TEMPLATES } = await import('@/services/permission.service')
    ROLE_TEMPLATES.forEach((t) => {
      expect(t.role).toBeTruthy()
      expect(t.label).toBeTruthy()
      expect(t.description).toBeTruthy()
      expect(Array.isArray(t.permissions)).toBe(true)
    })
  })
  it('owner template permissions match ROLE_PERMISSION_MAP.owner', async () => {
    const { ROLE_TEMPLATES, ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    const ownerTemplate = ROLE_TEMPLATES.find((t) => t.role === 'owner')!
    expect(ownerTemplate.permissions).toHaveLength(ROLE_PERMISSION_MAP.owner.length)
  })
  it('includes all 8 roles', async () => {
    const { ROLE_TEMPLATES } = await import('@/services/permission.service')
    const roles = ROLE_TEMPLATES.map((t) => t.role)
    expect(roles).toContain('owner')
    expect(roles).toContain('admin')
    expect(roles).toContain('manager')
    expect(roles).toContain('cashier')
    expect(roles).toContain('waiter')
    expect(roles).toContain('kitchen')
    expect(roles).toContain('marketing')
    expect(roles).toContain('support')
  })
})

// ── H — PERMISSION_CATEGORIES ─────────────────────────────────────────────────

describe('H — PERMISSION_CATEGORIES completeness', () => {
  it('has orders category', async () => {
    const { PERMISSION_CATEGORIES } = await import('@/services/permission.service')
    expect(PERMISSION_CATEGORIES).toHaveProperty('orders')
    expect(PERMISSION_CATEGORIES.orders.permissions).toContain('orders.view')
  })
  it('has payments category', async () => {
    const { PERMISSION_CATEGORIES } = await import('@/services/permission.service')
    expect(PERMISSION_CATEGORIES).toHaveProperty('payments')
    expect(PERMISSION_CATEGORIES.payments.permissions).toContain('payments.process')
  })
  it('has kitchen category', async () => {
    const { PERMISSION_CATEGORIES } = await import('@/services/permission.service')
    expect(PERMISSION_CATEGORIES).toHaveProperty('kitchen')
    expect(PERMISSION_CATEGORIES.kitchen.permissions).toContain('kitchen.view')
  })
  it('all category permissions are valid P7Permissions', async () => {
    const { PERMISSION_CATEGORIES, ALL_PERMISSIONS } = await import('@/services/permission.service')
    const allInCategories = Object.values(PERMISSION_CATEGORIES).flatMap((c) => c.permissions)
    allInCategories.forEach((p) => {
      expect(ALL_PERMISSIONS).toContain(p)
    })
  })
  it('each category has a label', async () => {
    const { PERMISSION_CATEGORIES } = await import('@/services/permission.service')
    Object.values(PERMISSION_CATEGORIES).forEach((cat) => {
      expect(cat.label).toBeTruthy()
    })
  })
})

// ── I — UserPermissionOverride type ───────────────────────────────────────────

describe('I — UserPermissionOverride type structure', () => {
  it('has userId, tenantId, allow, deny fields', () => {
    const override: import('@/types/rbac').UserPermissionOverride = {
      userId: 'u1',
      tenantId: 't1',
      allow: ['analytics.view'],
      deny: ['staff.manage'],
    }
    expect(override.userId).toBe('u1')
    expect(override.tenantId).toBe('t1')
    expect(override.allow).toContain('analytics.view')
    expect(override.deny).toContain('staff.manage')
  })
  it('allow and deny are P7Permission arrays', () => {
    const override: import('@/types/rbac').UserPermissionOverride = {
      userId: 'u2',
      tenantId: 't1',
      allow: ['orders.view', 'kitchen.view'],
      deny: [],
    }
    expect(override.allow).toHaveLength(2)
    expect(override.deny).toHaveLength(0)
  })
})

// ── J — BranchRoleAssignment type ─────────────────────────────────────────────

describe('J — BranchRoleAssignment type structure', () => {
  it('has tenantId, branchId, roles fields', () => {
    const assignment: import('@/types/rbac').BranchRoleAssignment = {
      tenantId: 't1',
      branchId: 'branch-01',
      roles: ['cashier', 'waiter'],
    }
    expect(assignment.tenantId).toBe('t1')
    expect(assignment.branchId).toBe('branch-01')
    expect(assignment.roles).toContain('cashier')
  })
})

// ── K — EffectivePermissionResult type ────────────────────────────────────────

describe('K — EffectivePermissionResult type structure', () => {
  it('has permission, fromRole, fromOverride, denied, effective fields', () => {
    const result: import('@/types/rbac').EffectivePermissionResult = {
      permission: 'orders.view',
      fromRole: true,
      fromOverride: false,
      denied: false,
      effective: true,
    }
    expect(result.permission).toBe('orders.view')
    expect(result.fromRole).toBe(true)
    expect(result.effective).toBe(true)
    expect(result.denied).toBe(false)
  })
})

// ── L — useRbacStore P8.5 extensions ─────────────────────────────────────────

describe('L — useRbacStore P8.5 overrides & branch roles', () => {
  beforeEach(async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState()._resetStore()
  })

  it('initial userOverrides is empty', async () => {
    const { useRbacStore } = await import('@/stores')
    expect(useRbacStore.getState().userOverrides).toHaveLength(0)
  })

  it('setUserOverride adds an override', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState().setUserOverride('u1', 't1', ['analytics.view'], ['staff.manage'])
    expect(useRbacStore.getState().userOverrides).toHaveLength(1)
  })

  it('setUserOverride replaces existing override for same user+tenant', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState().setUserOverride('u1', 't1', ['analytics.view'], [])
    useRbacStore.getState().setUserOverride('u1', 't1', ['orders.view'], ['staff.manage'])
    const overrides = useRbacStore.getState().userOverrides
    expect(overrides).toHaveLength(1)
    expect(overrides[0].allow).toContain('orders.view')
    expect(overrides[0].deny).toContain('staff.manage')
  })

  it('getUserOverride returns override for known user+tenant', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState().setUserOverride('u1', 't1', ['analytics.view'], [])
    const override = useRbacStore.getState().getUserOverride('u1', 't1')
    expect(override).toBeDefined()
    expect(override!.allow).toContain('analytics.view')
  })

  it('getUserOverride returns undefined for unknown user', async () => {
    const { useRbacStore } = await import('@/stores')
    expect(useRbacStore.getState().getUserOverride('unknown', 't1')).toBeUndefined()
  })

  it('clearUserOverride removes the override', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState().setUserOverride('u1', 't1', ['analytics.view'], [])
    useRbacStore.getState().clearUserOverride('u1', 't1')
    expect(useRbacStore.getState().userOverrides).toHaveLength(0)
  })

  it('initial branchRoles is empty', async () => {
    const { useRbacStore } = await import('@/stores')
    expect(useRbacStore.getState().branchRoles).toHaveLength(0)
  })

  it('setBranchRoles adds a branch role assignment', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState().setBranchRoles('t1', 'branch-01', ['cashier'])
    expect(useRbacStore.getState().branchRoles).toHaveLength(1)
  })

  it('getRolesForBranch returns roles for known branch', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState().setBranchRoles('t1', 'branch-01', ['waiter', 'cashier'])
    const roles = useRbacStore.getState().getRolesForBranch('t1', 'branch-01')
    expect(roles).toContain('waiter')
    expect(roles).toContain('cashier')
  })

  it('getRolesForBranch returns [] for unknown branch', async () => {
    const { useRbacStore } = await import('@/stores')
    expect(useRbacStore.getState().getRolesForBranch('t1', 'unknown')).toHaveLength(0)
  })

  it('clearBranchRoles removes branch assignment', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState().setBranchRoles('t1', 'branch-01', ['cashier'])
    useRbacStore.getState().clearBranchRoles('t1', 'branch-01')
    expect(useRbacStore.getState().branchRoles).toHaveLength(0)
  })

  it('_resetStore clears overrides and branchRoles', async () => {
    const { useRbacStore } = await import('@/stores')
    useRbacStore.getState().setUserOverride('u1', 't1', ['analytics.view'], [])
    useRbacStore.getState().setBranchRoles('t1', 'b1', ['cashier'])
    useRbacStore.getState()._resetStore()
    expect(useRbacStore.getState().userOverrides).toHaveLength(0)
    expect(useRbacStore.getState().branchRoles).toHaveLength(0)
  })
})
