// ============================================================
// P10.4.10 — Remove Legacy Dashboard Access Fallback (legacyGranted)
//
// useHasDashboardAccess() (src/hooks/index.ts) previously computed:
//   legacyGranted || ownerAccess || staffAccess
// docs/P10.4.9_RBAC_MIGRATION_PREPARATION.md closed the demo-account
// id-space gap `legacyGranted` existed for (staff@samoon.com,
// multirole@samoon.com, admin@samoon.com, kitchen@samoon.com all now have
// real StaffMember/StaffAssignment fixtures). This phase removed the
// `legacyGranted` branch entirely — the hook is now just:
//   ownerAccess || staffAccess
//
// This file proves the removal is behavior-preserving for every
// console-capable demo account, using the same isolation technique as
// p10.3.1-dashboard-access-audit.test.ts and
// p10.4.9-rbac-migration.test.ts: construct the user with a legacy
// UserRole of 'customer' so any pass can only be explained by the
// ownership/StaffAssignment path, which is the ONLY path in the hook.
//
// P10.4.12 update: the legacy RBAC engine (src/services/rbac.service.ts)
// this file originally used to prove 'customer' could never trigger the
// (already-removed) legacyGranted branch has since been fully retired —
// see docs/P10.4.12_LEGACY_RBAC_ENGINE_REMOVAL.md. The precondition
// assertions that called it were removed; the substantive
// useHasDashboardAccess() coverage below is unchanged.
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHasDashboardAccess } from '@/hooks'
import { useAuthStore, useTenantStore } from '@/stores'
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
})

describe('P10.4.10 — Owner access still passes with legacyGranted removed', () => {
  it('owner@samoon.com: grants access via resolveOwnerPermissions()/ownerOwnsTenant(), no legacy fallback involved', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('owner@samoon.com'))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)

    const identity = resolveOwnershipIdentity('owner@samoon.com')
    expect(identity.owner).toBeTruthy()
  })
})

describe('P10.4.10 — Staff assignment access still passes with legacyGranted removed', () => {
  const staffAccounts = [
    'admin@samoon.com',
    'staff@samoon.com',
    'manager@samoon.com',
    'cashier@samoon.com',
    'kitchen@samoon.com',
    'multirole@samoon.com',
  ]

  for (const email of staffAccounts) {
    it(`${email}: passes through StaffMember + StaffAssignment + ownership resolution`, async () => {
      const samoon = await samoonTenant()
      useTenantStore.getState().setTenant(samoon)
      useAuthStore.getState().setUser(customerRoleUserFor(email))

      const { result } = renderHook(() => useHasDashboardAccess())
      expect(result.current).toBe(true)

      const identity = resolveOwnershipIdentity(email)
      expect(identity.staffMember?.email).toBe(email)
      expect(
        staffAssignmentService.getEffectiveAssignments(identity.staffMember!.id).length,
      ).toBeGreaterThan(0)
    })
  }
})

// P10.4.12 — the `legacy isolation proof (legacyGranted === false for
// every account)` describe block was removed here: it duplicated the
// "Staff assignment access" coverage above, plus a rbacService
// precondition check that is now moot since rbacService no longer
// exists — see docs/P10.4.12_LEGACY_RBAC_ENGINE_REMOVAL.md.

describe('P10.4.10 — negative test: unknown account is still denied', () => {
  it('unknown@samoon.com: useHasDashboardAccess() === false (no StaffMember, no Owner record, and no legacy fallback exists anymore)', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('unknown@samoon.com'))

    const identity = resolveOwnershipIdentity('unknown@samoon.com')
    expect(identity.owner).toBeUndefined()
    expect(identity.staffMember).toBeUndefined()

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(false)
  })
})
