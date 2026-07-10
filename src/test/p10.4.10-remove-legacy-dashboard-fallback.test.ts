// ============================================================
// P10.4.10 — Remove Legacy Dashboard Access Fallback (legacyGranted)
//
// useHasDashboardAccess() (src/hooks/index.ts) previously computed:
//   legacyGranted || ownerAccess || staffAccess
// docs/P10.4.9_RBAC_MIGRATION_PREPARATION.md closed the demo-account
// id-space gap `legacyGranted` existed for (staff@savor.com,
// multirole@savor.com, admin@savor.com, kitchen@savor.com all now have
// real StaffMember/StaffAssignment fixtures). This phase removed the
// `legacyGranted` branch entirely — the hook is now just:
//   ownerAccess || staffAccess
//
// This file proves the removal is behavior-preserving for every
// console-capable demo account, using the same isolation technique as
// p10.3.1-dashboard-access-audit.test.ts and
// p10.4.9-rbac-migration.test.ts: construct the user with a legacy
// UserRole of 'customer' (rbacService.hasPermission() never grants
// 'dashboard:access' for 'customer' — proven inline below on every
// account) so any pass can only be explained by the ownership/
// StaffAssignment path, which is now the ONLY path in the hook.
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHasDashboardAccess } from '@/hooks'
import { useAuthStore, useTenantStore } from '@/stores'
import { ownerService } from '@/services/owner.service'
import { staffService } from '@/services/staff.service'
import { staffAssignmentService } from '@/services/staff-assignment.service'
import { tenantService } from '@/services/tenant.service'
import { rbacService } from '@/services/rbac.service'
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

async function savorTenant(): Promise<Tenant> {
  const tenants = await tenantService.getTenants()
  const tenant = tenants.find((t) => t.id === 'tenant-savor-01')
  if (!tenant) throw new Error('tenant-savor-01 not found in fixtures')
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
  it('owner@savor.com: grants access via resolveOwnerPermissions()/ownerOwnsTenant(), no legacy fallback involved', async () => {
    expect(rbacService.hasPermission('customer', 'dashboard:access')).toBe(false)

    const savor = await savorTenant()
    useTenantStore.getState().setTenant(savor)
    useAuthStore.getState().setUser(customerRoleUserFor('owner@savor.com'))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)

    const identity = resolveOwnershipIdentity('owner@savor.com')
    expect(identity.owner).toBeTruthy()
  })
})

describe('P10.4.10 — Staff assignment access still passes with legacyGranted removed', () => {
  const staffAccounts = [
    'admin@savor.com',
    'staff@savor.com',
    'manager@savor.com',
    'cashier@savor.com',
    'kitchen@savor.com',
    'multirole@savor.com',
  ]

  for (const email of staffAccounts) {
    it(`${email}: passes through StaffMember + StaffAssignment + ownership resolution`, async () => {
      const savor = await savorTenant()
      useTenantStore.getState().setTenant(savor)
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

describe('P10.4.10 — legacy isolation proof (legacyGranted === false for every account)', () => {
  const allConsoleCapableAccounts = [
    'owner@savor.com',
    'admin@savor.com',
    'staff@savor.com',
    'manager@savor.com',
    'cashier@savor.com',
    'kitchen@savor.com',
    'multirole@savor.com',
  ]

  for (const email of allConsoleCapableAccounts) {
    it(`${email}: useHasDashboardAccess() === true while rbacService.hasPermission('customer', 'dashboard:access') === false — access comes only from ownership`, async () => {
      // The user is always constructed with role: 'customer' below
      // (customerRoleUserFor). rbacService.hasPermission() never grants
      // 'dashboard:access' to 'customer' — CUSTOMER_PERMISSIONS in
      // rbac.service.ts excludes it — so this is what "legacyGranted
      // === false" means for every account tested here, without
      // needing to read a private variable that no longer exists.
      expect(rbacService.hasPermission('customer', 'dashboard:access')).toBe(false)

      const savor = await savorTenant()
      useTenantStore.getState().setTenant(savor)
      useAuthStore.getState().setUser(customerRoleUserFor(email))

      const { result } = renderHook(() => useHasDashboardAccess())
      expect(result.current).toBe(true)
    })
  }
})

describe('P10.4.10 — negative test: unknown account is still denied', () => {
  it('unknown@savor.com: useHasDashboardAccess() === false (no StaffMember, no Owner record, and no legacy fallback exists anymore)', async () => {
    const savor = await savorTenant()
    useTenantStore.getState().setTenant(savor)
    useAuthStore.getState().setUser(customerRoleUserFor('unknown@savor.com'))

    const identity = resolveOwnershipIdentity('unknown@savor.com')
    expect(identity.owner).toBeUndefined()
    expect(identity.staffMember).toBeUndefined()

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(false)
  })

  it('unknown@savor.com would also fail the legacy check if it still existed (role: customer)', () => {
    expect(rbacService.hasPermission('customer', 'dashboard:access')).toBe(false)
  })
})
