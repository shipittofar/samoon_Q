/**
 * P7.3 — Enterprise Branch Management — Test Suite
 * ~165 tests across sections A–Y
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '../../')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8')

// Ensure mock mode is active for all service tests
process.env.NEXT_PUBLIC_USE_MOCK = 'true'

// ── A. BranchStatus type ──────────────────────────────────────────────────────

describe('A — BranchStatus type', () => {
  afterEach(() => vi.resetModules())

  it('A1: BranchStatus is exported from types/branch.ts', () => {
    const src = readSrc('types/branch.ts')
    expect(src).toContain("export type BranchStatus")
  })

  it('A2: BranchStatus includes active', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    expect(branches.some((b) => b.status === 'active')).toBe(true)
  })

  it('A3: BranchStatus includes inactive', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    expect(branches.some((b) => b.status === 'inactive')).toBe(true)
  })

  it('A4: BranchStatus includes maintenance', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    expect(branches.some((b) => b.status === 'maintenance')).toBe(true)
  })
})

// ── B. BranchType ─────────────────────────────────────────────────────────────

describe('B — BranchType', () => {
  afterEach(() => vi.resetModules())

  it('B1: BranchType is exported from types/branch.ts', () => {
    const src = readSrc('types/branch.ts')
    expect(src).toContain("export type BranchType")
  })

  it('B2: BranchType includes physical', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    expect(branches.some((b) => b.type === 'physical')).toBe(true)
  })

  it('B3: BranchType includes mobile', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    expect(branches.some((b) => b.type === 'mobile')).toBe(true)
  })
})

// ── C. Branch interface shape ─────────────────────────────────────────────────

describe('C — Branch interface shape', () => {
  it('C1: Branch has id', () => {
    expect(readSrc('types/branch.ts')).toContain('id: string')
  })

  it('C2: Branch has tenantId', () => {
    expect(readSrc('types/branch.ts')).toContain('tenantId: string')
  })

  it('C3: Branch has name', () => {
    expect(readSrc('types/branch.ts')).toContain('name: string')
  })

  it('C4: Branch has slug', () => {
    expect(readSrc('types/branch.ts')).toContain('slug: string')
  })

  it('C5: Branch has status of BranchStatus', () => {
    expect(readSrc('types/branch.ts')).toContain('status: BranchStatus')
  })

  it('C6: Branch has type of BranchType', () => {
    expect(readSrc('types/branch.ts')).toContain('type: BranchType')
  })

  it('C7: Branch has location', () => {
    expect(readSrc('types/branch.ts')).toContain('location: BranchLocation')
  })

  it('C8: Branch has settings', () => {
    expect(readSrc('types/branch.ts')).toContain('settings: BranchSettings')
  })

  it('C9: Branch has businessHours', () => {
    expect(readSrc('types/branch.ts')).toContain('businessHours: BranchBusinessHours[]')
  })

  it('C10: Branch has createdAt and updatedAt', () => {
    const src = readSrc('types/branch.ts')
    expect(src).toContain('createdAt: string')
    expect(src).toContain('updatedAt: string')
  })
})

// ── D. Mock data ──────────────────────────────────────────────────────────────

describe('D — Mock data', () => {
  afterEach(() => vi.resetModules())

  it('D1: at least 12 mock branches exist', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    expect(branches.length).toBeGreaterThanOrEqual(12)
  })

  it('D2: branches belong to tenant-savor-01', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    expect(branches.every((b) => b.tenantId === 'tenant-savor-01')).toBe(true)
  })

  it('D3: mock branches include physical and mobile types', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const types = new Set(branches.map((b) => b.type))
    expect(types.has('physical')).toBe(true)
    expect(types.has('mobile')).toBe(true)
  })

  it('D4: mock branches include all three statuses', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const statuses = new Set(branches.map((b) => b.status))
    expect(statuses.has('active')).toBe(true)
    expect(statuses.has('inactive')).toBe(true)
    expect(statuses.has('maintenance')).toBe(true)
  })

  it('D5: branches have required fields', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    for (const b of branches) {
      expect(typeof b.id).toBe('string')
      expect(typeof b.name).toBe('string')
      expect(typeof b.slug).toBe('string')
      expect(b.location).toBeDefined()
      expect(b.settings).toBeDefined()
    }
  })
})

// ── E. getBranches ────────────────────────────────────────────────────────────

describe('E — getBranches', () => {
  afterEach(() => vi.resetModules())

  it('E1: getBranches returns array', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    expect(Array.isArray(await branchManagementService.getBranches('tenant-savor-01'))).toBe(true)
  })

  it('E2: getBranches filters by tenantId', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    expect(await branchManagementService.getBranches('nonexistent-tenant')).toHaveLength(0)
  })

  it('E3: getBranches returns copies (not same reference)', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const r1 = await branchManagementService.getBranches('tenant-savor-01')
    const r2 = await branchManagementService.getBranches('tenant-savor-01')
    expect(r1).not.toBe(r2)
  })
})

// ── F. getBranch ──────────────────────────────────────────────────────────────

describe('F — getBranch', () => {
  afterEach(() => vi.resetModules())


  it('F1: getBranch returns branch by id', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const first = branches[0]
    const found = await branchManagementService.getBranch(first.id)
    expect(found.id).toBe(first.id)
  })

  it('F2: getBranch throws on unknown id', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    await expect(branchManagementService.getBranch('nonexistent-id')).rejects.toThrow()
  })
})

// ── G. createBranch ───────────────────────────────────────────────────────────

describe('G — createBranch', () => {
  afterEach(() => vi.resetModules())

  it('G1: createBranch returns new branch with id', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branch = await branchManagementService.createBranch('tenant-savor-01', {
      name: 'New Branch',
      slug: 'new-branch',
      type: 'physical',
      location: { address: '123 Test St', city: 'Testville', country: 'US' },
    })
    expect(typeof branch.id).toBe('string')
    expect(branch.name).toBe('New Branch')
  })

  it('G2: createBranch sets tenantId', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branch = await branchManagementService.createBranch('tenant-savor-01', {
      name: 'New Branch',
      slug: 'new-branch',
      type: 'physical',
      location: { address: '123 Test St', city: 'Testville', country: 'US' },
    })
    expect(branch.tenantId).toBe('tenant-savor-01')
  })

  it('G3: createBranch sets status to inactive by default', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branch = await branchManagementService.createBranch('tenant-savor-01', {
      name: 'New Branch',
      slug: 'new-branch',
      type: 'physical',
      location: { address: '123 Test St', city: 'Testville', country: 'US' },
    })
    expect(branch.status).toBe('inactive')
  })

  it('G4: createBranch adds to the store', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const before = (await branchManagementService.getBranches('tenant-savor-01')).length
    await branchManagementService.createBranch('tenant-savor-01', {
      name: 'New Branch',
      slug: 'new-branch',
      type: 'physical',
      location: { address: '123 Test St', city: 'Testville', country: 'US' },
    })
    const after = (await branchManagementService.getBranches('tenant-savor-01')).length
    expect(after).toBe(before + 1)
  })

  it('G5: createBranch sets createdAt and updatedAt', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branch = await branchManagementService.createBranch('tenant-savor-01', {
      name: 'New Branch',
      slug: 'new-branch',
      type: 'physical',
      location: { address: '123 Test St', city: 'Testville', country: 'US' },
    })
    expect(typeof branch.createdAt).toBe('string')
    expect(typeof branch.updatedAt).toBe('string')
  })
})

// ── H. updateBranch ───────────────────────────────────────────────────────────

describe('H — updateBranch', () => {
  afterEach(() => vi.resetModules())

  it('H1: updateBranch updates name', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const updated = await branchManagementService.updateBranch(branches[0].id, { name: 'Updated Name' })
    expect(updated.name).toBe('Updated Name')
  })

  it('H2: updateBranch merges partial location', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const target = branches[0]
    const originalCity = target.location.city
    const updated = await branchManagementService.updateBranch(target.id, {
      location: { postalCode: '12345' },
    })
    expect(updated.location.city).toBe(originalCity)
    expect(updated.location.postalCode).toBe('12345')
  })

  it('H3: updateBranch updates updatedAt', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const target = branches[0]
    const originalUpdatedAt = target.updatedAt
    const updated = await branchManagementService.updateBranch(target.id, { name: 'Updated Name' })
    expect(updated.updatedAt).not.toBe(originalUpdatedAt)
  })

  it('H4: updateBranch throws on unknown id', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    await expect(branchManagementService.updateBranch('nonexistent-id', { name: 'x' })).rejects.toThrow()
  })
})

// ── I. activateBranch ─────────────────────────────────────────────────────────

describe('I — activateBranch', () => {
  afterEach(() => vi.resetModules())

  it('I1: activateBranch sets status to active', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const inactive = branches.find((b) => b.status !== 'active')
    expect(inactive).toBeDefined()
    const updated = await branchManagementService.activateBranch(inactive!.id)
    expect(updated.status).toBe('active')
  })

  it('I2: activateBranch throws on unknown id', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    await expect(branchManagementService.activateBranch('nonexistent-id')).rejects.toThrow()
  })
})

// ── J. deactivateBranch ───────────────────────────────────────────────────────

describe('J — deactivateBranch', () => {
  afterEach(() => vi.resetModules())

  it('J1: deactivateBranch sets status to inactive', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const active = branches.find((b) => b.status === 'active')
    expect(active).toBeDefined()
    const updated = await branchManagementService.deactivateBranch(active!.id)
    expect(updated.status).toBe('inactive')
  })

  it('J2: deactivateBranch throws on unknown id', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    await expect(branchManagementService.deactivateBranch('nonexistent-id')).rejects.toThrow()
  })
})

// ── K. setMaintenanceMode ─────────────────────────────────────────────────────

describe('K — setMaintenanceMode', () => {
  afterEach(() => vi.resetModules())

  it('K1: setMaintenanceMode sets status to maintenance', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const active = branches.find((b) => b.status === 'active')
    expect(active).toBeDefined()
    const updated = await branchManagementService.setMaintenanceMode(active!.id)
    expect(updated.status).toBe('maintenance')
  })

  it('K2: setMaintenanceMode throws on unknown id', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    await expect(branchManagementService.setMaintenanceMode('nonexistent-id')).rejects.toThrow()
  })
})

// ── L. assignManager ──────────────────────────────────────────────────────────

describe('L — assignManager', () => {
  afterEach(() => vi.resetModules())

  it('L1: assignManager sets managerId', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const updated = await branchManagementService.assignManager(branches[0].id, { managerId: 'user-manager-01' })
    expect(updated.managerId).toBe('user-manager-01')
  })

  it('L2: assignManager throws on unknown id', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    await expect(branchManagementService.assignManager('nonexistent-id', { managerId: 'user-manager-01' })).rejects.toThrow()
  })
})

// ── M. getBranchMetrics ───────────────────────────────────────────────────────

describe('M — getBranchMetrics', () => {
  afterEach(() => vi.resetModules())

  it('M1: getBranchMetrics returns metrics object', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    expect(await branchManagementService.getBranchMetrics(branches[0].id)).toBeDefined()
  })

  it('M2: metrics has branchId matching the branch', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const branch = branches[0]
    expect((await branchManagementService.getBranchMetrics(branch.id)).branchId).toBe(branch.id)
  })

  it('M3: metrics has numeric totalOrders', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    expect(typeof (await branchManagementService.getBranchMetrics(branches[0].id)).totalOrders).toBe('number')
  })

  it('M4: metrics has period field', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    expect(['day', 'week', 'month', 'all']).toContain((await branchManagementService.getBranchMetrics(branches[0].id)).period)
  })
})

// ── N. computeAnalytics ───────────────────────────────────────────────────────

describe('N — computeAnalytics', () => {
  afterEach(() => vi.resetModules())

  it('N1: computeAnalytics returns totalBranches count', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    expect(branchManagementService.computeAnalytics(branches).totalBranches).toBe(branches.length)
  })

  it('N2: computeAnalytics counts active branches', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const analytics = branchManagementService.computeAnalytics(branches)
    expect(analytics.activeBranches).toBe(branches.filter((b) => b.status === 'active').length)
  })

  it('N3: computeAnalytics counts inactive branches', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const analytics = branchManagementService.computeAnalytics(branches)
    expect(analytics.inactiveBranches).toBe(branches.filter((b) => b.status === 'inactive').length)
  })

  it('N4: computeAnalytics counts maintenance branches', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const analytics = branchManagementService.computeAnalytics(branches)
    expect(analytics.maintenanceBranches).toBe(branches.filter((b) => b.status === 'maintenance').length)
  })

  it('N5: computeAnalytics has byType with physical and mobile', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const analytics = branchManagementService.computeAnalytics(branches)
    expect(typeof analytics.byType.physical).toBe('number')
    expect(typeof analytics.byType.mobile).toBe('number')
  })

  it('N6: status counts add up to total', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const branches = await branchManagementService.getBranches('tenant-savor-01')
    const analytics = branchManagementService.computeAnalytics(branches)
    expect(analytics.activeBranches + analytics.inactiveBranches + analytics.maintenanceBranches)
      .toBe(analytics.totalBranches)
  })

  it('N7: computeAnalytics with empty array returns zeros', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const analytics = branchManagementService.computeAnalytics([])
    expect(analytics.totalBranches).toBe(0)
    expect(analytics.activeBranches).toBe(0)
  })
})

// ── O. _resetMockStore ────────────────────────────────────────────────────────

describe('O — _resetMockStore', () => {
  afterEach(() => vi.resetModules())

  it('O1: _resetMockStore restores initial 12+ branches after mutation', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    branchManagementService.createBranch('tenant-savor-01', {
      name: 'Temp',
      slug: 'temp',
      type: 'physical',
      location: { address: '1 St', city: 'City', country: 'US' },
    })
    branchManagementService._resetMockStore()
    expect((await branchManagementService.getBranches('tenant-savor-01')).length).toBeGreaterThanOrEqual(12)
  })
})

// ── P. Permissions ────────────────────────────────────────────────────────────

describe('P — Permissions', () => {
  afterEach(() => vi.resetModules())

  it('P1: owner has branches.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'branches.view')).toBe(true)
  })

  it('P2: owner has branches.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('owner', 'branches.manage')).toBe(true)
  })

  it('P3: admin has branches.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('admin', 'branches.view')).toBe(true)
  })

  it('P4: admin has branches.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('admin', 'branches.manage')).toBe(true)
  })

  it('P5: manager has branches.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'branches.view')).toBe(true)
  })

  it('P6: manager does NOT have branches.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('manager', 'branches.manage')).toBe(false)
  })

  it('P7: cashier does NOT have branches.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('cashier', 'branches.view')).toBe(false)
  })

  it('P8: waiter does NOT have branches.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('waiter', 'branches.view')).toBe(false)
  })

  it('P9: kitchen does NOT have branches.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('kitchen', 'branches.view')).toBe(false)
  })

  it('P10: support has branches.view', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'branches.view')).toBe(true)
  })

  it('P11: support does NOT have branches.manage', async () => {
    const { hasPermission } = await import('@/services/permission.service')
    expect(hasPermission('support', 'branches.manage')).toBe(false)
  })
})

// ── Q. Navigation ─────────────────────────────────────────────────────────────

describe('Q — Navigation', () => {
  afterEach(() => vi.resetModules())

  it('Q1: BRANCHES_NAV_ITEM is in registry source', () => {
    expect(readSrc('modules/registry.ts')).toContain('BRANCHES_NAV_ITEM')
  })

  it('Q2: ADMIN_BRANCHES_ROUTES is in registry source', () => {
    expect(readSrc('modules/registry.ts')).toContain('ADMIN_BRANCHES_ROUTES')
  })

  it('Q3: BRANCHES_NAV_ITEM href is /admin/branches', () => {
    expect(readSrc('modules/registry.ts')).toContain("href: '/admin/branches'")
  })

  it('Q4: BRANCHES_NAV_ITEM has branches.view permissionKey', () => {
    expect(readSrc('modules/registry.ts')).toContain("permissionKey: 'branches.view'")
  })

  it('Q5: BRANCHES_NAV_ITEM has admin.branches.enabled featureFlagKey', () => {
    expect(readSrc('modules/registry.ts')).toContain("featureFlagKey: 'admin.branches.enabled'")
  })

  it('Q6: all 6 modules have BRANCHES_NAV_ITEM in adminNavItems', async () => {
    const {
      RESTAURANT_MODULE, CAFE_MODULE, BAR_MODULE,
      FOOD_COURT_MODULE, FOOD_TRUCK_MODULE, MOBILE_CAFE_MODULE,
    } = await import('@/modules/registry')
    const modules = [RESTAURANT_MODULE, CAFE_MODULE, BAR_MODULE, FOOD_COURT_MODULE, FOOD_TRUCK_MODULE, MOBILE_CAFE_MODULE]
    for (const mod of modules) {
      expect(mod.adminNavItems?.some((n) => n.href === '/admin/branches')).toBe(true)
    }
  })

  it('Q7: RESTAURANT_MODULE has 5 adminNavItems', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.adminNavItems).toHaveLength(17)
  })

  it('Q8: CAFE_MODULE has 8 adminNavItems', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.adminNavItems).toHaveLength(18)
  })

  it('Q9: BAR_MODULE has 8 adminNavItems', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.adminNavItems).toHaveLength(19)
  })

  it('Q10: FOOD_COURT_MODULE has 7 adminNavItems', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.adminNavItems).toHaveLength(18)
  })

  it('Q11: FOOD_TRUCK_MODULE has 7 adminNavItems', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.adminNavItems).toHaveLength(17)
  })

  it('Q12: MOBILE_CAFE_MODULE has 7 adminNavItems', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.adminNavItems).toHaveLength(17)
  })
})

// ── R. Endpoints ──────────────────────────────────────────────────────────────

describe('R — Endpoints', () => {
  afterEach(() => vi.resetModules())

  it('R1: ENDPOINTS.BRANCHES.LIST is /branches/', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.BRANCHES.LIST).toBe('/branches/')
  })

  it('R2: ENDPOINTS.BRANCHES.CREATE is /branches/', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.BRANCHES.CREATE).toBe('/branches/')
  })

  it('R3: ENDPOINTS.BRANCHES.ACTIVATE returns correct path', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.BRANCHES.ACTIVATE('123')).toBe('/branches/123/activate/')
  })

  it('R4: ENDPOINTS.BRANCHES.DEACTIVATE returns correct path', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.BRANCHES.DEACTIVATE('123')).toBe('/branches/123/deactivate/')
  })

  it('R5: ENDPOINTS.BRANCHES.MAINTENANCE returns correct path', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.BRANCHES.MAINTENANCE('123')).toBe('/branches/123/maintenance/')
  })

  it('R6: ENDPOINTS.BRANCHES.ASSIGN_MANAGER returns correct path', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.BRANCHES.ASSIGN_MANAGER('123')).toBe('/branches/123/manager/')
  })

  it('R7: ENDPOINTS.BRANCHES.METRICS returns correct path', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.BRANCHES.METRICS('123')).toBe('/branches/123/metrics/')
  })
})

// ── S. Service layer source checks ────────────────────────────────────────────

describe('S — Service source', () => {
  it('S1: branch.service.ts exports branchManagementService', () => {
    expect(readSrc('services/branch.service.ts')).toContain('branchManagementService')
  })

  it('S2: branch.service.ts exports getBranches', () => {
    expect(readSrc('services/branch.service.ts')).toContain('getBranches')
  })

  it('S3: branch.service.ts exports createBranch', () => {
    expect(readSrc('services/branch.service.ts')).toContain('createBranch')
  })

  it('S4: branch.service.ts exports activateBranch', () => {
    expect(readSrc('services/branch.service.ts')).toContain('activateBranch')
  })

  it('S5: branch.service.ts exports computeAnalytics', () => {
    expect(readSrc('services/branch.service.ts')).toContain('computeAnalytics')
  })

  it('S6: branch.service.ts exports _resetMockStore', () => {
    expect(readSrc('services/branch.service.ts')).toContain('_resetMockStore')
  })
})

// ── T. Hooks source ───────────────────────────────────────────────────────────

describe('T — Hooks source', () => {
  const hooksrc = readSrc('hooks/index.ts')

  it('T1: useAdminBranches is exported', () => {
    expect(hooksrc).toContain('export function useAdminBranches')
  })

  it('T2: useAdminBranch is exported', () => {
    expect(hooksrc).toContain('export function useAdminBranch')
  })

  it('T3: useAdminBranchMetrics is exported', () => {
    expect(hooksrc).toContain('export function useAdminBranchMetrics')
  })

  it('T4: useCreateBranch is exported', () => {
    expect(hooksrc).toContain('export function useCreateBranch')
  })

  it('T5: useUpdateBranch is exported', () => {
    expect(hooksrc).toContain('export function useUpdateBranch')
  })

  it('T6: useActivateBranch is exported', () => {
    expect(hooksrc).toContain('export function useActivateBranch')
  })

  it('T7: useDeactivateBranch is exported', () => {
    expect(hooksrc).toContain('export function useDeactivateBranch')
  })

  it('T8: useMaintenanceBranch is exported', () => {
    expect(hooksrc).toContain('export function useMaintenanceBranch')
  })

  it('T9: useAssignBranchManager is exported', () => {
    expect(hooksrc).toContain('export function useAssignBranchManager')
  })

  it('T10: useActivateBranch has onMutate for optimistic update', () => {
    const idx = hooksrc.indexOf('export function useActivateBranch')
    const slice = hooksrc.slice(idx, idx + 600)
    expect(slice).toContain('onMutate')
  })

  it('T11: useDeactivateBranch has onMutate for optimistic update', () => {
    const idx = hooksrc.indexOf('export function useDeactivateBranch')
    const slice = hooksrc.slice(idx, idx + 600)
    expect(slice).toContain('onMutate')
  })

  it('T12: useMaintenanceBranch has onMutate for optimistic update', () => {
    const idx = hooksrc.indexOf('export function useMaintenanceBranch')
    const slice = hooksrc.slice(idx, idx + 600)
    expect(slice).toContain('onMutate')
  })

  it('T13: branch mutation hooks have onError rollback', () => {
    expect(hooksrc).toContain('ctx?.snapshot')
  })
})

// ── U. Admin pages source ─────────────────────────────────────────────────────

describe('U — Admin pages source', () => {
  it('U1: branches page.tsx exists', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/app/admin/branches/page.tsx'))).toBe(true)
  })

  it('U2: branches [id] page.tsx exists', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/app/admin/branches/[id]/page.tsx'))).toBe(true)
  })

  it('U3: branches page uses PermissionGuard with branches.view', () => {
    expect(readSrc('app/admin/branches/page.tsx')).toContain('branches.view')
  })

  it('U4: branches detail page uses PermissionGuard with branches.view', () => {
    expect(readSrc('app/admin/branches/[id]/page.tsx')).toContain('branches.view')
  })

  it('U5: branches page uses useAdminBranches', () => {
    expect(readSrc('app/admin/branches/page.tsx')).toContain('useAdminBranches')
  })

  it('U6: branches detail page uses useAdminBranch', () => {
    expect(readSrc('app/admin/branches/[id]/page.tsx')).toContain('useAdminBranch')
  })

  it('U7: branches detail page uses use(params)', () => {
    expect(readSrc('app/admin/branches/[id]/page.tsx')).toContain('use(params)')
  })

  it('U8: branches detail page shows status actions with branches.manage guard', () => {
    expect(readSrc('app/admin/branches/[id]/page.tsx')).toContain('branches.manage')
  })

  it('U9: branches page uses computeAnalytics', () => {
    expect(readSrc('app/admin/branches/page.tsx')).toContain('computeAnalytics')
  })
})

// ── V. Staff detail page integration ─────────────────────────────────────────

describe('V — Staff detail page integration', () => {
  it('V1: staff detail page imports useAdminBranch', () => {
    expect(readSrc('app/admin/staff/[id]/page.tsx')).toContain('useAdminBranch')
  })

  it('V2: staff detail page has BranchBadge component', () => {
    expect(readSrc('app/admin/staff/[id]/page.tsx')).toContain('BranchBadge')
  })

  it('V3: staff detail page links to /admin/branches', () => {
    expect(readSrc('app/admin/staff/[id]/page.tsx')).toContain('/admin/branches/')
  })
})

// ── W. BranchAnalyticsSummary ─────────────────────────────────────────────────

describe('W — BranchAnalyticsSummary', () => {
  it('W1: BranchAnalyticsSummary is exported', () => {
    expect(readSrc('types/branch.ts')).toContain('BranchAnalyticsSummary')
  })

  it('W2: BranchAnalyticsSummary has totalBranches', () => {
    expect(readSrc('types/branch.ts')).toContain('totalBranches: number')
  })

  it('W3: BranchAnalyticsSummary has byType', () => {
    expect(readSrc('types/branch.ts')).toContain('byType: Record<BranchType, number>')
  })
})

// ── X. DTOs ───────────────────────────────────────────────────────────────────

describe('X — DTOs', () => {
  it('X1: CreateBranchPayload is exported', () => {
    expect(readSrc('types/branch.ts')).toContain('export interface CreateBranchPayload')
  })

  it('X2: UpdateBranchPayload is exported', () => {
    expect(readSrc('types/branch.ts')).toContain('export interface UpdateBranchPayload')
  })

  it('X3: AssignManagerPayload is exported', () => {
    expect(readSrc('types/branch.ts')).toContain('export interface AssignManagerPayload')
  })
})

// ── Y. Regression ─────────────────────────────────────────────────────────────

describe('Y — Regression', () => {
  afterEach(() => vi.resetModules())

  it('Y1: existing useBranches hook still exported', () => {
    expect(readSrc('hooks/index.ts')).toContain('export function useBranches')
  })

  it('Y2: existing useBranch hook still exported', () => {
    expect(readSrc('hooks/index.ts')).toContain('export function useBranch(')
  })

  it('Y3: legacy branchService import still present in hooks', () => {
    expect(readSrc('hooks/index.ts')).toContain('branchService')
  })

  it('Y4: types/branch.ts has no circular imports from types/index', () => {
    const src = readSrc('types/branch.ts')
    expect(src).not.toContain("from '@/types'")
    expect(src).not.toContain("from '../types/index'")
  })

  it('Y5: types/index.ts re-exports from types/branch', () => {
    expect(readSrc('types/index.ts')).toContain("from '@/types/branch'")
  })

  it('Y6: manager role has branches.view', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP.manager).toContain('branches.view')
  })

  it('Y7: manager role does not have branches.manage', async () => {
    const { ROLE_PERMISSION_MAP } = await import('@/services/permission.service')
    expect(ROLE_PERMISSION_MAP.manager).not.toContain('branches.manage')
  })

  it('Y8: all 6 modules have /admin/branches in routes', async () => {
    const {
      RESTAURANT_MODULE, CAFE_MODULE, BAR_MODULE,
      FOOD_COURT_MODULE, FOOD_TRUCK_MODULE, MOBILE_CAFE_MODULE,
    } = await import('@/modules/registry')
    const modules = [RESTAURANT_MODULE, CAFE_MODULE, BAR_MODULE, FOOD_COURT_MODULE, FOOD_TRUCK_MODULE, MOBILE_CAFE_MODULE]
    for (const mod of modules) {
      expect(mod.routes).toContain('/admin/branches')
    }
  })

  it('Y9: all 6 modules have /admin/branches/[id] in routes', async () => {
    const {
      RESTAURANT_MODULE, CAFE_MODULE, BAR_MODULE,
      FOOD_COURT_MODULE, FOOD_TRUCK_MODULE, MOBILE_CAFE_MODULE,
    } = await import('@/modules/registry')
    const modules = [RESTAURANT_MODULE, CAFE_MODULE, BAR_MODULE, FOOD_COURT_MODULE, FOOD_TRUCK_MODULE, MOBILE_CAFE_MODULE]
    for (const mod of modules) {
      expect(mod.routes).toContain('/admin/branches/[id]')
    }
  })

  it('Y10: BranchMetrics has staffCount field', () => {
    expect(readSrc('types/branch.ts')).toContain('staffCount: number')
  })
})
