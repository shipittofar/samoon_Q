// ============================================================
// Phase Z.7 — activeMembership as a minimal pointer, not a full record
//
// Bug report: a business owner/admin with a real tenant membership
// (roles: ["owner", "admin"], branchAccess: {scope: "all"}) saw
// Console access denied. Root cause: the real /auth/me/ contract sends
// `activeMembership` as a minimal selector — `{ tenantId }` only — while
// `normalizeTenantPermissions()`'s `selectActiveMembership()` trusted it
// as a complete `TenantMembership` record. `selected.roles` was
// `undefined`, `getPermissionsForRole(undefined)` returned `[]`, and
// `dashboard:access` was denied despite `memberships[0]` holding the
// real roles.
//
// Fix: `activeMembership` now only supplies which tenantId is active;
// the actual roles/branchAccess always come from the matching entry in
// `memberships`. This file proves the exact reported payload shape now
// grants Console access, and that the prior (full-record activeMembership)
// shape still works unchanged.
// ============================================================
import { describe, it, expect } from 'vitest'
import { normalizeTenantPermissions } from '@/services/permission.service'
import type { TenantMembership } from '@/types/rbac'

describe('Phase Z.7 — activeMembership pointer-only shape', () => {
  it('reproduces the exact reported bug payload: activeMembership = { tenantId } only', () => {
    const tenantId = 'af09e508-0ea1-413d-8eee-24a02403ba0c'
    const memberships: TenantMembership[] = [
      {
        tenantId,
        tenantSlug: '2cum17xs',
        roles: ['owner', 'admin'],
        branchAccess: { scope: 'all' },
      },
    ]
    const activeMembership = { tenantId } as TenantMembership // backend sends no roles/branchAccess

    const { roles, permissions, branchAccess } = normalizeTenantPermissions(
      { memberships, activeMembership },
      tenantId,
    )

    expect(roles).toEqual(['owner', 'admin'])
    expect(branchAccess).toEqual({ scope: 'all' })
    expect(permissions).toContain('dashboard:access')
  })

  it('a business accountType user with this payload would pass usePermission("dashboard:access") — permissions are non-empty and include it', () => {
    const tenantId = 'tenant-business-01'
    const memberships: TenantMembership[] = [
      { tenantId, roles: ['admin'], branchAccess: { scope: 'all' } },
    ]
    const { permissions } = normalizeTenantPermissions(
      { memberships, activeMembership: { tenantId } as TenantMembership },
      tenantId,
    )
    expect(permissions.length).toBeGreaterThan(0)
    expect(permissions).toContain('dashboard:access')
  })

  it('still works when activeMembership is already a full record (backward compatible)', () => {
    const tenantId = 'tenant-full-01'
    const full: TenantMembership = { tenantId, roles: ['manager'], branchAccess: { scope: 'assigned', branchIds: ['b1'] } }
    const memberships: TenantMembership[] = [full]
    const { roles, branchAccess } = normalizeTenantPermissions({ memberships, activeMembership: full }, tenantId)
    expect(roles).toEqual(['manager'])
    expect(branchAccess).toEqual({ scope: 'assigned', branchIds: ['b1'] })
  })

  it('activeMembership pointing at a tenantId absent from memberships falls back to currentTenantId, never fabricates roles', () => {
    const memberships: TenantMembership[] = [
      { tenantId: 'tenant-a', roles: ['owner'], branchAccess: { scope: 'all' } },
    ]
    const { roles } = normalizeTenantPermissions(
      { memberships, activeMembership: { tenantId: 'tenant-ghost' } as TenantMembership },
      'tenant-a',
    )
    expect(roles).toEqual(['owner'])
  })

  it('multiple memberships, activeMembership pointer selects the correct one by tenantId', () => {
    const memberships: TenantMembership[] = [
      { tenantId: 'tenant-a', roles: ['cashier'], branchAccess: { scope: 'all' } },
      { tenantId: 'tenant-b', roles: ['owner', 'admin'], branchAccess: { scope: 'all' } },
    ]
    const { roles } = normalizeTenantPermissions(
      { memberships, activeMembership: { tenantId: 'tenant-b' } as TenantMembership },
      'tenant-a', // currentTenantId deliberately mismatched — activeMembership must win
    )
    expect(roles).toEqual(['owner', 'admin'])
  })
})
