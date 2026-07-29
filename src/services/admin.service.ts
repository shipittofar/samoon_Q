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
 *   ⚠️  GET   /console/stats/               — no backend route yet
 *   ⚠️  GET   /console/orders/              — falls back to /orders/ in real mode
 *   ⚠️  GET   /console/reservations/        — falls back to /reservations/ in real mode
 *   ⚠️  GET   /console/customers/           — no backend route yet
 *   ⚠️  GET   /console/customers/{id}/stats/ — no backend route yet
 */
import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { MOCK_MENU_ITEMS, MOCK_ORDERS, MOCK_PLATFORM_USERS, MOCK_BUSINESS_CUSTOMERS, MOCK_BRANCH_CUSTOMERS, MOCK_RESERVATIONS, MOCK_CUSTOMER_NOTES, MOCK_CUSTOMER_TAG_DEFINITIONS, MOCK_CUSTOMER_TAG_ASSIGNMENTS, MOCK_CUSTOMER_ANALYTICS, MOCK_CUSTOMER_MARKETING, MOCK_CUSTOMER_COUPONS, MOCK_CUSTOMER_TIMELINE } from '@/lib/mock-data'
import { isPickupDeliveryRejectionError, resolveStatusUpdate, type OrderStatusContext } from '@/lib/order-status'
import type {
  AdminCustomer,
  AdminCustomerFilters,
  AdminCustomerStats,
  AdminOrderFilters,
  AdminOrdersRequest,
  AdminOrdersScope,
  AdminReservationFilters,
  AdminStats,
  BusinessCustomer,
  BranchCustomer,
  CustomerNote,
  CustomerTag,
  CustomerTagAssignment,
  CustomerTimelineEvent,
  CustomerAnalytics,
  CustomerMarketing,
  CustomerCoupon,
  CustomerPayment,
  MenuItem,
  Order,
  OrderStatus,
  PaginatedResponse,
  Reservation,
  Review,
  AccountType,
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

// Build tenant-scoped AdminCustomer views from PlatformUser + BusinessCustomer.
// This join replaces the old flat MOCK_CUSTOMERS array.
function buildAdminCustomers(tenantId: string): AdminCustomer[] {
  const bcs = MOCK_BUSINESS_CUSTOMERS.filter((bc) => bc.tenantId === tenantId)
  return bcs.map((bc) => {
    const pu = MOCK_PLATFORM_USERS.find((u) => u.id === bc.userId)
    const avgOrder = bc.ordersCount > 0 ? bc.totalSpent / bc.ordersCount : 0
    const tierMap: Record<string, 'new' | 'regular' | 'vip'> = {
      bronze: 'new', silver: 'regular', gold: 'vip', platinum: 'vip',
    }
    return {
      id: bc.userId,
      email: pu?.email ?? '',
      phone_number: pu?.phone_number ?? '',
      first_name: pu?.name.split(' ')[0] ?? '',
      last_name: pu?.name.split(' ').slice(1).join(' ') ?? '',
      avatar: pu?.avatar,
      accountType: 'customer' as AccountType,
      is_verified: pu?.status === 'active',
      created_at: pu?.created_at ?? bc.firstInteractionAt,
      order_count: bc.ordersCount,
      total_spent: bc.totalSpent,
      avg_order_value: Math.round(avgOrder * 100) / 100,
      tier: tierMap[bc.loyaltyTier] ?? 'new',
      last_order_at: bc.lastInteractionAt,
    } satisfies AdminCustomer
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function applyOrderFilters(orders: Partial<Order>[], filters: AdminOrderFilters): Partial<Order>[] {
  let result = [...orders]
  if (filters.status) result = result.filter((o) => o.status === filters.status)
  if (filters.order_type) result = result.filter((o) => o.order_type === filters.order_type)
  if (filters.branch_id) result = result.filter((o) => o.branch_id === filters.branch_id)
  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (o) => o.order_number?.toLowerCase().includes(q) || o.user?.first_name?.toLowerCase().includes(q),
    )
  }
  return result
}

function isAdminOrdersRequest(input: AdminOrdersRequest | AdminOrderFilters): input is AdminOrdersRequest {
  return (
    'scope' in input ||
    'tenantId' in input ||
    'branchId' in input ||
    'filters' in input
  )
}

function normalizeAdminOrdersRequest(
  input: AdminOrdersRequest | AdminOrderFilters = {},
): {
  scope: AdminOrdersScope
  tenantId?: string
  branchId?: string
  filters: AdminOrderFilters
} {
  if (isAdminOrdersRequest(input)) {
    return {
      scope: input.scope ?? (input.tenantId && input.branchId ? 'scoped' : 'global'),
      tenantId: input.tenantId,
      branchId: input.branchId,
      filters: input.filters ?? {},
    }
  }
  return { scope: 'global', filters: input }
}

function usesConsoleOrdersEndpoint(
  request: ReturnType<typeof normalizeAdminOrdersRequest>,
): boolean {
  if (request.scope === 'scoped' && request.tenantId && request.branchId) return true
  if (request.scope === 'global' && request.tenantId) return true
  return false
}

function resolveAdminOrdersUrl(request: ReturnType<typeof normalizeAdminOrdersRequest>): string {
  if (request.scope === 'scoped' && request.tenantId && request.branchId) {
    return ENDPOINTS.ORDERS.CONSOLE_ORDER_TENANT_BRANCH_LIST(request.tenantId, request.branchId)
  }
  if (request.scope === 'global' && request.tenantId) {
    return ENDPOINTS.ORDERS.CONSOLE_ORDER_TENANT_BRANCHES_LIST(request.tenantId)
  }
  return ENDPOINTS.ORDERS.LIST
}

function buildAdminOrdersParams(
  request: ReturnType<typeof normalizeAdminOrdersRequest>,
): AdminOrderFilters | (AdminOrderFilters & { admin: true }) {
  if (usesConsoleOrdersEndpoint(request)) {
    if (request.scope === 'scoped') {
      const { branch_id: _branchId, ...rest } = request.filters
      return rest
    }
    return { ...request.filters }
  }
  return { ...request.filters, admin: true }
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
      (r) => r.name.toLowerCase().includes(q) || r.phone_number.includes(filters.search!),
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
        (c.email ?? '').toLowerCase().includes(q),
    )
  }
  return result
}

// Default tenant used when no tenantId is passed — covers legacy call sites.
const FALLBACK_TENANT = 'tenant-samoon-01'

export const ADMIN_ORDERS_PAGE_SIZE = 20

/** Mock branch → tenant map (matches branch.service INITIAL_MOCK_BRANCHES). */
const MOCK_BRANCH_TENANT_IDS: Record<string, string> = {
  'branch-rest-01': FALLBACK_TENANT,
  'branch-rest-02': FALLBACK_TENANT,
  'branch-rest-03': FALLBACK_TENANT,
  'branch-cafe-01': FALLBACK_TENANT,
  'branch-cafe-02': FALLBACK_TENANT,
  'branch-bar-01': FALLBACK_TENANT,
  'branch-fc-01': FALLBACK_TENANT,
  'branch-fc-02': FALLBACK_TENANT,
}

function mockBranchTenantId(branchId: string): string | undefined {
  return MOCK_BRANCH_TENANT_IDS[branchId]
}

function applyMockOrdersScope(
  orders: Partial<Order>[],
  request: ReturnType<typeof normalizeAdminOrdersRequest>,
): Partial<Order>[] {
  if (request.scope === 'scoped') {
    return orders.filter((o) => {
      if (!o.branch_id) return false
      if (request.branchId && o.branch_id !== request.branchId) return false
      if (request.tenantId) {
        const orderTenantId = mockBranchTenantId(o.branch_id)
        if (!orderTenantId || orderTenantId !== request.tenantId) return false
      }
      return true
    })
  }
  if (request.scope === 'global' && request.tenantId) {
    return orders.filter((o) => {
      if (!o.branch_id) return false
      const orderTenantId = mockBranchTenantId(o.branch_id)
      return orderTenantId === request.tenantId
    })
  }
  return orders
}

function paginate<T>(items: T[], page = 1, pageSize = ADMIN_ORDERS_PAGE_SIZE): PaginatedResponse<T> {
  const count = items.length
  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const start = (safePage - 1) * pageSize
  const results = items.slice(start, start + pageSize)
  return {
    count,
    next: safePage < totalPages ? String(safePage + 1) : null,
    previous: safePage > 1 ? String(safePage - 1) : null,
    results,
  }
}

// ── adminService ───────────────────────────────────────────────────────────────

export const adminService = {
  // ⚠️ Backend blocker: GET /console/stats/ not yet deployed
  async getStats(): Promise<AdminStats> {
    if (USE_MOCK) {
      await delay(600)
      return { ...MOCK_ADMIN_STATS }
    }
    const { data } = await api.get<AdminStats>(ENDPOINTS.ADMIN.STATS)
    return data
  },

  // Scoped: GET /orders/console-orders/tenants/{tenantId}/branches/{branchId}/
  // Global: GET /orders/console-orders/tenants/{tenantId}/branches/
  // Legacy: GET /orders/?admin=true (plain AdminOrderFilters without tenantId)
  async getAdminOrders(
    requestOrFilters: AdminOrdersRequest | AdminOrderFilters = {},
  ): Promise<PaginatedResponse<Order>> {
    const request = normalizeAdminOrdersRequest(requestOrFilters)
    if (USE_MOCK) {
      await delay(500)
      const scoped = applyMockOrdersScope(MOCK_ORDERS, request)
      const mockFilters =
        request.scope === 'scoped'
          ? { ...request.filters, branch_id: undefined }
          : request.filters
      const filtered = applyOrderFilters(scoped, mockFilters)
      const pageSize = request.filters.page_size ?? ADMIN_ORDERS_PAGE_SIZE
      return paginate(filtered as Order[], request.filters.page, pageSize) as PaginatedResponse<Order>
    }
    const { data } = await api.get<PaginatedResponse<Order>>(resolveAdminOrdersUrl(request), {
      params: buildAdminOrdersParams(request),
    })
    return data
  },

  // ⚠️ Backend blocker: PATCH /orders/{id}/status/ not yet deployed
  async updateOrderStatus(
    id: string,
    status: OrderStatus,
    orderContext?: OrderStatusContext,
  ): Promise<Order> {
    const resolvedStatus = resolveStatusUpdate(orderContext, status)
    if (USE_MOCK) {
      await delay(400)
      const order = MOCK_ORDERS.find((o) => o.id === id)
      return { ...(order as Order), status: resolvedStatus }
    }
    try {
      const { data } = await api.patch<Order>(ENDPOINTS.ORDERS.STATUS(id), { status: resolvedStatus })
      return data
    } catch (error) {
      if (isPickupDeliveryRejectionError(error)) {
        console.warn(
          '[adminService.updateOrderStatus] Unexpected invalid_order_status_transition',
          { id, status: resolvedStatus, orderType: orderContext?.order_type },
        )
      }
      throw error
    }
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
      const tenantId = filters.tenantId ?? FALLBACK_TENANT
      const tenantCustomers = buildAdminCustomers(tenantId)
      const filtered = applyCustomerFilters(tenantCustomers, filters)
      return paginate(filtered, filters.page, filters.page_size)
    }
    const { data } = await api.get<PaginatedResponse<AdminCustomer>>(ENDPOINTS.ADMIN.CUSTOMERS, {
      params: filters,
    })
    return data
  },

  async getCustomer(id: string, tenantId?: string): Promise<AdminCustomer> {
    if (USE_MOCK) {
      await delay(300)
      const tid = tenantId ?? FALLBACK_TENANT
      const tenantCustomers = buildAdminCustomers(tid)
      const customer = tenantCustomers.find((c) => c.id === id)
      if (!customer) throw new Error(`Customer not found: ${id}`)
      return { ...customer }
    }
    const { data } = await api.get<AdminCustomer>(ENDPOINTS.ADMIN.CUSTOMER_DETAIL(id))
    return data
  },

  // ⚠️ Backend blocker: GET /admin/customers/{id}/stats/ not yet deployed
  async getCustomerStats(id: string, tenantId?: string): Promise<AdminCustomerStats> {
    if (USE_MOCK) {
      await delay(400)
      const tid = tenantId ?? FALLBACK_TENANT
      const bc = MOCK_BUSINESS_CUSTOMERS.find((b) => b.userId === id && b.tenantId === tid)
      const avgOrder = bc && bc.ordersCount > 0 ? bc.totalSpent / bc.ordersCount : 0
      return {
        customer_id: id,
        tenant_id: tid,
        order_count: bc?.ordersCount ?? 0,
        total_spent: bc?.totalSpent ?? 0,
        avg_order_value: Math.round(avgOrder * 100) / 100,
        last_order_at: bc?.lastInteractionAt,
      }
    }
    const { data } = await api.get<AdminCustomerStats>(ENDPOINTS.ADMIN.CUSTOMER_STATS(id))
    return data
  },

  async getCustomerReviews(customerId: string, tenantId?: string): Promise<Review[]> {
    if (USE_MOCK) {
      await delay(300)
      const pu = MOCK_PLATFORM_USERS.find((u) => u.id === customerId)
      if (!pu) return []
      const firstName = pu.name.split(' ')[0] ?? ''
      const lastName = pu.name.split(' ').slice(1).join(' ') ?? ''
      const mockUser = { id: customerId, first_name: firstName, last_name: lastName, email: pu.email ?? '', accountType: 'customer' as AccountType, is_verified: pu.status === 'active', created_at: pu.created_at }
      return [
        {
          id: `review-${customerId}-1`,
          user: mockUser,
          menu_item_id: 'item-001',
          rating: 5,
          comment: 'Excellent food and service! Will definitely come back.',
          created_at: new Date(Date.now() - 7 * 86_400_000).toISOString(),
        },
        {
          id: `review-${customerId}-2`,
          user: mockUser,
          menu_item_id: 'item-003',
          order_id: `order-${customerId}-1`,
          rating: 4,
          comment: 'Great atmosphere, slightly long wait but worth it.',
          created_at: new Date(Date.now() - 21 * 86_400_000).toISOString(),
        },
      ]
    }
    const { data } = await api.get<Review[]>(`/console/customers/${customerId}/reviews/`)
    return data
  },

  // ⚠️ Backend blocker: GET /admin/business-customers/?userId=&tenantId= not yet deployed
  async getBusinessCustomer(userId: string, tenantId: string): Promise<BusinessCustomer | null> {
    if (USE_MOCK) {
      await delay(300)
      const bc = MOCK_BUSINESS_CUSTOMERS.find((b) => b.userId === userId && b.tenantId === tenantId)
      return bc ?? null
    }
    const { data } = await api.get<BusinessCustomer | null>(`/admin/business-customers/`, {
      params: { userId, tenantId },
    })
    return data
  },

  // ⚠️ Backend blocker: GET /admin/branches/{branchId}/customers/?userId= not yet deployed
  async getBranchCustomers(userId: string, tenantId: string): Promise<BranchCustomer[]> {
    if (USE_MOCK) {
      await delay(300)
      const bc = MOCK_BUSINESS_CUSTOMERS.find((b) => b.userId === userId && b.tenantId === tenantId)
      if (!bc) return []
      return MOCK_BRANCH_CUSTOMERS.filter((brc) => brc.businessCustomerId === bc.id)
    }
    const { data } = await api.get<BranchCustomer[]>(`/admin/business-customers/${userId}/branches/`, {
      params: { tenantId },
    })
    return data
  },

  // ── P8.9.7 Customer 360° CRM methods ──────────────────────────────────────────

  // ⚠️ Backend blocker: GET /admin/customers/{id}/timeline/ not yet deployed
  async getCustomerTimeline(userId: string, tenantId: string): Promise<CustomerTimelineEvent[]> {
    if (USE_MOCK) {
      await delay(400)
      const events = MOCK_CUSTOMER_TIMELINE.filter(
        (e) => e.userId === userId && e.tenantId === tenantId
      )
      return [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    const { data } = await api.get<CustomerTimelineEvent[]>(`/admin/customers/${userId}/timeline/`, {
      params: { tenantId },
    })
    return data
  },

  // ⚠️ Backend blocker: GET /admin/customers/{id}/notes/ not yet deployed
  async getCustomerNotes(userId: string, tenantId: string): Promise<CustomerNote[]> {
    if (USE_MOCK) {
      await delay(300)
      return MOCK_CUSTOMER_NOTES.filter((n) => n.userId === userId && n.tenantId === tenantId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    const { data } = await api.get<CustomerNote[]>(`/admin/customers/${userId}/notes/`, {
      params: { tenantId },
    })
    return data
  },

  // ⚠️ Backend blocker: POST /admin/customers/{id}/notes/ not yet deployed
  async createCustomerNote(userId: string, tenantId: string, content: string, authorId: string, authorName: string): Promise<CustomerNote> {
    if (USE_MOCK) {
      await delay(400)
      const note: CustomerNote = {
        id: `cn-${Date.now()}`,
        userId,
        tenantId,
        content,
        authorId,
        authorName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      MOCK_CUSTOMER_NOTES.push(note)
      return note
    }
    const { data } = await api.post<CustomerNote>(`/admin/customers/${userId}/notes/`, { tenantId, content })
    return data
  },

  // ⚠️ Backend blocker: PATCH /admin/customers/{id}/notes/{noteId}/ not yet deployed
  async updateCustomerNote(noteId: string, content: string): Promise<CustomerNote> {
    if (USE_MOCK) {
      await delay(300)
      const idx = MOCK_CUSTOMER_NOTES.findIndex((n) => n.id === noteId)
      if (idx === -1) throw new Error(`Note ${noteId} not found`)
      MOCK_CUSTOMER_NOTES[idx] = { ...MOCK_CUSTOMER_NOTES[idx], content, updated_at: new Date().toISOString() }
      return MOCK_CUSTOMER_NOTES[idx]
    }
    const { data } = await api.patch<CustomerNote>(`/admin/notes/${noteId}/`, { content })
    return data
  },

  // ⚠️ Backend blocker: DELETE /admin/customers/{id}/notes/{noteId}/ not yet deployed
  async deleteCustomerNote(noteId: string): Promise<void> {
    if (USE_MOCK) {
      await delay(300)
      const idx = MOCK_CUSTOMER_NOTES.findIndex((n) => n.id === noteId)
      if (idx !== -1) MOCK_CUSTOMER_NOTES.splice(idx, 1)
      return
    }
    await api.delete(`/admin/notes/${noteId}/`)
  },

  // ⚠️ Backend blocker: GET /admin/customers/{id}/tags/ not yet deployed
  async getCustomerTags(userId: string, tenantId: string): Promise<CustomerTagAssignment> {
    if (USE_MOCK) {
      await delay(250)
      const key = `${userId}:${tenantId}`
      const tagIds = MOCK_CUSTOMER_TAG_ASSIGNMENTS[key] ?? []
      const tags = MOCK_CUSTOMER_TAG_DEFINITIONS.filter((t) => tagIds.includes(t.id))
      return { userId, tenantId, tags }
    }
    const { data } = await api.get<CustomerTagAssignment>(`/admin/customers/${userId}/tags/`, {
      params: { tenantId },
    })
    return data
  },

  // ⚠️ Backend blocker: GET /admin/tenants/{tenantId}/tags/ not yet deployed
  async getTenantTagDefinitions(tenantId: string): Promise<CustomerTag[]> {
    if (USE_MOCK) {
      await delay(200)
      return MOCK_CUSTOMER_TAG_DEFINITIONS.filter((t) => t.tenantId === tenantId)
    }
    const { data } = await api.get<CustomerTag[]>(`/admin/tenants/${tenantId}/tags/`)
    return data
  },

  // ⚠️ Backend blocker: PATCH /admin/customers/{id}/tags/ not yet deployed
  async updateCustomerTags(userId: string, tenantId: string, tagIds: string[]): Promise<CustomerTagAssignment> {
    if (USE_MOCK) {
      await delay(300)
      const key = `${userId}:${tenantId}`
      MOCK_CUSTOMER_TAG_ASSIGNMENTS[key] = tagIds
      const tags = MOCK_CUSTOMER_TAG_DEFINITIONS.filter((t) => tagIds.includes(t.id))
      return { userId, tenantId, tags }
    }
    const { data } = await api.patch<CustomerTagAssignment>(`/admin/customers/${userId}/tags/`, { tenantId, tagIds })
    return data
  },

  // ⚠️ Backend blocker: GET /admin/customers/{id}/analytics/ not yet deployed
  async getCustomerAnalytics(userId: string, tenantId: string): Promise<CustomerAnalytics | null> {
    if (USE_MOCK) {
      await delay(400)
      return MOCK_CUSTOMER_ANALYTICS.find((a) => a.userId === userId && a.tenantId === tenantId) ?? null
    }
    const { data } = await api.get<CustomerAnalytics>(`/admin/customers/${userId}/analytics/`, {
      params: { tenantId },
    })
    return data
  },

  // ⚠️ Backend blocker: GET /admin/customers/{id}/marketing/ not yet deployed
  async getCustomerMarketing(userId: string, tenantId: string): Promise<CustomerMarketing | null> {
    if (USE_MOCK) {
      await delay(350)
      return MOCK_CUSTOMER_MARKETING.find((m) => m.userId === userId && m.tenantId === tenantId) ?? null
    }
    const { data } = await api.get<CustomerMarketing>(`/admin/customers/${userId}/marketing/`, {
      params: { tenantId },
    })
    return data
  },

  // ⚠️ Backend blocker: GET /admin/customers/{id}/coupons/ not yet deployed
  async getCustomerCoupons(userId: string, tenantId: string): Promise<CustomerCoupon[]> {
    if (USE_MOCK) {
      await delay(300)
      return MOCK_CUSTOMER_COUPONS.filter((c) => c.userId === userId && c.tenantId === tenantId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    const { data } = await api.get<CustomerCoupon[]>(`/admin/customers/${userId}/coupons/`, {
      params: { tenantId },
    })
    return data
  },

  // ⚠️ Backend blocker: GET /admin/customers/{id}/payments/ not yet deployed
  async getCustomerPayments(userId: string, tenantId: string): Promise<CustomerPayment[]> {
    if (USE_MOCK) {
      await delay(350)
      // Derive payments from timeline order events for this user/tenant
      const orderEvents = MOCK_CUSTOMER_TIMELINE.filter(
        (e) => e.userId === userId && e.tenantId === tenantId && e.type === 'order_placed' && e.amount
      )
      return orderEvents.map((e) => ({
        id: `pay-${e.referenceId ?? e.id}`,
        userId,
        tenantId,
        orderId: e.referenceId,
        amount: e.amount ?? 0,
        currency: 'USD',
        method: 'card' as const,
        status: 'completed' as const,
        processedAt: e.created_at,
      }))
    }
    const { data } = await api.get<CustomerPayment[]>(`/admin/customers/${userId}/payments/`, {
      params: { tenantId },
    })
    return data
  },

  // ⚠️ Backend blocker: GET /admin/customers/{id}/orders/ not yet deployed
  async getCustomerOrders(userId: string, tenantId: string): Promise<PaginatedResponse<Order>> {
    if (USE_MOCK) {
      await delay(400)
      // Return general mock orders as a stub — real impl would filter by userId+tenantId
      return paginate(MOCK_ORDERS as Order[], 1, 20)
    }
    const { data } = await api.get<PaginatedResponse<Order>>(`/admin/customers/${userId}/orders/`, {
      params: { tenantId },
    })
    return data
  },

  // ⚠️ Backend blocker: GET /admin/customers/{id}/reservations/ not yet deployed
  async getCustomerReservations(userId: string, tenantId: string): Promise<PaginatedResponse<Reservation>> {
    if (USE_MOCK) {
      await delay(350)
      return paginate(MOCK_RESERVATIONS, 1, 20)
    }
    const { data } = await api.get<PaginatedResponse<Reservation>>(`/admin/customers/${userId}/reservations/`, {
      params: { tenantId },
    })
    return data
  },
}
