// ============================================================
// Phase 9.2 — Identity/RBAC/Branch data-model preparation
//
// This phase adds `TenantMembership`/`BranchAccess` types and extends
// `CurrentTenantSession` with `branchAccess`, WITHOUT changing any
// permission string, ROLE_PERMISSION_MAP entry, override evaluation
// order, AuthGuard behavior, tenant resolution flow, branch store
// behavior, or Console UI. `normalizeTenantPermissions()` now accepts
// either the legacy flat-`tenantRoles` shape or the new tenant-mapped
// `memberships`/`activeMembership` shape (see docs/ Phase 9 architecture
// doc) and always resolves both to the same `CurrentTenantSession` shape.
//
// No backend sends the new `memberships` shape yet — this file proves
// the frontend is ready for it without breaking what already works.
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest'
import { normalizeTenantPermissions, resolveBranchAccess, getPermissionsForRole } from '@/services/permission.service'
import { useRbacStore } from '@/stores'
import type { TenantMembership } from '@/types/rbac'

beforeEach(() => {
  useRbacStore.getState()._resetStore()
})

describe('Phase 9.2 — normalizeTenantPermissions(): legacy tenantRoles shape', () => {
  it('{ tenantRoles: ["manager"] } resolves roles/permissions unchanged and a safe branchAccess fallback', () => {
    const result = normalizeTenantPermissions({ tenantRoles: ['manager'] })
    expect(result.roles).toEqual(['manager'])
    expect(result.permissions).toEqual([...getPermissionsForRole(['manager'])])
    expect(result.branchAccess).toEqual({ scope: 'selected', branchIds: [] })
  })

  it('{ roles: ["owner"] } resolves branchAccess to { scope: "all" } — the owner exception', () => {
    const result = normalizeTenantPermissions({ roles: ['owner'] })
    expect(result.roles).toEqual(['owner'])
    expect(result.branchAccess).toEqual({ scope: 'all' })
  })

  it('bare Role[] array shorthand (existing call convention) keeps working and gets the same safe fallback', () => {
    const result = normalizeTenantPermissions(['cashier'])
    expect(result.roles).toEqual(['cashier'])
    expect(result.permissions).toEqual([...getPermissionsForRole(['cashier'])])
    expect(result.branchAccess).toEqual({ scope: 'selected', branchIds: [] })
  })

  it('the bare-array owner shorthand also gets { scope: "all" }', () => {
    expect(normalizeTenantPermissions(['owner']).branchAccess).toEqual({ scope: 'all' })
  })

  it('p7Roles (login/register/verify-otp field name) is still honored identically to tenantRoles', () => {
    const result = normalizeTenantPermissions({ p7Roles: ['waiter'] })
    expect(result.roles).toEqual(['waiter'])
    expect(result.branchAccess).toEqual({ scope: 'selected', branchIds: [] })
  })

  it('no roles at all (undefined response) resolves to empty roles/permissions and the safe fallback, never a crash', () => {
    const result = normalizeTenantPermissions(undefined)
    expect(result.roles).toEqual([])
    expect(result.permissions).toEqual([])
    expect(result.branchAccess).toEqual({ scope: 'selected', branchIds: [] })
  })
})

describe('Phase 9.2 — normalizeTenantPermissions(): new memberships/activeMembership shape', () => {
  it('a single membership in the array is selected unambiguously and its own branchAccess is trusted as-is', () => {
    const memberships: TenantMembership[] = [
      { tenantId: 'tenant-1', roles: ['manager'], branchAccess: { scope: 'selected', branchIds: ['branch-a'] } },
    ]
    const result = normalizeTenantPermissions({ memberships })
    expect(result.tenantId).toBe('tenant-1')
    expect(result.roles).toEqual(['manager'])
    expect(result.permissions).toEqual([...getPermissionsForRole(['manager'])])
    expect(result.branchAccess).toEqual({ scope: 'selected', branchIds: ['branch-a'] })
  })

  it('activeMembership takes priority over scanning the memberships list', () => {
    const memberships: TenantMembership[] = [
      { tenantId: 'tenant-1', roles: ['waiter'], branchAccess: { scope: 'selected', branchIds: ['branch-a'] } },
      { tenantId: 'tenant-2', roles: ['owner'], branchAccess: { scope: 'all' } },
    ]
    const activeMembership = memberships[1]
    const result = normalizeTenantPermissions({ memberships, activeMembership })
    expect(result.tenantId).toBe('tenant-2')
    expect(result.roles).toEqual(['owner'])
    expect(result.branchAccess).toEqual({ scope: 'all' })
  })

  it('currentTenantId disambiguates a multi-membership list when no activeMembership is sent', () => {
    const memberships: TenantMembership[] = [
      { tenantId: 'tenant-1', roles: ['waiter'], branchAccess: { scope: 'selected', branchIds: ['branch-a'] } },
      { tenantId: 'tenant-2', roles: ['owner'], branchAccess: { scope: 'all' } },
    ]
    const result = normalizeTenantPermissions({ memberships }, 'tenant-1')
    expect(result.tenantId).toBe('tenant-1')
    expect(result.roles).toEqual(['waiter'])
    expect(result.branchAccess).toEqual({ scope: 'selected', branchIds: ['branch-a'] })
  })

  it('an ambiguous multi-membership list with no activeMembership and no matching currentTenantId denies by default (never guesses)', () => {
    const memberships: TenantMembership[] = [
      { tenantId: 'tenant-1', roles: ['waiter'], branchAccess: { scope: 'selected', branchIds: ['branch-a'] } },
      { tenantId: 'tenant-2', roles: ['owner'], branchAccess: { scope: 'all' } },
    ]
    const result = normalizeTenantPermissions({ memberships })
    expect(result.roles).toEqual([])
    expect(result.permissions).toEqual([])
    expect(result.branchAccess).toEqual({ scope: 'selected', branchIds: [] })
  })

  it('an empty memberships array resolves to zero access, not a crash and not a fallback to legacy fields', () => {
    const result = normalizeTenantPermissions({ memberships: [], tenantRoles: ['owner'] })
    // memberships (even empty) takes priority over legacy tenantRoles — a
    // backend that sends both must not have the legacy field silently
    // rescue an intentionally-empty membership list.
    expect(result.roles).toEqual([])
    expect(result.branchAccess).toEqual({ scope: 'selected', branchIds: [] })
  })

  it('a membership with roles:["owner"] but missing/malformed branchAccess still resolves to { scope: "all" }', () => {
    const memberships = [
      { tenantId: 'tenant-1', roles: ['owner'] } as unknown as TenantMembership,
    ]
    const result = normalizeTenantPermissions({ memberships })
    expect(result.branchAccess).toEqual({ scope: 'all' })
  })
})

describe('Phase 9.2 — resolveBranchAccess()', () => {
  it('returns an explicit valid "all" value unchanged', () => {
    expect(resolveBranchAccess({ scope: 'all' }, ['manager'])).toEqual({ scope: 'all' })
  })

  it('returns an explicit valid "selected" value, including an empty branchIds array', () => {
    expect(resolveBranchAccess({ scope: 'selected', branchIds: [] }, ['waiter'])).toEqual({ scope: 'selected', branchIds: [] })
    expect(resolveBranchAccess({ scope: 'selected', branchIds: ['b1', 'b2'] }, ['waiter'])).toEqual({ scope: 'selected', branchIds: ['b1', 'b2'] })
  })

  it('normalizes legacy "assigned" scope to "selected"', () => {
    expect(resolveBranchAccess({ scope: 'assigned', branchIds: ['b1'] }, ['waiter'])).toEqual({ scope: 'selected', branchIds: ['b1'] })
  })

  it('derives branchIds from membership.branches when scope is selected without branchIds', () => {
    const branches = [{ id: 'b1', name: 'One', slug: 'one', status: 'active' as const }]
    expect(resolveBranchAccess({ scope: 'selected' }, ['waiter'], branches)).toEqual({ scope: 'selected', branchIds: ['b1'] })
  })

  it('a missing value falls back to safe-deny for a non-owner role', () => {
    expect(resolveBranchAccess(undefined, ['cashier'])).toEqual({ scope: 'selected', branchIds: [] })
    expect(resolveBranchAccess(null, ['kitchen'])).toEqual({ scope: 'selected', branchIds: [] })
  })

  it('a missing value falls back to { scope: "all" } specifically for owner', () => {
    expect(resolveBranchAccess(undefined, ['owner'])).toEqual({ scope: 'all' })
  })

  it('a malformed "assigned" value (branchIds not an array) is rejected and falls back, same as missing', () => {
    const malformed = { scope: 'selected', branchIds: 'not-an-array' } as unknown as import('@/types/rbac').BranchAccess
    expect(resolveBranchAccess(malformed, ['manager'])).toEqual({ scope: 'selected', branchIds: [] })
  })

  it('owner combined with other roles still resolves to "all" (most-permissive-role-wins for scope)', () => {
    expect(resolveBranchAccess(undefined, ['waiter', 'owner'])).toEqual({ scope: 'all' })
  })
})

describe('Phase 9.2 — useRbacStore.setCurrentTenantSession(): backward-compatible 3-arg form still works', () => {
  it('omitting branchAccess computes a safe default from roles (existing 3-arg call sites keep working)', () => {
    useRbacStore.getState().setCurrentTenantSession('tenant-x', ['manager'], [...getPermissionsForRole(['manager'])])
    const session = useRbacStore.getState().currentTenantSession
    expect(session?.tenantId).toBe('tenant-x')
    expect(session?.branchAccess).toEqual({ scope: 'selected', branchIds: [] })
  })

  it('omitting branchAccess for an owner session still resolves to { scope: "all" }', () => {
    useRbacStore.getState().setCurrentTenantSession('tenant-x', ['owner'], [...getPermissionsForRole(['owner'])])
    expect(useRbacStore.getState().currentTenantSession?.branchAccess).toEqual({ scope: 'all' })
  })

  it('an explicit 4th-arg branchAccess is stored as given', () => {
    useRbacStore.getState().setCurrentTenantSession(
      'tenant-x',
      ['waiter'],
      [...getPermissionsForRole(['waiter'])],
      { scope: 'selected', branchIds: ['branch-9'] },
    )
    expect(useRbacStore.getState().currentTenantSession?.branchAccess).toEqual({ scope: 'selected', branchIds: ['branch-9'] })
  })

  it('an explicit but malformed 4th-arg branchAccess does not silently corrupt the session — falls back safely', () => {
    const malformed = { scope: 'selected' } as unknown as import('@/types/rbac').BranchAccess
    useRbacStore.getState().setCurrentTenantSession('tenant-x', ['cashier'], [...getPermissionsForRole(['cashier'])], malformed)
    expect(useRbacStore.getState().currentTenantSession?.branchAccess).toEqual({ scope: 'selected', branchIds: [] })
  })
})
