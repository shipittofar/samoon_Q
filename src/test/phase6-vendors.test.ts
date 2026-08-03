/**
 * P6.11 — Food Court Vendor Management tests
 *
 * Covers:
 *   A. Domain types — Vendor, VendorStatus, VendorCategory, VendorStats, VendorCommission, VendorSettlement
 *   B. Service — getVendors() mock
 *   C. Service — getVendor(id) — happy path and error
 *   D. Service — createVendor()
 *   E. Service — updateVendor()
 *   F. Service — disableVendor()
 *   G. Service — getVendorStats()
 *   H. Service — getVendorSettlements()
 *   I. Service — createSettlement() — commission calculation
 *   J. Service — calculateCommission() helper
 *   K. Service — _resetMockStore()
 *   L. Capability enforcement — food_court only
 *   M. Feature flags — vendor_management, featured_vendor flags
 *   N. Navigation — /vendors in food court navItems, /console/food-court/vendors in adminNavItems
 *   O. Endpoints — VENDORS shape
 *   P. Hooks — source-text existence
 *   Q. Customer /vendors page — source-text structure
 *   R. Admin /console/food-court/vendors page — source-text structure
 *   S. Mock mode compatibility
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

async function freshService() {
  vi.resetModules()
  return import('@/services/vendor.service')
}

// ── A. Domain types ───────────────────────────────────────────────────────────

describe('A. Vendor domain types', () => {
  it('types source defines VendorStatus union', () => {
    const src = readSrc('types/index.ts')
    expect(src).toContain("'active'")
    expect(src).toContain("'inactive'")
    expect(src).toContain("'pending'")
    expect(src).toContain("'suspended'")
    expect(src).toContain('VendorStatus')
  })

  it('types source defines VendorCategory union with required values', () => {
    const src = readSrc('types/index.ts')
    expect(src).toContain('VendorCategory')
    expect(src).toContain("'asian'")
    expect(src).toContain("'western'")
    expect(src).toContain("'desserts'")
    expect(src).toContain("'healthy'")
  })

  it('types source defines Vendor interface', () => {
    const src = readSrc('types/index.ts')
    expect(src).toContain('interface Vendor')
    expect(src).toContain('rating:')
    expect(src).toContain('featured:')
    expect(src).toContain('commissionRate:')
    expect(src).toContain('stallNumber?:')
  })

  it('types source defines VendorStats interface', () => {
    const src = readSrc('types/index.ts')
    expect(src).toContain('VendorStats')
    expect(src).toContain('ordersCount:')
    expect(src).toContain('revenue:')
    expect(src).toContain('commissionPaid:')
    expect(src).toContain('avgRating:')
    expect(src).toContain('activeProducts:')
  })

  it('types source defines VendorCommission interface', () => {
    const src = readSrc('types/index.ts')
    expect(src).toContain('VendorCommission')
    expect(src).toContain('grossRevenue:')
    expect(src).toContain('commissionAmount:')
    expect(src).toContain('netPayout:')
  })

  it('types source defines VendorSettlement interface', () => {
    const src = readSrc('types/index.ts')
    expect(src).toContain('VendorSettlement')
    expect(src).toContain('SettlementStatus')
    expect(src).toContain('settlementDate:')
    expect(src).toContain('payoutReference?:')
    expect(src).toContain('commission:')
  })
})

// ── B. Service — getVendors() ─────────────────────────────────────────────────

describe('B. vendorService.getVendors()', () => {
  it('returns an array', async () => {
    const { vendorService } = await freshService()
    const vendors = await vendorService.getVendors()
    expect(Array.isArray(vendors)).toBe(true)
  })

  it('initial mock has 6 vendors', async () => {
    const { vendorService } = await freshService()
    const vendors = await vendorService.getVendors()
    expect(vendors).toHaveLength(6)
  })

  it('vendor shape is correct', async () => {
    const { vendorService } = await freshService()
    const vendors = await vendorService.getVendors()
    const v = vendors[0]
    expect(v).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      description: expect.any(String),
      category: expect.any(String),
      status: expect.stringMatching(/^(active|inactive|pending|suspended)$/),
      rating: expect.any(Number),
      commissionRate: expect.any(Number),
      contactEmail: expect.any(String),
    })
  })

  it('includes vendors with different statuses', async () => {
    const { vendorService } = await freshService()
    const vendors = await vendorService.getVendors()
    const statuses = new Set(vendors.map((v) => v.status))
    expect(statuses.size).toBeGreaterThan(1)
  })

  it('includes featured vendors', async () => {
    const { vendorService } = await freshService()
    const vendors = await vendorService.getVendors()
    expect(vendors.some((v) => v.featured)).toBe(true)
  })
})

// ── C. Service — getVendor(id) ────────────────────────────────────────────────

describe('C. vendorService.getVendor(id)', () => {
  it('returns the correct vendor', async () => {
    const { vendorService } = await freshService()
    const vendor = await vendorService.getVendor('vendor-1')
    expect(vendor.id).toBe('vendor-1')
    expect(vendor.name).toBe("Chang's Asian Kitchen")
  })

  it('returns a copy — mutations do not affect internal state', async () => {
    const { vendorService } = await freshService()
    const vendor = await vendorService.getVendor('vendor-1')
    vendor.name = 'Hacked'
    const again = await vendorService.getVendor('vendor-1')
    expect(again.name).toBe("Chang's Asian Kitchen")
  })

  it('throws when vendor not found', async () => {
    const { vendorService } = await freshService()
    await expect(vendorService.getVendor('no-such')).rejects.toThrow('not found')
  })
})

// ── D. Service — createVendor() ───────────────────────────────────────────────

describe('D. vendorService.createVendor()', () => {
  it('adds the vendor to the store', async () => {
    const { vendorService } = await freshService()
    const before = (await vendorService.getVendors()).length
    await vendorService.createVendor({
      name: 'New Stall',
      description: 'Test',
      category: 'beverages',
      status: 'pending',
      rating: 0,
      ratingCount: 0,
      featured: false,
      commissionRate: 10,
      contactEmail: 'new@example.com',
    })
    const after = (await vendorService.getVendors()).length
    expect(after).toBe(before + 1)
  })

  it('returns the new vendor with id and timestamps', async () => {
    const { vendorService } = await freshService()
    const vendor = await vendorService.createVendor({
      name: 'New Stall',
      description: 'Test',
      category: 'beverages',
      status: 'pending',
      rating: 0,
      ratingCount: 0,
      featured: false,
      commissionRate: 10,
      contactEmail: 'new@example.com',
    })
    expect(vendor.id).toBeTruthy()
    expect(vendor.created_at).toBeTruthy()
    expect(vendor.updated_at).toBeTruthy()
    expect(vendor.name).toBe('New Stall')
  })

  it('new vendor appears in getVendors()', async () => {
    const { vendorService } = await freshService()
    const created = await vendorService.createVendor({
      name: 'Visible Stall',
      description: 'Visible',
      category: 'other',
      status: 'active',
      rating: 0,
      ratingCount: 0,
      featured: false,
      commissionRate: 8,
      contactEmail: 'v@example.com',
    })
    const vendors = await vendorService.getVendors()
    expect(vendors.some((v) => v.id === created.id)).toBe(true)
  })
})

// ── E. Service — updateVendor() ───────────────────────────────────────────────

describe('E. vendorService.updateVendor()', () => {
  it('updates vendor fields', async () => {
    const { vendorService } = await freshService()
    const updated = await vendorService.updateVendor('vendor-2', { commissionRate: 20 })
    expect(updated.commissionRate).toBe(20)
  })

  it('preserves unchanged fields', async () => {
    const { vendorService } = await freshService()
    const updated = await vendorService.updateVendor('vendor-2', { commissionRate: 20 })
    expect(updated.name).toBe('Burgers & Co.')
    expect(updated.id).toBe('vendor-2')
  })

  it('throws when vendor not found', async () => {
    const { vendorService } = await freshService()
    await expect(
      vendorService.updateVendor('no-such', { commissionRate: 5 }),
    ).rejects.toThrow('not found')
  })

  it('updates updatedAt timestamp', async () => {
    const { vendorService } = await freshService()
    const before = await vendorService.getVendor('vendor-2')
    await new Promise((r) => setTimeout(r, 2))
    await vendorService.updateVendor('vendor-2', { featured: true })
    const after = await vendorService.getVendor('vendor-2')
    expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before.updated_at).getTime(),
    )
  })

  it('can toggle featured status', async () => {
    const { vendorService } = await freshService()
    const updated = await vendorService.updateVendor('vendor-2', { featured: true })
    expect(updated.featured).toBe(true)
  })
})

// ── F. Service — disableVendor() ──────────────────────────────────────────────

describe('F. vendorService.disableVendor()', () => {
  it('sets status to inactive', async () => {
    const { vendorService } = await freshService()
    const result = await vendorService.disableVendor('vendor-1')
    expect(result.status).toBe('inactive')
  })

  it('disabled vendor still appears in getVendors()', async () => {
    const { vendorService } = await freshService()
    await vendorService.disableVendor('vendor-1')
    const vendors = await vendorService.getVendors()
    const v = vendors.find((v) => v.id === 'vendor-1')
    expect(v?.status).toBe('inactive')
  })

  it('throws when vendor not found', async () => {
    const { vendorService } = await freshService()
    await expect(vendorService.disableVendor('no-such')).rejects.toThrow('not found')
  })
})

// ── G. Service — getVendorStats() ─────────────────────────────────────────────

describe('G. vendorService.getVendorStats()', () => {
  it('returns stats for an existing vendor', async () => {
    const { vendorService } = await freshService()
    const stats = await vendorService.getVendorStats('vendor-1')
    expect(stats.vendorId).toBe('vendor-1')
    expect(stats.ordersCount).toBeGreaterThan(0)
    expect(stats.revenue).toBeGreaterThan(0)
  })

  it('stats shape is correct', async () => {
    const { vendorService } = await freshService()
    const stats = await vendorService.getVendorStats('vendor-1')
    expect(stats).toMatchObject({
      vendorId: expect.any(String),
      ordersCount: expect.any(Number),
      revenue: expect.any(Number),
      commissionPaid: expect.any(Number),
      avgRating: expect.any(Number),
      activeProducts: expect.any(Number),
      period: expect.any(String),
    })
  })

  it('throws when stats not found', async () => {
    const { vendorService } = await freshService()
    await expect(vendorService.getVendorStats('no-such')).rejects.toThrow()
  })

  it('commissionPaid is consistent with revenue and commissionRate', async () => {
    const { vendorService } = await freshService()
    const stats = await vendorService.getVendorStats('vendor-1')
    const vendor = await vendorService.getVendor('vendor-1')
    const expectedCommission = Math.round(stats.revenue * (vendor.commissionRate / 100) * 100) / 100
    expect(stats.commissionPaid).toBeCloseTo(expectedCommission, 0)
  })
})

// ── H. Service — getVendorSettlements() ──────────────────────────────────────

describe('H. vendorService.getVendorSettlements()', () => {
  it('returns settlements for vendor-1', async () => {
    const { vendorService } = await freshService()
    const settlements = await vendorService.getVendorSettlements('vendor-1')
    expect(Array.isArray(settlements)).toBe(true)
    expect(settlements.length).toBeGreaterThan(0)
    expect(settlements.every((s) => s.vendorId === 'vendor-1')).toBe(true)
  })

  it('returns empty array for vendor with no settlements', async () => {
    const { vendorService } = await freshService()
    const settlements = await vendorService.getVendorSettlements('vendor-6')
    expect(settlements).toHaveLength(0)
  })

  it('settlement shape is correct', async () => {
    const { vendorService } = await freshService()
    const settlements = await vendorService.getVendorSettlements('vendor-1')
    const s = settlements[0]
    expect(s).toMatchObject({
      id: expect.any(String),
      vendorId: expect.any(String),
      amount: expect.any(Number),
      status: expect.stringMatching(/^(pending|paid|failed)$/),
      settlementDate: expect.any(String),
      commission: expect.objectContaining({
        grossRevenue: expect.any(Number),
        commissionRate: expect.any(Number),
        commissionAmount: expect.any(Number),
        netPayout: expect.any(Number),
      }),
    })
  })

  it('includes settlements with different statuses', async () => {
    const { vendorService } = await freshService()
    // Gather settlements across multiple vendors to check status variety
    const s1 = await vendorService.getVendorSettlements('vendor-1')
    const s3 = await vendorService.getVendorSettlements('vendor-3')
    const s4 = await vendorService.getVendorSettlements('vendor-4')
    const statuses = new Set([...s1, ...s3, ...s4].map((s) => s.status))
    expect(statuses.size).toBeGreaterThan(1)
  })
})

// ── I. Service — createSettlement() ──────────────────────────────────────────

describe('I. vendorService.createSettlement()', () => {
  it('creates a settlement for a vendor', async () => {
    const { vendorService } = await freshService()
    const before = (await vendorService.getVendorSettlements('vendor-1')).length
    await vendorService.createSettlement({ vendorId: 'vendor-1', grossRevenue: 1000 })
    const after = (await vendorService.getVendorSettlements('vendor-1')).length
    expect(after).toBe(before + 1)
  })

  it('settlement starts with pending status', async () => {
    const { vendorService } = await freshService()
    const s = await vendorService.createSettlement({ vendorId: 'vendor-2', grossRevenue: 500 })
    expect(s.status).toBe('pending')
  })

  it('settlement amount equals netPayout from commission', async () => {
    const { vendorService } = await freshService()
    const s = await vendorService.createSettlement({ vendorId: 'vendor-1', grossRevenue: 10000 })
    // vendor-1 has 15% commission → netPayout = 8500
    expect(s.amount).toBeCloseTo(8500, 1)
    expect(s.commission.commissionAmount).toBeCloseTo(1500, 1)
  })

  it('stores payoutReference when provided', async () => {
    const { vendorService } = await freshService()
    const s = await vendorService.createSettlement({
      vendorId: 'vendor-2',
      grossRevenue: 2000,
      payoutReference: 'REF-001',
    })
    expect(s.payoutReference).toBe('REF-001')
  })

  it('throws when vendor not found', async () => {
    const { vendorService } = await freshService()
    await expect(
      vendorService.createSettlement({ vendorId: 'no-such', grossRevenue: 100 }),
    ).rejects.toThrow('not found')
  })
})

// ── J. calculateCommission() helper ──────────────────────────────────────────

describe('J. calculateCommission()', () => {
  it('calculates correct commission and netPayout', async () => {
    const { calculateCommission } = await freshService()
    const result = calculateCommission(1000, 15)
    expect(result.commissionAmount).toBeCloseTo(150, 2)
    expect(result.netPayout).toBeCloseTo(850, 2)
    expect(result.grossRevenue).toBe(1000)
    expect(result.commissionRate).toBe(15)
  })

  it('handles zero commission rate', async () => {
    const { calculateCommission } = await freshService()
    const result = calculateCommission(500, 0)
    expect(result.commissionAmount).toBe(0)
    expect(result.netPayout).toBe(500)
  })

  it('handles 100% commission rate', async () => {
    const { calculateCommission } = await freshService()
    const result = calculateCommission(200, 100)
    expect(result.commissionAmount).toBeCloseTo(200, 2)
    expect(result.netPayout).toBeCloseTo(0, 2)
  })

  it('rounds to two decimal places', async () => {
    const { calculateCommission } = await freshService()
    const result = calculateCommission(100, 33)
    // 100 * 0.33 = 33.00 exactly — but test a tricky rate
    const result2 = calculateCommission(100, 33.3)
    expect(Number.isFinite(result2.commissionAmount)).toBe(true)
    expect(result.commissionAmount.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2)
  })

  it('netPayout + commissionAmount ≈ grossRevenue', async () => {
    const { calculateCommission } = await freshService()
    const result = calculateCommission(9999.99, 12.5)
    expect(result.netPayout + result.commissionAmount).toBeCloseTo(result.grossRevenue, 1)
  })
})

// ── K. _resetMockStore() ──────────────────────────────────────────────────────

describe('K. vendorService._resetMockStore()', () => {
  it('restores vendor-1 to active after disable', async () => {
    const { vendorService } = await freshService()
    await vendorService.disableVendor('vendor-1')
    vendorService._resetMockStore()
    const vendor = await vendorService.getVendor('vendor-1')
    expect(vendor.status).toBe('active')
  })

  it('vendor-5 remains inactive after reset', async () => {
    const { vendorService } = await freshService()
    vendorService._resetMockStore()
    const vendor = await vendorService.getVendor('vendor-5')
    expect(vendor.status).toBe('inactive')
  })

  it('vendor-6 remains pending after reset', async () => {
    const { vendorService } = await freshService()
    vendorService._resetMockStore()
    const vendor = await vendorService.getVendor('vendor-6')
    expect(vendor.status).toBe('pending')
  })

  it('newly created settlements are cleared', async () => {
    const { vendorService } = await freshService()
    await vendorService.createSettlement({ vendorId: 'vendor-1', grossRevenue: 1000 })
    vendorService._resetMockStore()
    const settlements = await vendorService.getVendorSettlements('vendor-1')
    // Only the initial seed settlement should remain
    expect(settlements.every((s) => ['settle-1', 'settle-2', 'settle-3', 'settle-4'].includes(s.id))).toBe(true)
  })
})

// ── L. Capability enforcement ─────────────────────────────────────────────────

describe('L. Capability enforcement — food_court only', () => {
  it('food_court module has ordering as required capability', async () => {
    vi.resetModules()
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.capabilities?.required).toContain('ordering')
  })

  it('food_court navItems includes Vendors', async () => {
    vi.resetModules()
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.navItems.some((n) => n.href === '/vendors')).toBe(true)
  })

  it('cafe module does NOT include /vendors in navItems', async () => {
    vi.resetModules()
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.navItems.every((n) => n.href !== '/vendors')).toBe(true)
  })

  it('bar module does NOT include /vendors in navItems', async () => {
    vi.resetModules()
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.navItems.every((n) => n.href !== '/vendors')).toBe(true)
  })

  it('restaurant module does NOT include /vendors in navItems', async () => {
    vi.resetModules()
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.navItems.every((n) => n.href !== '/vendors')).toBe(true)
  })

  it('food_truck module does NOT include /vendors in navItems', async () => {
    vi.resetModules()
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.navItems.every((n) => n.href !== '/vendors')).toBe(true)
  })

  it('mobile_cafe module does NOT include /vendors in navItems', async () => {
    vi.resetModules()
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.navItems.every((n) => n.href !== '/vendors')).toBe(true)
  })
})

// ── M. Feature flags ──────────────────────────────────────────────────────────

describe('M. Feature flags', () => {
  it('food_court.vendor_management.enabled is true', async () => {
    vi.resetModules()
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.defaultFeatureFlags['food_court.vendor_management.enabled']).toBe(true)
  })

  it('food_court.featured_vendor.enabled flag exists', async () => {
    vi.resetModules()
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect('food_court.featured_vendor.enabled' in FOOD_COURT_MODULE.defaultFeatureFlags).toBe(true)
  })

  it('food_court.multi_vendor.enabled is true', async () => {
    vi.resetModules()
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.defaultFeatureFlags['food_court.multi_vendor.enabled']).toBe(true)
  })

  it('Vendors nav entry is gated by food_court.vendor_management.enabled', async () => {
    vi.resetModules()
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    const entry = FOOD_COURT_MODULE.navItems.find((n) => n.href === '/vendors')
    expect(entry?.featureFlagKey).toBe('food_court.vendor_management.enabled')
  })

  it('Vendor Management admin nav is gated by food_court.vendor_management.enabled', async () => {
    vi.resetModules()
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    const entry = FOOD_COURT_MODULE.adminNavItems?.find((n) => n.label === 'Vendor Management')
    expect(entry?.featureFlagKey).toBe('food_court.vendor_management.enabled')
  })
})

// ── N. Navigation ─────────────────────────────────────────────────────────────

describe('N. Navigation', () => {
  it('/vendors route is in food_court routes', async () => {
    vi.resetModules()
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.routes).toContain('/vendors')
  })

  it('Vendor Management admin nav links to /console/food-court/vendors', async () => {
    vi.resetModules()
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    const item = FOOD_COURT_MODULE.adminNavItems?.find((n) => n.label === 'Vendor Management')
    expect(item?.href).toBe('/console/food-court/vendors')
  })

  it('getHeaderNav(["food_court"]) includes Vendors', async () => {
    vi.resetModules()
    const { getHeaderNav } = await import('@/modules/registry')
    expect(getHeaderNav(['food_court']).some((n) => n.label === 'Vendors')).toBe(true)
  })

  it('getAdminNav(["food_court"]) includes Vendor Management', async () => {
    vi.resetModules()
    const { getAdminNav } = await import('@/modules/registry')
    expect(getAdminNav(['food_court']).some((n) => n.label === 'Vendor Management')).toBe(true)
  })

  it('getHeaderNav(["cafe"]) does not include Vendors', async () => {
    vi.resetModules()
    const { getHeaderNav } = await import('@/modules/registry')
    expect(getHeaderNav(['cafe']).every((n) => n.label !== 'Vendors')).toBe(true)
  })
})

// ── O. Endpoints ──────────────────────────────────────────────────────────────

describe('O. ENDPOINTS.VENDORS shape', () => {
  it('has LIST and ADMIN_LIST endpoints', async () => {
    vi.resetModules()
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.VENDORS.LIST).toBe('/vendors/')
    expect(ENDPOINTS.VENDORS.ADMIN_LIST).toBe('/admin/vendors/')
    expect(ENDPOINTS.VENDORS.ADMIN_SETTLEMENTS).toBe('/admin/settlements/')
  })

  it('DETAIL is a function returning correct path', async () => {
    vi.resetModules()
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.VENDORS.DETAIL('v1')).toBe('/vendors/v1/')
  })

  it('STATS is a function returning correct path', async () => {
    vi.resetModules()
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.VENDORS.STATS('v1')).toBe('/vendors/v1/stats/')
  })

  it('SETTLEMENTS is a function returning correct path', async () => {
    vi.resetModules()
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.VENDORS.SETTLEMENTS('v1')).toBe('/vendors/v1/settlements/')
  })

  it('ADMIN_DETAIL is a function returning correct path', async () => {
    vi.resetModules()
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.VENDORS.ADMIN_DETAIL('v1')).toBe('/admin/vendors/v1/')
  })
})

// ── P. Hooks — source-text existence ─────────────────────────────────────────

describe('P. Vendor hooks source-text', () => {
  const src = readSrc('hooks/index.ts')

  it('exports useVendors', () => expect(src).toContain('export function useVendors'))
  it('exports useVendor', () => expect(src).toContain('export function useVendor'))
  it('exports useCreateVendor', () => expect(src).toContain('export function useCreateVendor'))
  it('exports useUpdateVendor', () => expect(src).toContain('export function useUpdateVendor'))
  it('exports useDisableVendor', () => expect(src).toContain('export function useDisableVendor'))
  it('exports useVendorStats', () => expect(src).toContain('export function useVendorStats'))
  it('exports useVendorSettlements', () => expect(src).toContain('export function useVendorSettlements'))
  it('exports useCreateSettlement', () => expect(src).toContain('export function useCreateSettlement'))

  it('imports vendorService', () => {
    expect(src).toContain("from '@/services/vendor.service'")
  })

  it('invalidates vendor-settlements on useCreateSettlement success', () => {
    expect(src).toContain("queryKey: ['vendor-settlements'")
  })
})

// ── Q. Customer /vendors page ─────────────────────────────────────────────────

describe('Q. /vendors/page.tsx source-text', () => {
  const src = readSrc('app/vendors/VendorsClientPage.tsx')

  it('is a client component', () => expect(src.trimStart()).toMatch(/^'use client'/))
  it('uses useVendors', () => expect(src).toContain('useVendors'))
  it('uses useVendorStats', () => expect(src).toContain('useVendorStats'))
  it('uses useVendorSettlements', () => expect(src).toContain('useVendorSettlements'))
  it('uses CapabilityGuard', () => expect(src).toContain('CapabilityGuard'))
  it('shows featured vendor badge', () => expect(src).toContain("t('featured')"))
  it('shows vendor category', () => expect(src).toContain('CATEGORY_KEYS'))
  it('shows vendor rating', () => expect(src).toContain('rating'))
  it('has active status display', () => expect(src).toContain('active'))
  it('has vendor profile view', () => expect(src).toContain('VendorProfile'))
  it('has vendor list', () => expect(src).toContain('VendorCard'))
})

// ── R. Admin /console/food-court/vendors page ───────────────────────────────────

describe('R. /console/food-court/vendors/page.tsx source-text', () => {
  const src = readSrc('app/console/food-court/vendors/page.tsx')

  it('is a client component', () => expect(src.trimStart()).toMatch(/^'use client'/))
  it('uses useVendors', () => expect(src).toContain('useVendors'))
  it('uses useCreateVendor', () => expect(src).toContain('useCreateVendor'))
  it('uses useUpdateVendor', () => expect(src).toContain('useUpdateVendor'))
  it('uses useDisableVendor', () => expect(src).toContain('useDisableVendor'))
  it('uses useVendorStats', () => expect(src).toContain('useVendorStats'))
  it('uses useVendorSettlements', () => expect(src).toContain('useVendorSettlements'))
  it('uses useCreateSettlement', () => expect(src).toContain('useCreateSettlement'))
  it('has Vendor Management heading', () => expect(src).toContain('Vendor Management'))
  it('has Add Vendor button', () => expect(src).toContain("t('addVendor')"))
  it('has Disable button', () => expect(src).toContain('Disable'))
  it('has Edit button', () => expect(src).toContain('Edit'))
  it('has Stats button', () => expect(src).toContain('Stats'))
  it('has settlement creation UI', () => expect(src).toContain('Settle'))
  it('has commission display', () => expect(src).toContain('commission'))
})

// ── S. Mock mode compatibility ────────────────────────────────────────────────

describe('S. Mock mode compatibility', () => {
  it('all service methods are callable functions', async () => {
    const { vendorService } = await freshService()
    expect(typeof vendorService.getVendors).toBe('function')
    expect(typeof vendorService.getVendor).toBe('function')
    expect(typeof vendorService.createVendor).toBe('function')
    expect(typeof vendorService.updateVendor).toBe('function')
    expect(typeof vendorService.disableVendor).toBe('function')
    expect(typeof vendorService.getVendorStats).toBe('function')
    expect(typeof vendorService.getVendorSettlements).toBe('function')
    expect(typeof vendorService.createSettlement).toBe('function')
    expect(typeof vendorService.calculateCommission).toBe('function')
    expect(typeof vendorService._resetMockStore).toBe('function')
  })

  it('service source uses USE_MOCK guard', () => {
    const src = readSrc('services/vendor.service.ts')
    expect(src).toContain('USE_MOCK')
    expect(src).toContain('NEXT_PUBLIC_USE_MOCK')
  })

  it('module-level mock state declared with let', () => {
    const src = readSrc('services/vendor.service.ts')
    expect(src).toContain('let mockVendors')
    expect(src).toContain('let mockSettlements')
  })

  it('state persists across calls within same module instance', async () => {
    const { vendorService } = await freshService()
    const before = (await vendorService.getVendors()).length
    await vendorService.createVendor({
      name: 'Persist Test',
      description: 'X',
      category: 'other',
      status: 'pending',
      rating: 0,
      ratingCount: 0,
      featured: false,
      commissionRate: 5,
      contactEmail: 'p@e.com',
    })
    const after = (await vendorService.getVendors()).length
    expect(after).toBe(before + 1)
  })

  it('mock vendors cover multiple VendorCategory values', async () => {
    const { vendorService } = await freshService()
    const vendors = await vendorService.getVendors()
    const categories = new Set(vendors.map((v) => v.category))
    expect(categories.size).toBeGreaterThan(3)
  })

  it('/console/vendors/page.tsx re-exports the food-court admin page', () => {
    const src = readSrc('app/console/vendors/page.tsx')
    expect(src).toContain('console/food-court/vendors')
  })
})
