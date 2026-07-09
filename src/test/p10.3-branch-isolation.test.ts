// ============================================================
// P10.3 Phase D — Branch Isolation Enforcement — regression tests
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest'
import { assertOwnershipBranchAccess, assertOwnershipTenantAccess, TenantAccessError } from '@/services/ownership-resolution.service'
import { BranchAccessError } from '@/services/branch-access.service'
import { ownerService } from '@/services/owner.service'
import { staffService } from '@/services/staff.service'
import { staffAssignmentService } from '@/services/staff-assignment.service'
import { tenantService } from '@/services/tenant.service'

beforeEach(() => {
  ownerService._resetMockStore()
  staffService._resetMockStore()
  staffAssignmentService._resetMockStore()
  tenantService._resetMockList()
})

describe('P10.3 Phase D — assertOwnershipBranchAccess', () => {
  it('allows an eligible Owner to access any branch of a tenant they own', async () => {
    await expect(assertOwnershipBranchAccess('owner@savor.com', 'branch-rest-01')).resolves.toBeUndefined()
    await expect(assertOwnershipBranchAccess('owner@savor.com', 'branch-rest-02')).resolves.toBeUndefined()
  })

  it('allows Staff to access a branch within their assignment', async () => {
    await expect(assertOwnershipBranchAccess('cashier@savor.com', 'branch-rest-01')).resolves.toBeUndefined()
  })

  it('denies Staff access to a branch of the same tenant outside their assignment', async () => {
    await expect(assertOwnershipBranchAccess('cashier@savor.com', 'branch-rest-02')).rejects.toThrow(
      BranchAccessError,
    )
  })

  it('denies access for an identity with no Owner and no matching StaffAssignment', async () => {
    await expect(assertOwnershipBranchAccess('john@example.com', 'branch-rest-01')).rejects.toThrow(
      BranchAccessError,
    )
  })

  it('denies a suspended Owner access to a branch of a tenant they own (Phase A carried through)', async () => {
    await expect(assertOwnershipBranchAccess('owner@roadbites.com', 'branch-roadbites-01')).rejects.toThrow(
      BranchAccessError,
    )
  })

  it('denies access to a branch belonging to an archived tenant (Phase C carried through)', async () => {
    await tenantService.archiveTenant('tenant-savor-01')
    await expect(assertOwnershipBranchAccess('owner@savor.com', 'branch-rest-01')).rejects.toThrow(
      BranchAccessError,
    )
  })

  it('denies access for an unknown branch id', async () => {
    await expect(assertOwnershipBranchAccess('owner@savor.com', 'branch-does-not-exist')).rejects.toThrow()
  })
})

describe('P10.3 Phase E — assertOwnershipTenantAccess', () => {
  it('allows an eligible Owner to access a tenant they own', async () => {
    await expect(assertOwnershipTenantAccess('owner@savor.com', 'tenant-savor-01')).resolves.toBeUndefined()
  })

  it('allows Staff with an effective assignment to access that tenant', async () => {
    await expect(assertOwnershipTenantAccess('accountant@savor.com', 'tenant-brew-cafe-01')).resolves.toBeUndefined()
  })

  it('denies an Owner access to a tenant they do not own', async () => {
    await expect(assertOwnershipTenantAccess('owner@savor.com', 'tenant-oak-bar-01')).rejects.toThrow(
      TenantAccessError,
    )
  })

  it('denies access for an identity with no Owner and no matching StaffAssignment', async () => {
    await expect(assertOwnershipTenantAccess('john@example.com', 'tenant-savor-01')).rejects.toThrow(
      TenantAccessError,
    )
  })

  it('denies a suspended Owner access to a tenant they own (Phase A carried through)', async () => {
    await expect(assertOwnershipTenantAccess('owner@roadbites.com', 'tenant-road-bites-01')).rejects.toThrow(
      TenantAccessError,
    )
  })

  it('denies access to an archived tenant (Phase C carried through)', async () => {
    await tenantService.archiveTenant('tenant-savor-01')
    await expect(assertOwnershipTenantAccess('owner@savor.com', 'tenant-savor-01')).rejects.toThrow(
      TenantAccessError,
    )
  })
})
