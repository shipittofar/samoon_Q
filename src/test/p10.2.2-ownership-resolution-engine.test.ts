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
    const identity = resolveOwnershipIdentity('owner@savor.com')
    expect(identity.staffMember?.id).toBe('staff-owner-01')
    expect(identity.owner?.ownerId).toBe('owner-001')
  })

  it('resolves a StaffMember with no Owner short-circuit for a non-owning staff email', () => {
    const identity = resolveOwnershipIdentity('cashier@savor.com')
    expect(identity.staffMember?.id).toBe('staff-cashier-01')
    // cashier@savor.com is not the Owner of any tenant.
    expect(identity.owner).toBeUndefined()
  })

  it('resolves the cross-tenant Accountant fixture', () => {
    const identity = resolveOwnershipIdentity('accountant@savor.com')
    expect(identity.staffMember?.id).toBe('staff-accountant-01')
  })
})

describe('P10.2.2 — resolveOwnerPermissions (§4.2 short-circuit)', () => {
  it('grants the full P7Permission set for a tenant the identity owns', () => {
    const identity = resolveOwnershipIdentity('owner@savor.com') // owner-001
    const savor: Pick<Tenant, 'id' | 'ownerId'> = { id: 'tenant-savor-01', ownerId: 'owner-001' }
    const result = resolveOwnerPermissions(identity, savor)
    expect(result).toEqual(ALL_PERMISSIONS)
  })

  it('includes tenant.manage and tenant.view (owner-exclusive, §7.2)', () => {
    const identity = resolveOwnershipIdentity('owner@savor.com')
    const savor: Pick<Tenant, 'id' | 'ownerId'> = { id: 'tenant-savor-01', ownerId: 'owner-001' }
    const result = resolveOwnerPermissions(identity, savor)
    expect(result).toContain('tenant.manage')
    expect(result).toContain('tenant.view')
  })

  it('grants nothing for a tenant the identity does NOT own', () => {
    const identity = resolveOwnershipIdentity('owner@savor.com') // owner-001
    const oakBar: Pick<Tenant, 'id' | 'ownerId'> = { id: 'tenant-oak-bar-01', ownerId: 'owner-002' }
    expect(resolveOwnerPermissions(identity, oakBar)).toEqual([])
  })

  it('grants nothing for an identity with no Owner record', () => {
    const identity = resolveOwnershipIdentity('cashier@savor.com')
    const savor: Pick<Tenant, 'id' | 'ownerId'> = { id: 'tenant-savor-01', ownerId: 'owner-001' }
    expect(resolveOwnerPermissions(identity, savor)).toEqual([])
  })

  it('grants nothing when activeTenant is undefined', () => {
    const identity = resolveOwnershipIdentity('owner@savor.com')
    expect(resolveOwnerPermissions(identity, undefined)).toEqual([])
  })

  it('reflects an ownership transfer: old owner loses access, new owner gains it', () => {
    // Simulates the effect of a completed Tenant.ownerId transfer (Backend
    // Contract §39.4 — not a live endpoint yet) by constructing the
    // post-transfer tenant shape directly and re-resolving.
    const oldOwnerIdentity = resolveOwnershipIdentity('owner@savor.com') // owner-001
    const newOwnerIdentity = resolveOwnershipIdentity('owner@theoakbar.com') // owner-002

    const preTransfer: Pick<Tenant, 'id' | 'ownerId'> = { id: 'tenant-savor-01', ownerId: 'owner-001' }
    expect(resolveOwnerPermissions(oldOwnerIdentity, preTransfer).length).toBeGreaterThan(0)
    expect(resolveOwnerPermissions(newOwnerIdentity, preTransfer)).toEqual([])

    const postTransfer: Pick<Tenant, 'id' | 'ownerId'> = { id: 'tenant-savor-01', ownerId: 'owner-002' }
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
    expect(resolveStaffAssignmentPermissions({}, 'tenant-savor-01')).toEqual([])
  })

  it('returns [] when tenantId is undefined', () => {
    const identity = resolveOwnershipIdentity('accountant@savor.com')
    expect(resolveStaffAssignmentPermissions(identity, undefined)).toEqual([])
  })

  it('mode: read grants only .view permissions for the assigned role', () => {
    const identity = resolveOwnershipIdentity('accountant@savor.com')
    const result = resolveStaffAssignmentPermissions(identity, 'tenant-savor-01')
    expect(result).toContain('menu.view')
    expect(result).not.toContain('menu.manage')
    expect(result).not.toContain('orders.manage')
  })

  it('resolves permissions for a second, differently-scoped tenant under the same Owner (multi-tenant)', () => {
    const identity = resolveOwnershipIdentity('accountant@savor.com')
    const savorPerms = resolveStaffAssignmentPermissions(identity, 'tenant-savor-01')
    const brewCafePerms = resolveStaffAssignmentPermissions(identity, 'tenant-brew-cafe-01')
    expect(savorPerms.length).toBeGreaterThan(0)
    expect(brewCafePerms.length).toBeGreaterThan(0)
  })

  it('mode: manage grants the full role permission set unchanged', () => {
    const identity = resolveOwnershipIdentity('cashier@savor.com')
    const result = resolveStaffAssignmentPermissions(identity, 'tenant-savor-01')
    expect(result).toContain('payments.process')
    expect(result).toContain('payments.refund')
  })

  it('returns [] for a tenant this staff member has no assignment to', () => {
    const identity = resolveOwnershipIdentity('cashier@savor.com')
    expect(resolveStaffAssignmentPermissions(identity, 'tenant-oak-bar-01')).toEqual([])
  })

  it('a future assignment (validFrom ahead) grants nothing at the current time', () => {
    const identity = resolveOwnershipIdentity('sage.server@savor.com') // staff-waiter-02
    expect(resolveStaffAssignmentPermissions(identity, 'tenant-brew-cafe-01')).toEqual([])
  })

  it('a future assignment becomes effective once validFrom has passed', () => {
    const identity = resolveOwnershipIdentity('sage.server@savor.com')
    const in20Days = new Date(Date.now() + 20 * 86_400_000)
    const result = resolveStaffAssignmentPermissions(identity, 'tenant-brew-cafe-01', in20Days)
    expect(result.length).toBeGreaterThan(0)
  })

  it('a temporary assignment (validUntil) is effective before expiry', () => {
    const identity = resolveOwnershipIdentity('lee.line@savor.com') // staff-kitchen-02
    const result = resolveStaffAssignmentPermissions(identity, 'tenant-savor-01')
    expect(result.length).toBeGreaterThan(0)
  })

  it('a temporary assignment grants nothing after validUntil has passed', () => {
    const identity = resolveOwnershipIdentity('lee.line@savor.com')
    const in31Days = new Date(Date.now() + 31 * 86_400_000)
    expect(resolveStaffAssignmentPermissions(identity, 'tenant-savor-01', in31Days)).toEqual([])
  })

  it('a revoked assignment grants nothing, regardless of the current time', () => {
    const identity = resolveOwnershipIdentity('quinn.promo@savor.com') // staff-marketing-02
    expect(resolveStaffAssignmentPermissions(identity, 'tenant-savor-01')).toEqual([])
    const farFuture = new Date(Date.now() + 365 * 86_400_000)
    expect(resolveStaffAssignmentPermissions(identity, 'tenant-savor-01', farFuture)).toEqual([])
  })

  it('unions permissions across multiple active assignments to the same tenant', async () => {
    const tenants = await tenantService.getTenants()
    const staff = await staffService.getStaff('tenant-savor-01')
    await staffAssignmentService.grant(
      {
        staffId: 'staff-cashier-01',
        tenantId: 'tenant-savor-01',
        branchIds: 'all',
        role: 'support',
        mode: 'manage',
        grantedBy: 'user-owner-01',
      },
      staff,
      tenants,
    )
    const identity = resolveOwnershipIdentity('cashier@savor.com')
    const result = resolveStaffAssignmentPermissions(identity, 'tenant-savor-01')
    // From the pre-existing cashier assignment:
    expect(result).toContain('payments.process')
    // From the newly granted support assignment:
    expect(result).toContain('branches.view')
  })
})

describe('P10.2.2 — resolveOwnershipDrivenPermissions (full §4.4 priority chain)', () => {
  it('Owner short-circuit wins over any StaffAssignment lookup', () => {
    const savor: Pick<Tenant, 'id' | 'ownerId'> = { id: 'tenant-savor-01', ownerId: 'owner-001' }
    const result = resolveOwnershipDrivenPermissions('owner@savor.com', savor)
    expect(result).toEqual(ALL_PERMISSIONS)
  })

  it('falls through to StaffAssignment permissions when not the owner', () => {
    const savor: Pick<Tenant, 'id' | 'ownerId'> = { id: 'tenant-savor-01', ownerId: 'owner-001' }
    const result = resolveOwnershipDrivenPermissions('cashier@savor.com', savor)
    expect(result.length).toBeGreaterThan(0)
    expect(result).not.toEqual(ALL_PERMISSIONS)
  })

  it('Platform Admin identities are untouched — no matching StaffMember means no interference', () => {
    // platform@savor.com has no StaffMember record; Platform Admin's real
    // permissions come entirely from src/platform-admin/permissions.ts,
    // never from this function.
    const savor: Pick<Tenant, 'id' | 'ownerId'> = { id: 'tenant-savor-01', ownerId: 'owner-001' }
    expect(resolveOwnershipDrivenPermissions('platform@savor.com', savor)).toEqual([])
  })

  it('Customer identities resolve to zero P7Permission grants (§4.5)', () => {
    const savor: Pick<Tenant, 'id' | 'ownerId'> = { id: 'tenant-savor-01', ownerId: 'owner-001' }
    expect(resolveOwnershipDrivenPermissions('john@example.com', savor)).toEqual([])
  })

  it('returns [] for an undefined active tenant', () => {
    expect(resolveOwnershipDrivenPermissions('owner@savor.com', undefined)).toEqual([])
  })
})

describe('P10.2.2 — buildBranchAccessContextFromAssignments (Phase D wiring)', () => {
  it('returns null for an identity with no StaffMember', () => {
    expect(buildBranchAccessContextFromAssignments('nobody@nowhere.example', 'tenant-savor-01', [])).toBeNull()
  })

  it('returns null for a staff member with no assignments to this tenant', () => {
    expect(
      buildBranchAccessContextFromAssignments('cashier@savor.com', 'tenant-oak-bar-01', []),
    ).toBeNull()
  })

  it("expands branchIds: 'all' to every branch of the tenant", async () => {
    const allBranches = await branchManagementService.getBranches('tenant-savor-01')
    const context = buildBranchAccessContextFromAssignments('accountant@savor.com', 'tenant-savor-01', allBranches)
    expect(context).not.toBeNull()
    expect(context!.branchIds.length).toBe(allBranches.length)
    expect(context!.tenantId).toBe('tenant-savor-01')
    expect(context!.staffId).toBe('staff-accountant-01')
  })

  it('resolves a specific-branch subset for a different tenant (multi-branch, multi-tenant)', async () => {
    const brewCafeBranches = await branchManagementService.getBranches('tenant-brew-cafe-01')
    const context = buildBranchAccessContextFromAssignments('accountant@savor.com', 'tenant-brew-cafe-01', brewCafeBranches)
    expect(context).not.toBeNull()
    expect(context!.branchIds).toEqual(['branch-brewcafe-02'])
  })

  it('resolves a single-branch scope (cashier example)', async () => {
    const allBranches = await branchManagementService.getBranches('tenant-savor-01')
    const context = buildBranchAccessContextFromAssignments('cashier@savor.com', 'tenant-savor-01', allBranches)
    expect(context).not.toBeNull()
    expect(context!.branchIds).toEqual(['branch-rest-01'])
  })

  it('returns null for an Owner (ownership grants full access without an assignment context)', () => {
    // staff-owner-01 is a StaffMember record but holds no StaffAssignment rows.
    expect(buildBranchAccessContextFromAssignments('owner@savor.com', 'tenant-savor-01', [])).toBeNull()
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
