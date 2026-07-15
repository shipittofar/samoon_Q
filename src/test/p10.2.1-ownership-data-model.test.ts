// ============================================================
// P10.2.1 — Ownership & RBAC Data Model Foundation — regression tests
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest'
import { ownerService, MOCK_TENANT_OWNER_MAP } from '@/services/owner.service'
import { staffAssignmentService } from '@/services/staff-assignment.service'
import {
  resolveAssignmentStatus,
  isAssignmentEffective,
  validateAssignment,
  ownerOwnsTenant,
  resolveAssignmentBranchIds,
} from '@/services/ownership.service'
import {
  backfillTenantOwnership,
  deriveLegacyUserRoleLabel,
} from '@/services/ownership-migration.service'
import { tenantService } from '@/services/tenant.service'
import { staffService } from '@/services/staff.service'
import { branchManagementService } from '@/services/branch.service'
import type { StaffAssignment } from '@/types/ownership'
import type { StaffMember } from '@/types/staff'
import type { Tenant } from '@/types'

describe('P10.2.1 — Owner entity', () => {
  beforeEach(() => {
    ownerService._resetMockStore()
  })

  it('has at least 2 owners', async () => {
    const owners = await ownerService.getOwners()
    expect(owners.length).toBeGreaterThanOrEqual(2)
  })

  it('has at least one owner owning at least 2 tenants (P10.1 §9)', async () => {
    const tenants = await tenantService.getTenants()
    const owners = await ownerService.getOwners()
    const counts = owners.map((o) => ownerService.countOwnedTenants(o.ownerId, tenants))
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(2)
  })

  it('getOwnerByUserId resolves the same record as getOwners()', async () => {
    const owners = await ownerService.getOwners()
    const first = owners[0]
    const byUserId = await ownerService.getOwnerByUserId(first.userId)
    expect(byUserId?.ownerId).toBe(first.ownerId)
  })

  it('every tenant in MOCK_TENANT_OWNER_MAP resolves to a real owner', async () => {
    const owners = await ownerService.getOwners()
    const ownerIds = new Set(owners.map((o) => o.ownerId))
    for (const ownerId of Object.values(MOCK_TENANT_OWNER_MAP)) {
      expect(ownerIds.has(ownerId)).toBe(true)
    }
  })
})

describe('P10.2.1 — Tenant.ownerId (additive, nullable)', () => {
  beforeEach(() => {
    tenantService._resetMockList()
  })

  it('every seeded tenant except the pre-provisioning default has an ownerId', async () => {
    const tenants = await tenantService.getTenants()
    for (const tenant of tenants) {
      if (tenant.id === 'default') continue
      expect(tenant.ownerId, `tenant ${tenant.id} should have ownerId`).toBeTruthy()
    }
  })

  it('the default (pre-provisioning) tenant has no ownerId', async () => {
    const tenants = await tenantService.getTenants()
    const def = tenants.find((t) => t.id === 'default')
    expect(def?.ownerId).toBeUndefined()
  })

  it('reading a tenant without knowledge of ownerId is unaffected (backward compatibility)', async () => {
    const tenant = await tenantService.getTenant('samoon')
    // Every field that existed before P10.2.1 is still present and typed the same.
    expect(tenant.id).toBe('tenant-samoon-01')
    expect(tenant.slug).toBe('samoon')
    expect(tenant.status).toBeDefined()
  })
})

describe('P10.2.1 — StaffMember.ownerId (additive, nullable)', () => {
  beforeEach(() => {
    staffService._resetMockStore()
  })

  it('every seeded staff member has an ownerId matching their tenantId\'s owner', async () => {
    const tenants = await tenantService.getTenants()
    const tenantOwnerById = new Map(tenants.map((t) => [t.id, t.ownerId]))
    const staff = await staffService.getStaff('tenant-samoon-01')
    for (const member of staff) {
      expect(member.ownerId).toBe(tenantOwnerById.get(member.tenantId))
    }
  })

  it('existing StaffMember fields (tenantId, roles, status) are unchanged', async () => {
    const staff = await staffService.getStaff('tenant-samoon-01')
    const owner = staff.find((s) => s.roles.includes('owner'))
    expect(owner?.tenantId).toBe('tenant-samoon-01')
    expect(owner?.status).toBe('active')
  })
})

describe('P10.2.1 — StaffAssignment', () => {
  beforeEach(() => {
    staffAssignmentService._resetMockStore()
  })

  it('has at least one staff member with 2+ assignments to different tenants under the same owner', async () => {
    const assignments = await staffAssignmentService.getAssignmentsForStaff('staff-accountant-01')
    expect(assignments.length).toBeGreaterThanOrEqual(2)
    const tenantIds = new Set(assignments.map((a) => a.tenantId))
    expect(tenantIds.size).toBeGreaterThanOrEqual(2)
  })

  it('has at least one future, one temporary, and one revoked assignment', async () => {
    const all = [
      ...(await staffAssignmentService.getAssignmentsForTenant('tenant-samoon-01')),
      ...(await staffAssignmentService.getAssignmentsForTenant('tenant-brew-cafe-01')),
    ]
    expect(all.some((a) => a.status === 'future')).toBe(true)
    expect(all.some((a) => a.status === 'revoked')).toBe(true)
    expect(all.some((a) => !!a.validUntil)).toBe(true)
  })

  it('has at least one branchIds: "all" and one explicit-subset assignment', async () => {
    const all = await staffAssignmentService.getAssignmentsForTenant('tenant-samoon-01')
    expect(all.some((a) => a.branchIds === 'all')).toBe(true)
    expect(all.some((a) => Array.isArray(a.branchIds) && a.branchIds.length > 0)).toBe(true)
  })

  it('has at least one read-mode and one manage-mode assignment', async () => {
    const all = await staffAssignmentService.getAssignmentsForTenant('tenant-samoon-01')
    expect(all.some((a) => a.mode === 'read')).toBe(true)
    expect(all.some((a) => a.mode === 'manage')).toBe(true)
  })

  it('every seeded assignment satisfies the §3.3 ownership invariant', async () => {
    const staff = await staffService.getStaff('tenant-samoon-01')
    const brewCafeStaff = (await tenantService.getTenants())
      .map((t) => t.id)
    const allStaff: StaffMember[] = []
    for (const tenantId of brewCafeStaff) {
      allStaff.push(...(await staffService.getStaff(tenantId)))
    }
    const tenants = await tenantService.getTenants()

    const assignments: StaffAssignment[] = [
      ...(await staffAssignmentService.getAssignmentsForTenant('tenant-samoon-01')),
      ...(await staffAssignmentService.getAssignmentsForTenant('tenant-brew-cafe-01')),
      ...(await staffAssignmentService.getAssignmentsForTenant('tenant-wheels-brews-01')),
    ]
    expect(assignments.length).toBeGreaterThan(0)
    for (const assignment of assignments) {
      const result = validateAssignment(assignment, allStaff.concat(staff), tenants)
      expect(result.valid, `assignment ${assignment.assignmentId}: ${result.errors.join('; ')}`).toBe(true)
    }
  })

  it('validateAssignment rejects a cross-owner grant', () => {
    const staff: StaffMember[] = [
      {
        id: 'staff-x',
        tenantId: 'tenant-a',
        userId: 'user-x',
        email: 'x@example.com',
        firstName: 'X',
        lastName: 'Y',
        status: 'active',
        roles: ['manager'],
        invitedAt: new Date().toISOString(),
        createdBy: 'system',
        ownerId: 'owner-A',
      },
    ]
    const tenants: Tenant[] = [
      { id: 'tenant-b', name: 'B', slug: 'b', businessTypes: ['restaurant'], status: 'active', createdAt: new Date().toISOString(), ownerId: 'owner-B' },
    ]
    const result = validateAssignment({ staffId: 'staff-x', tenantId: 'tenant-b' }, staff, tenants)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/owned by owner-B/)
  })

  it('grant() writes a new row and revoke() marks it revoked without deleting it', async () => {
    const tenants = await tenantService.getTenants()
    const staff = await staffService.getStaff('tenant-samoon-01')

    const granted = await staffAssignmentService.grant(
      {
        staffId: 'staff-cashier-02',
        tenantId: 'tenant-samoon-01',
        branchIds: ['branch-rest-02'],
        role: 'cashier',
        mode: 'manage',
        grantedBy: 'user-owner-01',
      },
      staff,
      tenants,
    )
    expect(granted.status).toBe('active')

    const revoked = await staffAssignmentService.revoke(granted.assignmentId, { revokedBy: 'user-owner-01' })
    expect(revoked.status).toBe('revoked')
    expect(revoked.revokedBy).toBe('user-owner-01')

    // Row still exists (never deleted) — audit trail preserved.
    const after = await staffAssignmentService.getAssignmentsForStaff('staff-cashier-02')
    expect(after.some((a) => a.assignmentId === granted.assignmentId)).toBe(true)
  })

  it('move() revokes the old assignment and grants a new one (not an in-place mutation)', async () => {
    const tenants = await tenantService.getTenants()
    const staff = await staffService.getStaff('tenant-samoon-01')

    const original = await staffAssignmentService.grant(
      {
        staffId: 'staff-waiter-01',
        tenantId: 'tenant-samoon-01',
        branchIds: 'all',
        role: 'waiter',
        mode: 'manage',
        grantedBy: 'user-owner-01',
      },
      staff,
      tenants,
    )

    const { revoked, granted } = await staffAssignmentService.move(
      {
        fromAssignmentId: original.assignmentId,
        to: {
          staffId: 'staff-waiter-01',
          tenantId: 'tenant-brew-cafe-01',
          branchIds: ['branch-brewcafe-01'],
          role: 'waiter',
          mode: 'manage',
          grantedBy: 'user-owner-01',
        },
      },
      staff,
      tenants,
    )

    expect(revoked.assignmentId).toBe(original.assignmentId)
    expect(revoked.status).toBe('revoked')
    expect(granted.assignmentId).not.toBe(original.assignmentId)
    expect(granted.tenantId).toBe('tenant-brew-cafe-01')
    expect(granted.status).toBe('active')
  })
})

describe('P10.2.1 — resolveAssignmentStatus / isAssignmentEffective', () => {
  const base: StaffAssignment = {
    assignmentId: 'a1',
    staffId: 's1',
    tenantId: 't1',
    branchIds: 'all',
    role: 'manager',
    mode: 'manage',
    status: 'active',
    grantedBy: 'u1',
    grantedAt: new Date().toISOString(),
  }

  it('an active assignment with no dates resolves to active', () => {
    expect(resolveAssignmentStatus(base)).toBe('active')
    expect(isAssignmentEffective(base)).toBe(true)
  })

  it('a future validFrom resolves to future, not effective', () => {
    const future = { ...base, validFrom: new Date(Date.now() + 86_400_000).toISOString() }
    expect(resolveAssignmentStatus(future)).toBe('future')
    expect(isAssignmentEffective(future)).toBe(false)
  })

  it('a past validFrom promotes future to active', () => {
    const nowActive = { ...base, validFrom: new Date(Date.now() - 86_400_000).toISOString() }
    expect(resolveAssignmentStatus(nowActive)).toBe('active')
  })

  it('a past validUntil resolves to expired, not effective', () => {
    const expired = { ...base, validUntil: new Date(Date.now() - 86_400_000).toISOString() }
    expect(resolveAssignmentStatus(expired)).toBe('expired')
    expect(isAssignmentEffective(expired)).toBe(false)
  })

  it('an explicit revoked status always wins, even with a future validFrom', () => {
    const revoked: StaffAssignment = {
      ...base,
      status: 'revoked',
      validFrom: new Date(Date.now() + 86_400_000).toISOString(),
    }
    expect(resolveAssignmentStatus(revoked)).toBe('revoked')
    expect(isAssignmentEffective(revoked)).toBe(false)
  })
})

describe('P10.2.1 — ownerOwnsTenant / resolveAssignmentBranchIds', () => {
  const tenants: Tenant[] = [
    { id: 't1', name: 'T1', slug: 't1', businessTypes: ['restaurant'], status: 'active', createdAt: new Date().toISOString(), ownerId: 'owner-A' },
  ]

  it('true only when Tenant.ownerId matches', () => {
    expect(ownerOwnsTenant('owner-A', 't1', tenants)).toBe(true)
    expect(ownerOwnsTenant('owner-B', 't1', tenants)).toBe(false)
    expect(ownerOwnsTenant('owner-A', 'unknown-tenant', tenants)).toBe(false)
  })

  it('expands "all" to every branch of the tenant', async () => {
    const branches = await branchManagementService.getBranches('tenant-samoon-01')
    const resolved = resolveAssignmentBranchIds({ tenantId: 'tenant-samoon-01', branchIds: 'all' }, branches)
    expect(resolved.length).toBe(branches.length)
    expect(resolved).toContain('branch-rest-01')
  })

  it('passes through an explicit branch list unchanged', () => {
    const resolved = resolveAssignmentBranchIds(
      { tenantId: 'tenant-samoon-01', branchIds: ['branch-rest-01', 'branch-rest-02'] },
      [],
    )
    expect(resolved).toEqual(['branch-rest-01', 'branch-rest-02'])
  })
})

describe('P10.2.1 — migration helpers (Phase G)', () => {
  it('backfillTenantOwnership derives ownerId from the legacy single owner-role staff member', () => {
    const tenants: Tenant[] = [
      { id: 'tenant-x', name: 'X', slug: 'x', businessTypes: ['restaurant'], status: 'active', createdAt: new Date().toISOString() },
    ]
    const staff: StaffMember[] = [
      {
        id: 'staff-x-owner',
        tenantId: 'tenant-x',
        userId: 'user-x-owner',
        email: 'owner@x.com',
        firstName: 'X',
        lastName: 'Owner',
        status: 'active',
        roles: ['owner'],
        invitedAt: new Date().toISOString(),
        createdBy: 'system',
      },
    ]
    const { tenants: result, owners, report } = backfillTenantOwnership(tenants, staff, [])
    expect(report.resolvedTenantIds).toEqual(['tenant-x'])
    expect(report.ambiguousTenantIds).toEqual([])
    expect(result[0].ownerId).toBeTruthy()
    expect(owners.find((o) => o.ownerId === result[0].ownerId)?.userId).toBe('user-x-owner')
  })

  it('flags tenants with zero owner-role holders as ambiguous, not auto-resolved', () => {
    const tenants: Tenant[] = [
      { id: 'tenant-y', name: 'Y', slug: 'y', businessTypes: ['restaurant'], status: 'active', createdAt: new Date().toISOString() },
    ]
    const { tenants: result, report } = backfillTenantOwnership(tenants, [], [])
    expect(report.ambiguousTenantIds).toEqual(['tenant-y'])
    expect(result[0].ownerId).toBeUndefined()
  })

  it('flags tenants with more than one owner-role holder as ambiguous, not auto-resolved', () => {
    const tenants: Tenant[] = [
      { id: 'tenant-z', name: 'Z', slug: 'z', businessTypes: ['restaurant'], status: 'active', createdAt: new Date().toISOString() },
    ]
    const staff: StaffMember[] = ['user-1', 'user-2'].map((uid, i) => ({
      id: `staff-z-${i}`,
      tenantId: 'tenant-z',
      userId: uid,
      email: `${uid}@z.com`,
      firstName: 'Z',
      lastName: 'Owner',
      status: 'active',
      roles: ['owner'],
      invitedAt: new Date().toISOString(),
      createdBy: 'system',
    }))
    const { tenants: result, report } = backfillTenantOwnership(tenants, staff, [])
    expect(report.ambiguousTenantIds).toEqual(['tenant-z'])
    expect(result[0].ownerId).toBeUndefined()
  })

  it('reuses an existing Owner record for the resolved userId instead of duplicating it', () => {
    const tenants: Tenant[] = [
      { id: 'tenant-w', name: 'W', slug: 'w', businessTypes: ['restaurant'], status: 'active', createdAt: new Date().toISOString() },
    ]
    const staff: StaffMember[] = [
      {
        id: 'staff-w-owner',
        tenantId: 'tenant-w',
        userId: 'user-existing',
        email: 'existing@w.com',
        firstName: 'W',
        lastName: 'Owner',
        status: 'active',
        roles: ['owner'],
        invitedAt: new Date().toISOString(),
        createdBy: 'system',
      },
    ]
    const existingOwners = [
      { ownerId: 'owner-existing', userId: 'user-existing', status: 'active' as const, plan: 'starter', maxTenants: null, billing: { customerId: null, billingEmail: 'existing@w.com' }, createdAt: new Date().toISOString() },
    ]
    const { tenants: result, owners, report } = backfillTenantOwnership(tenants, staff, existingOwners)
    expect(result[0].ownerId).toBe('owner-existing')
    expect(report.createdOwners).toEqual([])
    expect(owners).toHaveLength(1)
  })

  it('never touches a tenant that already has an ownerId', () => {
    const tenants: Tenant[] = [
      { id: 'tenant-v', name: 'V', slug: 'v', businessTypes: ['restaurant'], status: 'active', createdAt: new Date().toISOString(), ownerId: 'owner-already' },
    ]
    const { tenants: result, report } = backfillTenantOwnership(tenants, [], [])
    expect(result[0].ownerId).toBe('owner-already')
    expect(report.resolvedTenantIds).toEqual([])
    expect(report.ambiguousTenantIds).toEqual([])
  })

  it('deriveLegacyUserRoleLabel maps the new model back onto the 4 legacy UserRole values', () => {
    expect(deriveLegacyUserRoleLabel({ isOwner: true, hasActiveStaffAssignment: false })).toBe('owner')
    expect(deriveLegacyUserRoleLabel({ isOwner: false, hasActiveStaffAssignment: true })).toBe('staff')
    expect(deriveLegacyUserRoleLabel({ isOwner: false, hasActiveStaffAssignment: false })).toBe('customer')
    // Owner takes precedence even if somehow also has an assignment.
    expect(deriveLegacyUserRoleLabel({ isOwner: true, hasActiveStaffAssignment: true })).toBe('owner')
  })
})
