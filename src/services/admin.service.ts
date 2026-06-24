/**
 * Admin Service — Phase 5.1
 *
 * All methods follow the USE_MOCK pattern used throughout the codebase:
 *   - USE_MOCK=true  → returns typed mock data after a simulated delay
 *   - USE_MOCK=false → calls the real API via axios
 *
 * Backend-gated methods (marked ⚠️) have typed mock implementations ready
 * but will 404/500 in production until the corresponding backend endpoint
 * is deployed. They are safe to call in mock mode at any time.
 *
 * Backend-gated endpoints:
 *   ⚠️  PATCH /orders/{id}/status/        — no backend route yet
 *   ⚠️  POST  /reservations/{id}/confirm/ — no backend route yet
 *   ⚠️  GET   /admin/stats/               — no backend route yet
 *   ⚠️  GET   /admin/orders/              — falls back to /orders/ in real mode
 *   ⚠️  GET   /admin/reservations/        — falls back to /reservations/ in real mode
 *   ⚠️  GET   /admin/customers/           — no backend route yet
 *   ⚠️  GET   /admin/customers/{id}/stats/ — no backend route yet
 */
import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { MOCK_MENU_ITEMS, MOCK_ORDERS, MOCK_RESERVATIONS } from '@/lib/mock-data'
import type {
  AdminCustomer,
  AdminCustomerFilters,
  AdminCustomerStats,
  AdminOrderFilters,
  AdminReservationFilters,
  AdminStats,
  MenuItem,
  Order,
  OrderStatus,
  PaginatedResponse,
  Reservation,
  Review,
  UserRole,
} from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 600) => new Promise((r) => setTimeout(r, ms))

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_ADMIN_STATS: AdminStats = {
  period_days: 30,
  total_revenue: 48295,
  revenue_change_pct: 12.5,
  total_orders: 1284,
  orders_change_pct: 8.2,
  new_customers: 348,
  customers_change_pct: 15.3,
  total_reservations: 92,
  reservations_change_pct: -3.1,
  top_items: [
    { menu_item_id: '1', name: 'Wagyu Smash Burger', order_count: 284, revenue: 7098, trend_pct: 18 },
    { menu_item_id: '2', name: 'Carbonara Autentica', order_count: 231, revenue: 5079, trend_pct: 12 },
    { menu_item_id: '3', name: 'Truffle Mushroom Pizza', order_count: 198, revenue: 5741, trend_pct: 7 },
    { menu_item_id: '4', name: 'Crème Brûlée', order_count: 176, revenue: 2112, trend_pct: 22 },
    { menu_item_id: '5', name: 'Mango Lassi', order_count: 162, revenue: 1133, trend_pct: -4 },
  ],
  orders_in_queue: 12,
  avg_prep_time_minutes: 18,
  tables_reserved: 8,
  tables_total: 24,
}

const MOCK_CUSTOMERS: AdminCustomer[] = [
  {
    id: 'u1', email: 'alice@example.com', first_name: 'Alice', last_name: 'Johnson',
    phone: '+1234567890', role: 'customer' as UserRole, is_verified: true,
    created_at: '2024-01-15T00:00:00Z',
    order_count: 14, total_spent: 420.50, avg_order_value: 30.04, tier: 'vip',
    last_order_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: 'u2', email: 'bob@example.com', first_name: 'Bob', last_name: 'Chen',
    phone: '+0987654321', role: 'customer' as UserRole, is_verified: true,
    created_at: '2024-02-20T00:00:00Z',
    order_count: 8, total_spent: 210.75, avg_order_value: 26.34, tier: 'regular',
    last_order_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: 'u3', email: 'carol@example.com', first_name: 'Carol', last_name: 'Davis',
    phone: '+1122334455', role: 'customer' as UserRole, is_verified: true,
    created_at: '2023-11-05T00:00:00Z',
    order_count: 22, total_spent: 680.00, avg_order_value: 30.91, tier: 'vip',
    last_order_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  },
  {
    id: 'u4', email: 'dan@example.com', first_name: 'Dan', last_name: 'Wilson',
    phone: '+5544332211', role: 'customer' as UserRole, is_verified: false,
    created_at: '2024-03-10T00:00:00Z',
    order_count: 3, total_spent: 67.20, avg_order_value: 22.40, tier: 'new',
    last_order_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
  },
  {
    id: 'u5', email: 'eva@example.com', first_name: 'Eva', last_name: 'Martinez',
    phone: '+6677889900', role: 'customer' as UserRole, is_verified: true,
    created_at: '2023-12-01T00:00:00Z',
    order_count: 17, total_spent: 530.40, avg_order_value: 31.20, tier: 'vip',
    last_order_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function applyOrderFilters(orders: Partial<Order>[], filters: AdminOrderFilters): Partial<Order>[] {
  let result = [...orders]
  if (filters.status) result = result.filter((o) => o.status === filters.status)
  if (filters.order_type) result = result.filter((o) => o.order_type === filters.order_type)
  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (o) => o.order_number?.toLowerCase().includes(q) || o.user?.first_name?.toLowerCase().includes(q),
    )
  }
  return result
}

function applyReservationFilters(
  reservations: Reservation[],
  filters: AdminReservationFilters,
): Reservation[] {
  let result = [...reservations]
  if (filters.status) result = result.filter((r) => r.status === filters.status)
  if (filters.branch_id) result = result.filter((r) => r.branch_id === filters.branch_id)
  if (filters.date) result = result.filter((r) => r.date === filters.date)
  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (r) => r.name.toLowerCase().includes(q) || r.phone.includes(filters.search!),
    )
  }
  return result
}

function applyCustomerFilters(customers: AdminCustomer[], filters: AdminCustomerFilters): AdminCustomer[] {
  let result = [...customers]
  if (filters.tier) result = result.filter((c) => c.tier === filters.tier)
  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    )
  }
  return result
}

function paginate<T>(items: T[], page = 1, pageSize = 20): PaginatedResponse<T> {
  const start = (page - 1) * pageSize
  const results = items.slice(start, start + pageSize)
  return { count: items.length, next: null, previous: null, results }
}

// ── adminService ───────────────────────────────────────────────────────────────

export const adminService = {
  // ⚠️ Backend blocker: GET /admin/stats/ not yet deployed
  async getStats(): Promise<AdminStats> {
    if (USE_MOCK) {
      await delay(600)
      return { ...MOCK_ADMIN_STATS }
    }
    const { data } = await api.get<AdminStats>(ENDPOINTS.ADMIN.STATS)
    return data
  },

  // Falls back to GET /orders/ in real mode; swap to ENDPOINTS.ADMIN.ORDERS when deployed
  async getAdminOrders(filters: AdminOrderFilters = {}): Promise<PaginatedResponse<Order>> {
    if (USE_MOCK) {
      await delay(500)
      const filtered = applyOrderFilters(MOCK_ORDERS, filters)
      return paginate(filtered as Order[], filters.page, filters.page_size) as PaginatedResponse<Order>
    }
    const { data } = await api.get<PaginatedResponse<Order>>(ENDPOINTS.ORDERS.LIST, {
      params: { ...filters, admin: true },
    })
    return data
  },

  // ⚠️ Backend blocker: PATCH /orders/{id}/status/ not yet deployed
  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    if (USE_MOCK) {
      await delay(400)
      const order = MOCK_ORDERS.find((o) => o.id === id)
      return { ...(order as Order), status }
    }
    const { data } = await api.patch<Order>(ENDPOINTS.ORDERS.STATUS(id), { status })
    return data
  },

  async getAdminReservation(id: string): Promise<Reservation> {
    if (USE_MOCK) {
      await delay(400)
      const res = MOCK_RESERVATIONS.find((r) => r.id === id)
      if (!res) throw new Error(`Reservation ${id} not found`)
      return res
    }
    const { data } = await api.get<Reservation>(ENDPOINTS.RESERVATIONS.DETAIL(id))
    return data
  },

  // Falls back to GET /reservations/ in real mode; swap to ENDPOINTS.ADMIN.RESERVATIONS when deployed
  async getAdminReservations(filters: AdminReservationFilters = {}): Promise<PaginatedResponse<Reservation>> {
    if (USE_MOCK) {
      await delay(500)
      const filtered = applyReservationFilters(MOCK_RESERVATIONS, filters)
      return paginate(filtered, filters.page, filters.page_size)
    }
    const { data } = await api.get<PaginatedResponse<Reservation>>(ENDPOINTS.RESERVATIONS.LIST, {
      params: { ...filters, admin: true },
    })
    return data
  },

  // ⚠️ Backend blocker: POST /reservations/{id}/confirm/ not yet deployed
  async confirmReservation(id: string): Promise<Reservation> {
    if (USE_MOCK) {
      await delay(400)
      const res = MOCK_RESERVATIONS.find((r) => r.id === id)
      return {
        ...(res as Reservation),
        status: 'confirmed',
        confirmation_code: `SAV-${Math.floor(Math.random() * 9000) + 1000}`,
      }
    }
    const { data } = await api.post<Reservation>(ENDPOINTS.RESERVATIONS.CONFIRM(id))
    return data
  },

  // ⚠️ Backend blocker: GET /admin/customers/ not yet deployed
  async getCustomers(filters: AdminCustomerFilters = {}): Promise<PaginatedResponse<AdminCustomer>> {
    if (USE_MOCK) {
      await delay(500)
      const filtered = applyCustomerFilters(MOCK_CUSTOMERS, filters)
      return paginate(filtered, filters.page, filters.page_size)
    }
    const { data } = await api.get<PaginatedResponse<AdminCustomer>>(ENDPOINTS.ADMIN.CUSTOMERS, {
      params: filters,
    })
    return data
  },

  async getCustomer(id: string): Promise<AdminCustomer> {
    if (USE_MOCK) {
      await delay(300)
      const customer = MOCK_CUSTOMERS.find((c) => c.id === id)
      if (!customer) throw new Error(`Customer not found: ${id}`)
      return { ...customer }
    }
    const { data } = await api.get<AdminCustomer>(ENDPOINTS.ADMIN.CUSTOMER_DETAIL(id))
    return data
  },

  // ⚠️ Backend blocker: GET /admin/customers/{id}/stats/ not yet deployed
  async getCustomerStats(id: string): Promise<AdminCustomerStats> {
    if (USE_MOCK) {
      await delay(400)
      const customer = MOCK_CUSTOMERS.find((c) => c.id === id)
      return {
        customer_id: id,
        order_count: customer?.order_count ?? 0,
        total_spent: customer?.total_spent ?? 0,
        avg_order_value: customer?.avg_order_value ?? 0,
        last_order_at: customer?.last_order_at,
      }
    }
    const { data } = await api.get<AdminCustomerStats>(ENDPOINTS.ADMIN.CUSTOMER_STATS(id))
    return data
  },

  async getCustomerReviews(customerId: string): Promise<Review[]> {
    if (USE_MOCK) {
      await delay(300)
      const customer = MOCK_CUSTOMERS.find((c) => c.id === customerId)
      if (!customer) return []
      return [
        {
          id: `review-${customerId}-1`,
          user: { id: customerId, first_name: customer.first_name, last_name: customer.last_name, email: customer.email, role: 'customer', is_verified: customer.is_verified, created_at: customer.created_at },
          menu_item_id: 'item-001',
          rating: 5,
          comment: 'Excellent food and service! Will definitely come back.',
          created_at: new Date(Date.now() - 7 * 86_400_000).toISOString(),
        },
        {
          id: `review-${customerId}-2`,
          user: { id: customerId, first_name: customer.first_name, last_name: customer.last_name, email: customer.email, role: 'customer', is_verified: customer.is_verified, created_at: customer.created_at },
          menu_item_id: 'item-003',
          order_id: `order-${customerId}-1`,
          rating: 4,
          comment: 'Great atmosphere, slightly long wait but worth it.',
          created_at: new Date(Date.now() - 21 * 86_400_000).toISOString(),
        },
      ]
    }
    const { data } = await api.get<Review[]>(`/admin/customers/${customerId}/reviews/`)
    return data
  },
}
