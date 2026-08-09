import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import type {
  AnalyticsSummary,
  RevenueAnalytics,
  ReservationAnalytics,
  LoyaltyAnalytics,
  PromotionAnalytics,
  VendorAnalytics,
  MenuAnalytics,
  TimeSeries,
} from '@/types/analytics'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// Deterministic daily series generator — no Math.random()
function buildDailySeries(days: number, base: number, pattern: number[]): TimeSeries[] {
  const result: TimeSeries[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    const offset = pattern[i % pattern.length]
    result.push({ date, value: Math.round(base + offset) })
  }
  return result
}

const REVENUE_PATTERN = [
  200, 450, 120, 380, 510, 620, -80,
  290, 440, 170, 390, 560, 480, -120,
  310, 420, 200, 350, 580, 640, -60,
  280, 460, 180, 410, 530, 590, -100,
  320, 470,
]

const RESERVATION_PATTERN = [
  2, 5, 1, 4, 6, 8, -1,
  3, 5, 2, 4, 7, 6, -2,
  3, 4, 2, 3, 7, 8, 0,
  2, 5, 1, 4, 6, 7, -1,
  3, 5,
]

const MOCK_SUMMARY: AnalyticsSummary = {
  periodDays: 30,
  totalRevenue: 48295,
  revenueChangePct: 12.5,
  totalOrders: 1284,
  ordersChangePct: 8.2,
  totalReservations: 92,
  reservationsChangePct: -3.1,
  newCustomers: 348,
  customersChangePct: 15.3,
  activeVendors: 4,
  loyaltyMembersActive: 124,
  activePromotions: 3,
}

const MOCK_TOP_ITEMS = [
  { name: 'Signature Burger',  revenue: 7098, orderCount: 284, trendPct: 18 },
  { name: 'Truffle Fries',     revenue: 4210, orderCount: 421, trendPct: 12 },
  { name: 'Classic Latte',     revenue: 3150, orderCount: 630, trendPct: 5  },
  { name: 'Avocado Toast',     revenue: 2640, orderCount: 176, trendPct: -4 },
  { name: 'Chocolate Fondant', revenue: 2100, orderCount: 175, trendPct: 22 },
]

const MOCK_TIER_DISTRIBUTION = { bronze: 298, silver: 142, gold: 58, platinum: 14 }

const MOCK_TOP_REWARDS = [
  { name: 'Free Coffee',        redemptions: 84 },
  { name: '10% Off Order',      redemptions: 62 },
  { name: 'Free Dessert',       redemptions: 41 },
  { name: 'Double Points Day',  redemptions: 28 },
]

const MOCK_PROMOTION_USAGE = {
  percentage_discount: 412,
  fixed_discount: 187,
  buy_one_get_one: 94,
  happy_hour: 319,
}

const MOCK_TOP_PROMOTIONS = [
  { name: 'Happy Hour Special', usageCount: 319, discountGiven: 1912 },
  { name: '10% Weekend Off',    usageCount: 412, discountGiven: 1148 },
  { name: 'BOGO Latte',         usageCount: 94,  discountGiven: 782  },
]

const MOCK_MENU_ANALYTICS_DATA: MenuAnalytics = {
  topSellers: [
    { itemId: 'item-001', name: 'Signature Burger',  category: 'Mains',   orderCount: 284, revenue: 7098, trendPct: 18,  avgOrderValue: 24.99 },
    { itemId: 'item-002', name: 'Truffle Fries',     category: 'Sides',   orderCount: 421, revenue: 4210, trendPct: 12,  avgOrderValue: 9.99  },
    { itemId: 'item-003', name: 'Classic Latte',     category: 'Drinks',  orderCount: 630, revenue: 3150, trendPct: 5,   avgOrderValue: 5.00  },
    { itemId: 'item-004', name: 'Avocado Toast',     category: 'Starters',orderCount: 176, revenue: 2640, trendPct: -4,  avgOrderValue: 15.00 },
    { itemId: 'item-005', name: 'Chocolate Fondant', category: 'Desserts',orderCount: 175, revenue: 2100, trendPct: 22,  avgOrderValue: 12.00 },
  ],
  slowMovers: [
    { itemId: 'item-010', name: 'Seasonal Salad',   category: 'Starters', orderCount: 12, revenue: 180,  trendPct: -15, avgOrderValue: 15.00 },
    { itemId: 'item-011', name: 'Herbal Tea',        category: 'Drinks',   orderCount: 18, revenue: 90,   trendPct: -8,  avgOrderValue: 5.00  },
    { itemId: 'item-012', name: 'Fruit Platter',     category: 'Desserts', orderCount: 9,  revenue: 135,  trendPct: -22, avgOrderValue: 15.00 },
  ],
  categoryPerformance: [
    { category: 'Mains',    orderCount: 412, revenue: 11298, itemCount: 6  },
    { category: 'Sides',    orderCount: 621, revenue: 6210,  itemCount: 4  },
    { category: 'Drinks',   orderCount: 890, revenue: 4940,  itemCount: 8  },
    { category: 'Starters', orderCount: 298, revenue: 4472,  itemCount: 5  },
    { category: 'Desserts', orderCount: 241, revenue: 2892,  itemCount: 4  },
  ],
  totalItemsSold: 2462,
  totalMenuRevenue: 29812,
}

const MOCK_VENDORS_LIST = [
  { vendorId: 'vendor-1', name: 'Golden Dragon',    revenue: 54320, commissionPaid: 8148, ordersCount: 1842, avgRating: 4.7 },
  { vendorId: 'vendor-2', name: 'The Burger Shack', revenue: 48760, commissionPaid: 5851, ordersCount: 1624, avgRating: 4.3 },
  { vendorId: 'vendor-3', name: 'Spice Garden',     revenue: 51200, commissionPaid: 7168, ordersCount: 1536, avgRating: 4.6 },
  { vendorId: 'vendor-4', name: 'Sweet Treats',     revenue: 29960, commissionPaid: 2996, ordersCount: 1248, avgRating: 4.1 },
]

function mockTenantScale(tenantId: string): number {
  if (tenantId === 'tenant-samoon-01') return 1
  if (tenantId === 'tenant-brew-cafe-01') return 0.35
  return 0.15
}

export const analyticsService = {
  async getAnalyticsSummary(
    tenantId: string,
    params?: { dateFrom?: string; dateTo?: string },
  ): Promise<AnalyticsSummary> {
    if (USE_MOCK) {
      await delay(200)
      const scale = mockTenantScale(tenantId)
      const base = {
        ...MOCK_SUMMARY,
        totalRevenue: Math.round(MOCK_SUMMARY.totalRevenue * scale),
        totalOrders: Math.round(MOCK_SUMMARY.totalOrders * scale),
        totalReservations: Math.round(MOCK_SUMMARY.totalReservations * scale),
        newCustomers: Math.round(MOCK_SUMMARY.newCustomers * scale),
      }
      if (params?.dateTo) {
        return {
          ...base,
          totalRevenue: Math.round(base.totalRevenue * 0.87),
          totalOrders: Math.round(base.totalOrders * 0.91),
          totalReservations: Math.round(base.totalReservations * 1.04),
          newCustomers: Math.round(base.newCustomers * 0.82),
        }
      }
      return base
    }
    const { data } = await api.get<AnalyticsSummary>(ENDPOINTS.ANALYTICS.SUMMARY, {
      params: { tenantId, ...params },
    })
    return data
  },

  async getRevenueAnalytics(tenantId: string): Promise<RevenueAnalytics> {
    if (USE_MOCK) {
      await delay(200)
      const scale = mockTenantScale(tenantId)
      return {
        totalRevenue: Math.round(48295 * scale),
        revenueChangePct: 12.5,
        averageOrderValue: 37.6,
        totalOrders: Math.round(1284 * scale),
        dailyRevenue: buildDailySeries(30, 1600 * scale, REVENUE_PATTERN),
        topItems: MOCK_TOP_ITEMS.map((i) => ({ ...i, revenue: Math.round(i.revenue * scale) })),
      }
    }
    const { data } = await api.get<RevenueAnalytics>(ENDPOINTS.ANALYTICS.REVENUE, { params: { tenantId } })
    return data
  },

  async getReservationAnalytics(tenantId: string): Promise<ReservationAnalytics> {
    if (USE_MOCK) {
      await delay(200)
      const scale = mockTenantScale(tenantId)
      return {
        totalReservations: Math.round(92 * scale),
        reservationsChangePct: -3.1,
        upcomingReservations: Math.round(18 * scale),
        cancelledReservations: Math.round(7 * scale),
        tablesTotal: 24,
        tablesOccupied: Math.round(8 * scale),
        occupancyRate: 33,
        dailyReservations: buildDailySeries(30, 3 * scale, RESERVATION_PATTERN),
      }
    }
    const { data } = await api.get<ReservationAnalytics>(ENDPOINTS.ANALYTICS.RESERVATIONS, {
      params: { tenantId },
    })
    return data
  },

  async getLoyaltyAnalytics(tenantId: string): Promise<LoyaltyAnalytics> {
    if (USE_MOCK) {
      await delay(200)
      const scale = mockTenantScale(tenantId)
      return {
        totalMembers: Math.round(512 * scale),
        activeMembersThisMonth: Math.round(124 * scale),
        pointsIssued: Math.round(48320 * scale),
        pointsRedeemed: Math.round(19240 * scale),
        redemptionRate: 39.8,
        tierDistribution: { ...MOCK_TIER_DISTRIBUTION },
        topRewards: MOCK_TOP_REWARDS.map((r) => ({ ...r })),
      }
    }
    const { data } = await api.get<LoyaltyAnalytics>(ENDPOINTS.ANALYTICS.LOYALTY, { params: { tenantId } })
    return data
  },

  async getPromotionAnalytics(tenantId: string): Promise<PromotionAnalytics> {
    if (USE_MOCK) {
      await delay(200)
      const scale = mockTenantScale(tenantId)
      return {
        totalPromotions: Math.max(1, Math.round(5 * scale)),
        activePromotions: Math.max(0, Math.round(3 * scale)),
        totalDiscountGiven: Math.round(3842 * scale),
        discountChangePct: 7.4,
        usageByType: { ...MOCK_PROMOTION_USAGE },
        topPromotions: MOCK_TOP_PROMOTIONS.map((p) => ({ ...p })),
      }
    }
    const { data } = await api.get<PromotionAnalytics>(ENDPOINTS.ANALYTICS.PROMOTIONS, { params: { tenantId } })
    return data
  },

  async getVendorAnalytics(tenantId: string): Promise<VendorAnalytics> {
    if (USE_MOCK) {
      await delay(200)
      const scale = mockTenantScale(tenantId)
      return {
        totalVendors: Math.max(0, Math.round(6 * scale)),
        activeVendors: Math.max(0, Math.round(4 * scale)),
        totalRevenue: Math.round(184240 * scale),
        totalCommission: Math.round(25640 * scale),
        avgRating: 4.4,
        vendors: MOCK_VENDORS_LIST.map((v) => ({ ...v })),
      }
    }
    const { data } = await api.get<VendorAnalytics>(ENDPOINTS.ANALYTICS.VENDORS, { params: { tenantId } })
    return data
  },

  async getMenuAnalytics(tenantId: string): Promise<MenuAnalytics> {
    if (USE_MOCK) {
      await delay(200)
      const scale = mockTenantScale(tenantId)
      return {
        ...MOCK_MENU_ANALYTICS_DATA,
        topSellers: MOCK_MENU_ANALYTICS_DATA.topSellers.map((i) => ({
          ...i,
          orderCount: Math.round(i.orderCount * scale),
          revenue: Math.round(i.revenue * scale),
        })),
        slowMovers: MOCK_MENU_ANALYTICS_DATA.slowMovers.map((i) => ({
          ...i,
          orderCount: Math.round(i.orderCount * scale),
          revenue: Math.round(i.revenue * scale),
        })),
        categoryPerformance: MOCK_MENU_ANALYTICS_DATA.categoryPerformance.map((c) => ({
          ...c,
          orderCount: Math.round(c.orderCount * scale),
          revenue: Math.round(c.revenue * scale),
        })),
        totalItemsSold: Math.round(MOCK_MENU_ANALYTICS_DATA.totalItemsSold * scale),
        totalMenuRevenue: Math.round(MOCK_MENU_ANALYTICS_DATA.totalMenuRevenue * scale),
      }
    }
    const { data } = await api.get<MenuAnalytics>(ENDPOINTS.ANALYTICS.MENU, { params: { tenantId } })
    return data
  },
}
