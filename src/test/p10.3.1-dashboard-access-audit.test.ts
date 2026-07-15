// P10.3.1 — Enterprise Ownership Enforcement Verification Audit
// Finding: useHasDashboardAccess() (src/hooks/index.ts) is the ACTUAL
// gate AuthGuard uses for the entire /console route tree
// (app/console/layout.tsx: <AuthGuard requiredPermission="dashboard:access">),
// but its Owner/Staff branches were never updated in P10.3 Phase A/B/C to
// call isOwnerEligible()/isStaffMemberEligible()/isTenantEligible().
// resolveOwnerPermissions()/resolveStaffAssignmentPermissions() correctly
// returned zero permissions for an ineligible identity, but the console
// entry gate itself did not consult them — a suspended Owner, a
// suspended/removed Staff member, or anyone on an archived tenant could
// still pass AuthGuard and reach /console. Fixed by wiring the same
// eligibility predicates into useHasDashboardAccess().

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHasDashboardAccess } from '@/hooks'
import { useAuthStore, useTenantStore } from '@/stores'
import { ownerService } from '@/services/owner.service'
import { staffService } from '@/services/staff.service'
import { staffAssignmentService } from '@/services/staff-assignment.service'
import { tenantService } from '@/services/tenant.service'
import type { User } from '@/types'
import type { Tenant } from '@/types'

function userFor(email: string, role: User['role'] = 'customer'): User {
  return {
    id: 'test-user-' + email,
    email,
    first_name: 'Test',
    last_name: 'User',
    role,
    is_verified: true,
    created_at: new Date().toISOString(),
  }
}

async function tenantById(id: string): Promise<Tenant> {
  const tenants = await tenantService.getTenants()
  const tenant = tenants.find((t) => t.id === id)
  if (!tenant) throw new Error(`Tenant not found in fixtures: ${id}`)
  return tenant
}

beforeEach(() => {
  ownerService._resetMockStore()
  staffService._resetMockStore()
  staffAssignmentService._resetMockStore()
  tenantService._resetMockList()
  useAuthStore.getState().setUser(null)
})

describe('P10.3.1 — useHasDashboardAccess honors Owner/Staff/Tenant eligibility (AuthGuard /console gate)', () => {
  it('grants access to an active Owner of the active tenant', async () => {
    const samoon = await tenantById('tenant-samoon-01')
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('owner@samoon.com', 'customer'))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)
  })

  it('denies access to a SUSPENDED Owner of a tenant they structurally own (owner-004 / road-bites)', async () => {
    const roadBites = await tenantById('tenant-road-bites-01')
    useTenantStore.getState().setTenant(roadBites)
    useAuthStore.getState().setUser(userFor('owner@roadbites.com', 'customer'))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(false)
  })

  it('denies access when the active tenant is archived, even for its real Owner', async () => {
    await tenantService.archiveTenant('tenant-samoon-01')
    const samoon = await tenantById('tenant-samoon-01')
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('owner@samoon.com', 'customer'))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(false)
  })

  it('grants access to an active Staff member holding an effective assignment', async () => {
    const samoon = await tenantById('tenant-samoon-01')
    useTenantStore.getState().setTenant(samoon)
    // accountant@samoon.com (staff-accountant-01) has effective assignments
    // and no matching legacy MOCK_CREDENTIALS entry, so this exercises the
    // Staff branch specifically, not the legacyGranted short-circuit.
    useAuthStore.getState().setUser(userFor('accountant@samoon.com', 'customer'))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)
  })
})

// ============================================================
// Issue investigation fix — real-backend role fallback.
//
// staffService.findStaffMemberByEmail() / ownerService.getOwnerByUserIdSync()
// are hard-gated `if (!USE_MOCK) return undefined`, so in real-backend mode
// resolveOwnershipIdentity() always returns `{}` regardless of the email
// queried. An email with no matching mock fixture reproduces exactly that
// "identity not found" state from useHasDashboardAccess()'s point of view,
// without needing to flip NEXT_PUBLIC_USE_MOCK (which is read once at
// module load and can't be toggled mid-test-run) — so these tests use
// emails that are guaranteed absent from the mock Owner/Staff fixtures to
// exercise the same code path a real production user hits.
// ============================================================
describe('P10.3.1 fix — real-backend role fallback in useHasDashboardAccess()', () => {
  it('grants access to a real-backend admin with no matching mock identity', async () => {
    const samoon = await tenantById('tenant-samoon-01')
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('real-admin@production.example', 'admin'))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)
  })

  it('grants access to a real-backend owner with no matching mock identity', async () => {
    const samoon = await tenantById('tenant-samoon-01')
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('real-owner@production.example', 'owner'))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)
  })

  it('grants access to a real-backend staff member with no matching mock identity', async () => {
    const samoon = await tenantById('tenant-samoon-01')
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('real-staff@production.example', 'staff'))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)
  })

  it('denies access to a real-backend customer with no matching mock identity', async () => {
    const samoon = await tenantById('tenant-samoon-01')
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('real-customer@production.example', 'customer'))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(false)
  })

  it('role fallback is case-insensitive', async () => {
    const samoon = await tenantById('tenant-samoon-01')
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('real-admin-caps@production.example', 'ADMIN' as User['role']))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)
  })
})