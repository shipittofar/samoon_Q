// P6.13 — Analytics Layer Types

export interface TimeSeries {
  date: string  // ISO date YYYY-MM-DD
  value: number
}

export interface AnalyticsSummary {
  periodDays: number
  totalRevenue: number
  revenueChangePct: number
  totalOrders: number
  ordersChangePct: number
  totalReservations: number
  reservationsChangePct: number
  newCustomers: number
  customersChangePct: number
  activeVendors: number
  loyaltyMembersActive: number
  activePromotions: number
}

export interface RevenueAnalytics {
  totalRevenue: number
  revenueChangePct: number
  averageOrderValue: number
  totalOrders: number
  dailyRevenue: TimeSeries[]
  topItems: Array<{
    name: string
    revenue: number
    orderCount: number
    trendPct: number
  }>
}

export interface ReservationAnalytics {
  totalReservations: number
  reservationsChangePct: number
  upcomingReservations: number
  cancelledReservations: number
  tablesTotal: number
  tablesOccupied: number
  occupancyRate: number
  dailyReservations: TimeSeries[]
}

export interface LoyaltyAnalytics {
  totalMembers: number
  activeMembersThisMonth: number
  pointsIssued: number
  pointsRedeemed: number
  redemptionRate: number
  tierDistribution: {
    bronze: number
    silver: number
    gold: number
    platinum: number
  }
  topRewards: Array<{
    name: string
    redemptions: number
  }>
}

export interface PromotionAnalytics {
  totalPromotions: number
  activePromotions: number
  totalDiscountGiven: number
  discountChangePct: number
  usageByType: {
    percentage_discount: number
    fixed_discount: number
    buy_one_get_one: number
    happy_hour: number
  }
  topPromotions: Array<{
    name: string
    usageCount: number
    discountGiven: number
  }>
}

export interface VendorAnalytics {
  totalVendors: number
  activeVendors: number
  totalRevenue: number
  totalCommission: number
  avgRating: number
  vendors: Array<{
    vendorId: string
    name: string
    revenue: number
    commissionPaid: number
    ordersCount: number
    avgRating: number
  }>
}

// ── P7.13 Menu Performance Analytics ─────────────────────────────────────────

export interface MenuItemPerformance {
  itemId: string
  name: string
  category: string
  orderCount: number
  revenue: number
  trendPct: number
  avgOrderValue: number
}

export interface MenuCategoryPerformance {
  category: string
  orderCount: number
  revenue: number
  itemCount: number
}

export interface MenuAnalytics {
  topSellers: MenuItemPerformance[]
  slowMovers: MenuItemPerformance[]
  categoryPerformance: MenuCategoryPerformance[]
  totalItemsSold: number
  totalMenuRevenue: number
}

// ── P7.4 Branch-scoped analytics ─────────────────────────────────────────────

export interface BranchRevenueAnalytics {
  branchId: string
  totalRevenue: number
  revenueChangePct: number
  averageOrderValue: number
  totalOrders: number
  period: string
}

export interface BranchOrderAnalytics {
  branchId: string
  totalOrders: number
  ordersByStatus: Record<string, number>
  averageOrderValue: number
  period: string
}

export interface BranchReservationAnalytics {
  branchId: string
  totalReservations: number
  upcomingReservations: number
  cancelledReservations: number
  occupancyRate: number
  period: string
}
