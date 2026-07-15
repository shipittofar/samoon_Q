// ============================================================
// P10.3 Phase F — Ownership Transfer Consolidation — regression tests
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest'
import { staffService } from '@/services/staff.service'
import { tenantService } from '@/services/tenant.service'
import { ownerService } from '@/services/owner.service'
import { staffAssignmentService } from '@/services/staff-assignment.service'

beforeEach(() => {
  ownerService._resetMockStore()
  staffService._resetMockStore()
  staffAssignmentService._resetMockStore()
  tenantService._resetMockList()
})

describe('P10.3 Phase F — tenantService.transferOwnership (single source of truth for Tenant.ownerId)', () => {
  it('reassigns Tenant.ownerId', async () => {
    const updated = await tenantService.transferOwnership('tenant-samoon-01', 'owner-002')
    expect(updated.ownerId).toBe('owner-002')
  })

  it('is reflected by a subsequent getTenants() read', async () => {
    await tenantService.transferOwnership('tenant-samoon-01', 'owner-002')
    const tenants = await tenantService.getTenants()
    const samoon = tenants.find((t) => t.id === 'tenant-samoon-01')
    expect(samoon?.ownerId).toBe('owner-002')
  })
})

describe('P10.3 Phase F — staffService.transferOwnership (legacy + Tenant.ownerId sync)', () => {
  it('keeps legacy role-swap behavior unchanged when the target has no Owner record', async () => {
    // staff-manager-01 (tenant-samoon-01) has no corresponding Owner record.
    const result = await staffService.transferOwnership('staff-owner-01', 'staff-manager-01')
    expect(result.owner.roles).toContain('owner')
    expect(result.prevOwner.roles).toContain('admin')
    expect(result.prevOwner.roles).not.toContain('owner')

    // Tenant.ownerId is deliberately left unchanged — target has no Owner record.
    const tenants = await tenantService.getTenants()
    const samoon = tenants.find((t) => t.id === 'tenant-samoon-01')
    expect(samoon?.ownerId).toBe('owner-001')
  })

  it('synchronizes Tenant.ownerId when both source and target are backed by real Owner records', async () => {
    // staff-owner-01 (Olivia, owner-001) transfers to staff-centralfc-owner-01
    // (Jordan, owner-003) — both are structural Owners in the fixtures.
    const result = await staffService.transferOwnership('staff-owner-01', 'staff-centralfc-owner-01')
    expect(result.owner.roles).toContain('owner')
    expect(result.owner.ownerId).toBe('owner-003')

    const tenants = await tenantService.getTenants()
    const samoon = tenants.find((t) => t.id === 'tenant-samoon-01')
    expect(samoon?.ownerId).toBe('owner-003')
  })

  it('throws when transferring to oneself (unchanged legacy behavior)', async () => {
    await expect(staffService.transferOwnership('staff-owner-01', 'staff-owner-01')).rejects.toThrow()
  })

  it('throws when the source does not hold the owner role (unchanged legacy behavior)', async () => {
    await expect(staffService.transferOwnership('staff-manager-01', 'staff-cashier-01')).rejects.toThrow()
  })
})
