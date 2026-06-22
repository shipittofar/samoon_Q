import type {
  BranchRevenueAnalytics,
  BranchOrderAnalytics,
  BranchReservationAnalytics,
} from '@/types/analytics'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const MOCK_BRANCH_DATA: Record<string, { revenue: number; orders: number; reservations: number }> = {
  'branch-rest-01': { revenue: 45200, orders: 312, reservations: 87 },
  'branch-rest-02': { revenue: 38100, orders: 264, reservations: 71 },
  'branch-cafe-01': { revenue: 22400, orders: 189, reservations: 43 },
  'branch-cafe-02': { revenue: 19800, orders: 156, reservations: 38 },
  'branch-bar-01':  { revenue: 31600, orders: 201, reservations: 55 },
  'branch-bar-02':  { revenue: 28900, orders: 187, reservations: 49 },
}

function mockData(branchId: string) {
  return MOCK_BRANCH_DATA[branchId] ?? { revenue: 12000, orders: 80, reservations: 25 }
}

export const branchAnalyticsService = {
  async getBranchRevenueAnalytics(branchId: string): Promise<BranchRevenueAnalytics> {
    if (!USE_MOCK) throw new Error('Network mode not available — set NEXT_PUBLIC_USE_MOCK=true')
    await delay(50)
    const d = mockData(branchId)
    return {
      branchId,
      totalRevenue: d.revenue,
      revenueChangePct: 8.3,
      averageOrderValue: parseFloat((d.revenue / d.orders).toFixed(2)),
      totalOrders: d.orders,
      period: 'month',
    }
  },

  async getBranchOrderAnalytics(branchId: string): Promise<BranchOrderAnalytics> {
    if (!USE_MOCK) throw new Error('Network mode not available — set NEXT_PUBLIC_USE_MOCK=true')
    await delay(50)
    const d = mockData(branchId)
    return {
      branchId,
      totalOrders: d.orders,
      ordersByStatus: {
        pending:   Math.floor(d.orders * 0.05),
        accepted:  Math.floor(d.orders * 0.08),
        preparing: Math.floor(d.orders * 0.12),
        ready:     Math.floor(d.orders * 0.10),
        delivered: Math.floor(d.orders * 0.60),
        cancelled: Math.floor(d.orders * 0.05),
      },
      averageOrderValue: parseFloat((d.revenue / d.orders).toFixed(2)),
      period: 'month',
    }
  },

  async getBranchReservationAnalytics(branchId: string): Promise<BranchReservationAnalytics> {
    if (!USE_MOCK) throw new Error('Network mode not available — set NEXT_PUBLIC_USE_MOCK=true')
    await delay(50)
    const d = mockData(branchId)
    return {
      branchId,
      totalReservations: d.reservations,
      upcomingReservations: Math.floor(d.reservations * 0.30),
      cancelledReservations: Math.floor(d.reservations * 0.10),
      occupancyRate: 0.72,
      period: 'month',
    }
  },
}
