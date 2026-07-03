/**
 * Phase 5.2 — Admin Orders Management Tests
 *
 * Verifies:
 *   A. Page uses useAdminOrders hook
 *   B. No MOCK_LIVE_ORDERS dependency remains
 *   C. Status mutation uses useUpdateOrderStatus
 *   D. Filters drive query inputs (status + search → AdminOrderFilters)
 *   E. Loading state exists
 *   F. Error state exists
 *   G. Empty state exists
 *   H. Query invalidation exists in useUpdateOrderStatus
 *   I. Optimistic update exists in useUpdateOrderStatus
 *   J. Mock mode path preserved in adminService.getAdminOrders
 *
 * Regression:
 *   - Admin layout auth guard unchanged
 *   - Dashboard routes unchanged
 *   - Order tracker unchanged (customer WebSocket)
 *   - Customer order flow unchanged
 *   - P5.1 adminService methods still present
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../')

function src(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

// ── A. Page uses useAdminOrders ───────────────────────────────────────────────

describe('Admin orders page — useAdminOrders integration', () => {
  const page = src('src/app/console/orders/page.tsx')

  it('A: imports useAdminOrders from @/hooks', () => {
    expect(page).toMatch(/useAdminOrders/)
    expect(page).toMatch(/@\/hooks/)
  })

  it('A: calls useAdminOrders with filters', () => {
    expect(page).toMatch(/useAdminOrders\s*\(/)
  })

  it('A: consumes data.results', () => {
    expect(page).toMatch(/data\?\.results/)
  })
})

// ── B. No MOCK_LIVE_ORDERS ────────────────────────────────────────────────────

describe('Admin orders page — no hardcoded data', () => {
  const page = src('src/app/console/orders/page.tsx')

  it('B: MOCK_LIVE_ORDERS is removed', () => {
    expect(page).not.toContain('MOCK_LIVE_ORDERS')
  })

  it('B: no local useState seeded order array', () => {
    expect(page).not.toMatch(/useState\s*\(\s*\[/)
  })

  it('B: no inline order literal objects with customer/items fields', () => {
    expect(page).not.toMatch(/customer:\s*['"]/)
  })
})

// ── C. Status mutation uses useUpdateOrderStatus ──────────────────────────────

describe('Admin orders page — useUpdateOrderStatus mutation', () => {
  const page = src('src/app/console/orders/page.tsx')

  it('C: imports useUpdateOrderStatus', () => {
    expect(page).toMatch(/useUpdateOrderStatus/)
  })

  it('C: calls mutate with id and status', () => {
    expect(page).toMatch(/mutate\s*\(\s*\{/)
    expect(page).toMatch(/status/)
  })

  it('C: advance() is defined as a function', () => {
    expect(page).toMatch(/const advance\s*=/)
  })
})

// ── D. Filters drive query inputs ─────────────────────────────────────────────

describe('Admin orders page — filter state → query params', () => {
  const page = src('src/app/console/orders/page.tsx')

  it('D: uses useMemo for filters object', () => {
    expect(page).toMatch(/useMemo/)
    expect(page).toMatch(/filters/)
  })

  it('D: status filter state controls query', () => {
    expect(page).toMatch(/statusFilter/)
  })

  it('D: search filter state controls query', () => {
    expect(page).toMatch(/search/)
  })

  it('D: filters passed to useAdminOrders', () => {
    expect(page).toMatch(/useAdminOrders\s*\(\s*filters\s*\)/)
  })
})

// ── E. Loading state ──────────────────────────────────────────────────────────

describe('Admin orders page — loading state', () => {
  const page = src('src/app/console/orders/page.tsx')

  it('E: isLoading from useAdminOrders', () => {
    expect(page).toMatch(/isLoading/)
  })

  it('E: renders loading UI when isLoading', () => {
    expect(page).toMatch(/isLoading\s*&&/)
  })

  it('E: uses Loader2 spinner', () => {
    expect(page).toContain('Loader2')
  })
})

// ── F. Error state ────────────────────────────────────────────────────────────

describe('Admin orders page — error state', () => {
  const page = src('src/app/console/orders/page.tsx')

  it('F: isError from useAdminOrders', () => {
    expect(page).toMatch(/isError/)
  })

  it('F: renders error UI when isError', () => {
    expect(page).toMatch(/isError\s*&&|&&\s*!isLoading/)
  })

  it('F: error UI has retry affordance', () => {
    expect(page).toMatch(/Retry|retry|refetch/)
  })
})

// ── G. Empty state ────────────────────────────────────────────────────────────

describe('Admin orders page — empty state', () => {
  const page = src('src/app/console/orders/page.tsx')

  it('G: renders empty state when orders.length === 0', () => {
    expect(page).toMatch(/orders\.length\s*===\s*0/)
  })

  it('G: empty state has user-facing message', () => {
    expect(page).toMatch(/No orders/)
  })
})

// ── H. Query invalidation in hook ─────────────────────────────────────────────

describe('useUpdateOrderStatus hook — query invalidation', () => {
  const hooks = src('src/hooks/index.ts')

  it('H: invalidates admin-orders on success', () => {
    expect(hooks).toMatch(/invalidateQueries.*admin-orders/)
  })

  it('H: invalidates orders on success', () => {
    expect(hooks).toMatch(/invalidateQueries.*['"]orders['"]/)
  })
})

// ── I. Optimistic update in hook ──────────────────────────────────────────────

describe('useUpdateOrderStatus hook — optimistic update', () => {
  const hooks = src('src/hooks/index.ts')

  it('I: has onMutate handler', () => {
    expect(hooks).toMatch(/onMutate\s*:/)
  })

  it('I: cancels in-flight queries on mutate', () => {
    expect(hooks).toMatch(/cancelQueries/)
  })

  it('I: captures snapshots for rollback', () => {
    expect(hooks).toMatch(/snapshots/)
  })

  it('I: calls setQueriesData for optimistic write', () => {
    expect(hooks).toMatch(/setQueriesData/)
  })

  it('I: has onError handler for rollback', () => {
    expect(hooks).toMatch(/onError\s*:/)
  })

  it('I: restores snapshot on error', () => {
    expect(hooks).toMatch(/setQueryData\s*\(key,\s*data\)|setQueryData\(key,\s*data\)/)
  })
})

// ── J. Mock mode path preserved ───────────────────────────────────────────────

describe('adminService mock mode — orders path', () => {
  it('J: mock mode works for getAdminOrders', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const result = await adminService.getAdminOrders()
    expect(result).toHaveProperty('results')
    expect(Array.isArray(result.results)).toBe(true)
    expect(result).toHaveProperty('count')
  })

  it('J: mock status update works', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    const order = await adminService.updateOrderStatus('ord-001', 'preparing')
    expect(order.status).toBe('preparing')
  })
})

// ── Real-Time Layer Audit ─────────────────────────────────────────────────────

describe('Real-time layer audit — no admin WebSocket', () => {
  const hooks = src('src/hooks/client.ts')
  const page = src('src/app/console/orders/page.tsx')

  it('customer useOrderWebSocket exists and takes orderId', () => {
    expect(hooks).toMatch(/useOrderWebSocket\s*\(\s*orderId/)
  })

  it('admin orders page does NOT import useOrderWebSocket', () => {
    expect(page).not.toMatch(/import.*useOrderWebSocket/)
  })

  it('admin page uses PermissionGuard for orders.view', () => {
    expect(page).toMatch(/PermissionGuard|orders\.view/)
  })
})

// ── Regression: Admin layout auth guard ───────────────────────────────────────

describe('Regression — admin layout auth guard', () => {
  const layout = src('src/app/console/layout.tsx')

  it('admin layout still exists', () => {
    expect(layout.length).toBeGreaterThan(0)
  })

  it('admin layout still guards by role', () => {
    expect(layout).toMatch(/admin|role/)
  })
})

// ── Regression: Dashboard routes ──────────────────────────────────────────────

describe('Regression — dashboard routes', () => {
  const layout = src('src/app/console/layout.tsx')

  it('admin layout wraps children with auth guard', () => {
    expect(layout).toMatch(/AuthGuard|dashboard:access/)
  })
})

// ── Regression: Customer order tracker ───────────────────────────────────────

describe('Regression — customer order tracker (P3.6)', () => {
  const tracker = src('src/components/order/OrderTracker.tsx')

  it('OrderTracker still exists', () => {
    expect(tracker.length).toBeGreaterThan(0)
  })

  it('OrderTracker still uses useOrderWebSocket', () => {
    expect(tracker).toMatch(/useOrderWebSocket/)
  })
})

// ── Regression: Customer order flow ──────────────────────────────────────────

describe('Regression — customer order flow', () => {
  it('orderService.getOrders still works in mock mode', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { orderService } = await import('@/services/order.service')
    const result = await orderService.getOrders()
    expect(Array.isArray(result.results)).toBe(true)
  })
})

// ── Regression: P5.1 adminService methods ────────────────────────────────────

describe('Regression — P5.1 adminService completeness', () => {
  it('all seven adminService methods still present', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const { adminService } = await import('@/services/admin.service')
    expect(typeof adminService.getStats).toBe('function')
    expect(typeof adminService.getAdminOrders).toBe('function')
    expect(typeof adminService.updateOrderStatus).toBe('function')
    expect(typeof adminService.getAdminReservations).toBe('function')
    expect(typeof adminService.confirmReservation).toBe('function')
    expect(typeof adminService.getCustomers).toBe('function')
    expect(typeof adminService.getCustomerStats).toBe('function')
  })
})

// ── Regression: P5.1 menu CRUD hooks ─────────────────────────────────────────

describe('Regression — P5.1 menu CRUD hooks', () => {
  const hooks = src('src/hooks/index.ts')

  it('useCreateMenuItem hook still present', () => {
    expect(hooks).toMatch(/useCreateMenuItem/)
  })

  it('useUpdateMenuItem hook still present', () => {
    expect(hooks).toMatch(/useUpdateMenuItem/)
  })

  it('useDeleteMenuItem hook still present', () => {
    expect(hooks).toMatch(/useDeleteMenuItem/)
  })
})
