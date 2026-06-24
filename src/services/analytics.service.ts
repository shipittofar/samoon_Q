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

export const analyticsService = {
  async getAnalyticsSummary(params?: { dateFrom?: string; dateTo?: string }): Promise<AnalyticsSummary> {
    if (USE_MOCK) {
      await delay(200)
      if (params?.dateTo) {
        return {
          ...MOCK_SUMMARY,
          totalRevenue: Math.round(MOCK_SUMMARY.totalRevenue * 0.87),
          totalOrders: Math.round(MOCK_SUMMARY.totalOrders * 0.91),
          totalReservations: Math.round(MOCK_SUMMARY.totalReservations * 1.04),
          newCustomers: Math.round(MOCK_SUMMARY.newCustomers * 0.82),
        }
      }
      return { ...MOCK_SUMMARY }
    }
    const { data } = await api.get<AnalyticsSummary>(ENDPOINTS.ANALYTICS.SUMMARY, { params })
    return data
  },

  async getRevenueAnalytics(): Promise<RevenueAnalytics> {
    if (USE_MOCK) {
      await delay(200)
      return {
        totalRevenue: 48295,
        revenueChangePct: 12.5,
        averageOrderValue: 37.6,
        totalOrders: 1284,
        dailyRevenue: buildDailySeries(30, 1600, REVENUE_PATTERN),
        topItems: MOCK_TOP_ITEMS.map((i) => ({ ...i })),
      }
    }
    const { data } = await api.get<RevenueAnalytics>(ENDPOINTS.ANALYTICS.REVENUE)
    return data
  },

  async getReservationAnalytics(): Promise<ReservationAnalytics> {
    if (USE_MOCK) {
      await delay(200)
      return {
        totalReservations: 92,
        reservationsChangePct: -3.1,
        upcomingReservations: 18,
        cancelledReservations: 7,
        tablesTotal: 24,
        tablesOccupied: 8,
        occupancyRate: 33,
        dailyReservations: buildDailySeries(30, 3, RESERVATION_PATTERN),
      }
    }
    const { data } = await api.get<ReservationAnalytics>(ENDPOINTS.ANALYTICS.RESERVATIONS)
    return data
  },

  async getLoyaltyAnalytics(): Promise<LoyaltyAnalytics> {
    if (USE_MOCK) {
      await delay(200)
      return {
        totalMembers: 512,
        activeMembersThisMonth: 124,
        pointsIssued: 48320,
        pointsRedeemed: 19240,
        redemptionRate: 39.8,
        tierDistribution: { ...MOCK_TIER_DISTRIBUTION },
        topRewards: MOCK_TOP_REWARDS.map((r) => ({ ...r })),
      }
    }
    const { data } = await api.get<LoyaltyAnalytics>(ENDPOINTS.ANALYTICS.LOYALTY)
    return data
  },

  async getPromotionAnalytics(): Promise<PromotionAnalytics> {
    if (USE_MOCK) {
      await delay(200)
      return {
        totalPromotions: 5,
        activePromotions: 3,
        totalDiscountGiven: 3842,
        discountChangePct: 7.4,
        usageByType: { ...MOCK_PROMOTION_USAGE },
        topPromotions: MOCK_TOP_PROMOTIONS.map((p) => ({ ...p })),
      }
    }
    const { data } = await api.get<PromotionAnalytics>(ENDPOINTS.ANALYTICS.PROMOTIONS)
    return data
  },

  async getVendorAnalytics(): Promise<VendorAnalytics> {
    if (USE_MOCK) {
      await delay(200)
      return {
        totalVendors: 6,
        activeVendors: 4,
        totalRevenue: 184240,
        totalCommission: 25640,
        avgRating: 4.4,
        vendors: MOCK_VENDORS_LIST.map((v) => ({ ...v })),
      }
    }
    const { data } = await api.get<VendorAnalytics>(ENDPOINTS.ANALYTICS.VENDORS)
    return data
  },

  async getMenuAnalytics(): Promise<MenuAnalytics> {
    if (USE_MOCK) {
      await delay(200)
      return {
        ...MOCK_MENU_ANALYTICS_DATA,
        topSellers: MOCK_MENU_ANALYTICS_DATA.topSellers.map((i) => ({ ...i })),
        slowMovers: MOCK_MENU_ANALYTICS_DATA.slowMovers.map((i) => ({ ...i })),
        categoryPerformance: MOCK_MENU_ANALYTICS_DATA.categoryPerformance.map((c) => ({ ...c })),
      }
    }
    const { data } = await api.get<MenuAnalytics>(ENDPOINTS.ANALYTICS.MENU)
    return data
  },
}
