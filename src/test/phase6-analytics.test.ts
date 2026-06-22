/**
 * P6.13 — Analytics Layer Tests
 *
 * Sections:
 *  A. Analytics types — file existence and field assertions
 *  B. analyticsService.getAnalyticsSummary() — shape and values
 *  C. analyticsService.getRevenueAnalytics() — shape and time series
 *  D. analyticsService.getReservationAnalytics() — shape and values
 *  E. analyticsService.getLoyaltyAnalytics() — shape and tier distribution
 *  F. analyticsService.getPromotionAnalytics() — shape and usage by type
 *  G. analyticsService.getVendorAnalytics() — shape and vendor list
 *  H. Time series — deterministic and 30-day length
 *  I. Business invariants — rates, ratios, consistency
 *  J. Registry — analytics.enabled flag on all modules
 *  K. Registry — /admin/analytics in adminNavItems for all modules
 *  L. Registry — /admin/analytics in routes for all modules
 *  M. Endpoints — ANALYTICS group present
 *  N. Hooks — useAnalyticsSummary
 *  O. Hooks — useRevenueAnalytics
 *  P. Hooks — useReservationAnalytics
 *  Q. Hooks — useLoyaltyAnalytics
 *  R. Hooks — usePromotionAnalytics
 *  S. Hooks — useVendorAnalytics
 *  T. Admin page source-text checks
 *  U. Chart components — MiniBarChart
 *  V. Chart components — Sparkline
 *  W. Mock mode compatibility
 *  X. Copy semantics
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = resolve(__dirname, '../..')

function src(rel: string) {
  return readFileSync(resolve(ROOT, 'src', rel), 'utf-8')
}

async function freshService() {
  vi.resetModules()
  const mod = await import('@/services/analytics.service')
  return mod.analyticsService
}

// ── A. Analytics types ────────────────────────────────────────────────────────

describe('A. Analytics types — file existence and fields', () => {
  it('analytics.ts file exists', () => {
    const text = src('types/analytics.ts')
    expect(text).toBeTruthy()
  })

  it('exports AnalyticsSummary', () => {
    expect(src('types/analytics.ts')).toContain('export interface AnalyticsSummary')
  })

  it('exports RevenueAnalytics', () => {
    expect(src('types/analytics.ts')).toContain('export interface RevenueAnalytics')
  })

  it('exports ReservationAnalytics', () => {
    expect(src('types/analytics.ts')).toContain('export interface ReservationAnalytics')
  })

  it('exports LoyaltyAnalytics', () => {
    expect(src('types/analytics.ts')).toContain('export interface LoyaltyAnalytics')
  })

  it('exports PromotionAnalytics', () => {
    expect(src('types/analytics.ts')).toContain('export interface PromotionAnalytics')
  })

  it('exports VendorAnalytics', () => {
    expect(src('types/analytics.ts')).toContain('export interface VendorAnalytics')
  })

  it('exports TimeSeries', () => {
    expect(src('types/analytics.ts')).toContain('export interface TimeSeries')
  })

  it('TimeSeries has date and value fields', () => {
    const text = src('types/analytics.ts')
    expect(text).toContain('date:')
    expect(text).toContain('value:')
  })

  it('AnalyticsSummary has periodDays', () => {
    expect(src('types/analytics.ts')).toContain('periodDays')
  })

  it('RevenueAnalytics has dailyRevenue', () => {
    expect(src('types/analytics.ts')).toContain('dailyRevenue')
  })

  it('LoyaltyAnalytics has tierDistribution', () => {
    expect(src('types/analytics.ts')).toContain('tierDistribution')
  })

  it('PromotionAnalytics has usageByType', () => {
    expect(src('types/analytics.ts')).toContain('usageByType')
  })

  it('VendorAnalytics has vendors array', () => {
    expect(src('types/analytics.ts')).toContain('vendors:')
  })
})

// ── B. getAnalyticsSummary() ──────────────────────────────────────────────────

describe('B. analyticsService.getAnalyticsSummary()', () => {
  it('returns a Promise', async () => {
    const svc = await freshService()
    const p = svc.getAnalyticsSummary()
    expect(p).toBeInstanceOf(Promise)
    await p
  })

  it('resolves with correct shape', async () => {
    const svc = await freshService()
    const summary = await svc.getAnalyticsSummary()
    expect(typeof summary.periodDays).toBe('number')
    expect(typeof summary.totalRevenue).toBe('number')
    expect(typeof summary.revenueChangePct).toBe('number')
    expect(typeof summary.totalOrders).toBe('number')
    expect(typeof summary.ordersChangePct).toBe('number')
    expect(typeof summary.totalReservations).toBe('number')
    expect(typeof summary.reservationsChangePct).toBe('number')
    expect(typeof summary.newCustomers).toBe('number')
    expect(typeof summary.customersChangePct).toBe('number')
    expect(typeof summary.activeVendors).toBe('number')
    expect(typeof summary.loyaltyMembersActive).toBe('number')
    expect(typeof summary.activePromotions).toBe('number')
  })

  it('totalRevenue is positive', async () => {
    const svc = await freshService()
    const summary = await svc.getAnalyticsSummary()
    expect(summary.totalRevenue).toBeGreaterThan(0)
  })

  it('totalOrders is positive', async () => {
    const svc = await freshService()
    const summary = await svc.getAnalyticsSummary()
    expect(summary.totalOrders).toBeGreaterThan(0)
  })

  it('periodDays is 30', async () => {
    const svc = await freshService()
    const summary = await svc.getAnalyticsSummary()
    expect(summary.periodDays).toBe(30)
  })
})

// ── C. getRevenueAnalytics() ──────────────────────────────────────────────────

describe('C. analyticsService.getRevenueAnalytics()', () => {
  it('resolves with correct shape', async () => {
    const svc = await freshService()
    const data = await svc.getRevenueAnalytics()
    expect(typeof data.totalRevenue).toBe('number')
    expect(typeof data.revenueChangePct).toBe('number')
    expect(typeof data.averageOrderValue).toBe('number')
    expect(typeof data.totalOrders).toBe('number')
    expect(Array.isArray(data.dailyRevenue)).toBe(true)
    expect(Array.isArray(data.topItems)).toBe(true)
  })

  it('dailyRevenue has 30 entries', async () => {
    const svc = await freshService()
    const data = await svc.getRevenueAnalytics()
    expect(data.dailyRevenue).toHaveLength(30)
  })

  it('dailyRevenue entries have date and value', async () => {
    const svc = await freshService()
    const data = await svc.getRevenueAnalytics()
    const entry = data.dailyRevenue[0]
    expect(typeof entry.date).toBe('string')
    expect(typeof entry.value).toBe('number')
  })

  it('dailyRevenue dates are ISO format', async () => {
    const svc = await freshService()
    const data = await svc.getRevenueAnalytics()
    data.dailyRevenue.forEach((d) => {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  it('topItems array is non-empty', async () => {
    const svc = await freshService()
    const data = await svc.getRevenueAnalytics()
    expect(data.topItems.length).toBeGreaterThan(0)
  })

  it('topItems entries have name, revenue, orderCount, trendPct', async () => {
    const svc = await freshService()
    const data = await svc.getRevenueAnalytics()
    const item = data.topItems[0]
    expect(typeof item.name).toBe('string')
    expect(typeof item.revenue).toBe('number')
    expect(typeof item.orderCount).toBe('number')
    expect(typeof item.trendPct).toBe('number')
  })

  it('averageOrderValue is positive', async () => {
    const svc = await freshService()
    const data = await svc.getRevenueAnalytics()
    expect(data.averageOrderValue).toBeGreaterThan(0)
  })
})

// ── D. getReservationAnalytics() ──────────────────────────────────────────────

describe('D. analyticsService.getReservationAnalytics()', () => {
  it('resolves with correct shape', async () => {
    const svc = await freshService()
    const data = await svc.getReservationAnalytics()
    expect(typeof data.totalReservations).toBe('number')
    expect(typeof data.reservationsChangePct).toBe('number')
    expect(typeof data.upcomingReservations).toBe('number')
    expect(typeof data.cancelledReservations).toBe('number')
    expect(typeof data.tablesTotal).toBe('number')
    expect(typeof data.tablesOccupied).toBe('number')
    expect(typeof data.occupancyRate).toBe('number')
    expect(Array.isArray(data.dailyReservations)).toBe(true)
  })

  it('dailyReservations has 30 entries', async () => {
    const svc = await freshService()
    const data = await svc.getReservationAnalytics()
    expect(data.dailyReservations).toHaveLength(30)
  })

  it('tablesOccupied <= tablesTotal', async () => {
    const svc = await freshService()
    const data = await svc.getReservationAnalytics()
    expect(data.tablesOccupied).toBeLessThanOrEqual(data.tablesTotal)
  })

  it('occupancyRate is between 0 and 100', async () => {
    const svc = await freshService()
    const data = await svc.getReservationAnalytics()
    expect(data.occupancyRate).toBeGreaterThanOrEqual(0)
    expect(data.occupancyRate).toBeLessThanOrEqual(100)
  })
})

// ── E. getLoyaltyAnalytics() ──────────────────────────────────────────────────

describe('E. analyticsService.getLoyaltyAnalytics()', () => {
  it('resolves with correct shape', async () => {
    const svc = await freshService()
    const data = await svc.getLoyaltyAnalytics()
    expect(typeof data.totalMembers).toBe('number')
    expect(typeof data.activeMembersThisMonth).toBe('number')
    expect(typeof data.pointsIssued).toBe('number')
    expect(typeof data.pointsRedeemed).toBe('number')
    expect(typeof data.redemptionRate).toBe('number')
    expect(typeof data.tierDistribution).toBe('object')
    expect(Array.isArray(data.topRewards)).toBe(true)
  })

  it('tierDistribution has bronze, silver, gold, platinum', async () => {
    const svc = await freshService()
    const data = await svc.getLoyaltyAnalytics()
    expect(typeof data.tierDistribution.bronze).toBe('number')
    expect(typeof data.tierDistribution.silver).toBe('number')
    expect(typeof data.tierDistribution.gold).toBe('number')
    expect(typeof data.tierDistribution.platinum).toBe('number')
  })

  it('topRewards entries have name and redemptions', async () => {
    const svc = await freshService()
    const data = await svc.getLoyaltyAnalytics()
    const reward = data.topRewards[0]
    expect(typeof reward.name).toBe('string')
    expect(typeof reward.redemptions).toBe('number')
  })

  it('activeMembersThisMonth <= totalMembers', async () => {
    const svc = await freshService()
    const data = await svc.getLoyaltyAnalytics()
    expect(data.activeMembersThisMonth).toBeLessThanOrEqual(data.totalMembers)
  })

  it('redemptionRate is between 0 and 100', async () => {
    const svc = await freshService()
    const data = await svc.getLoyaltyAnalytics()
    expect(data.redemptionRate).toBeGreaterThanOrEqual(0)
    expect(data.redemptionRate).toBeLessThanOrEqual(100)
  })

  it('pointsRedeemed <= pointsIssued', async () => {
    const svc = await freshService()
    const data = await svc.getLoyaltyAnalytics()
    expect(data.pointsRedeemed).toBeLessThanOrEqual(data.pointsIssued)
  })
})

// ── F. getPromotionAnalytics() ────────────────────────────────────────────────

describe('F. analyticsService.getPromotionAnalytics()', () => {
  it('resolves with correct shape', async () => {
    const svc = await freshService()
    const data = await svc.getPromotionAnalytics()
    expect(typeof data.totalPromotions).toBe('number')
    expect(typeof data.activePromotions).toBe('number')
    expect(typeof data.totalDiscountGiven).toBe('number')
    expect(typeof data.discountChangePct).toBe('number')
    expect(typeof data.usageByType).toBe('object')
    expect(Array.isArray(data.topPromotions)).toBe(true)
  })

  it('usageByType has all 4 promotion types', async () => {
    const svc = await freshService()
    const data = await svc.getPromotionAnalytics()
    expect(typeof data.usageByType.percentage_discount).toBe('number')
    expect(typeof data.usageByType.fixed_discount).toBe('number')
    expect(typeof data.usageByType.buy_one_get_one).toBe('number')
    expect(typeof data.usageByType.happy_hour).toBe('number')
  })

  it('activePromotions <= totalPromotions', async () => {
    const svc = await freshService()
    const data = await svc.getPromotionAnalytics()
    expect(data.activePromotions).toBeLessThanOrEqual(data.totalPromotions)
  })

  it('topPromotions entries have name, usageCount, discountGiven', async () => {
    const svc = await freshService()
    const data = await svc.getPromotionAnalytics()
    const promo = data.topPromotions[0]
    expect(typeof promo.name).toBe('string')
    expect(typeof promo.usageCount).toBe('number')
    expect(typeof promo.discountGiven).toBe('number')
  })

  it('totalDiscountGiven is positive', async () => {
    const svc = await freshService()
    const data = await svc.getPromotionAnalytics()
    expect(data.totalDiscountGiven).toBeGreaterThan(0)
  })
})

// ── G. getVendorAnalytics() ───────────────────────────────────────────────────

describe('G. analyticsService.getVendorAnalytics()', () => {
  it('resolves with correct shape', async () => {
    const svc = await freshService()
    const data = await svc.getVendorAnalytics()
    expect(typeof data.totalVendors).toBe('number')
    expect(typeof data.activeVendors).toBe('number')
    expect(typeof data.totalRevenue).toBe('number')
    expect(typeof data.totalCommission).toBe('number')
    expect(typeof data.avgRating).toBe('number')
    expect(Array.isArray(data.vendors)).toBe(true)
  })

  it('vendors array is non-empty', async () => {
    const svc = await freshService()
    const data = await svc.getVendorAnalytics()
    expect(data.vendors.length).toBeGreaterThan(0)
  })

  it('vendor entries have required fields', async () => {
    const svc = await freshService()
    const data = await svc.getVendorAnalytics()
    const v = data.vendors[0]
    expect(typeof v.vendorId).toBe('string')
    expect(typeof v.name).toBe('string')
    expect(typeof v.revenue).toBe('number')
    expect(typeof v.commissionPaid).toBe('number')
    expect(typeof v.ordersCount).toBe('number')
    expect(typeof v.avgRating).toBe('number')
  })

  it('activeVendors <= totalVendors', async () => {
    const svc = await freshService()
    const data = await svc.getVendorAnalytics()
    expect(data.activeVendors).toBeLessThanOrEqual(data.totalVendors)
  })

  it('avgRating is between 0 and 5', async () => {
    const svc = await freshService()
    const data = await svc.getVendorAnalytics()
    expect(data.avgRating).toBeGreaterThanOrEqual(0)
    expect(data.avgRating).toBeLessThanOrEqual(5)
  })
})

// ── H. Time series — deterministic and 30-day length ─────────────────────────

describe('H. Time series determinism and shape', () => {
  it('dailyRevenue dates are consecutive', async () => {
    const svc = await freshService()
    const data = await svc.getRevenueAnalytics()
    for (let i = 1; i < data.dailyRevenue.length; i++) {
      const prev = new Date(data.dailyRevenue[i - 1].date)
      const curr = new Date(data.dailyRevenue[i].date)
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBe(1)
    }
  })

  it('last dailyRevenue entry is today or yesterday', async () => {
    const svc = await freshService()
    const data = await svc.getRevenueAnalytics()
    const lastDate = new Date(data.dailyRevenue[data.dailyRevenue.length - 1].date)
    const now = new Date()
    const diffMs = now.getTime() - lastDate.getTime()
    expect(diffMs).toBeLessThan(2 * 24 * 60 * 60 * 1000)
  })

  it('dailyReservations dates are consecutive', async () => {
    const svc = await freshService()
    const data = await svc.getReservationAnalytics()
    for (let i = 1; i < data.dailyReservations.length; i++) {
      const prev = new Date(data.dailyReservations[i - 1].date)
      const curr = new Date(data.dailyReservations[i].date)
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBe(1)
    }
  })

  it('second call returns same structure as first call', async () => {
    const svc = await freshService()
    const a = await svc.getRevenueAnalytics()
    const b = await svc.getRevenueAnalytics()
    expect(a.totalRevenue).toBe(b.totalRevenue)
    expect(a.dailyRevenue.length).toBe(b.dailyRevenue.length)
  })
})

// ── I. Business invariants ────────────────────────────────────────────────────

describe('I. Business invariants', () => {
  it('vendor totalRevenue >= totalCommission', async () => {
    const svc = await freshService()
    const data = await svc.getVendorAnalytics()
    expect(data.totalRevenue).toBeGreaterThanOrEqual(data.totalCommission)
  })

  it('loyalty redemptionRate ≈ pointsRedeemed/pointsIssued * 100', async () => {
    const svc = await freshService()
    const data = await svc.getLoyaltyAnalytics()
    const computed = (data.pointsRedeemed / data.pointsIssued) * 100
    expect(Math.abs(data.redemptionRate - computed)).toBeLessThan(1)
  })

  it('summary activeVendors matches vendor analytics activeVendors', async () => {
    const svc = await freshService()
    const [summary, vendors] = await Promise.all([
      svc.getAnalyticsSummary(),
      svc.getVendorAnalytics(),
    ])
    expect(summary.activeVendors).toBe(vendors.activeVendors)
  })

  it('summary activePromotions matches promotion analytics activePromotions', async () => {
    const svc = await freshService()
    const [summary, promotions] = await Promise.all([
      svc.getAnalyticsSummary(),
      svc.getPromotionAnalytics(),
    ])
    expect(summary.activePromotions).toBe(promotions.activePromotions)
  })
})

// ── J. Registry — analytics.enabled flag ─────────────────────────────────────

describe('J. Registry — analytics.enabled flag on all modules', () => {
  beforeEach(() => { vi.resetModules() })

  it('RESTAURANT_MODULE has analytics.enabled = true', async () => {
    const { RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(RESTAURANT_MODULE.defaultFeatureFlags['analytics.enabled']).toBe(true)
  })

  it('CAFE_MODULE has analytics.enabled = true', async () => {
    const { CAFE_MODULE } = await import('@/modules/registry')
    expect(CAFE_MODULE.defaultFeatureFlags['analytics.enabled']).toBe(true)
  })

  it('BAR_MODULE has analytics.enabled = true', async () => {
    const { BAR_MODULE } = await import('@/modules/registry')
    expect(BAR_MODULE.defaultFeatureFlags['analytics.enabled']).toBe(true)
  })

  it('FOOD_COURT_MODULE has analytics.enabled = true', async () => {
    const { FOOD_COURT_MODULE } = await import('@/modules/registry')
    expect(FOOD_COURT_MODULE.defaultFeatureFlags['analytics.enabled']).toBe(true)
  })

  it('FOOD_TRUCK_MODULE has analytics.enabled = true', async () => {
    const { FOOD_TRUCK_MODULE } = await import('@/modules/registry')
    expect(FOOD_TRUCK_MODULE.defaultFeatureFlags['analytics.enabled']).toBe(true)
  })

  it('MOBILE_CAFE_MODULE has analytics.enabled = true', async () => {
    const { MOBILE_CAFE_MODULE } = await import('@/modules/registry')
    expect(MOBILE_CAFE_MODULE.defaultFeatureFlags['analytics.enabled']).toBe(true)
  })
})

// ── K. Registry — /admin/analytics in adminNavItems ──────────────────────────

describe('K. Registry — /admin/analytics in adminNavItems for all modules', () => {
  beforeEach(() => { vi.resetModules() })

  const modules = ['RESTAURANT_MODULE', 'CAFE_MODULE', 'BAR_MODULE', 'FOOD_COURT_MODULE', 'FOOD_TRUCK_MODULE', 'MOBILE_CAFE_MODULE'] as const

  for (const modName of modules) {
    it(`${modName} adminNavItems includes /admin/analytics`, async () => {
      const reg = await import('@/modules/registry')
      const mod = reg[modName]
      const found = mod.adminNavItems?.some((n) => n.href === '/admin/analytics')
      expect(found).toBe(true)
    })
  }
})

// ── L. Registry — /admin/analytics in routes ─────────────────────────────────

describe('L. Registry — /admin/analytics in routes for all modules', () => {
  beforeEach(() => { vi.resetModules() })

  const modules = ['RESTAURANT_MODULE', 'CAFE_MODULE', 'BAR_MODULE', 'FOOD_COURT_MODULE', 'FOOD_TRUCK_MODULE', 'MOBILE_CAFE_MODULE'] as const

  for (const modName of modules) {
    it(`${modName} routes includes /admin/analytics`, async () => {
      const reg = await import('@/modules/registry')
      const mod = reg[modName]
      expect(mod.routes).toContain('/admin/analytics')
    })
  }
})

// ── M. Endpoints — ANALYTICS group ───────────────────────────────────────────

describe('M. Endpoints — ANALYTICS group', () => {
  it('ENDPOINTS has ANALYTICS group', () => {
    const text = src('services/endpoints.ts')
    expect(text).toContain('ANALYTICS:')
  })

  it('ANALYTICS.SUMMARY is defined', () => {
    const text = src('services/endpoints.ts')
    expect(text).toContain('SUMMARY:')
    expect(text).toContain('/admin/analytics/summary/')
  })

  it('ANALYTICS.REVENUE is defined', () => {
    expect(src('services/endpoints.ts')).toContain('/admin/analytics/revenue/')
  })

  it('ANALYTICS.RESERVATIONS is defined', () => {
    expect(src('services/endpoints.ts')).toContain('/admin/analytics/reservations/')
  })

  it('ANALYTICS.LOYALTY is defined', () => {
    expect(src('services/endpoints.ts')).toContain('/admin/analytics/loyalty/')
  })

  it('ANALYTICS.PROMOTIONS is defined', () => {
    expect(src('services/endpoints.ts')).toContain('/admin/analytics/promotions/')
  })

  it('ANALYTICS.VENDORS is defined', () => {
    expect(src('services/endpoints.ts')).toContain('/admin/analytics/vendors/')
  })
})

// ── N–S. Hooks ────────────────────────────────────────────────────────────────

describe('N. Hooks — useAnalyticsSummary', () => {
  it('exported from hooks/index.ts', () => {
    expect(src('hooks/index.ts')).toContain('export function useAnalyticsSummary')
  })

  it('uses analytics-summary query key', () => {
    expect(src('hooks/index.ts')).toContain("'analytics-summary'")
  })

  it('calls analyticsService.getAnalyticsSummary', () => {
    expect(src('hooks/index.ts')).toContain('analyticsService.getAnalyticsSummary')
  })
})

describe('O. Hooks — useRevenueAnalytics', () => {
  it('exported from hooks/index.ts', () => {
    expect(src('hooks/index.ts')).toContain('export function useRevenueAnalytics')
  })

  it('uses analytics-revenue query key', () => {
    expect(src('hooks/index.ts')).toContain("'analytics-revenue'")
  })

  it('calls analyticsService.getRevenueAnalytics', () => {
    expect(src('hooks/index.ts')).toContain('analyticsService.getRevenueAnalytics')
  })
})

describe('P. Hooks — useReservationAnalytics', () => {
  it('exported from hooks/index.ts', () => {
    expect(src('hooks/index.ts')).toContain('export function useReservationAnalytics')
  })

  it('uses analytics-reservations query key', () => {
    expect(src('hooks/index.ts')).toContain("'analytics-reservations'")
  })
})

describe('Q. Hooks — useLoyaltyAnalytics', () => {
  it('exported from hooks/index.ts', () => {
    expect(src('hooks/index.ts')).toContain('export function useLoyaltyAnalytics')
  })

  it('uses analytics-loyalty query key', () => {
    expect(src('hooks/index.ts')).toContain("'analytics-loyalty'")
  })
})

describe('R. Hooks — usePromotionAnalytics', () => {
  it('exported from hooks/index.ts', () => {
    expect(src('hooks/index.ts')).toContain('export function usePromotionAnalytics')
  })

  it('uses analytics-promotions query key', () => {
    expect(src('hooks/index.ts')).toContain("'analytics-promotions'")
  })
})

describe('S. Hooks — useVendorAnalytics', () => {
  it('exported from hooks/index.ts', () => {
    expect(src('hooks/index.ts')).toContain('export function useVendorAnalytics')
  })

  it('uses analytics-vendors query key', () => {
    expect(src('hooks/index.ts')).toContain("'analytics-vendors'")
  })
})

// ── T. Admin page source-text checks ─────────────────────────────────────────

describe('T. Admin analytics page source-text', () => {
  const page = src('app/admin/analytics/page.tsx')

  it('is a client component', () => {
    expect(page).toMatch(/'use client'/)
  })

  it('imports all 6 analytics hooks', () => {
    expect(page).toContain('useAnalyticsSummary')
    expect(page).toContain('useRevenueAnalytics')
    expect(page).toContain('useReservationAnalytics')
    expect(page).toContain('useLoyaltyAnalytics')
    expect(page).toContain('usePromotionAnalytics')
    expect(page).toContain('useVendorAnalytics')
  })

  it('imports MiniBarChart', () => {
    expect(page).toContain('MiniBarChart')
  })

  it('imports Sparkline', () => {
    expect(page).toContain('Sparkline')
  })

  it('has Revenue section', () => {
    expect(page).toContain('Revenue')
  })

  it('has Reservations section', () => {
    expect(page).toContain('Reservations')
  })

  it('has Loyalty section', () => {
    expect(page).toContain('Loyalty')
  })

  it('has Promotions section', () => {
    expect(page).toContain('Promotions')
  })

  it('has Vendors section', () => {
    expect(page).toContain('Vendors')
  })

  it('has Analytics heading', () => {
    expect(page).toContain('Analytics')
  })

  it('renders KPI cards', () => {
    expect(page).toContain('KpiCard')
  })

  it('has aria-label attributes for accessibility', () => {
    expect(page).toContain('aria-label')
  })
})

// ── U. Chart components — MiniBarChart ───────────────────────────────────────

describe('U. Chart components — MiniBarChart', () => {
  it('MiniBarChart.tsx file exists', () => {
    const text = src('components/charts/MiniBarChart.tsx')
    expect(text).toBeTruthy()
  })

  it('is a client component', () => {
    expect(src('components/charts/MiniBarChart.tsx')).toMatch(/'use client'/)
  })

  it('exports MiniBarChart function', () => {
    expect(src('components/charts/MiniBarChart.tsx')).toContain('export function MiniBarChart')
  })

  it('accepts data: TimeSeries[] prop', () => {
    expect(src('components/charts/MiniBarChart.tsx')).toContain('TimeSeries')
    expect(src('components/charts/MiniBarChart.tsx')).toContain('data:')
  })

  it('renders an SVG element', () => {
    expect(src('components/charts/MiniBarChart.tsx')).toContain('<svg')
  })

  it('renders rect elements for bars', () => {
    expect(src('components/charts/MiniBarChart.tsx')).toContain('<rect')
  })

  it('returns null for empty data', () => {
    expect(src('components/charts/MiniBarChart.tsx')).toContain('!data.length')
  })

  it('has height prop', () => {
    expect(src('components/charts/MiniBarChart.tsx')).toContain('height')
  })
})

// ── V. Chart components — Sparkline ──────────────────────────────────────────

describe('V. Chart components — Sparkline', () => {
  it('Sparkline.tsx file exists', () => {
    const text = src('components/charts/Sparkline.tsx')
    expect(text).toBeTruthy()
  })

  it('is a client component', () => {
    expect(src('components/charts/Sparkline.tsx')).toMatch(/'use client'/)
  })

  it('exports Sparkline function', () => {
    expect(src('components/charts/Sparkline.tsx')).toContain('export function Sparkline')
  })

  it('accepts data: TimeSeries[] prop', () => {
    expect(src('components/charts/Sparkline.tsx')).toContain('TimeSeries')
  })

  it('renders an SVG element', () => {
    expect(src('components/charts/Sparkline.tsx')).toContain('<svg')
  })

  it('renders polyline for the trend line', () => {
    expect(src('components/charts/Sparkline.tsx')).toContain('<polyline')
  })

  it('renders polygon for area fill', () => {
    expect(src('components/charts/Sparkline.tsx')).toContain('<polygon')
  })

  it('returns null for insufficient data', () => {
    expect(src('components/charts/Sparkline.tsx')).toContain('data.length < 2')
  })
})

// ── W. Mock mode compatibility ────────────────────────────────────────────────

describe('W. Mock mode compatibility', () => {
  it('analytics.service.ts references USE_MOCK', () => {
    const text = src('services/analytics.service.ts')
    expect(text).toContain('USE_MOCK')
    expect(text).toContain('NEXT_PUBLIC_USE_MOCK')
  })

  it('all 6 methods are async', () => {
    const text = src('services/analytics.service.ts')
    const methods = [
      'getAnalyticsSummary',
      'getRevenueAnalytics',
      'getReservationAnalytics',
      'getLoyaltyAnalytics',
      'getPromotionAnalytics',
      'getVendorAnalytics',
    ]
    for (const m of methods) {
      expect(text).toContain(`async ${m}`)
    }
  })

  it('service imports analyticsService from analytics.service', () => {
    expect(src('hooks/index.ts')).toContain('analyticsService')
  })

  it('buildDailySeries generates deterministic output', async () => {
    const svc = await freshService()
    const a = await svc.getRevenueAnalytics()
    const b = await svc.getRevenueAnalytics()
    expect(a.dailyRevenue[0].date).toBe(b.dailyRevenue[0].date)
    expect(a.dailyRevenue[0].value).toBe(b.dailyRevenue[0].value)
  })
})

// ── X. Copy semantics ─────────────────────────────────────────────────────────

describe('X. Copy semantics', () => {
  it('mutating summary does not affect next call', async () => {
    const svc = await freshService()
    const a = await svc.getAnalyticsSummary()
    const original = a.totalRevenue
    a.totalRevenue = 0
    const b = await svc.getAnalyticsSummary()
    expect(b.totalRevenue).toBe(original)
  })

  it('mutating vendor list does not affect next call', async () => {
    const svc = await freshService()
    const a = await svc.getVendorAnalytics()
    const originalLen = a.vendors.length
    a.vendors.pop()
    const b = await svc.getVendorAnalytics()
    expect(b.vendors.length).toBe(originalLen)
  })

  it('mutating tierDistribution does not affect next call', async () => {
    const svc = await freshService()
    const a = await svc.getLoyaltyAnalytics()
    const original = a.tierDistribution.platinum
    a.tierDistribution.platinum = 999
    const b = await svc.getLoyaltyAnalytics()
    expect(b.tierDistribution.platinum).toBe(original)
  })
})
