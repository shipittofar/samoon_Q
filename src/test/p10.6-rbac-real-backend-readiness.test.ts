// ============================================================
// P10.6 — RBAC Real Backend Readiness (Phase 2 rewrite)
//
// Phase 2 (RBAC unification) changed the authorization read path
// fundamentally: usePermission()/useAnyPermission()/useAllPermissions()/
// usePermissions()/useHasDashboardAccess() now read exclusively from
// useRbacStore.currentTenantSession, which is never persisted to
// localStorage and is not derived from Owner/StaffAssignment data. This
// file's original Phase H "localStorage tampering is currently trusted"
// trip-wire has flipped from a documented risk into the actual mitigation
// — reflected below. The Suspended-Staff/Archived-Tenant scenarios that
// depended on StaffAssignment revocation for console access no longer
// apply (that engine has no runtime callers), so console access now
// depends only on `currentTenantSession`/tenant state as tested here.
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  usePermission,
  useAnyPermission,
  useAllPermissions,
  usePermissions,
  useHasDashboardAccess,
} from '@/hooks'
import { useAuthStore, useTenantStore, useRbacStore } from '@/stores'
import { tenantService } from '@/services/tenant.service'
import { normalizeTenantPermissions } from '@/services/permission.service'
import type { User, Tenant } from '@/types'
import type { Role } from '@/types/rbac'

function customerRoleUserFor(email: string): User {
  return {
    id: 'test-user-' + email,
    email,
    first_name: 'Test',
    last_name: 'User',
    role: 'customer',
    is_verified: true,
    created_at: new Date().toISOString(),
  }
}

async function samoonTenant(): Promise<Tenant> {
  const tenants = await tenantService.getTenants()
  const tenant = tenants.find((t) => t.id === 'tenant-samoon-01')
  if (!tenant) throw new Error('tenant-samoon-01 not found in fixtures')
  return tenant
}

function seedSession(tenantId: string, roles: Role[]) {
  const { permissions } = normalizeTenantPermissions(roles)
  act(() => {
    useRbacStore.getState().setCurrentTenantSession(tenantId, roles, permissions)
  })
}

beforeEach(() => {
  tenantService._resetMockList()
  useAuthStore.getState().setUser(null)
  useRbacStore.getState()._resetStore()
  useTenantStore.getState().setFeatureFlags({})
})

// ── Phase G — feature-flag gate consistency ────────────────────────────────

describe('P10.6 Phase G — usePermission/useAnyPermission/useAllPermissions share the feature-flag gate', () => {
  it('usePermission denies a permission whose feature flag is off (baseline, unchanged)', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('owner@samoon.com'))
    seedSession(samoon.id, ['owner'])
    useTenantStore.getState().setFeatureFlags({ 'ordering.enabled': false })

    const { result } = renderHook(() => usePermission('orders.view'))
    expect(result.current).toBe(false)
  })

  it('useAnyPermission now also denies when the only matching permission is feature-flag gated off', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('owner@samoon.com'))
    seedSession(samoon.id, ['owner'])
    useTenantStore.getState().setFeatureFlags({ 'ordering.enabled': false })

    const { result: permsResult } = renderHook(() => usePermissions())
    expect(permsResult.current).toContain('orders.view')

    const { result } = renderHook(() => useAnyPermission(['orders.view']))
    expect(result.current).toBe(false)
  })

  it('useAllPermissions now also denies when one of the required permissions is feature-flag gated off', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('owner@samoon.com'))
    seedSession(samoon.id, ['owner'])
    useTenantStore.getState().setFeatureFlags({ 'ordering.enabled': false })

    const { result } = renderHook(() => useAllPermissions(['orders.view', 'staff.manage']))
    expect(result.current).toBe(false)
  })

  it('useAnyPermission still grants when a flag-gated permission is denied but another passes', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('owner@samoon.com'))
    seedSession(samoon.id, ['owner'])
    useTenantStore.getState().setFeatureFlags({ 'ordering.enabled': false })

    const { result } = renderHook(() => useAnyPermission(['orders.view', 'staff.manage']))
    expect(result.current).toBe(true)
  })

  it('all three hooks agree when no feature flag is disabled (no regression for the common case)', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('owner@samoon.com'))
    seedSession(samoon.id, ['owner'])

    const { result: single } = renderHook(() => usePermission('orders.view'))
    const { result: any } = renderHook(() => useAnyPermission(['orders.view']))
    const { result: all } = renderHook(() => useAllPermissions(['orders.view']))
    expect(single.current).toBe(true)
    expect(any.current).toBe(true)
    expect(all.current).toBe(true)
  })
})

// ── Phase H — Security tests (rewritten for the single-source model) ───────

describe('P10.6 Phase H — currentTenantSession is not persisted, so tampering the persisted tenantRoles no longer grants permissions', () => {
  it('a tampered legacy tenantRoles entry is NOT trusted by usePermissions() — currentTenantSession is the only read path', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('nobody@example.com'))

    // Simulate a devtools-tampered `samoon-rbac` localStorage value landing
    // in the legacy tenantRoles map (still persisted, out of Phase 2 scope)
    // WITHOUT going through setCurrentTenantSession — this is exactly what
    // an attacker could still write, and it must have zero effect on any
    // permission decision.
    act(() => {
      useRbacStore.getState().setTenantRoles(samoon.id, ['owner'])
    })

    const { result } = renderHook(() => usePermissions())
    expect(result.current).toEqual([])
  })
})

describe('P10.6 Phase H — Missing backend RBAC payload', () => {
  it('usePermissions() does not throw and resolves to an empty set when currentTenantSession was never populated', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('nobody@example.com'))
    expect(useRbacStore.getState().currentTenantSession).toBeNull()

    const { result } = renderHook(() => usePermissions())
    expect(() => result.current).not.toThrow()
    expect(result.current).toEqual([])
  })

  it('useHasDashboardAccess() falls back cleanly to false (not a crash) with no currentTenantSession', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('nobody@example.com'))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(false)
  })

  it('useHasDashboardAccess() grants access once currentTenantSession is seeded, with no other data source involved', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('owner@samoon.com'))
    seedSession(samoon.id, ['owner'])

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)
  })
})

describe('P10.6 Phase H — tenant switch clears the previous session (no stale grant)', () => {
  it('clearing currentTenantSession removes console access immediately', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('cashier@samoon.com'))
    seedSession(samoon.id, ['cashier'])

    const before = renderHook(() => useHasDashboardAccess())
    expect(before.result.current).toBe(true)

    act(() => {
      useRbacStore.getState().clearCurrentTenantSession()
    })

    const after = renderHook(() => useHasDashboardAccess())
    expect(after.result.current).toBe(false)
  })
})

describe('P10.6 Phase H — Archived Tenant', () => {
  it('an active session grants access, but switching the active tenant to one with no matching session denies it', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('cashier@samoon.com'))
    seedSession(samoon.id, ['cashier'])

    const before = renderHook(() => useHasDashboardAccess())
    expect(before.result.current).toBe(true)

    const archived: Tenant = { ...samoon, id: 'tenant-archived-different', status: 'archived' as Tenant['status'] }
    act(() => {
      useTenantStore.getState().setTenant(archived)
    })

    const after = renderHook(() => useHasDashboardAccess())
    expect(after.result.current).toBe(false)
  })
})
