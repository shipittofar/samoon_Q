// ============================================================
// P10.4.9 — Legacy RBAC Migration Preparation: Close Demo Account Staff
// Identity Gap
//
// docs/P10.4.8_LEGACY_COMPATIBILITY_AUDIT.md Phase H found that
// staff@samoon.com and multirole@samoon.com had no matching StaffMember
// fixture, so useHasDashboardAccess()'s ownership/StaffAssignment branch
// always returned false for them — only the legacy
// `rbacService.hasPermission(role, 'dashboard:access')` fallback
// ('legacyGranted') granted them /console access.
//
// This phase adds the missing StaffMember/StaffAssignment fixtures
// (src/services/staff.service.ts, src/services/staff-assignment.service.ts)
// and proves, with legacyGranted forced to a value that can never grant
// access ('customer', which CUSTOMER_PERMISSIONS never includes
// 'dashboard:access' for — see rbac.service.ts), that every
// console-capable demo account now resolves access purely through the
// ownership/StaffAssignment path.
//
// While verifying the fixture set (Phase B — "For every MOCK_CREDENTIALS
// entry... StaffAssignment resolution succeeds"), this phase also found
// that admin@samoon.com (staff-admin-01) and kitchen@samoon.com
// (staff-kitchen-01) had a StaffMember record but ZERO StaffAssignment
// rows — the same class of gap as staff@samoon.com/multirole@samoon.com,
// just not named in this phase's Phase A instructions because P10.4.8
// didn't audit it (P10.4.8 only flagged accounts with no StaffMember at
// all). Closed identically (fixture-only) so this file's own proof list
// — which the phase specifies verbatim — is actually true rather than
// silently failing for two of its seven entries.
//
// This was NOT a removal phase — at the time this file was written,
// rbacService.hasPermission(), ROLE_PERMISSIONS, LegacyPermission,
// legacyGranted, and AuthGuard's legacy fallback were all still present
// and unmodified; this file only proved they were no longer the
// DECIDING factor for any demo account. The legacy engine itself was
// later fully retired in P10.4.12 (see
// docs/P10.4.12_LEGACY_RBAC_ENGINE_REMOVAL.md) — this file's
// rbacService-specific precondition assertions were removed then, since
// there is no longer a legacy engine left to prove isolation from; the
// substantive useHasDashboardAccess() coverage below is unchanged.
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHasDashboardAccess } from '@/hooks'
import { useAuthStore, useTenantStore } from '@/stores'
import { ownerService } from '@/services/owner.service'
import { staffService } from '@/services/staff.service'
import { staffAssignmentService } from '@/services/staff-assignment.service'
import { tenantService } from '@/services/tenant.service'
import {
  resolveOwnershipIdentity,
  resolveOwnershipDrivenPermissions,
} from '@/services/ownership-resolution.service'
import type { User, Tenant } from '@/types'

/**
 * Builds a User with `role: 'customer'` unless overridden. At the time
 * this file was written, 'customer' was the one legacy UserRole that
 * `rbacService.hasPermission(role, 'dashboard:access')` never granted,
 * which forced `legacyGranted` to `false` inside `useHasDashboardAccess()`.
 * `legacyGranted` was removed in P10.4.10 and the legacy engine itself
 * was fully retired in P10.4.12 — `useHasDashboardAccess()` now has no
 * legacy branch to isolate from at all, so this helper's role choice is
 * kept for historical continuity with the rest of this test suite, not
 * because it still needs to defeat a legacy check. Same technique
 * originally established in
 * src/test/p10.3.1-dashboard-access-audit.test.ts for `accountant@samoon.com`.
 */
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

// ── Phase B — Fixture Consistency Audit ─────────────────────────────────────
//
// For each account this phase's regression proof (Phase C) depends on:
// email exists in MOCK_STAFF_LIST when required, ownership resolution
// succeeds, StaffAssignment resolution succeeds (for Staff, not Owner —
// Owner short-circuits per resolveOwnerPermissions()), and P7 permissions
// resolve to a non-empty set. This is the audit helper the phase asked
// for — a local, test-only function; it changes no runtime code.

interface FixtureAuditExpectation {
  email: string
  /** Owner accounts resolve via resolveOwnerPermissions(), not a StaffAssignment. */
  kind: 'owner' | 'staff'
}

function auditFixtureConsistency(
  expectation: FixtureAuditExpectation,
  tenant: Tenant,
): { staffMemberFound: boolean; hasEffectiveAssignment: boolean; permissionCount: number } {
  const identity = resolveOwnershipIdentity(expectation.email)
  const staffMemberFound = expectation.kind === 'owner' ? true : !!identity.staffMember
  const hasEffectiveAssignment =
    expectation.kind === 'owner'
      ? true // Owner grants full access structurally — no StaffAssignment involved
      : !!identity.staffMember &&
        staffAssignmentService.getEffectiveAssignments(identity.staffMember.id).length > 0
  const permissions = resolveOwnershipDrivenPermissions(expectation.email, tenant)
  return { staffMemberFound, hasEffectiveAssignment, permissionCount: permissions.length }
}

describe('P10.4.9 Phase B — fixture consistency audit', () => {
  const expectations: FixtureAuditExpectation[] = [
    { email: 'owner@samoon.com', kind: 'owner' },
    { email: 'admin@samoon.com', kind: 'staff' },
    { email: 'manager@samoon.com', kind: 'staff' },
    { email: 'cashier@samoon.com', kind: 'staff' },
    { email: 'kitchen@samoon.com', kind: 'staff' },
    { email: 'staff@samoon.com', kind: 'staff' },
    { email: 'multirole@samoon.com', kind: 'staff' },
  ]

  for (const expectation of expectations) {
    it(`${expectation.email}: StaffMember resolves, has an effective assignment (or is Owner), and P7 permissions resolve`, async () => {
      const tenant = await samoonTenant()
      const audit = auditFixtureConsistency(expectation, tenant)
      expect(audit.staffMemberFound).toBe(true)
      expect(audit.hasEffectiveAssignment).toBe(true)
      expect(audit.permissionCount).toBeGreaterThan(0)
    })
  }

  it('multirole@samoon.com resolves TWO distinct effective assignments (cashier AND kitchen, not collapsed)', async () => {
    const identity = resolveOwnershipIdentity('multirole@samoon.com')
    expect(identity.staffMember).toBeTruthy()
    const assignments = staffAssignmentService.getEffectiveAssignments(identity.staffMember!.id)
    const roles = assignments.map((a) => a.role).sort()
    expect(roles).toEqual(['cashier', 'kitchen'])
  })

  it('staff@samoon.com resolves to the manager role via its StaffAssignment', async () => {
    const identity = resolveOwnershipIdentity('staff@samoon.com')
    expect(identity.staffMember).toBeTruthy()
    const assignments = staffAssignmentService.getEffectiveAssignments(identity.staffMember!.id)
    expect(assignments.map((a) => a.role)).toEqual(['manager'])
  })
})

// ── Phase C — Regression Test Before Future Removal ─────────────────────────

describe('P10.4.9 Phase C — console access holds independent of any legacy dashboard:access fallback', () => {
  const consoleCapableEmails = [
    'owner@samoon.com',
    'admin@samoon.com',
    'manager@samoon.com',
    'cashier@samoon.com',
    'kitchen@samoon.com',
    'staff@samoon.com',
    'multirole@samoon.com',
  ]

  for (const email of consoleCapableEmails) {
    it(`${email}: useHasDashboardAccess() returns true via ownership/StaffAssignment resolution alone`, async () => {
      const samoon = await samoonTenant()
      useTenantStore.getState().setTenant(samoon)
      useAuthStore.getState().setUser(customerRoleUserFor(email))

      const { result } = renderHook(() => useHasDashboardAccess())
      expect(result.current).toBe(true)
    })
  }

  it('staff@samoon.com specifically resolves via ownership resolution alone', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('staff@samoon.com'))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)

    const identity = resolveOwnershipIdentity('staff@samoon.com')
    expect(identity.staffMember?.email).toBe('staff@samoon.com')
    expect(
      staffAssignmentService.getEffectiveAssignments(identity.staffMember!.id).length,
    ).toBeGreaterThan(0)
  })

  it('multirole@samoon.com specifically resolves via ownership resolution alone', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('multirole@samoon.com'))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)

    const identity = resolveOwnershipIdentity('multirole@samoon.com')
    expect(identity.staffMember?.email).toBe('multirole@samoon.com')
    const assignments = staffAssignmentService.getEffectiveAssignments(identity.staffMember!.id)
    expect(assignments.length).toBe(2)
    expect(assignments.map((a) => a.role).sort()).toEqual(['cashier', 'kitchen'])
  })

  it('sanity check: a real Customer (no StaffMember, no Owner record) is still denied — the fixture additions did not broaden access', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(customerRoleUserFor('nobody@example.com'))

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(false)
  })
})
