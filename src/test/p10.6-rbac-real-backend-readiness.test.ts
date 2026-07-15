// ============================================================
// P10.6 — RBAC Real Backend Readiness Implementation Audit & Preparation
//
// Phase G — feature-flag gate consistency across usePermission()/
// useAnyPermission()/useAllPermissions(). P10.5.5 documented that only
// usePermission() applied the per-resource feature-flag gate; the other
// two silently ignored it despite claiming otherwise in their JSDoc.
// src/hooks/index.ts now shares a single isPermissionFeatureFlagGated()
// helper across all three. This file proves the fix and that it doesn't
// change any currently-passing behavior when flags are enabled.
//
// Phase H — Security tests:
//   - LocalStorage tampering: documents the CURRENT (unmitigated) state —
//     useRbacStore persists tenantRoles/userOverrides to localStorage with
//     no partialize, so a tampered value is trusted verbatim on rehydrate.
//     This is a deliberate trip-wire test: it will start FAILING the day a
//     future phase adds partialize/backend-sync, which is the intended
//     signal that docs/P10.6_RBAC_REAL_BACKEND_MIGRATION_PLAN.md Phase C
//     migration has landed and this test's assertions must flip.
//   - Missing backend RBAC payload: login/session-restore with no
//     tenantRoles data must not crash usePermissions() or
//     useHasDashboardAccess() — it must fall back cleanly to whatever
//     Ownership/StaffAssignment resolution can independently establish.
//   - Suspended Staff: revoking a StaffAssignment removes console access
//     immediately (no stale grant).
//   - Archived Tenant: an archived tenant denies a Staff member's console
//     access exactly as it already does for an Owner (P10.3.1 covers the
//     Owner case; this file adds the Staff case, which was not yet
//     covered by any existing test).
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
import { ownerService } from '@/services/owner.service'
import { staffService } from '@/services/staff.service'
import { staffAssignmentService } from '@/services/staff-assignment.service'
import { tenantService } from '@/services/tenant.service'
import { resolveOwnershipIdentity } from '@/services/ownership-resolution.service'
import type { User, Tenant } from '@/types'

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

beforeEach(() => {
  ownerService._resetMockStore()
  staffService._resetMockStore()
  staffAssignmentService._resetMockStore()
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
    useTenantStore.getState().setFeatureFlags({ 'ordering.enabled': false })

    const { result } = renderHook(() => usePermission('orders.view'))
    expect(result.current).toBe(false)
  })

  it('useAnyPermission now also denies when the only matching permission is feature-flag gated off', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('owner@samoon.com'))
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
    useTenantStore.getState().setFeatureFlags({ 'ordering.enabled': false })

    const { result } = renderHook(() => useAllPermissions(['orders.view', 'staff.manage']))
    expect(result.current).toBe(false)
  })

  it('useAnyPermission still grants when a flag-gated permission is denied but another passes', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('owner@samoon.com'))
    useTenantStore.getState().setFeatureFlags({ 'ordering.enabled': false })

    const { result } = renderHook(() => useAnyPermission(['orders.view', 'staff.manage']))
    expect(result.current).toBe(true)
  })

  it('all three hooks agree when no feature flag is disabled (no regression for the common case)', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('owner@samoon.com'))

    const { result: single } = renderHook(() => usePermission('orders.view'))
    const { result: any } = renderHook(() => useAnyPermission(['orders.view']))
    const { result: all } = renderHook(() => useAllPermissions(['orders.view']))
    expect(single.current).toBe(true)
    expect(any.current).toBe(true)
    expect(all.current).toBe(true)
  })
})

// ── Phase H — Security tests ────────────────────────────────────────────────

describe('P10.6 Phase H — LocalStorage tampering (documents current unmitigated risk)', () => {
  it('a directly-tampered tenantRoles entry IS currently trusted by usePermissions() (no server re-validation exists yet)', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('nobody@example.com'))

    // Simulate what a devtools-tampered `samoon-rbac` localStorage value
    // would rehydrate into: this is exactly what setTenantRoles() does at
    // login, but here it models an attacker-authored entry, not a real
    // login response — see docs/P10.5.5_RBAC_REAL_MODE_SECURITY.md §3.
    act(() => {
      useRbacStore.getState().setTenantRoles(samoon.id, ['owner'])
    })

    const { result } = renderHook(() => usePermissions())
    // 'nobody@example.com' has no Owner/StaffAssignment record at all, so
    // every permission in this result can ONLY have come from the
    // tampered tenantRoles entry — proving it is currently authoritative.
    expect(result.current).toContain('tenant.manage')
    expect(result.current.length).toBeGreaterThan(0)

    const identity = resolveOwnershipIdentity('nobody@example.com')
    expect(identity.owner).toBeUndefined()
    expect(identity.staffMember).toBeUndefined()
  })
})

describe('P10.6 Phase H — Missing backend RBAC payload', () => {
  it('usePermissions() does not throw and resolves to an empty/ownership-only set when tenantRoles was never populated', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    // Simulate a real-mode login/session-restore response with no RBAC
    // data at all (docs/P10.5.5_RBAC_REAL_MODE_SECURITY.md §4) — a
    // customer-role user with zero StaffAssignment/Owner record.
    useAuthStore.getState().setUser(customerRoleUserFor('nobody@example.com'))
    expect(useRbacStore.getState().tenantRoles).toEqual([])

    const { result } = renderHook(() => usePermissions())
    expect(() => result.current).not.toThrow()
    expect(result.current).toEqual([])
  })

  it('useHasDashboardAccess() falls back cleanly to false (not a crash) with no RBAC payload and no Owner/Staff record', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('nobody@example.com'))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(false)
  })

  it('useHasDashboardAccess() still grants access via Ownership/StaffAssignment even with zero tenantRoles (proves sources are independent)', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('owner@samoon.com'))
    expect(useRbacStore.getState().tenantRoles).toEqual([])

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)
  })
})

describe('P10.6 Phase H — Suspended Staff (StaffAssignment revoked)', () => {
  it('revoking cashier@samoon.com\'s StaffAssignment removes console access immediately', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('cashier@samoon.com'))

    const before = renderHook(() => useHasDashboardAccess())
    expect(before.result.current).toBe(true)

    const identity = resolveOwnershipIdentity('cashier@samoon.com')
    expect(identity.staffMember).toBeTruthy()
    const [assignment] = staffAssignmentService.getEffectiveAssignments(identity.staffMember!.id)
    expect(assignment).toBeTruthy()

    await staffAssignmentService.revoke(assignment.assignmentId, { revokedBy: 'test-admin' })

    expect(
      staffAssignmentService.getEffectiveAssignments(identity.staffMember!.id).length,
    ).toBe(0)

    const after = renderHook(() => useHasDashboardAccess())
    expect(after.result.current).toBe(false)
  })
})

describe('P10.6 Phase H — Archived Tenant (Staff case)', () => {
  it('an active Staff member loses console access when the active tenant becomes archived', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('cashier@samoon.com'))

    const before = renderHook(() => useHasDashboardAccess())
    expect(before.result.current).toBe(true)

    const archived: Tenant = { ...samoon, status: 'archived' as Tenant['status'] }
    act(() => {
      useTenantStore.getState().setTenant(archived)
    })

    const after = renderHook(() => useHasDashboardAccess())
    expect(after.result.current).toBe(false)
  })
})
