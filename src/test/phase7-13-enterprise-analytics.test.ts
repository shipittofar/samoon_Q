// ============================================================
// P7.13 — Enterprise Analytics & Operational Intelligence
// ============================================================

process.env.NEXT_PUBLIC_USE_MOCK = 'true'

import { describe, it, expect } from 'vitest'
import { analyticsService } from '@/services/analytics.service'
import type { MenuAnalytics } from '@/types/analytics'

const TENANT_SAMOON = 'tenant-samoon-01'

// ── Menu Analytics ────────────────────────────────────────────────────────────

describe('analyticsService.getMenuAnalytics()', () => {
  it('returns menu analytics with topSellers', async () => {
    const data = await analyticsService.getMenuAnalytics(TENANT_SAMOON)
    expect(data.topSellers.length).toBeGreaterThan(0)
    expect(data.topSellers[0]).toHaveProperty('itemId')
    expect(data.topSellers[0]).toHaveProperty('name')
    expect(data.topSellers[0]).toHaveProperty('orderCount')
    expect(data.topSellers[0]).toHaveProperty('revenue')
    expect(data.topSellers[0]).toHaveProperty('trendPct')
  })

  it('returns slowMovers with fewer orders than top sellers', async () => {
    const data = await analyticsService.getMenuAnalytics(TENANT_SAMOON)
    expect(data.slowMovers.length).toBeGreaterThan(0)
    const topMin = Math.min(...data.topSellers.map((i) => i.orderCount))
    const slowMax = Math.max(...data.slowMovers.map((i) => i.orderCount))
    expect(slowMax).toBeLessThan(topMin)
  })

  it('returns categoryPerformance with required fields', async () => {
    const data = await analyticsService.getMenuAnalytics(TENANT_SAMOON)
    expect(data.categoryPerformance.length).toBeGreaterThan(0)
    for (const cat of data.categoryPerformance) {
      expect(cat).toHaveProperty('category')
      expect(cat).toHaveProperty('orderCount')
      expect(cat).toHaveProperty('revenue')
      expect(cat).toHaveProperty('itemCount')
    }
  })

  it('totalItemsSold and totalMenuRevenue are positive numbers', async () => {
    const data = await analyticsService.getMenuAnalytics(TENANT_SAMOON)
    expect(data.totalItemsSold).toBeGreaterThan(0)
    expect(data.totalMenuRevenue).toBeGreaterThan(0)
  })

  it('satisfies MenuAnalytics type shape', async () => {
    const data: MenuAnalytics = await analyticsService.getMenuAnalytics(TENANT_SAMOON)
    expect(typeof data.totalItemsSold).toBe('number')
    expect(typeof data.totalMenuRevenue).toBe('number')
    expect(Array.isArray(data.topSellers)).toBe(true)
    expect(Array.isArray(data.slowMovers)).toBe(true)
    expect(Array.isArray(data.categoryPerformance)).toBe(true)
  })
})

// ── Analytics Comparison — Extended Periods ───────────────────────────────────

describe('analyticsService — comparison period data', () => {
  it('returns different data for previous period (dateTo param)', async () => {
    const current = await analyticsService.getAnalyticsSummary(TENANT_SAMOON)
    const previous = await analyticsService.getAnalyticsSummary(TENANT_SAMOON, {
      dateFrom: new Date(Date.now() - 14 * 86_400_000).toISOString(),
      dateTo: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    })
    // previous period mock returns scaled-down values
    expect(previous.totalRevenue).toBeLessThan(current.totalRevenue)
    expect(previous.totalOrders).toBeLessThan(current.totalOrders)
  })

  it('current period has positive totalRevenue', async () => {
    const data = await analyticsService.getAnalyticsSummary(TENANT_SAMOON)
    expect(data.totalRevenue).toBeGreaterThan(0)
    expect(data.totalOrders).toBeGreaterThan(0)
  })
})

// ── Delta Calculation ─────────────────────────────────────────────────────────

describe('comparison delta calculations', () => {
  it('calculates delta percent correctly', () => {
    const curr = 1200
    const prev = 1000
    const delta = ((curr - prev) / prev) * 100
    expect(delta).toBeCloseTo(20, 1)
  })

  it('handles zero previous value gracefully', () => {
    const curr = 500
    const prev = 0
    const delta = prev !== 0 ? ((curr - prev) / prev) * 100 : null
    expect(delta).toBeNull()
  })

  it('produces negative delta for declining metric', () => {
    const curr = 800
    const prev = 1000
    const delta = ((curr - prev) / prev) * 100
    expect(delta).toBeCloseTo(-20, 1)
    expect(delta).toBeLessThan(0)
  })
})

// ── Export Format Validation ──────────────────────────────────────────────────

describe('Analytics export domain coverage', () => {
  it('all export domains map to analytics service methods', async () => {
    const domains = ['summary', 'revenue', 'reservations', 'loyalty', 'promotions', 'vendors', 'menu'] as const
    for (const domain of domains) {
      let result: unknown
      if (domain === 'summary')      result = await analyticsService.getAnalyticsSummary(TENANT_SAMOON)
      else if (domain === 'revenue') result = await analyticsService.getRevenueAnalytics(TENANT_SAMOON)
      else if (domain === 'reservations') result = await analyticsService.getReservationAnalytics(TENANT_SAMOON)
      else if (domain === 'loyalty') result = await analyticsService.getLoyaltyAnalytics(TENANT_SAMOON)
      else if (domain === 'promotions') result = await analyticsService.getPromotionAnalytics()
      else if (domain === 'vendors') result = await analyticsService.getVendorAnalytics()
      else if (domain === 'menu')    result = await analyticsService.getMenuAnalytics(TENANT_SAMOON)
      expect(result).toBeTruthy()
      expect(typeof result).toBe('object')
    }
  })
})

// ── AdminBreadcrumbs path logic ───────────────────────────────────────────────

describe('AdminBreadcrumbs segment label resolution', () => {
  const SEGMENT_LABELS: Record<string, string> = {
    admin: 'Admin', orders: 'Orders', reservations: 'Reservations',
    customers: 'Customers', vendors: 'Vendors', promotions: 'Promotions',
    branches: 'Branches', tenants: 'Tenants', kitchen: 'Kitchen Display',
  }

  function labelForSegment(segment: string): string {
    return SEGMENT_LABELS[segment] ?? (segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '))
  }

  it('labels known admin segments correctly', () => {
    expect(labelForSegment('orders')).toBe('Orders')
    expect(labelForSegment('customers')).toBe('Customers')
    expect(labelForSegment('kitchen')).toBe('Kitchen Display')
  })

  it('capitalises unknown segments', () => {
    expect(labelForSegment('my-page')).toBe('My page')
  })

  it('builds crumbs for /console/orders/abc', () => {
    const segments = ['admin', 'orders', 'abc123']
    const crumbs = segments.map((s) => labelForSegment(s))
    expect(crumbs).toEqual(['Admin', 'Orders', 'Abc123'])
  })
})

// ── Kitchen route ─────────────────────────────────────────────────────────────

describe('Kitchen page route integration', () => {
  it('ADMIN_OPERATIONS_ROUTES includes /console/kitchen', async () => {
    const { ADMIN_OPERATIONS_ROUTES } = await import('@/modules/registry')
    expect(ADMIN_OPERATIONS_ROUTES).toContain('/console/kitchen')
  })
})
