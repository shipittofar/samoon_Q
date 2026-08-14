// ============================================================
// P10.2.2 — Ownership Resolution Engine — regression tests
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest'
import {
  resolveOwnershipIdentity,
  resolveOwnerPermissions,
  resolveStaffAssignmentPermissions,
  resolveOwnershipDrivenPermissions,
  downgradeToReadOnly,
  buildBranchAccessContextFromAssignments,
  isOwnerEligible,
  isStaffMemberEligible,
  isTenantEligible,
} from '@/services/ownership-resolution.service'
import { ownerService } from '@/services/owner.service'
import { staffService } from '@/services/staff.service'
import { staffAssignmentService } from '@/services/staff-assignment.service'
import { tenantService } from '@/services/tenant.service'
import { branchManagementService } from '@/services/branch.service'
import { ROLE_PERMISSION_MAP, ALL_PERMISSIONS, hasPermission } from '@/services/permission.service'
import type { Tenant } from '@/types'

beforeEach(() => {
  ownerService._resetMockStore()
  staffService._resetMockStore()
  staffAssignmentService._resetMockStore()
  tenantService._resetMockList()
})

describe('P10.2.2 — resolveOwnershipIdentity (session bridge)', () => {
  it('returns {} for an unknown email', () => {
    expect(resolveOwnershipIdentity('nobody@nowhere.example')).toEqual({})
  })

  it('returns {} for null/undefined email', () => {
    expect(resolveOwnershipIdentity(null)).toEqual({})
    expect(resolveOwnershipIdentity(undefined)).toEqual({})
  })

  it('resolves a StaffMember + their Owner for a known staff email', () => {
    const identity = resolveOwnershipIdentity('owner@samoon.com')
    expect(identity.staffMember?.id).toBe('staff-owner-01')
    expect(identity.owner?.ownerId).toBe('owner-001')
  })

  it('resolves a StaffMember with no Owner short-circuit for a non-owning staff email', () => {
    const identity = resolveOwnershipIdentity('cashier@samoon.com')
    expect(identity.staffMember?.id).toBe('staff-cashier-01')
    // cashier@samoon.com is not the Owner of any tenant.
    expect(identity.owner).toBeUndefined()
  })

  it('resolves the cross-tenant Accountant fixture', () => {
    const identity = resolveOwnershipIdentity('accountant@samoon.com')
    expect(identity.staffMember?.id).toBe('staff-accountant-01')
  })
})

describe('P10.2.2 — resolveOwnerPermissions (§4.2 short-circuit)', () => {
  it('grants the full P7Permission set for a tenant the identity owns', () => {
    const identity = resolveOwnershipIdentity('owner@samoon.com') // owner-001
    const samoon: Pick<Tenant, 'id' | 'ownerId' | 'status'> = { id: 'tenant-samoon-01', ownerId: 'owner-001', status: 'active' }
    const result = resolveOwnerPermissions(identity, samoon)
    expect(result).toEqual(ALL_PERMISSIONS)
  })

  it('includes tenant.manage and tenant.view (owner-exclusive, §7.2)', () => {
    const identity = resolveOwnershipIdentity('owner@samoon.com')
    const samoon: Pick<Tenant, 'id' | 'ownerId' | 'status'> = { id: 'tenant-samoon-01', ownerId: 'owner-001', status: 'active' }
    const result = resolveOwnerPermissions(identity, samoon)
    expect(result).toContain('tenant.manage')
    expect(result).toContain('tenant.view')
  })

  it('grants nothing for a tenant the identity does NOT own', () => {
    const identity = resolveOwnershipIdentity('owner@samoon.com') // owner-001
    const oakBar: Pick<Tenant, 'id' | 'ownerId' | 'status'> = { id: 'tenant-oak-bar-01', ownerId: 'owner-002', status: 'active' }
    expect(resolveOwnerPermissions(identity, oakBar)).toEqual([])
  })

  it('grants nothing for an identity with no Owner record', () => {
    const identity = resolveOwnershipIdentity('cashier@samoon.com')
    const samoon: Pick<Tenant, 'id' | 'ownerId' | 'status'> = { id: 'tenant-samoon-01', ownerId: 'owner-001', status: 'active' }
    expect(resolveOwnerPermissions(identity, samoon)).toEqual([])
  })

  it('grants nothing when activeTenant is undefined', () => {
    const identity = resolveOwnershipIdentity('owner@samoon.com')
    expect(resolveOwnerPermissions(identity, undefined)).toEqual([])
  })

  it('reflects an ownership transfer: old owner loses access, new owner gains it', () => {
    // Simulates the effect of a completed Tenant.ownerId transfer (Backend
    // Contract §39.4 — not a live endpoint yet) by constructing the
    // post-transfer tenant shape directly and re-resolving.
    const oldOwnerIdentity = resolveOwnershipIdentity('owner@samoon.com') // owner-001
    const newOwnerIdentity = resolveOwnershipIdentity('owner@theoakbar.com') // owner-002

    const preTransfer: Pick<Tenant, 'id' | 'ownerId' | 'status'> = { id: 'tenant-samoon-01', ownerId: 'owner-001', status: 'active' }
    expect(resolveOwnerPermissions(oldOwnerIdentity, preTransfer).length).toBeGreaterThan(0)
    expect(resolveOwnerPermissions(newOwnerIdentity, preTransfer)).toEqual([])

    const postTransfer: Pick<Tenant, 'id' | 'ownerId' | 'status'> = { id: 'tenant-samoon-01', ownerId: 'owner-002', status: 'active' }
    expect(resolveOwnerPermissions(oldOwnerIdentity, postTransfer)).toEqual([])
    expect(resolveOwnerPermissions(newOwnerIdentity, postTransfer).length).toBeGreaterThan(0)
  })
})

describe('P10.2.2 — downgradeToReadOnly (§3.4 mode dimension)', () => {
  it('keeps .view permissions unchanged', () => {
    const result = downgradeToReadOnly(['orders.view', 'menu.view'])
    expect(result.sort()).toEqual(['menu.view', 'orders.view'])
  })

  it('downgrades a .manage permission to its .view sibling', () => {
    const result = downgradeToReadOnly(['orders.manage'])
    expect(result).toEqual(['orders.view'])
  })

  it('drops permissions with no .view sibling (e.g. payments.process)', () => {
    const result = downgradeToReadOnly(['payments.process', 'payments.refund'])
    expect(result).toEqual([])
  })

  it('deduplicates when both the .view and .manage of a resource are present', () => {
    const result = downgradeToReadOnly(['menu.view', 'menu.manage'])
    expect(result).toEqual(['menu.view'])
  })

  it("downgrading manager's full permission set never includes any .manage permission", () => {
    const result = downgradeToReadOnly(ROLE_PERMISSION_MAP.manager)
    expect(result.some((p) => p.endsWith('.manage'))).toBe(false)
  })
})

describe('P10.2.2 — resolveStaffAssignmentPermissions (§4.4 step 3)', () => {
  it('returns [] for an identity with no StaffMember', () => {
    expect(resolveStaffAssignmentPermissions({}, { id: 'tenant-samoon-01', status: 'active' })).toEqual([])
  })

  it('returns [] when tenantId is undefined', () => {
    const identity = resolveOwnershipIdentity('accountant@samoon.com')
    expect(resolveStaffAssignmentPermissions(identity, undefined)).toEqual([])
  })

  it('mode: read grants only .view permissions for the assigned role', () => {
    const identity = resolveOwnershipIdentity('accountant@samoon.com')
    const result = resolveStaffAssignmentPermissions(identity, { id: 'tenant-samoon-01', status: 'active' })
    expect(result).toContain('menu.view')
    expect(result).not.toContain('menu.manage')
    expect(result).not.toContain('orders.manage')
  })

  it('resolves permissions for a second, differently-scoped tenant under the same Owner (multi-tenant)', () => {
    const identity = resolveOwnershipIdentity('accountant@samoon.com')
    const samoonPerms = resolveStaffAssignmentPermissions(identity, { id: 'tenant-samoon-01', status: 'active' })
    const brewCafePerms = resolveStaffAssignmentPermissions(identity, { id: 'tenant-brew-cafe-01', status: 'active' })
    expect(samoonPerms.length).toBeGreaterThan(0)
    expect(brewCafePerms.length).toBeGreaterThan(0)
  })

  it('mode: manage grants the full role permission set unchanged', () => {
    const identity = resolveOwnershipIdentity('cashier@samoon.com')
    const result = resolveStaffAssignmentPermissions(identity, { id: 'tenant-samoon-01', status: 'active' })
    expect(result).toContain('payments.process')
    expect(result).toContain('payments.refund')
  })

  it('returns [] for a tenant this staff member has no assignment to', () => {
    const identity = resolveOwnershipIdentity('cashier@samoon.com')
    expect(resolveStaffAssignmentPermissions(identity, { id: 'tenant-oak-bar-01', status: 'active' })).toEqual([])
  })

  it('a future assignment (validFrom ahead) grants nothing at the current time', () => {
    const identity = resolveOwnershipIdentity('sage.server@samoon.com') // staff-waiter-02
    expect(resolveStaffAssignmentPermissions(identity, { id: 'tenant-brew-cafe-01', status: 'active' })).toEqual([])
  })

  it('a future assignment becomes effective once validFrom has passed', () => {
    const identity = resolveOwnershipIdentity('sage.server@samoon.com')
    const in20Days = new Date(Date.now() + 20 * 86_400_000)
    const result = resolveStaffAssignmentPermissions(identity, { id: 'tenant-brew-cafe-01', status: 'active' }, in20Days)
    expect(result.length).toBeGreaterThan(0)
  })

  it('a temporary assignment (validUntil) is effective before expiry', () => {
    const identity = resolveOwnershipIdentity('lee.line@samoon.com') // staff-kitchen-02
    const result = resolveStaffAssignmentPermissions(identity, { id: 'tenant-samoon-01', status: 'active' })
    expect(result.length).toBeGreaterThan(0)
  })

  it('a temporary assignment grants nothing after validUntil has passed', () => {
    const identity = resolveOwnershipIdentity('lee.line@samoon.com')
    const in31Days = new Date(Date.now() + 31 * 86_400_000)
    expect(resolveStaffAssignmentPermissions(identity, { id: 'tenant-samoon-01', status: 'active' }, in31Days)).toEqual([])
  })

  it('a revoked assignment grants nothing, regardless of the current time', () => {
    const identity = resolveOwnershipIdentity('quinn.promo@samoon.com') // staff-marketing-02
    expect(resolveStaffAssignmentPermissions(identity, { id: 'tenant-samoon-01', status: 'active' })).toEqual([])
    const farFuture = new Date(Date.now() + 365 * 86_400_000)
    expect(resolveStaffAssignmentPermissions(identity, { id: 'tenant-samoon-01', status: 'active' }, farFuture)).toEqual([])
  })

  it('unions permissions across multiple active assignments to the same tenant', async () => {
    const tenants = await tenantService.getTenants()
    const staff = await staffService.getStaff('tenant-samoon-01')
    await staffAssignmentService.grant(
      {
        staffId: 'staff-cashier-01',
        tenantId: 'tenant-samoon-01',
        branchIds: 'all',
        role: 'support',
        mode: 'manage',
        grantedBy: 'user-owner-01',
      },
      staff,
      tenants,
    )
    const identity = resolveOwnershipIdentity('cashier@samoon.com')
    const result = resolveStaffAssignmentPermissions(identity, { id: 'tenant-samoon-01', status: 'active' })
    // From the pre-existing cashier assignment:
    expect(result).toContain('payments.process')
    // From the newly granted support assignment:
    expect(result).toContain('branches.view')
  })
})

describe('P10.2.2 — resolveOwnershipDrivenPermissions (full §4.4 priority chain)', () => {
  it('Owner short-circuit wins over any StaffAssignment lookup', () => {
    const samoon: Pick<Tenant, 'id' | 'ownerId' | 'status'> = { id: 'tenant-samoon-01', ownerId: 'owner-001', status: 'active' }
    const result = resolveOwnershipDrivenPermissions('owner@samoon.com', samoon)
    expect(result).toEqual(ALL_PERMISSIONS)
  })

  it('falls through to StaffAssignment permissions when not the owner', () => {
    const samoon: Pick<Tenant, 'id' | 'ownerId' | 'status'> = { id: 'tenant-samoon-01', ownerId: 'owner-001', status: 'active' }
    const result = resolveOwnershipDrivenPermissions('cashier@samoon.com', samoon)
    expect(result.length).toBeGreaterThan(0)
    expect(result).not.toEqual(ALL_PERMISSIONS)
  })

  it('Platform Admin identities are untouched — no matching StaffMember means no interference', () => {
    // platform@samoon.com has no StaffMember record; Platform Admin's real
    // permissions come entirely from src/platform-admin/permissions.ts,
    // never from this function.
    const samoon: Pick<Tenant, 'id' | 'ownerId' | 'status'> = { id: 'tenant-samoon-01', ownerId: 'owner-001', status: 'active' }
    expect(resolveOwnershipDrivenPermissions('platform@samoon.com', samoon)).toEqual([])
  })

  it('Customer identities resolve to zero P7Permission grants (§4.5)', () => {
    const samoon: Pick<Tenant, 'id' | 'ownerId' | 'status'> = { id: 'tenant-samoon-01', ownerId: 'owner-001', status: 'active' }
    expect(resolveOwnershipDrivenPermissions('john@example.com', samoon)).toEqual([])
  })

  it('returns [] for an undefined active tenant', () => {
    expect(resolveOwnershipDrivenPermissions('owner@samoon.com', undefined)).toEqual([])
  })
})

describe('P10.2.2 — buildBranchAccessContextFromAssignments (Phase D wiring)', () => {
  it('returns null for an identity with no StaffMember', () => {
    expect(buildBranchAccessContextFromAssignments('nobody@nowhere.example', 'tenant-samoon-01', [])).toBeNull()
  })

  it('returns null for a staff member with no assignments to this tenant', () => {
    expect(
      buildBranchAccessContextFromAssignments('cashier@samoon.com', 'tenant-oak-bar-01', []),
    ).toBeNull()
  })

  it("expands branchIds: 'all' to every branch of the tenant", async () => {
    const allBranches = await branchManagementService.getBranches('tenant-samoon-01')
    const context = buildBranchAccessContextFromAssignments('accountant@samoon.com', 'tenant-samoon-01', allBranches)
    expect(context).not.toBeNull()
    expect(context!.branchIds.length).toBe(allBranches.length)
    expect(context!.tenantId).toBe('tenant-samoon-01')
    expect(context!.staffId).toBe('staff-accountant-01')
  })

  it('resolves a specific-branch subset for a different tenant (multi-branch, multi-tenant)', async () => {
    const brewCafeBranches = await branchManagementService.getBranches('tenant-brew-cafe-01')
    const context = buildBranchAccessContextFromAssignments('accountant@samoon.com', 'tenant-brew-cafe-01', brewCafeBranches)
    expect(context).not.toBeNull()
    expect(context!.branchIds).toEqual(['branch-brewcafe-02'])
  })

  it('resolves a single-branch scope (cashier example)', async () => {
    const allBranches = await branchManagementService.getBranches('tenant-samoon-01')
    const context = buildBranchAccessContextFromAssignments('cashier@samoon.com', 'tenant-samoon-01', allBranches)
    expect(context).not.toBeNull()
    expect(context!.branchIds).toEqual(['branch-rest-01'])
  })

  it('returns null for an Owner (ownership grants full access without an assignment context)', () => {
    // staff-owner-01 is a StaffMember record but holds no StaffAssignment rows.
    expect(buildBranchAccessContextFromAssignments('owner@samoon.com', 'tenant-samoon-01', [])).toBeNull()
  })
})

describe('P10.2.2 — ROLE_PERMISSION_MAP.admin (Phase E fix, closes P10.0 J1)', () => {
  it('admin no longer has tenant.manage', () => {
    expect(hasPermission('admin', 'tenant.manage')).toBe(false)
  })

  it('admin no longer has tenant.view', () => {
    expect(hasPermission('admin', 'tenant.view')).toBe(false)
  })

  it('admin retains every other ALL_PERMISSIONS entry', () => {
    const missing = ALL_PERMISSIONS.filter((p) => !ROLE_PERMISSION_MAP.admin.includes(p))
    expect(missing.sort()).toEqual(['tenant.manage', 'tenant.view'])
  })

  it('no other role was touched by this phase — none of them granted tenant.manage/tenant.view before, and none does now', () => {
    for (const role of ['manager', 'cashier', 'waiter', 'kitchen', 'marketing', 'support'] as const) {
      expect(ROLE_PERMISSION_MAP[role]).not.toContain('tenant.manage')
      expect(ROLE_PERMISSION_MAP[role]).not.toContain('tenant.view')
    }
  })

  it("owner's array (a separate, pre-existing entry, out of this phase's scope) is untouched — still contains tenant.manage", () => {
    expect(ROLE_PERMISSION_MAP.owner).toContain('tenant.manage')
    expect(ROLE_PERMISSION_MAP.owner).toContain('tenant.view')
  })
})

describe('P10.3 Phase A/B/C — centralized eligibility predicates', () => {
  it('isOwnerEligible is true only for status "active"', () => {
    expect(isOwnerEligible({ status: 'active' } as Parameters<typeof isOwnerEligible>[0])).toBe(true)
    expect(isOwnerEligible({ status: 'suspended' } as Parameters<typeof isOwnerEligible>[0])).toBe(false)
    expect(isOwnerEligible({ status: 'pending_verification' } as Parameters<typeof isOwnerEligible>[0])).toBe(false)
  })

  it('isStaffMemberEligible is true only for status "active"', () => {
    expect(isStaffMemberEligible({ status: 'active' } as Parameters<typeof isStaffMemberEligible>[0])).toBe(true)
    expect(isStaffMemberEligible({ status: 'suspended' } as Parameters<typeof isStaffMemberEligible>[0])).toBe(false)
    expect(isStaffMemberEligible({ status: 'removed' } as Parameters<typeof isStaffMemberEligible>[0])).toBe(false)
    expect(isStaffMemberEligible({ status: 'pending' } as Parameters<typeof isStaffMemberEligible>[0])).toBe(false)
  })

  it('isTenantEligible is false for CLOSED (legacy archived/suspended map to CLOSED)', () => {
    expect(isTenantEligible({ status: 'ACTIVE' })).toBe(true)
    expect(isTenantEligible({ status: 'INACTIVE' })).toBe(true)
    expect(isTenantEligible({ status: 'CLOSED' })).toBe(false)
    // Legacy aliases still normalize correctly via helpers
    expect(isTenantEligible({ status: 'active' })).toBe(true)
    expect(isTenantEligible({ status: 'trial' })).toBe(true)
    expect(isTenantEligible({ status: 'archived' })).toBe(false)
  })
})

describe('P10.3 Phase A — Owner status enforcement', () => {
  it('a suspended Owner resolves to zero permissions for a tenant they own (owner-004 / road-bites, real fixture)', () => {
    const identity = resolveOwnershipIdentity('owner@roadbites.com')
    expect(identity.owner?.status).toBe('suspended')
    const roadBites: Pick<Tenant, 'id' | 'ownerId' | 'status'> = {
      id: 'tenant-road-bites-01',
      ownerId: 'owner-004',
      status: 'active',
    }
    expect(resolveOwnerPermissions(identity, roadBites)).toEqual([])
  })

  it('a pending_verification Owner resolves to zero permissions', () => {
    const baseIdentity = resolveOwnershipIdentity('owner@samoon.com')
    const identity = { ...baseIdentity, owner: { ...baseIdentity.owner!, status: 'pending_verification' as const } }
    const samoon: Pick<Tenant, 'id' | 'ownerId' | 'status'> = {
      id: 'tenant-samoon-01',
      ownerId: 'owner-001',
      status: 'active',
    }
    expect(resolveOwnerPermissions(identity, samoon)).toEqual([])
  })

  it('an active Owner is unaffected (no regression)', () => {
    const identity = resolveOwnershipIdentity('owner@samoon.com')
    const samoon: Pick<Tenant, 'id' | 'ownerId' | 'status'> = {
      id: 'tenant-samoon-01',
      ownerId: 'owner-001',
      status: 'active',
    }
    expect(resolveOwnerPermissions(identity, samoon)).toEqual(ALL_PERMISSIONS)
  })
})

describe('P10.3 Phase B — Staff status enforcement', () => {
  it('a suspended StaffMember resolves to zero permissions despite an active assignment', () => {
    const baseIdentity = resolveOwnershipIdentity('accountant@samoon.com')
    const identity = { ...baseIdentity, staffMember: { ...baseIdentity.staffMember!, status: 'suspended' as const } }
    const samoon: Pick<Tenant, 'id' | 'status'> = { id: 'tenant-samoon-01', status: 'active' }
    expect(resolveStaffAssignmentPermissions(identity, samoon)).toEqual([])
  })

  it('a removed StaffMember resolves to zero permissions despite an active assignment', () => {
    const baseIdentity = resolveOwnershipIdentity('accountant@samoon.com')
    const identity = { ...baseIdentity, staffMember: { ...baseIdentity.staffMember!, status: 'removed' as const } }
    const samoon: Pick<Tenant, 'id' | 'status'> = { id: 'tenant-samoon-01', status: 'active' }
    expect(resolveStaffAssignmentPermissions(identity, samoon)).toEqual([])
  })

  it('an active StaffMember is unaffected (no regression)', () => {
    const identity = resolveOwnershipIdentity('accountant@samoon.com')
    const samoon: Pick<Tenant, 'id' | 'status'> = { id: 'tenant-samoon-01', status: 'active' }
    expect(resolveStaffAssignmentPermissions(identity, samoon).length).toBeGreaterThan(0)
  })
})

describe('P10.3 Phase C — Tenant status enforcement', () => {
  it('an archived tenant grants zero Owner permissions', () => {
    const identity = resolveOwnershipIdentity('owner@samoon.com')
    const archived: Pick<Tenant, 'id' | 'ownerId' | 'status'> = {
      id: 'tenant-samoon-01',
      ownerId: 'owner-001',
      status: 'archived',
    }
    expect(resolveOwnerPermissions(identity, archived)).toEqual([])
  })

  it('an archived tenant grants zero Staff permissions', () => {
    const identity = resolveOwnershipIdentity('accountant@samoon.com')
    const archived: Pick<Tenant, 'id' | 'status'> = { id: 'tenant-samoon-01', status: 'archived' }
    expect(resolveStaffAssignmentPermissions(identity, archived)).toEqual([])
  })

  it('resolveOwnershipDrivenPermissions returns [] for an archived tenant end-to-end (owner identity)', () => {
    const archived: Pick<Tenant, 'id' | 'ownerId' | 'status'> = {
      id: 'tenant-samoon-01',
      ownerId: 'owner-001',
      status: 'archived',
    }
    expect(resolveOwnershipDrivenPermissions('owner@samoon.com', archived)).toEqual([])
  })

  it('INACTIVE tenants remain eligible for console permission resolution (visibility is separate)', () => {
    const identity = resolveOwnershipIdentity('owner@samoon.com')
    const inactiveTenant: Pick<Tenant, 'id' | 'ownerId' | 'status'> = {
      id: 'tenant-samoon-01',
      ownerId: 'owner-001',
      status: 'INACTIVE',
    }
    expect(resolveOwnerPermissions(identity, inactiveTenant)).toEqual(ALL_PERMISSIONS)
  })

  it('CLOSED / legacy suspended tenants are not eligible for permission resolution', () => {
    const identity = resolveOwnershipIdentity('owner@samoon.com')
    const closedTenant: Pick<Tenant, 'id' | 'ownerId' | 'status'> = {
      id: 'tenant-samoon-01',
      ownerId: 'owner-001',
      status: 'CLOSED',
    }
    expect(resolveOwnerPermissions(identity, closedTenant)).toEqual([])
    expect(
      resolveOwnerPermissions(identity, {
        id: 'tenant-samoon-01',
        ownerId: 'owner-001',
        status: 'suspended',
      }),
    ).toEqual([])
  })
})
