// ============================================================
// P10.3.1 audit — useAdminOrders()/useAdminReservations() had zero
// tenant-isolation enforcement even after P10.3 Phase E: they read
// getAdminOrders()/getAdminReservations(), whose mock filtering never
// scopes by tenant at all. Fixed by wiring assertOwnershipTenantAccess()
// the same way useStaff()/useAdminBranches() already were.
// ============================================================
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeEach } from 'vitest'
import { assertOwnershipTenantAccess } from '@/services/ownership-resolution.service'
import { ownerService } from '@/services/owner.service'
import { staffService } from '@/services/staff.service'
import { staffAssignmentService } from '@/services/staff-assignment.service'
import { tenantService } from '@/services/tenant.service'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

beforeEach(() => {
  ownerService._resetMockStore()
  staffService._resetMockStore()
  staffAssignmentService._resetMockStore()
  tenantService._resetMockList()
})

describe('P10.3.1 — useAdminOrders()/useAdminReservations() now enforce tenant isolation', () => {
  it('hooks/index.ts wires assertOwnershipTenantAccess into useAdminOrders', () => {
    const src = readFileSync(join(__dirname, '..', 'hooks', 'index.ts'), 'utf-8')
    const start = src.indexOf('export function useAdminOrders')
    const block = src.slice(start, start + 500)
    expect(block).toContain('assertOwnershipTenantAccess')
  })

  it('hooks/index.ts wires assertOwnershipTenantAccess into useAdminReservations', () => {
    const src = readFileSync(join(__dirname, '..', 'hooks', 'index.ts'), 'utf-8')
    const start = src.indexOf('export function useAdminReservations')
    const block = src.slice(start, start + 500)
    expect(block).toContain('assertOwnershipTenantAccess')
  })

  it('the underlying guard denies an identity with no relationship to the tenant (regression coverage for the shared guard)', async () => {
    await expect(assertOwnershipTenantAccess('john@example.com', 'tenant-samoon-01')).rejects.toThrow()
  })

  it('the underlying guard allows the tenant Owner (regression coverage for the shared guard)', async () => {
    await expect(assertOwnershipTenantAccess('owner@samoon.com', 'tenant-samoon-01')).resolves.toBeUndefined()
  })
})
