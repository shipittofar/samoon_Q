/**
 * P5.1 — Admin Service Layer tests
 *
 * Coverage:
 *   - ENDPOINTS additions (ADMIN.*, ORDERS.STATUS, RESERVATIONS.CONFIRM)
 *   - AdminStats / AdminCustomer / AdminOrderFilters / AdminReservationFilters types
 *   - adminService mock-mode behaviour
 *   - menuService CRUD (createItem / updateItem / deleteItem)
 *   - React Query hooks — query keys, mutation invalidation
 *   - Regression: existing hooks and services unmodified
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const TENANT_SAMOON = 'tenant-samoon-01'

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

/** Source of one exported function: from its declaration to the next top-level `}` (EOL-agnostic). */
function fnBody(source: string, name: string): string {
  const text = source.replace(/\r\n/g, '\n')
  const start = text.indexOf(`export function ${name}(`)
  if (start < 0) return ''
  const end = text.indexOf('\n}\n', start)
  return text.slice(start, end < 0 ? undefined : end + 2)
}

// ── ENDPOINTS additions ───────────────────────────────────────────────────────

describe('endpoints.ts — P5.1 additions', () => {
  const src = () => readSrc('services/endpoints.ts')

  it('has ENDPOINTS.ORDERS.STATUS', () => {
    expect(src()).toContain('STATUS')
    expect(src()).toContain('/orders/${id}/status/')
  })

  it('has ENDPOINTS.RESERVATIONS.CONFIRM', () => {
    expect(src()).toContain('CONFIRM')
    expect(src()).toContain('/reservations/${id}/confirm/')
  })

  it('has ENDPOINTS.ADMIN namespace', () => {
    expect(src()).toContain('ADMIN:')
  })

  it('has ENDPOINTS.ADMIN.STATS', () => {
    expect(src()).toContain('STATS:')
    expect(src()).toContain('/admin/stats/')
  })

  it('has ENDPOINTS.ADMIN.ORDERS', () => {
    expect(src()).toContain('/admin/orders/')
  })

  it('has ENDPOINTS.ADMIN.RESERVATIONS', () => {
    expect(src()).toContain('/admin/reservations/')
  })

  it('has ENDPOINTS.ADMIN.CUSTOMERS', () => {
    expect(src()).toContain('/admin/customers/')
  })

  it('has ENDPOINTS.ADMIN.CUSTOMER_STATS', () => {
    expect(src()).toContain('CUSTOMER_STATS')
    expect(src()).toContain('/admin/customers/${id}/stats/')
  })

  it('preserves all existing ORDERS keys', () => {
    const src_ = src()
    expect(src_).toContain("LIST: '/orders/'")
    expect(src_).toContain("CREATE: '/orders/'")
    expect(src_).toContain('CANCEL:')
    expect(src_).toContain('REORDER:')
    expect(src_).toContain('TRACK:')
    expect(src_).toContain('VALIDATE_DISCOUNT:')
  })

  it('preserves all existing RESERVATIONS keys', () => {
    const src_ = src()
    expect(src_).toContain("LIST: '/reservations/'")
    expect(src_).toContain("CREATE: '/reservations/'")
    expect(src_).toContain('AVAILABLE_SLOTS:')
  })
})

// ── ENDPOINTS runtime values ──────────────────────────────────────────────────

describe('ENDPOINTS — runtime values', () => {
  beforeEach(() => { vi.resetModules() })

  it('ORDERS.STATUS returns correct URL', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.ORDERS.STATUS('abc')).toBe('/orders/abc/status/')
  })

  it('RESERVATIONS.CONFIRM returns correct URL', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.RESERVATIONS.CONFIRM('res-1')).toBe('/reservations/res-1/confirm/')
  })

  it('ADMIN.CUSTOMER_STATS returns correct URL', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.ADMIN.CUSTOMER_STATS('u1')).toBe('/admin/customers/u1/stats/')
  })

  it('ADMIN.STATS is correct', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.ADMIN.STATS).toBe('/admin/stats/')
  })

  it('ADMIN.ORDERS is correct', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.ADMIN.ORDERS).toBe('/admin/orders/')
  })
})

// ── Types — source structure ──────────────────────────────────────────────────

describe('types/index.ts — P5.1 admin types', () => {
  const src = () => readSrc('types/index.ts')

  it('exports AdminStats interface', () => {
    expect(src()).toContain('export interface AdminStats')
  })

  it('AdminStats has required KPI fields', () => {
    const block = src().slice(src().indexOf('AdminStats'))
    expect(block).toContain('total_revenue')
    expect(block).toContain('total_orders')
    expect(block).toContain('new_customers')
    expect(block).toContain('total_reservations')
    expect(block).toContain('top_items')
  })

  it('exports AdminCustomer interface extending User', () => {
    expect(src()).toContain('export interface AdminCustomer extends User')
  })

  it('AdminCustomer has commerce fields', () => {
    const block = src().slice(src().indexOf('AdminCustomer extends'))
    expect(block).toContain('order_count')
    expect(block).toContain('total_spent')
    expect(block).toContain('tier')
  })

  it('exports AdminCustomerStats', () => {
    expect(src()).toContain('export interface AdminCustomerStats')
  })

  it('exports AdminOrderFilters', () => {
    expect(src()).toContain('export interface AdminOrderFilters')
  })

  it('exports AdminReservationFilters', () => {
    expect(src()).toContain('export interface AdminReservationFilters')
  })

  it('exports AdminCustomerFilters', () => {
    expect(src()).toContain('export interface AdminCustomerFilters')
  })

  it('exports AdminCustomerTier type', () => {
    expect(src()).toContain("export type AdminCustomerTier = 'new' | 'regular' | 'vip'")
  })

  it('does not duplicate User, Order, or Reservation interfaces', () => {
    const src_ = src()
    const userCount = (src_.match(/^export interface User\b/gm) ?? []).length
    const orderCount = (src_.match(/^export interface Order\b/gm) ?? []).length
    expect(userCount).toBe(1)
    expect(orderCount).toBe(1)
  })
})

// ── adminService source structure ─────────────────────────────────────────────

describe('admin.service.ts — source structure', () => {
  const src = () => readSrc('services/admin.service.ts')

  it('exports adminService', () => {
    expect(src()).toContain('export const adminService')
  })

  it('has getStats method', () => {
    expect(src()).toContain('getStats()')
  })

  it('has getAdminOrders method', () => {
    expect(src()).toContain('getAdminOrders(')
  })

  it('has updateOrderStatus method', () => {
    expect(src()).toContain('updateOrderStatus(')
  })

  it('has getAdminReservations method', () => {
    expect(src()).toContain('getAdminReservations(')
  })

  it('has confirmReservation method', () => {
    expect(src()).toContain('confirmReservation(')
  })

  it('has getCustomers method', () => {
    expect(src()).toContain('getCustomers(')
  })

  it('has getCustomerStats method', () => {
    expect(src()).toContain('getCustomerStats(')
  })

  it('uses USE_MOCK pattern', () => {
    expect(src()).toContain('USE_MOCK')
  })

  it('uses ENDPOINTS.ADMIN constants', () => {
    expect(src()).toContain('ENDPOINTS.ADMIN')
  })

  it('uses ENDPOINTS.ORDERS.STATUS', () => {
    expect(src()).toContain('ENDPOINTS.ORDERS.STATUS')
  })

  it('uses ENDPOINTS.RESERVATIONS.CONFIRM', () => {
    expect(src()).toContain('ENDPOINTS.RESERVATIONS.CONFIRM')
  })
})

// ── adminService runtime (mock mode) ─────────────────────────────────────────

describe('adminService — mock mode runtime', () => {
  beforeEach(() => { vi.resetModules() })

  it('getStats returns typed AdminStats', async () => {
    const { adminService } = await import('@/services/admin.service')
    const stats = await adminService.getStats()
    expect(typeof stats.total_revenue).toBe('number')
    expect(typeof stats.total_orders).toBe('number')
    expect(Array.isArray(stats.top_items)).toBe(true)
    expect(stats.top_items.length).toBeGreaterThan(0)
  })

  it('getStats top_items have required shape', async () => {
    const { adminService } = await import('@/services/admin.service')
    const stats = await adminService.getStats()
    for (const item of stats.top_items) {
      expect(typeof item.name).toBe('string')
      expect(typeof item.order_count).toBe('number')
      expect(typeof item.revenue).toBe('number')
    }
  })

  it('getAdminOrders returns paginated orders', async () => {
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getAdminOrders()
    expect(typeof result.count).toBe('number')
    expect(Array.isArray(result.results)).toBe(true)
  })

  it('getAdminOrders filters by status', async () => {
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getAdminOrders({ status: 'delivered' })
    for (const order of result.results) {
      expect(order.status).toBe('delivered')
    }
  })

  it('updateOrderStatus returns order with new status', async () => {
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.updateOrderStatus('ord-001', 'accepted', TENANT_SAMOON)
    expect(result.status).toBe('accepted')
  })

  it('getAdminReservations returns paginated reservations', async () => {
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getAdminReservations()
    expect(typeof result.count).toBe('number')
    expect(Array.isArray(result.results)).toBe(true)
  })

  it('getAdminReservations filters by status', async () => {
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getAdminReservations({ status: 'confirmed' })
    for (const res of result.results) {
      expect(res.status).toBe('confirmed')
    }
  })

  it('confirmReservation returns confirmed reservation', async () => {
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.confirmReservation('res-001', TENANT_SAMOON)
    expect(result.status).toBe('confirmed')
  })

  it('getCustomers returns paginated ConsoleCustomers', async () => {
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getCustomers()
    expect(result.count).toBeGreaterThan(0)
    expect(result.results[0]).toHaveProperty('orders_count')
    expect(result.results[0]).toHaveProperty('reservations_count')
    expect(result.results[0]).not.toHaveProperty('tier')
  })

  it('getCustomers does not apply tier as a list filter', async () => {
    const { adminService } = await import('@/services/admin.service')
    const all = await adminService.getCustomers()
    const result = await adminService.getCustomers({ tier: 'vip' })
    expect(result.count).toBe(all.count)
  })

  it('getCustomers filters by search', async () => {
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getCustomers({ search: 'alice' })
    expect(result.results.length).toBeGreaterThanOrEqual(1)
    expect(result.results[0].first_name.toLowerCase()).toBe('alice')
  })

  it('getCustomerStats returns typed stats for known id', async () => {
    const { adminService } = await import('@/services/admin.service')
    const stats = await adminService.getCustomerStats('u1')
    expect(stats.customer_id).toBe('u1')
    expect(typeof stats.order_count).toBe('number')
    expect(typeof stats.total_spent).toBe('number')
  })

  it('getCustomerStats returns zero counts for unknown id', async () => {
    const { adminService } = await import('@/services/admin.service')
    const stats = await adminService.getCustomerStats('unknown')
    expect(stats.order_count).toBe(0)
    expect(stats.total_spent).toBe(0)
  })
})

// ── menuService CRUD ──────────────────────────────────────────────────────────

describe('menuService — CRUD (mock mode)', () => {
  beforeEach(() => { vi.resetModules() })

  it('createItem returns item with provided name', async () => {
    const { menuService } = await import('@/services/menu.service')
    const item = await menuService.createItem('main', { name: 'Test Burger', price: 12.99 })
    expect(item.name).toBe('Test Burger')
    expect(item.price).toBe(12.99)
    expect(item.id).toBeTruthy()
  })

  it('createItem defaults available to true', async () => {
    const { menuService } = await import('@/services/menu.service')
    const item = await menuService.createItem('main', { name: 'X' })
    expect(item.available).toBe(true)
  })

  it('updateItem merges payload onto existing item', async () => {
    const { menuService } = await import('@/services/menu.service')
    const item = await menuService.updateItem('main', '1', { name: 'Updated', price: 99 })
    expect(item.name).toBe('Updated')
    expect(item.price).toBe(99)
    expect(item.id).toBe('1')
  })

  it('deleteItem resolves without error', async () => {
    const { menuService } = await import('@/services/menu.service')
    await expect(menuService.deleteItem('main', '1')).resolves.toBeUndefined()
  })
})

describe('menu.service.ts — CRUD source structure', () => {
  const src = () => readSrc('services/menu.service.ts')

  it('has createItem method', () => {
    expect(src()).toContain('createItem(')
  })

  it('has updateItem method', () => {
    expect(src()).toContain('updateItem(')
  })

  it('has deleteItem method', () => {
    expect(src()).toContain('deleteItem(')
  })

  it('createItem uses ENDPOINTS.MENU.ITEMS for real mode', () => {
    expect(src()).toContain('ENDPOINTS.MENU.ITEMS')
  })

  it('updateItem uses ENDPOINTS.MENU.ITEM for real mode', () => {
    const block = src().slice(src().indexOf('updateItem('))
    expect(block).toContain('ENDPOINTS.MENU.ITEM(id)')
  })

  it('deleteItem uses api.delete', () => {
    expect(src()).toContain('api.delete')
  })
})

// ── hooks/index.ts — source structure ────────────────────────────────────────

describe('hooks/index.ts — P5.1 admin hooks source', () => {
  const src = () => readSrc('hooks/index.ts')

  it('imports adminService', () => {
    expect(src()).toContain("from '@/services/admin.service'")
  })

  it('exports useAdminStats', () => {
    expect(src()).toContain('export function useAdminStats')
  })

  it('exports useAdminOrders', () => {
    expect(src()).toContain('export function useAdminOrders')
  })

  it('exports useUpdateOrderStatus', () => {
    expect(src()).toContain('export function useUpdateOrderStatus')
  })

  it('exports useAdminReservations', () => {
    expect(src()).toContain('export function useAdminReservations')
  })

  it('exports useConfirmReservation', () => {
    expect(src()).toContain('export function useConfirmReservation')
  })

  it('exports useAdminCustomers', () => {
    expect(src()).toContain('export function useAdminCustomers')
  })

  it('exports useAdminCustomerStats', () => {
    expect(src()).toContain('export function useAdminCustomerStats')
  })

  it('exports useCreateMenuItem', () => {
    expect(src()).toContain('export function useCreateMenuItem')
  })

  it('exports useUpdateMenuItem', () => {
    expect(src()).toContain('export function useUpdateMenuItem')
  })

  it('exports useDeleteMenuItem', () => {
    expect(src()).toContain('export function useDeleteMenuItem')
  })

  it('useUpdateOrderStatus invalidates admin-orders', () => {
    expect(fnBody(src(), 'useUpdateOrderStatus')).toContain("invalidateQueries({ queryKey: ['admin-orders'] })")
  })

  it('useUpdateOrderStatus invalidates orders', () => {
    expect(fnBody(src(), 'useUpdateOrderStatus')).toContain("invalidateQueries({ queryKey: ['orders'] })")
  })

  it('useConfirmReservation invalidates admin-reservations', () => {
    const block = src().slice(src().indexOf('useConfirmReservation'))
    expect(block.slice(0, 1100)).toContain("'admin-reservations'")
  })

  it('useConfirmReservation invalidates reservations', () => {
    const block = src().slice(src().indexOf('useConfirmReservation'))
    expect(block.slice(0, 1200)).toContain("'reservations'")
  })

  // Branch-scoped invalidation (docs/BRANCH_MENU_IMPLEMENTATION.md): mutations
  // invalidate only the active branch's cached menu-items via a predicate,
  // not a blanket ['menu-items'] prefix that would touch every branch's cache.
  it('useCreateMenuItem invalidates menu-items scoped to the branch', () => {
    // Invalidation goes through invalidateBranchMenuItemsQueries(), whose
    // predicates include menuItemsQueryPredicate(branchId).
    expect(fnBody(src(), 'useCreateMenuItem')).toContain('invalidateBranchMenuItemsQueries(qc, branchId)')
    expect(src()).toMatch(/function branchMenuItemsQueryPredicates[\s\S]{0,200}menuItemsQueryPredicate\(branchId\)/)
  })

  it('useDeleteMenuItem invalidates menu-items scoped to the branch', () => {
    // Invalidation goes through invalidateBranchMenuItemsQueries(), whose
    // predicates include menuItemsQueryPredicate(branchId).
    expect(fnBody(src(), 'useDeleteMenuItem')).toContain('invalidateBranchMenuItemsQueries(qc, branchId)')
    expect(src()).toMatch(/function branchMenuItemsQueryPredicates[\s\S]{0,200}menuItemsQueryPredicate\(branchId\)/)
  })

  it('useUpdateMenuItem invalidates specific menu-item query', () => {
    const block = src().slice(src().indexOf('export function useUpdateMenuItem'))
    expect(block.slice(0, 1200)).toContain("'menu-item'")
  })
})

// ── hooks runtime ────────────────────────────────────────────────────────────

describe('admin hooks — query keys', () => {
  beforeEach(() => { vi.resetModules() })

  it('useAdminStats uses admin-stats query key', async () => {
    const src = readSrc('hooks/index.ts')
    const block = src.slice(src.indexOf('useAdminStats'))
    expect(block.slice(0, 200)).toContain("'admin-stats'")
  })

  it('useAdminOrders uses admin-orders query key', async () => {
    const src = readSrc('hooks/index.ts')
    const block = src.slice(src.indexOf('function useAdminOrders'))
    expect(block.slice(0, 500)).toContain("'admin-orders'")
  })

  it('useAdminReservations uses admin-reservations query key', async () => {
    const src = readSrc('hooks/index.ts')
    expect(fnBody(src, 'useAdminReservations')).toContain("queryKey: ['admin-reservations'")
  })

  it('useAdminCustomers uses admin-customers query key', async () => {
    const src = readSrc('hooks/index.ts')
    const block = src.slice(src.indexOf('function useAdminCustomers'))
    expect(block.slice(0, 600)).toContain("'admin-customers'")
  })

  it('useAdminCustomerStats uses admin-customer-stats key', async () => {
    const src = readSrc('hooks/index.ts')
    const block = src.slice(src.indexOf('function useAdminCustomerStats'))
    expect(block.slice(0, 200)).toContain("'admin-customer-stats'")
  })
})

// ── Regression: existing services unmodified ──────────────────────────────────

describe('Regression — existing service behaviour preserved', () => {
  beforeEach(() => { vi.resetModules() })

  it('orderService.getOrders still works', async () => {
    const { orderService } = await import('@/services/order.service')
    const result = await orderService.getOrders()
    expect(result.results.length).toBeGreaterThan(0)
  })

  it('orderService.cancelOrder still works', async () => {
    const { orderService } = await import('@/services/order.service')
    const result = await orderService.cancelOrder('ord-001')
    expect(result.status).toBe('cancelled')
  })

  it('reservationService.getReservations still works', async () => {
    const { reservationService } = await import('@/services/combined.service')
    const result = await reservationService.getReservations()
    expect(result.results.length).toBeGreaterThan(0)
  })

  it('menuService.getItems still works', async () => {
    const { menuService } = await import('@/services/menu.service')
    const result = await menuService.getItems('main')
    expect(result.results.length).toBeGreaterThan(0)
  })

  it('menuService.getCategories still works', async () => {
    const { menuService } = await import('@/services/menu.service')
    const cats = await menuService.getCategories('main')
    expect(cats.length).toBeGreaterThan(0)
  })

  it('menuService.search still works', async () => {
    const { menuService } = await import('@/services/menu.service')
    const results = await menuService.search('main', 'burger')
    expect(Array.isArray(results)).toBe(true)
  })
})

describe('Regression — existing hooks source preserved', () => {
  const src = () => readSrc('hooks/index.ts')

  it('useOrders still exported', () => { expect(src()).toContain('export function useOrders') })
  it('useOrder still exported', () => { expect(src()).toContain('export function useOrder') })
  it('useCreateOrder still exported', () => { expect(src()).toContain('export function useCreateOrder') })
  it('useReservations still exported', () => { expect(src()).toContain('export function useReservations') })
  it('useCreateReservation still exported', () => { expect(src()).toContain('export function useCreateReservation') })
  it('useMenuItems still exported', () => { expect(src()).toContain('export function useMenuItems') })
  it('useCategories still exported', () => { expect(src()).toContain('export function useCategories') })
  it('useBranches still exported', () => { expect(src()).toContain('export function useBranches') })
  it('useTableInfo still exported', () => { expect(src()).toContain('export function useTableInfo') })
  it('useAdminStats still exported', () => { expect(src()).toContain('export function useAdminStats') })
})

// ── Regression P1A / P1B / P3 / P4 source guards ─────────────────────────────

describe('Regression — P1A/P1B stores and services intact', () => {
  const storesSrc = () => readSrc('stores/index.ts')
  const providersSrc = () => readSrc('providers/index.tsx')

  it('useTenantStore still exported', () => {
    expect(storesSrc()).toContain('export const useTenantStore')
  })
  it('useDineInStore still exported', () => {
    expect(storesSrc()).toContain('export const useDineInStore')
  })
  it('DINE_IN_KEY still in constants', () => {
    expect(readSrc('constants/index.ts')).toContain('DINE_IN_KEY')
  })
  it('TenantBootstrapper still present', () => {
    expect(providersSrc()).toContain('TenantBootstrapper')
  })
  it('readTenantSlug still present (P1B.3)', () => {
    expect(providersSrc()).toContain('readTenantSlug')
  })
  it('middleware still has resolveTenantSlug (P1B.3)', () => {
    expect(readSrc('middleware.ts')).toContain('resolveTenantSlug')
  })
})

describe('Regression — P3/P4 features intact', () => {
  it('ErrorBoundary feature prop still present (P3.12)', () => {
    expect(readSrc('components/common/ErrorBoundary.tsx')).toContain('feature')
  })
  it('table page still has useDineInStore (P4.4)', () => {
    expect(readSrc('app/table/[tableId]/page.tsx')).toContain('useDineInStore')
  })
  it('checkout page still has persistedTableNumber (P4.4)', () => {
    expect(readSrc('app/checkout/page.tsx')).toContain('persistedTableNumber')
  })
})

// ── Console orders endpoint routing ───────────────────────────────────────────

vi.mock('@/services/axios.instance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

async function freshAdminServiceRealMode() {
  vi.resetModules()
  process.env.NEXT_PUBLIC_USE_MOCK = 'false'
  const mod = await import('@/services/admin.service')
  const axiosMod = await import('@/services/axios.instance')
  return {
    adminService: mod.adminService,
    api: axiosMod.default as unknown as { get: ReturnType<typeof vi.fn> },
  }
}

describe('adminService.getAdminOrders — console endpoint routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('endpoints.ts exposes tenant-wide console orders list URL', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.ORDERS.CONSOLE_ORDER_TENANT_BRANCHES_LIST('tenant-1'))
      .toBe('/orders/console-orders/tenants/tenant-1/branches/')
  })

  it('scoped mode calls branch-specific console orders endpoint', async () => {
    const { adminService, api } = await freshAdminServiceRealMode()
    api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } })

    await adminService.getAdminOrders({
      scope: 'scoped',
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      filters: { page: 1, page_size: 20 },
    })

    expect(api.get).toHaveBeenCalledWith(
      '/orders/console-orders/tenants/tenant-1/branches/branch-1/',
      { params: { page: 1, page_size: 20 } },
    )
  })

  it('global mode calls tenant-wide console orders endpoint with tenantId', async () => {
    const { adminService, api } = await freshAdminServiceRealMode()
    api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } })

    await adminService.getAdminOrders({
      scope: 'global',
      tenantId: 'tenant-1',
      filters: { page: 1, page_size: 20 },
    })

    expect(api.get).toHaveBeenCalledWith(
      '/orders/console-orders/tenants/tenant-1/branches/',
      { params: { page: 1, page_size: 20 } },
    )
  })

  it('global mode forwards branch_id filter as query param', async () => {
    const { adminService, api } = await freshAdminServiceRealMode()
    api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } })

    await adminService.getAdminOrders({
      scope: 'global',
      tenantId: 'tenant-1',
      filters: { page: 1, page_size: 20, branch_id: 'branch-2' },
    })

    expect(api.get).toHaveBeenCalledWith(
      '/orders/console-orders/tenants/tenant-1/branches/',
      { params: { page: 1, page_size: 20, branch_id: 'branch-2' } },
    )
  })

  it('legacy plain filters still fall back to /orders/?admin=true', async () => {
    const { adminService, api } = await freshAdminServiceRealMode()
    api.get.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } })

    await adminService.getAdminOrders({ status: 'pending' })

    expect(api.get).toHaveBeenCalledWith('/orders/', { params: { status: 'pending', admin: true } })
  })
})

describe('useAdminOrders — global scope passes tenantId', () => {
  it('passes tenantId to adminService in global mode', () => {
    const src = readSrc('hooks/index.ts')
    const block = src.slice(src.indexOf('function useAdminOrders'), src.indexOf('export function useUpdateOrderStatus'))
    expect(block).toContain("{ scope, tenantId, filters }")
    expect(block).not.toContain("adminService.getAdminOrders({ scope, filters })")
  })

  it('omits branchId from global query key', () => {
    const src = readSrc('hooks/index.ts')
    const block = src.slice(src.indexOf('function useAdminOrders'), src.indexOf('export function useUpdateOrderStatus'))
    expect(block).toContain("['admin-orders', scope, tenantId, filters]")
  })
})
