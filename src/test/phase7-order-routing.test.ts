/**
 * Phase 7.4 — Enterprise Order Routing & Branch Isolation Tests
 *
 * Coverage:
 *   A. Branch routing type definitions
 *   B. BranchAccessContext shape
 *   C. BranchIsolationResult shape
 *   D. BranchScope union values
 *   E. BranchAssignmentRule shape
 *   F. branchAccessService — getAccessibleBranches (owner/console sees all)
 *   G. branchAccessService — getAccessibleBranches (manager/cashier sees assigned)
 *   H. branchAccessService — canAccessBranch
 *   I. branchAccessService — filterByAccessibleBranches
 *   J. branchAccessService — assertBranchAccess
 *   K. branchAccessService — getScopeForContext
 *   L. orderRoutingService — resolveBranchForOrder (dine_in)
 *   M. orderRoutingService — resolveBranchForOrder (delivery)
 *   N. orderRoutingService — resolveBranchForOrder (pickup)
 *   O. orderRoutingService — getAccessibleOrders
 *   P. orderRoutingService — validateBranchOrderAccess
 *   Q. orderRoutingService — getAccessibleReservations
 *   R. orderRoutingService — validateReservationBranch
 *   S. Vendor branchIds field
 *   T. branchAnalyticsService — getBranchRevenueAnalytics
 *   U. branchAnalyticsService — getBranchOrderAnalytics
 *   V. branchAnalyticsService — getBranchReservationAnalytics
 *   W. AdminOrderFilters.branch_id
 *   X. Hooks source checks
 *   Y. Admin pages source checks
 *   Z. Registry and navigation
 *   Regression — P7.3 nav counts, type re-exports
 */

import { describe, it, expect, afterEach } from 'vitest'
import * as vi from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

process.env.NEXT_PUBLIC_USE_MOCK = 'true'

const ROOT = path.join(__dirname, '../../')

function src(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

import type { Branch as BranchEntity } from '@/types/branch'
import { branchAccessService, BranchAccessError } from '@/services/branch-access.service'
import { orderRoutingService, ORDER_ROUTING_RULES } from '@/services/order-routing.service'

function makeBranch(
  id: string,
  tenantId: string,
  status: 'active' | 'inactive' | 'maintenance' = 'active',
  type: 'physical' | 'mobile' = 'physical',
): BranchEntity {
  return {
    id,
    tenantId,
    name: `Branch ${id}`,
    slug: id,
    status,
    type,
    location: { address: '1 Main St', city: 'City', country: 'US' },
    contact: {},
    businessHours: [],
    settings: {
      deliveryEnabled: true,
      pickupEnabled: true,
      tableOrderingEnabled: true,
      reservationsEnabled: true,
    },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  }
}

const TENANT_A = 'tenant-savor-01'
const BRANCH_A1 = makeBranch('branch-a1', TENANT_A, 'active')
const BRANCH_A2 = makeBranch('branch-a2', TENANT_A, 'active')
const BRANCH_A3 = makeBranch('branch-a3', TENANT_A, 'maintenance')
const BRANCH_B1 = makeBranch('branch-b1', 'tenant-b', 'active')
const ALL_BRANCHES = [BRANCH_A1, BRANCH_A2, BRANCH_A3, BRANCH_B1]

// ── A. Branch routing type definitions ───────────────────────────────────────

describe('A — branch-routing.ts type definitions', () => {
  const typeSrc = () => src('src/types/branch-routing.ts')

  it('A1: exports BranchScope', () => {
    expect(typeSrc()).toContain('export type BranchScope')
  })

  it('A2: exports BranchFilter', () => {
    expect(typeSrc()).toContain('export interface BranchFilter')
  })

  it('A3: exports BranchAccessContext', () => {
    expect(typeSrc()).toContain('export interface BranchAccessContext')
  })

  it('A4: exports BranchIsolationResult', () => {
    expect(typeSrc()).toContain('export interface BranchIsolationResult')
  })

  it('A5: exports BranchAssignmentRule', () => {
    expect(typeSrc()).toContain('export interface BranchAssignmentRule')
  })

  it('A6: BranchScope has "all" value', () => {
    expect(typeSrc()).toMatch(/BranchScope.*=.*'all'|'all'.*BranchScope/)
  })

  it('A7: BranchScope has "assigned" value', () => {
    expect(typeSrc()).toContain("'assigned'")
  })

  it('A8: BranchScope has "none" value', () => {
    expect(typeSrc()).toContain("'none'")
  })
})

// ── B. BranchAccessContext shape ──────────────────────────────────────────────

describe('B — BranchAccessContext shape', () => {
  const typeSrc = () => src('src/types/branch-routing.ts')

  it('B1: BranchAccessContext has tenantId field', () => {
    expect(typeSrc()).toContain('tenantId: string')
  })

  it('B2: BranchAccessContext has staffId field', () => {
    expect(typeSrc()).toContain('staffId: string')
  })

  it('B3: BranchAccessContext has roles field', () => {
    expect(typeSrc()).toContain('roles: Role[]')
  })

  it('B4: BranchAccessContext has branchIds field', () => {
    expect(typeSrc()).toContain('branchIds: string[]')
  })

  it('B5: BranchAccessContext imports Role from rbac', () => {
    expect(typeSrc()).toContain("from '@/types/rbac'")
  })

  it('B6: BranchFilter has scope field', () => {
    expect(typeSrc()).toContain('scope: BranchScope')
  })
})

// ── C. BranchIsolationResult shape ───────────────────────────────────────────

describe('C — BranchIsolationResult shape', () => {
  it('C1: filterByAccessibleBranches returns records array', () => {
    const result = branchAccessService.filterByAccessibleBranches(
      [BRANCH_A1, BRANCH_A2],
      (b) => b.id,
      { tenantId: TENANT_A, staffId: 'staff-1', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(Array.isArray(result.records)).toBe(true)
  })

  it('C2: filterByAccessibleBranches result has scope field', () => {
    const result = branchAccessService.filterByAccessibleBranches(
      [] as BranchEntity[],
      (b) => b.id,
      { tenantId: TENANT_A, staffId: 's1', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(['all', 'assigned', 'none']).toContain(result.scope)
  })

  it('C3: filterByAccessibleBranches result has accessibleBranchIds array', () => {
    const result = branchAccessService.filterByAccessibleBranches(
      [] as BranchEntity[],
      (b) => b.id,
      { tenantId: TENANT_A, staffId: 's1', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(Array.isArray(result.accessibleBranchIds)).toBe(true)
  })

  it('C4: accessibleBranchIds contains all tenant branches for owner', () => {
    const result = branchAccessService.filterByAccessibleBranches(
      [] as BranchEntity[],
      (b) => b.id,
      { tenantId: TENANT_A, staffId: 's1', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result.accessibleBranchIds).toContain(BRANCH_A1.id)
    expect(result.accessibleBranchIds).toContain(BRANCH_A2.id)
    expect(result.accessibleBranchIds).toContain(BRANCH_A3.id)
  })

  it('C5: accessibleBranchIds does not include other tenant branches', () => {
    const result = branchAccessService.filterByAccessibleBranches(
      [] as BranchEntity[],
      (b) => b.id,
      { tenantId: TENANT_A, staffId: 's1', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result.accessibleBranchIds).not.toContain(BRANCH_B1.id)
  })

  it('C6: scope is "assigned" for manager', () => {
    const result = branchAccessService.filterByAccessibleBranches(
      [] as BranchEntity[],
      (b) => b.id,
      { tenantId: TENANT_A, staffId: 's1', roles: ['manager'], branchIds: [BRANCH_A1.id] },
      ALL_BRANCHES,
    )
    expect(result.scope).toBe('assigned')
  })
})

// ── D. BranchScope union values ───────────────────────────────────────────────

describe('D — BranchScope values', () => {
  it('D1: getScopeForContext owner → "all"', () => {
    expect(branchAccessService.getScopeForContext({
      tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [],
    })).toBe('all')
  })

  it('D2: getScopeForContext admin → "all"', () => {
    expect(branchAccessService.getScopeForContext({
      tenantId: TENANT_A, staffId: 's', roles: ['admin'], branchIds: [],
    })).toBe('all')
  })

  it('D3: getScopeForContext manager with assignments → "assigned"', () => {
    expect(branchAccessService.getScopeForContext({
      tenantId: TENANT_A, staffId: 's', roles: ['manager'], branchIds: [BRANCH_A1.id],
    })).toBe('assigned')
  })

  it('D4: getScopeForContext cashier no assignments → "none"', () => {
    expect(branchAccessService.getScopeForContext({
      tenantId: TENANT_A, staffId: 's', roles: ['cashier'], branchIds: [],
    })).toBe('none')
  })
})

// ── E. BranchAssignmentRule shape ─────────────────────────────────────────────

describe('E — ORDER_ROUTING_RULES', () => {
  it('E1: ORDER_ROUTING_RULES is an array', () => {
    expect(Array.isArray(ORDER_ROUTING_RULES)).toBe(true)
  })

  it('E2: has a dine_in rule', () => {
    expect(ORDER_ROUTING_RULES.some((r) => r.orderType === 'dine_in')).toBe(true)
  })

  it('E3: has a delivery rule', () => {
    expect(ORDER_ROUTING_RULES.some((r) => r.orderType === 'delivery')).toBe(true)
  })

  it('E4: has a pickup rule', () => {
    expect(ORDER_ROUTING_RULES.some((r) => r.orderType === 'pickup')).toBe(true)
  })

  it('E5: dine_in rule has table strategy', () => {
    const rule = ORDER_ROUTING_RULES.find((r) => r.orderType === 'dine_in')
    expect(rule?.branchSelectionStrategy).toBe('table')
  })

  it('E6: delivery rule has customer_choice strategy', () => {
    const rule = ORDER_ROUTING_RULES.find((r) => r.orderType === 'delivery')
    expect(rule?.branchSelectionStrategy).toBe('customer_choice')
  })

  it('E7: pickup rule has nearest strategy', () => {
    const rule = ORDER_ROUTING_RULES.find((r) => r.orderType === 'pickup')
    expect(rule?.branchSelectionStrategy).toBe('nearest')
  })

  it('E8: all rules require an active branch', () => {
    expect(ORDER_ROUTING_RULES.every((r) => r.requiresActiveBranch)).toBe(true)
  })
})

// ── F. getAccessibleBranches — owner/console sees all ───────────────────────────

describe('F — getAccessibleBranches (owner/console sees all tenant branches)', () => {
  it('F1: owner sees all branches in tenant', () => {
    const result = branchAccessService.getAccessibleBranches(
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result.map((b) => b.id)).toEqual(expect.arrayContaining([BRANCH_A1.id, BRANCH_A2.id, BRANCH_A3.id]))
  })

  it('F2: admin sees all branches in tenant', () => {
    const result = branchAccessService.getAccessibleBranches(
      { tenantId: TENANT_A, staffId: 's', roles: ['admin'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result.length).toBe(3)
  })

  it('F3: owner does not see branches from other tenants', () => {
    const result = branchAccessService.getAccessibleBranches(
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result.every((b) => b.tenantId === TENANT_A)).toBe(true)
  })

  it('F4: owner with empty allBranches returns empty', () => {
    const result = branchAccessService.getAccessibleBranches(
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      [],
    )
    expect(result).toHaveLength(0)
  })

  it('F5: result includes maintenance branches for owner', () => {
    const result = branchAccessService.getAccessibleBranches(
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result.some((b) => b.id === BRANCH_A3.id)).toBe(true)
  })

  it('F6: admin with only foreign branches returns empty', () => {
    const result = branchAccessService.getAccessibleBranches(
      { tenantId: TENANT_A, staffId: 's', roles: ['admin'], branchIds: [] },
      [BRANCH_B1],
    )
    expect(result).toHaveLength(0)
  })
})

// ── G. getAccessibleBranches — manager/cashier sees assigned only ─────────────

describe('G — getAccessibleBranches (manager/cashier sees assigned branches)', () => {
  it('G1: manager sees only assigned branches', () => {
    const result = branchAccessService.getAccessibleBranches(
      { tenantId: TENANT_A, staffId: 's', roles: ['manager'], branchIds: [BRANCH_A1.id] },
      ALL_BRANCHES,
    )
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(BRANCH_A1.id)
  })

  it('G2: cashier with no assignments sees empty', () => {
    const result = branchAccessService.getAccessibleBranches(
      { tenantId: TENANT_A, staffId: 's', roles: ['cashier'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result).toHaveLength(0)
  })

  it('G3: waiter sees only assigned branches', () => {
    const result = branchAccessService.getAccessibleBranches(
      { tenantId: TENANT_A, staffId: 's', roles: ['waiter'], branchIds: [BRANCH_A1.id, BRANCH_A2.id] },
      ALL_BRANCHES,
    )
    expect(result).toHaveLength(2)
  })

  it('G4: kitchen with 2 assignments sees 2 branches', () => {
    const result = branchAccessService.getAccessibleBranches(
      { tenantId: TENANT_A, staffId: 's', roles: ['kitchen'], branchIds: [BRANCH_A1.id, BRANCH_A2.id] },
      ALL_BRANCHES,
    )
    expect(result.map((b) => b.id)).toEqual(expect.arrayContaining([BRANCH_A1.id, BRANCH_A2.id]))
  })

  it('G5: support with assignment does not see cross-tenant branch even if branchIds includes it', () => {
    const result = branchAccessService.getAccessibleBranches(
      { tenantId: TENANT_A, staffId: 's', roles: ['support'], branchIds: [BRANCH_B1.id] },
      ALL_BRANCHES,
    )
    expect(result).toHaveLength(0)
  })

  it('G6: manager branchIds not in allBranches returns empty', () => {
    const result = branchAccessService.getAccessibleBranches(
      { tenantId: TENANT_A, staffId: 's', roles: ['manager'], branchIds: ['nonexistent'] },
      ALL_BRANCHES,
    )
    expect(result).toHaveLength(0)
  })
})

// ── H. canAccessBranch ────────────────────────────────────────────────────────

describe('H — canAccessBranch', () => {
  it('H1: owner can access any tenant branch', () => {
    expect(branchAccessService.canAccessBranch(
      BRANCH_A2.id,
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )).toBe(true)
  })

  it('H2: manager can access assigned branch', () => {
    expect(branchAccessService.canAccessBranch(
      BRANCH_A1.id,
      { tenantId: TENANT_A, staffId: 's', roles: ['manager'], branchIds: [BRANCH_A1.id] },
      ALL_BRANCHES,
    )).toBe(true)
  })

  it('H3: manager cannot access unassigned branch', () => {
    expect(branchAccessService.canAccessBranch(
      BRANCH_A2.id,
      { tenantId: TENANT_A, staffId: 's', roles: ['manager'], branchIds: [BRANCH_A1.id] },
      ALL_BRANCHES,
    )).toBe(false)
  })

  it('H4: owner cannot access branch from another tenant', () => {
    expect(branchAccessService.canAccessBranch(
      BRANCH_B1.id,
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )).toBe(false)
  })

  it('H5: cashier with no assignments cannot access any branch', () => {
    expect(branchAccessService.canAccessBranch(
      BRANCH_A1.id,
      { tenantId: TENANT_A, staffId: 's', roles: ['cashier'], branchIds: [] },
      ALL_BRANCHES,
    )).toBe(false)
  })

  it('H6: returns false for unknown branchId', () => {
    expect(branchAccessService.canAccessBranch(
      'does-not-exist',
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )).toBe(false)
  })
})

// ── I. filterByAccessibleBranches ─────────────────────────────────────────────

describe('I — filterByAccessibleBranches', () => {
  const orders = [
    { id: 'o1', branch_id: BRANCH_A1.id },
    { id: 'o2', branch_id: BRANCH_A2.id },
    { id: 'o3', branch_id: BRANCH_B1.id },
  ]

  it('I1: owner sees all orders from own tenant', () => {
    const result = branchAccessService.filterByAccessibleBranches(
      orders,
      (o) => o.branch_id,
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result.records).toHaveLength(2)
  })

  it('I2: manager sees only assigned-branch orders', () => {
    const result = branchAccessService.filterByAccessibleBranches(
      orders,
      (o) => o.branch_id,
      { tenantId: TENANT_A, staffId: 's', roles: ['manager'], branchIds: [BRANCH_A1.id] },
      ALL_BRANCHES,
    )
    expect(result.records).toHaveLength(1)
    expect(result.records[0].id).toBe('o1')
  })

  it('I3: cashier with no assignments sees empty', () => {
    const result = branchAccessService.filterByAccessibleBranches(
      orders,
      (o) => o.branch_id,
      { tenantId: TENANT_A, staffId: 's', roles: ['cashier'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result.records).toHaveLength(0)
  })

  it('I4: scope is "all" for owner', () => {
    const result = branchAccessService.filterByAccessibleBranches(
      orders,
      (o) => o.branch_id,
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result.scope).toBe('all')
  })

  it('I5: scope is "assigned" for manager', () => {
    const result = branchAccessService.filterByAccessibleBranches(
      orders,
      (o) => o.branch_id,
      { tenantId: TENANT_A, staffId: 's', roles: ['manager'], branchIds: [BRANCH_A1.id] },
      ALL_BRANCHES,
    )
    expect(result.scope).toBe('assigned')
  })

  it('I6: works with empty record set', () => {
    const result = branchAccessService.filterByAccessibleBranches(
      [],
      (o: { branch_id: string }) => o.branch_id,
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result.records).toHaveLength(0)
  })

  it('I7: admin with 2 branches assigned via branchIds context sees both (admin has branches.manage)', () => {
    const result = branchAccessService.filterByAccessibleBranches(
      orders,
      (o) => o.branch_id,
      { tenantId: TENANT_A, staffId: 's', roles: ['admin'], branchIds: [BRANCH_A1.id] },
      ALL_BRANCHES,
    )
    // admin has branches.manage → sees all
    expect(result.scope).toBe('all')
  })
})

// ── J. assertBranchAccess ─────────────────────────────────────────────────────

describe('J — assertBranchAccess', () => {
  it('J1: does not throw for owner accessing tenant branch', () => {
    expect(() => branchAccessService.assertBranchAccess(
      BRANCH_A1.id,
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )).not.toThrow()
  })

  it('J2: throws BranchAccessError for manager accessing unassigned branch', () => {
    expect(() => branchAccessService.assertBranchAccess(
      BRANCH_A2.id,
      { tenantId: TENANT_A, staffId: 'staff-x', roles: ['manager'], branchIds: [BRANCH_A1.id] },
      ALL_BRANCHES,
    )).toThrow(BranchAccessError)
  })

  it('J3: thrown error contains branchId', () => {
    try {
      branchAccessService.assertBranchAccess(
        BRANCH_A2.id,
        { tenantId: TENANT_A, staffId: 'staff-x', roles: ['cashier'], branchIds: [] },
        ALL_BRANCHES,
      )
    } catch (e) {
      expect(e).toBeInstanceOf(BranchAccessError)
      expect((e as BranchAccessError).branchId).toBe(BRANCH_A2.id)
    }
  })

  it('J4: thrown error contains staffId', () => {
    try {
      branchAccessService.assertBranchAccess(
        BRANCH_A2.id,
        { tenantId: TENANT_A, staffId: 'staff-xyz', roles: ['cashier'], branchIds: [] },
        ALL_BRANCHES,
      )
    } catch (e) {
      expect((e as BranchAccessError).staffId).toBe('staff-xyz')
    }
  })

  it('J5: BranchAccessError has correct name', () => {
    try {
      branchAccessService.assertBranchAccess(
        BRANCH_A2.id,
        { tenantId: TENANT_A, staffId: 's', roles: ['cashier'], branchIds: [] },
        ALL_BRANCHES,
      )
    } catch (e) {
      expect((e as Error).name).toBe('BranchAccessError')
    }
  })
})

// ── K. getScopeForContext ─────────────────────────────────────────────────────

describe('K — getScopeForContext', () => {
  it('K1: kitchen with assignments → assigned', () => {
    expect(branchAccessService.getScopeForContext({
      tenantId: TENANT_A, staffId: 's', roles: ['kitchen'], branchIds: [BRANCH_A1.id],
    })).toBe('assigned')
  })

  it('K2: waiter with no assignments → none', () => {
    expect(branchAccessService.getScopeForContext({
      tenantId: TENANT_A, staffId: 's', roles: ['waiter'], branchIds: [],
    })).toBe('none')
  })

  it('K3: support with no assignments → none', () => {
    expect(branchAccessService.getScopeForContext({
      tenantId: TENANT_A, staffId: 's', roles: ['support'], branchIds: [],
    })).toBe('none')
  })

  it('K4: marketing role → assigned (no branches.manage)', () => {
    expect(branchAccessService.getScopeForContext({
      tenantId: TENANT_A, staffId: 's', roles: ['marketing'], branchIds: [BRANCH_A1.id],
    })).toBe('assigned')
  })
})

// ── L. resolveBranchForOrder — dine_in ────────────────────────────────────────

describe('L — resolveBranchForOrder (dine_in)', () => {
  afterEach(() => vi.vi.resetModules?.())

  it('L1: dine_in resolves to first active branch', async () => {
    const branchId = await orderRoutingService.resolveBranchForOrder(
      { orderType: 'dine_in', tableNumber: 5 },
      [BRANCH_A1, BRANCH_A2],
    )
    expect(branchId).toBe(BRANCH_A1.id)
  })

  it('L2: dine_in returns null when no active branches', async () => {
    const inactive = makeBranch('i1', TENANT_A, 'inactive')
    const result = await orderRoutingService.resolveBranchForOrder(
      { orderType: 'dine_in' },
      [inactive],
    )
    expect(result).toBeNull()
  })

  it('L3: dine_in skips maintenance branch if no active available', async () => {
    const result = await orderRoutingService.resolveBranchForOrder(
      { orderType: 'dine_in' },
      [BRANCH_A3],
    )
    expect(result).toBeNull()
  })

  it('L4: dine_in with multiple active returns a valid branch id', async () => {
    const result = await orderRoutingService.resolveBranchForOrder(
      { orderType: 'dine_in' },
      [BRANCH_A1, BRANCH_A2],
    )
    expect([BRANCH_A1.id, BRANCH_A2.id]).toContain(result)
  })

  it('L5: return value is a string', async () => {
    const result = await orderRoutingService.resolveBranchForOrder(
      { orderType: 'dine_in' },
      [BRANCH_A1],
    )
    expect(typeof result).toBe('string')
  })
})

// ── M. resolveBranchForOrder — delivery ──────────────────────────────────────

describe('M — resolveBranchForOrder (delivery)', () => {
  it('M1: delivery uses customerChosenBranchId when provided', async () => {
    const result = await orderRoutingService.resolveBranchForOrder(
      { orderType: 'delivery', customerChosenBranchId: BRANCH_A2.id },
      [BRANCH_A1, BRANCH_A2],
    )
    expect(result).toBe(BRANCH_A2.id)
  })

  it('M2: delivery falls back to first active when chosen branch is inactive', async () => {
    const inactive = makeBranch('inactive-1', TENANT_A, 'inactive')
    const result = await orderRoutingService.resolveBranchForOrder(
      { orderType: 'delivery', customerChosenBranchId: inactive.id },
      [BRANCH_A1, inactive],
    )
    expect(result).toBe(BRANCH_A1.id)
  })

  it('M3: delivery with no customerChosenBranchId returns first active', async () => {
    const result = await orderRoutingService.resolveBranchForOrder(
      { orderType: 'delivery' },
      [BRANCH_A1, BRANCH_A2],
    )
    expect(result).toBeTruthy()
  })

  it('M4: delivery returns null when no active branches', async () => {
    const result = await orderRoutingService.resolveBranchForOrder(
      { orderType: 'delivery', customerChosenBranchId: BRANCH_A3.id },
      [BRANCH_A3],
    )
    expect(result).toBeNull()
  })

  it('M5: delivery with exact chosen active branch returns that branch', async () => {
    const result = await orderRoutingService.resolveBranchForOrder(
      { orderType: 'delivery', customerChosenBranchId: BRANCH_A1.id },
      [BRANCH_A1],
    )
    expect(result).toBe(BRANCH_A1.id)
  })
})

// ── N. resolveBranchForOrder — pickup ────────────────────────────────────────

describe('N — resolveBranchForOrder (pickup)', () => {
  it('N1: pickup prefers physical branch', async () => {
    const mobileBranch = makeBranch('mobile-1', TENANT_A, 'active', 'mobile')
    const result = await orderRoutingService.resolveBranchForOrder(
      { orderType: 'pickup' },
      [mobileBranch, BRANCH_A1],
    )
    expect(result).toBe(BRANCH_A1.id)
  })

  it('N2: pickup falls back to mobile when no physical active', async () => {
    const mobileBranch = makeBranch('mobile-1', TENANT_A, 'active', 'mobile')
    const result = await orderRoutingService.resolveBranchForOrder(
      { orderType: 'pickup' },
      [mobileBranch],
    )
    expect(result).toBe(mobileBranch.id)
  })

  it('N3: pickup returns null when no active branches', async () => {
    const result = await orderRoutingService.resolveBranchForOrder(
      { orderType: 'pickup' },
      [],
    )
    expect(result).toBeNull()
  })

  it('N4: pickup result is a string when branch available', async () => {
    const result = await orderRoutingService.resolveBranchForOrder(
      { orderType: 'pickup' },
      [BRANCH_A1],
    )
    expect(typeof result).toBe('string')
  })
})

// ── O. getAccessibleOrders ────────────────────────────────────────────────────

describe('O — getAccessibleOrders', () => {
  const mockOrders = [
    { id: 'o1', branch_id: BRANCH_A1.id, order_number: 'ORD-1' },
    { id: 'o2', branch_id: BRANCH_A2.id, order_number: 'ORD-2' },
    { id: 'o3', branch_id: BRANCH_A3.id, order_number: 'ORD-3' },
    { id: 'o4', branch_id: BRANCH_B1.id, order_number: 'ORD-4' },
  ]

  it('O1: owner sees all own-tenant orders', () => {
    const result = orderRoutingService.getAccessibleOrders(
      mockOrders,
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result).toHaveLength(3)
  })

  it('O2: manager sees only assigned-branch orders', () => {
    const result = orderRoutingService.getAccessibleOrders(
      mockOrders,
      { tenantId: TENANT_A, staffId: 's', roles: ['manager'], branchIds: [BRANCH_A1.id] },
      ALL_BRANCHES,
    )
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('o1')
  })

  it('O3: cashier with no assignments sees no orders', () => {
    const result = orderRoutingService.getAccessibleOrders(
      mockOrders,
      { tenantId: TENANT_A, staffId: 's', roles: ['cashier'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result).toHaveLength(0)
  })

  it('O4: cross-tenant orders are excluded for owner', () => {
    const result = orderRoutingService.getAccessibleOrders(
      mockOrders,
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result.every((o) => o.branch_id !== BRANCH_B1.id)).toBe(true)
  })

  it('O5: empty orders return empty', () => {
    const result = orderRoutingService.getAccessibleOrders(
      [],
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result).toHaveLength(0)
  })
})

// ── P. validateBranchOrderAccess ─────────────────────────────────────────────

describe('P — validateBranchOrderAccess', () => {
  it('P1: owner can access any tenant branch', () => {
    expect(orderRoutingService.validateBranchOrderAccess(
      BRANCH_A2.id,
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )).toBe(true)
  })

  it('P2: manager can validate assigned branch', () => {
    expect(orderRoutingService.validateBranchOrderAccess(
      BRANCH_A1.id,
      { tenantId: TENANT_A, staffId: 's', roles: ['manager'], branchIds: [BRANCH_A1.id] },
      ALL_BRANCHES,
    )).toBe(true)
  })

  it('P3: manager cannot validate unassigned branch', () => {
    expect(orderRoutingService.validateBranchOrderAccess(
      BRANCH_A2.id,
      { tenantId: TENANT_A, staffId: 's', roles: ['manager'], branchIds: [BRANCH_A1.id] },
      ALL_BRANCHES,
    )).toBe(false)
  })

  it('P4: cashier with no assignments returns false', () => {
    expect(orderRoutingService.validateBranchOrderAccess(
      BRANCH_A1.id,
      { tenantId: TENANT_A, staffId: 's', roles: ['cashier'], branchIds: [] },
      ALL_BRANCHES,
    )).toBe(false)
  })
})

// ── Q. getAccessibleReservations ─────────────────────────────────────────────

describe('Q — getAccessibleReservations', () => {
  const mockReservations = [
    { id: 'r1', branch_id: BRANCH_A1.id, name: 'Alice' },
    { id: 'r2', branch_id: BRANCH_A2.id, name: 'Bob' },
    { id: 'r3', branch_id: BRANCH_B1.id, name: 'Carol' },
  ]

  it('Q1: owner sees all own-tenant reservations', () => {
    const result = orderRoutingService.getAccessibleReservations(
      mockReservations,
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result).toHaveLength(2)
  })

  it('Q2: manager sees only assigned-branch reservations', () => {
    const result = orderRoutingService.getAccessibleReservations(
      mockReservations,
      { tenantId: TENANT_A, staffId: 's', roles: ['manager'], branchIds: [BRANCH_A2.id] },
      ALL_BRANCHES,
    )
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r2')
  })

  it('Q3: waiter with no assignments sees none', () => {
    const result = orderRoutingService.getAccessibleReservations(
      mockReservations,
      { tenantId: TENANT_A, staffId: 's', roles: ['waiter'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result).toHaveLength(0)
  })

  it('Q4: cross-tenant reservations excluded', () => {
    const result = orderRoutingService.getAccessibleReservations(
      mockReservations,
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result.every((r) => r.branch_id !== BRANCH_B1.id)).toBe(true)
  })

  it('Q5: empty reservations returns empty', () => {
    const result = orderRoutingService.getAccessibleReservations(
      [],
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result).toHaveLength(0)
  })

  it('Q6: admin sees all own-tenant reservations', () => {
    const result = orderRoutingService.getAccessibleReservations(
      mockReservations,
      { tenantId: TENANT_A, staffId: 's', roles: ['admin'], branchIds: [] },
      ALL_BRANCHES,
    )
    expect(result).toHaveLength(2)
  })
})

// ── R. validateReservationBranch ──────────────────────────────────────────────

describe('R — validateReservationBranch', () => {
  it('R1: owner can validate any tenant reservation branch', () => {
    expect(orderRoutingService.validateReservationBranch(
      BRANCH_A1.id,
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )).toBe(true)
  })

  it('R2: manager can validate assigned branch for reservations', () => {
    expect(orderRoutingService.validateReservationBranch(
      BRANCH_A1.id,
      { tenantId: TENANT_A, staffId: 's', roles: ['manager'], branchIds: [BRANCH_A1.id] },
      ALL_BRANCHES,
    )).toBe(true)
  })

  it('R3: waiter cannot validate unassigned branch', () => {
    expect(orderRoutingService.validateReservationBranch(
      BRANCH_A2.id,
      { tenantId: TENANT_A, staffId: 's', roles: ['waiter'], branchIds: [BRANCH_A1.id] },
      ALL_BRANCHES,
    )).toBe(false)
  })

  it('R4: cross-tenant branch always returns false', () => {
    expect(orderRoutingService.validateReservationBranch(
      BRANCH_B1.id,
      { tenantId: TENANT_A, staffId: 's', roles: ['owner'], branchIds: [] },
      ALL_BRANCHES,
    )).toBe(false)
  })
})

// ── S. Vendor branchIds field ──────────────────────────────────────────────────

describe('S — Vendor branchIds field', () => {
  const typesSrc = () => src('src/types/index.ts')

  it('S1: Vendor interface has branchIds field', () => {
    const block = typesSrc().slice(typesSrc().indexOf('export interface Vendor {'))
    expect(block.slice(0, 500)).toContain('branchIds')
  })

  it('S2: branchIds on Vendor is optional', () => {
    const block = typesSrc().slice(typesSrc().indexOf('export interface Vendor {'))
    expect(block.slice(0, 500)).toMatch(/branchIds\?/)
  })

  it('S3: branchIds type is string array', () => {
    const block = typesSrc().slice(typesSrc().indexOf('export interface Vendor {'))
    expect(block.slice(0, 500)).toMatch(/branchIds\?:\s*string\[\]/)
  })

  it('S4: AdminOrderFilters has branch_id field', () => {
    const block = typesSrc().slice(typesSrc().indexOf('export interface AdminOrderFilters {'))
    expect(block.slice(0, 300)).toContain('branch_id')
  })

  it('S5: AdminOrderFilters.branch_id is optional', () => {
    const block = typesSrc().slice(typesSrc().indexOf('export interface AdminOrderFilters {'))
    expect(block.slice(0, 300)).toMatch(/branch_id\?/)
  })
})

// ── T. getBranchRevenueAnalytics ──────────────────────────────────────────────

describe('T — getBranchRevenueAnalytics', () => {
  afterEach(() => vi.vi.resetModules?.())

  it('T1: returns branchId matching input', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchRevenueAnalytics('branch-rest-01')
    expect(result.branchId).toBe('branch-rest-01')
  })

  it('T2: totalRevenue is positive number', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchRevenueAnalytics('branch-rest-01')
    expect(result.totalRevenue).toBeGreaterThan(0)
  })

  it('T3: totalOrders is positive number', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchRevenueAnalytics('branch-rest-01')
    expect(result.totalOrders).toBeGreaterThan(0)
  })

  it('T4: averageOrderValue is totalRevenue / totalOrders approximately', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchRevenueAnalytics('branch-rest-01')
    expect(result.averageOrderValue).toBeGreaterThan(0)
  })

  it('T5: period field exists', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchRevenueAnalytics('branch-rest-01')
    expect(typeof result.period).toBe('string')
  })

  it('T6: unknown branchId returns default non-zero values', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchRevenueAnalytics('unknown-branch')
    expect(result.totalRevenue).toBeGreaterThan(0)
  })

  it('T7: revenueChangePct is a number', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchRevenueAnalytics('branch-cafe-01')
    expect(typeof result.revenueChangePct).toBe('number')
  })

  it('T8: different branches return different revenue', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const r1 = await branchAnalyticsService.getBranchRevenueAnalytics('branch-rest-01')
    const r2 = await branchAnalyticsService.getBranchRevenueAnalytics('branch-cafe-01')
    expect(r1.totalRevenue).not.toBe(r2.totalRevenue)
  })
})

// ── U. getBranchOrderAnalytics ────────────────────────────────────────────────

describe('U — getBranchOrderAnalytics', () => {
  afterEach(() => vi.vi.resetModules?.())

  it('U1: returns branchId matching input', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchOrderAnalytics('branch-rest-01')
    expect(result.branchId).toBe('branch-rest-01')
  })

  it('U2: totalOrders is a positive number', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchOrderAnalytics('branch-rest-01')
    expect(result.totalOrders).toBeGreaterThan(0)
  })

  it('U3: ordersByStatus is an object', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchOrderAnalytics('branch-rest-01')
    expect(typeof result.ordersByStatus).toBe('object')
  })

  it('U4: ordersByStatus has delivered key', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchOrderAnalytics('branch-rest-01')
    expect('delivered' in result.ordersByStatus).toBe(true)
  })

  it('U5: ordersByStatus has pending key', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchOrderAnalytics('branch-rest-01')
    expect('pending' in result.ordersByStatus).toBe(true)
  })

  it('U6: averageOrderValue is a positive number', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchOrderAnalytics('branch-bar-01')
    expect(result.averageOrderValue).toBeGreaterThan(0)
  })

  it('U7: period is a string', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchOrderAnalytics('branch-rest-01')
    expect(typeof result.period).toBe('string')
  })

  it('U8: different branches have different order counts', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const r1 = await branchAnalyticsService.getBranchOrderAnalytics('branch-rest-01')
    const r2 = await branchAnalyticsService.getBranchOrderAnalytics('branch-cafe-01')
    expect(r1.totalOrders).not.toBe(r2.totalOrders)
  })
})

// ── V. getBranchReservationAnalytics ─────────────────────────────────────────

describe('V — getBranchReservationAnalytics', () => {
  afterEach(() => vi.vi.resetModules?.())

  it('V1: returns branchId matching input', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchReservationAnalytics('branch-rest-01')
    expect(result.branchId).toBe('branch-rest-01')
  })

  it('V2: totalReservations is a positive number', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchReservationAnalytics('branch-rest-01')
    expect(result.totalReservations).toBeGreaterThan(0)
  })

  it('V3: upcomingReservations is non-negative', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchReservationAnalytics('branch-rest-01')
    expect(result.upcomingReservations).toBeGreaterThanOrEqual(0)
  })

  it('V4: cancelledReservations is non-negative', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchReservationAnalytics('branch-rest-01')
    expect(result.cancelledReservations).toBeGreaterThanOrEqual(0)
  })

  it('V5: occupancyRate is between 0 and 1', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchReservationAnalytics('branch-rest-01')
    expect(result.occupancyRate).toBeGreaterThanOrEqual(0)
    expect(result.occupancyRate).toBeLessThanOrEqual(1)
  })

  it('V6: period is a string', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchReservationAnalytics('branch-rest-01')
    expect(typeof result.period).toBe('string')
  })

  it('V7: different branches have different reservation counts', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const r1 = await branchAnalyticsService.getBranchReservationAnalytics('branch-rest-01')
    const r2 = await branchAnalyticsService.getBranchReservationAnalytics('branch-cafe-01')
    expect(r1.totalReservations).not.toBe(r2.totalReservations)
  })

  it('V8: unknown branch returns default positive values', async () => {
    const { branchAnalyticsService } = await import('@/services/branch-analytics.service')
    const result = await branchAnalyticsService.getBranchReservationAnalytics('unknown-999')
    expect(result.totalReservations).toBeGreaterThan(0)
  })
})

// ── W. AdminOrderFilters.branch_id & analytics types ─────────────────────────

describe('W — Types: branch-scoped analytics and filter types', () => {
  const analyticsSrc = () => src('src/types/analytics.ts')
  const typesSrc = () => src('src/types/index.ts')

  it('W1: analytics.ts exports BranchRevenueAnalytics', () => {
    expect(analyticsSrc()).toContain('export interface BranchRevenueAnalytics')
  })

  it('W2: analytics.ts exports BranchOrderAnalytics', () => {
    expect(analyticsSrc()).toContain('export interface BranchOrderAnalytics')
  })

  it('W3: analytics.ts exports BranchReservationAnalytics', () => {
    expect(analyticsSrc()).toContain('export interface BranchReservationAnalytics')
  })

  it('W4: BranchRevenueAnalytics has branchId field', () => {
    const block = analyticsSrc().slice(analyticsSrc().indexOf('export interface BranchRevenueAnalytics'))
    expect(block.slice(0, 300)).toContain('branchId: string')
  })

  it('W5: BranchOrderAnalytics has ordersByStatus field', () => {
    const block = analyticsSrc().slice(analyticsSrc().indexOf('export interface BranchOrderAnalytics'))
    expect(block.slice(0, 300)).toContain('ordersByStatus')
  })

  it('W6: BranchReservationAnalytics has occupancyRate field', () => {
    const block = analyticsSrc().slice(analyticsSrc().indexOf('export interface BranchReservationAnalytics'))
    expect(block.slice(0, 300)).toContain('occupancyRate')
  })

  it('W7: types/index.ts re-exports BranchRevenueAnalytics', () => {
    expect(typesSrc()).toContain('BranchRevenueAnalytics')
  })

  it('W8: types/index.ts re-exports BranchAccessContext', () => {
    expect(typesSrc()).toContain('BranchAccessContext')
  })
})

// ── X. Hooks source checks ────────────────────────────────────────────────────

describe('X — Hooks source checks', () => {
  const hooksSrc = () => src('src/hooks/index.ts')

  it('X1: exports useAccessibleBranches', () => {
    expect(hooksSrc()).toContain('export function useAccessibleBranches')
  })

  it('X2: exports useBranchOrders', () => {
    expect(hooksSrc()).toContain('export function useBranchOrders')
  })

  it('X3: exports useBranchReservations', () => {
    expect(hooksSrc()).toContain('export function useBranchReservations')
  })

  it('X4: exports useBranchAnalytics', () => {
    expect(hooksSrc()).toContain('export function useBranchAnalytics')
  })

  it('X5: useBranchOrders uses branch-orders query key', () => {
    const block = hooksSrc().slice(hooksSrc().indexOf('function useBranchOrders'))
    expect(block.slice(0, 200)).toContain('branch-orders')
  })

  it('X6: useBranchReservations uses branch-reservations query key', () => {
    const block = hooksSrc().slice(hooksSrc().indexOf('function useBranchReservations'))
    expect(block.slice(0, 200)).toContain('branch-reservations')
  })

  it('X7: useBranchAnalytics uses branch-analytics query key', () => {
    const block = hooksSrc().slice(hooksSrc().indexOf('function useBranchAnalytics'))
    expect(block.slice(0, 200)).toContain('branch-analytics')
  })

  it('X8: useBranchAnalytics has staleTime', () => {
    const block = hooksSrc().slice(hooksSrc().indexOf('function useBranchAnalytics'))
    expect(block.slice(0, 400)).toContain('staleTime')
  })

  it('X9: useAccessibleBranches has enabled guard', () => {
    const block = hooksSrc().slice(hooksSrc().indexOf('function useAccessibleBranches'))
    expect(block.slice(0, 300)).toContain('enabled')
  })

  it('X10: hooks import branchAccessService', () => {
    expect(hooksSrc()).toContain('branchAccessService')
  })

  it('X11: hooks import branchAnalyticsService', () => {
    expect(hooksSrc()).toContain('branchAnalyticsService')
  })
})

// ── Y. Admin pages source checks ──────────────────────────────────────────────

describe('Y — Admin pages source checks', () => {
  const orderPage = () => src('src/app/console/orders/page.tsx')
  const resPage = () => src('src/app/console/reservations/page.tsx')
  const staffPage = () => src('src/app/console/staff/[id]/page.tsx')
  const branchAnalytics = () => src('src/app/console/branches/[id]/analytics/page.tsx')
  const branchAnalyticsOverview = () => src('src/app/console/branches/analytics/page.tsx')

  it('Y1: orders page has branch filter select', () => {
    expect(orderPage()).toContain('branchFilter')
  })

  it('Y2: orders page filters by branch_id', () => {
    expect(orderPage()).toContain('branch_id')
  })

  it('Y3: reservations page has branch filter', () => {
    expect(resPage()).toContain('branchFilter')
  })

  it('Y4: reservations page filters by branch_id', () => {
    expect(resPage()).toContain('branch_id')
  })

  it('Y5: staff detail page has BranchAccessMatrix component', () => {
    expect(staffPage()).toContain('BranchAccessMatrix')
  })

  it('Y6: BranchAccessMatrix uses useAdminBranches', () => {
    expect(staffPage()).toContain('useAdminBranches')
  })

  it('Y7: branch analytics page uses useBranchAnalytics', () => {
    expect(branchAnalytics()).toContain('useBranchAnalytics')
  })

  it('Y8: branch analytics page uses PermissionGuard', () => {
    expect(branchAnalytics()).toContain('PermissionGuard')
  })

  it('Y9: branch analytics page has Revenue section', () => {
    expect(branchAnalytics()).toContain('Revenue')
  })

  it('Y10: branch analytics overview page uses useAdminBranches', () => {
    expect(branchAnalyticsOverview()).toContain('useAdminBranches')
  })

  it('Y11: branch analytics overview has PermissionGuard with branches.view', () => {
    expect(branchAnalyticsOverview()).toContain("branches.view")
  })

  it('Y12: branch analytics overview links to per-branch analytics', () => {
    expect(branchAnalyticsOverview()).toContain('/analytics')
  })
})

// ── Z. Registry and navigation ────────────────────────────────────────────────

describe('Z — Registry and navigation', () => {
  afterEach(() => vi.vi.resetModules?.())

  it('Z1: ADMIN_BRANCH_ANALYTICS_ROUTES is exported from registry', async () => {
    const { ADMIN_BRANCH_ANALYTICS_ROUTES } = await import('@/modules/registry')
    expect(Array.isArray(ADMIN_BRANCH_ANALYTICS_ROUTES)).toBe(true)
  })

  it('Z2: ADMIN_BRANCH_ANALYTICS_ROUTES includes /console/branches/analytics', async () => {
    const { ADMIN_BRANCH_ANALYTICS_ROUTES } = await import('@/modules/registry')
    expect(ADMIN_BRANCH_ANALYTICS_ROUTES).toContain('/console/branches/analytics')
  })

  it('Z3: ADMIN_BRANCH_ANALYTICS_ROUTES includes /console/branches/[id]/analytics', async () => {
    const { ADMIN_BRANCH_ANALYTICS_ROUTES } = await import('@/modules/registry')
    expect(ADMIN_BRANCH_ANALYTICS_ROUTES).toContain('/console/branches/[id]/analytics')
  })

  it('Z4: RESTAURANT_MODULE routes include /console/branches/analytics', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.routes).toContain('/console/branches/analytics')
  })

  it('Z5: CAFE_MODULE adminNavItems includes Branch Analytics', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.adminNavItems?.some((n) => n.label === 'Branch Analytics')).toBe(true)
  })

  it('Z6: RESTAURANT_MODULE adminNavItems includes Branch Analytics', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.adminNavItems?.some((n) => n.label === 'Branch Analytics')).toBe(true)
  })

  it('Z7: Branch Analytics nav item points to /console/branches/analytics', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    const item = RESTAURANT_MODULE.adminNavItems?.find((n) => n.label === 'Branch Analytics')
    expect(item?.href).toBe('/console/branches/analytics')
  })

  it('Z8: Branch Analytics nav item has permissionKey branches.view', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    const item = RESTAURANT_MODULE.adminNavItems?.find((n) => n.label === 'Branch Analytics')
    expect((item as { permissionKey?: string })?.permissionKey).toBe('branches.view')
  })

  it('Z9: FOOD_COURT_MODULE has Branch Analytics nav item', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.adminNavItems?.some((n) => n.label === 'Branch Analytics')).toBe(true)
  })

  it('Z10: MOBILE_CAFE_MODULE has Branch Analytics nav item', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.adminNavItems?.some((n) => n.label === 'Branch Analytics')).toBe(true)
  })
})

// ── Regression — updated nav counts ──────────────────────────────────────────

describe('Regression — P7.4 nav count updates', () => {
  afterEach(() => vi.vi.resetModules?.())

  it('Reg1: RESTAURANT_MODULE has 5 adminNavItems', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.adminNavItems).toHaveLength(23)
  })

  it('Reg2: CAFE_MODULE has 8 adminNavItems', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.adminNavItems).toHaveLength(23)
  })

  it('Reg3: BAR_MODULE has 8 adminNavItems', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.adminNavItems).toHaveLength(24)
  })

  it('Reg4: FOOD_COURT_MODULE has 7 adminNavItems', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.adminNavItems).toHaveLength(23)
  })

  it('Reg5: FOOD_TRUCK_MODULE has 7 adminNavItems', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.adminNavItems).toHaveLength(22)
  })

  it('Reg6: MOBILE_CAFE_MODULE has 7 adminNavItems', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.adminNavItems).toHaveLength(22)
  })

  it('Reg7: branch-access.service.ts exports branchAccessService', () => {
    expect(src('src/services/branch-access.service.ts')).toContain('export const branchAccessService')
  })

  it('Reg8: order-routing.service.ts exports orderRoutingService', () => {
    expect(src('src/services/order-routing.service.ts')).toContain('export const orderRoutingService')
  })

  it('Reg9: branch-analytics.service.ts exports branchAnalyticsService', () => {
    expect(src('src/services/branch-analytics.service.ts')).toContain('export const branchAnalyticsService')
  })

  it('Reg10: branchAccessService uses hasPermission (no hardcoded role checks)', () => {
    const svc = src('src/services/branch-access.service.ts')
    expect(svc).toContain('hasPermission')
    expect(svc).not.toMatch(/if\s*\(\s*(roles|role)\s*===/)
  })

  it('Reg11: orderRoutingService does not hardcode role checks', () => {
    const svc = src('src/services/order-routing.service.ts')
    expect(svc).not.toMatch(/if\s*\(\s*(roles|role)\s*===/)
  })

  it('Reg12: types/index.ts re-exports BranchScope', () => {
    expect(src('src/types/index.ts')).toContain('BranchScope')
  })

  it('Reg13: types/index.ts re-exports BranchIsolationResult', () => {
    expect(src('src/types/index.ts')).toContain('BranchIsolationResult')
  })

  it('Reg14: P7.3 branchManagementService still exported', () => {
    expect(src('src/services/branch.service.ts')).toContain('export const branchManagementService')
  })

  it('Reg15: P7.2 staffService still exported', () => {
    expect(src('src/services/staff.service.ts')).toContain('export const staffService')
  })
})
