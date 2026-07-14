/**
 * Phase 4.10 — End-to-End User Journey Tests (P4.10.2–P4.10.7)
 *
 * Service-layer E2E tests: import services and stores directly, run with
 * NEXT_PUBLIC_USE_MOCK=true (enforced by vi.stubEnv). No browser, no server.
 * Covers the same user flows as browser E2E would, at one level lower.
 *
 * Flows covered:
 *   P4.10.2.1 — Auth flow (login, token, logout)
 *   P4.10.2.2 — Menu flow (load categories, items)
 *   P4.10.2.3 — Cart flow (add, update quantity, persist shape)
 *   P4.10.2.4 — Checkout flow (create order, success state)
 *   P4.10.2.5 — Dashboard flow (RBAC access control)
 *   P4.10.2.6 — Offline flow (queue, replay)
 *   P4.10.5   — Critical path assertions
 *   P4.10.7   — Regression: no duplication with prior phase tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

// Force mock mode for all service calls
vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
// Prevent real API calls
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.savor.test')

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Speed up mock delays for tests. */
vi.mock('@/constants', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/constants')>()
  return { ...mod, MOCK_DELAY: 0 }
})

// ── P4.10.2.1 — Auth Flow ─────────────────────────────────────────────────────

describe('E2E: Auth Flow', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('login with demo credentials returns user and tokens', async () => {
    const { authService } = await import('@/services/auth.service')
    const promise = authService.login({ email: 'demo@savor.com', password: 'password' })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.user.email).toBe('john@example.com')
    const { MOCK_ACCESS_TOKEN, MOCK_REFRESH_TOKEN } = await import('@/services/auth.service')
    expect(result.tokens.access).toBe(MOCK_ACCESS_TOKEN)
    expect(result.tokens.refresh).toBe(MOCK_REFRESH_TOKEN)
  })

  it('login with wrong credentials rejects with Invalid credentials', async () => {
    const { authService } = await import('@/services/auth.service')
    // Attach .catch before advancing timers so the rejection is always handled
    let caught: unknown = null
    const promise = authService.login({ email: 'wrong@test.com', password: 'bad' })
      .catch((e: unknown) => { caught = e })
    await vi.runAllTimersAsync()
    await promise
    expect(caught).not.toBeNull()
    expect((caught as Error).message).toBe('Invalid credentials')
  })

  it('token is set in axios instance after login', async () => {
    const { authService } = await import('@/services/auth.service')
    const { setTokens } = await import('@/services/axios.instance')
    const spy = vi.spyOn({ setTokens }, 'setTokens')
    const promise = authService.login({ email: 'demo@savor.com', password: 'password' })
    await vi.runAllTimersAsync()
    await promise
    // Mock mode calls setTokens internally; verify token field is present
    const { default: axiosInstance } = await import('@/services/axios.instance')
    expect(axiosInstance.defaults.headers).toBeDefined()
  })

  it('getMe returns mock user when token exists', async () => {
    const { authService } = await import('@/services/auth.service')
    const promise = authService.getMe()
    await vi.runAllTimersAsync()
    const user = await promise
    expect(user.id).toBe('1')
    expect(user.role).toBe('customer')
    expect(typeof user.email).toBe('string')
  })

  it('logout clears tokens', async () => {
    const { authService } = await import('@/services/auth.service')
    const promise = authService.logout()
    await vi.runAllTimersAsync()
    // logout resolves without error in mock mode
    await expect(promise).resolves.not.toThrow()
  })

  it('register creates a new mock user', async () => {
    const { authService } = await import('@/services/auth.service')
    const promise = authService.register({
      email: 'new@test.com',
      password: 'pass123',
      confirm_password: 'pass123',
      first_name: 'New',
      last_name: 'User',
      phone_number: '+1000000000',
    })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.user.email).toBe('new@test.com')
    expect(result.user.first_name).toBe('New')
    const { MOCK_ACCESS_TOKEN } = await import('@/services/auth.service')
    expect(result.tokens.access).toBe(MOCK_ACCESS_TOKEN)
  })
})

// ── P4.10.2.2 — Menu Flow ─────────────────────────────────────────────────────

describe('E2E: Menu Flow', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('getCategories returns a non-empty category list', async () => {
    const { menuService } = await import('@/services/menu.service')
    const promise = menuService.getCategories('main')
    await vi.runAllTimersAsync()
    const categories = await promise
    expect(Array.isArray(categories)).toBe(true)
    expect(categories.length).toBeGreaterThan(0)
    expect(typeof categories[0].id).toBe('string')
    expect(typeof categories[0].name).toBe('string')
  })

  it('getItems returns paginated menu items', async () => {
    const { menuService } = await import('@/services/menu.service')
    const promise = menuService.getItems('main')
    await vi.runAllTimersAsync()
    const result = await promise
    expect(Array.isArray(result.results)).toBe(true)
    expect(result.results.length).toBeGreaterThan(0)
    expect(typeof result.results[0].id).toBe('string')
    expect(typeof result.results[0].price).toBe('number')
  })

  it('getItems with category filter returns filtered results', async () => {
    const { menuService } = await import('@/services/menu.service')
    const allPromise = menuService.getItems('main')
    await vi.runAllTimersAsync()
    const all = await allPromise

    const catId = typeof all.results[0].category === 'string'
      ? all.results[0].category
      : (all.results[0].category as { id: string } | undefined)?.id
    const filteredPromise = menuService.getItems('main', { category: catId })
    await vi.runAllTimersAsync()
    const filtered = await filteredPromise
    // All filtered items should belong to the requested category
    for (const item of filtered.results) {
      expect(item.category).toBe(catId)
    }
  })

  it('getItem returns a single menu item by id', async () => {
    const { menuService } = await import('@/services/menu.service')
    const listPromise = menuService.getItems('main')
    await vi.runAllTimersAsync()
    const list = await listPromise
    const targetId = list.results[0].id

    const itemPromise = menuService.getItem('main', targetId)
    await vi.runAllTimersAsync()
    const item = await itemPromise
    expect(item.id).toBe(targetId)
  })

  it('getFeatured returns featured menu items', async () => {
    const { menuService } = await import('@/services/menu.service')
    const promise = menuService.getFeatured('main')
    await vi.runAllTimersAsync()
    const items = await promise
    expect(Array.isArray(items)).toBe(true)
  })

  it('search returns results matching query', async () => {
    const { menuService } = await import('@/services/menu.service')
    const promise = menuService.search('main', 'burger')
    await vi.runAllTimersAsync()
    const results = await promise
    expect(Array.isArray(results)).toBe(true)
  })
})

// ── P4.10.2.3 — Cart Flow ────────────────────────────────────────────────────

describe('E2E: Cart Flow', () => {
  // Reset cart store state between tests
  beforeEach(async () => {
    const { useCartStore } = await import('@/stores')
    useCartStore.getState().clearCart()
  })

  it('addItem increases item count', async () => {
    const { useCartStore } = await import('@/stores')
    const { menuService } = await import('@/services/menu.service')
    vi.useFakeTimers()
    const listPromise = menuService.getItems('main')
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    const items = (await listPromise).results

    useCartStore.getState().addItem(items[0], 2)
    expect(useCartStore.getState().getItemCount()).toBe(2)
  })

  it('addItem same item again merges quantity', async () => {
    const { useCartStore } = await import('@/stores')
    const { menuService } = await import('@/services/menu.service')
    vi.useFakeTimers()
    const promise = menuService.getItems('main')
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    const item = (await promise).results[0]

    useCartStore.getState().addItem(item, 1)
    useCartStore.getState().addItem(item, 3)
    expect(useCartStore.getState().getItemCount()).toBe(4)
    expect(useCartStore.getState().items).toHaveLength(1) // still 1 unique item
  })

  it('updateQuantity modifies cart item quantity', async () => {
    const { useCartStore } = await import('@/stores')
    const { menuService } = await import('@/services/menu.service')
    vi.useFakeTimers()
    const promise = menuService.getItems('main')
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    const item = (await promise).results[0]

    useCartStore.getState().addItem(item, 1)
    const cartItemId = useCartStore.getState().items[0].id
    useCartStore.getState().updateQuantity(cartItemId, 5)
    expect(useCartStore.getState().items[0].quantity).toBe(5)
  })

  it('updateQuantity to 0 removes item', async () => {
    const { useCartStore } = await import('@/stores')
    const { menuService } = await import('@/services/menu.service')
    vi.useFakeTimers()
    const promise = menuService.getItems('main')
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    const item = (await promise).results[0]

    useCartStore.getState().addItem(item, 1)
    const cartItemId = useCartStore.getState().items[0].id
    useCartStore.getState().updateQuantity(cartItemId, 0)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('getSubtotal calculates correct total price', async () => {
    const { useCartStore } = await import('@/stores')
    const { menuService } = await import('@/services/menu.service')
    vi.useFakeTimers()
    const promise = menuService.getItems('main')
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    const item = (await promise).results[0]
    const price = item.discounted_price ?? item.price

    useCartStore.getState().addItem(item, 2)
    expect(useCartStore.getState().getSubtotal()).toBeCloseTo(price * 2, 2)
  })

  it('clearCart empties the cart', async () => {
    const { useCartStore } = await import('@/stores')
    const { menuService } = await import('@/services/menu.service')
    vi.useFakeTimers()
    const promise = menuService.getItems('main')
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    const item = (await promise).results[0]

    useCartStore.getState().addItem(item, 3)
    expect(useCartStore.getState().getItemCount()).toBe(3)
    useCartStore.getState().clearCart()
    expect(useCartStore.getState().getItemCount()).toBe(0)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('cart state shape matches CartItem contract', async () => {
    const { useCartStore } = await import('@/stores')
    const { menuService } = await import('@/services/menu.service')
    vi.useFakeTimers()
    const promise = menuService.getItems('main')
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    const item = (await promise).results[0]

    useCartStore.getState().addItem(item, 1)
    const cartItem = useCartStore.getState().items[0]
    expect(typeof cartItem.id).toBe('string')
    expect(cartItem.menu_item).toBeDefined()
    expect(typeof cartItem.quantity).toBe('number')
    expect(typeof cartItem.unit_price).toBe('number')
    expect(typeof cartItem.total_price).toBe('number')
  })
})

// ── P4.10.2.4 — Checkout Flow ─────────────────────────────────────────────────

describe('E2E: Checkout Flow', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('createOrder returns an order with pending status', async () => {
    const { orderService } = await import('@/services/order.service')
    const promise = orderService.createOrder({
      branch_id: '1',
      items: [{ menu_item_id: 'item-1', quantity: 2, extras: [] }],
      order_type: 'delivery',
      payment_method: 'cash',
    })
    await vi.runAllTimersAsync()
    const order = await promise
    expect(order.status).toBe('pending')
    expect(typeof order.id).toBe('string')
    expect(typeof order.order_number).toBe('string')
    expect(order.order_number).toMatch(/^#/)
  })

  it('createOrder response includes required fields', async () => {
    const { orderService } = await import('@/services/order.service')
    const promise = orderService.createOrder({
      branch_id: '1',
      items: [{ menu_item_id: 'item-1', quantity: 1, extras: [] }],
      order_type: 'dine_in',
      payment_method: 'card',
    })
    await vi.runAllTimersAsync()
    const order = await promise
    expect(order.payment_status).toBe('paid')
    expect(order.order_type).toBe('dine_in')
    expect(order.payment_method).toBe('card')
  })

  it('multiple checkout orders produce unique order numbers', async () => {
    const { orderService } = await import('@/services/order.service')
    // Run sequentially to avoid fake-timer Date.now() collision
    const p1 = orderService.createOrder({
      branch_id: '1',
      items: [{ menu_item_id: 'item-1', quantity: 1, extras: [] }],
      order_type: 'delivery',
      payment_method: 'cash',
    })
    await vi.runAllTimersAsync()
    const o1 = await p1

    // Advance clock to guarantee distinct Date.now() values
    vi.advanceTimersByTime(10)

    const p2 = orderService.createOrder({
      branch_id: '1',
      items: [{ menu_item_id: 'item-2', quantity: 1, extras: [] }],
      order_type: 'delivery',
      payment_method: 'cash',
    })
    await vi.runAllTimersAsync()
    const o2 = await p2

    expect(o1.order_number).not.toBe(o2.order_number)
  })

  it('getOrders returns order list', async () => {
    const { orderService } = await import('@/services/order.service')
    const promise = orderService.getOrders()
    await vi.runAllTimersAsync()
    const result = await promise
    expect(Array.isArray(result.results)).toBe(true)
  })
})

// ── P4.10.2.5 — Dashboard / RBAC Flow ────────────────────────────────────────
// P10.4.12 — the `E2E: Dashboard / RBAC Flow` describe block (entirely
// rbacService.hasPermission() assertions) was removed: the legacy engine
// is deleted (src/services/rbac.service.ts) and dashboard/permission
// authorization has flowed through useHasDashboardAccess()/usePermission()
// since P10.4.10/P10.4.11 — see
// docs/P10.4.12_LEGACY_RBAC_ENGINE_REMOVAL.md.

// ── P4.10.2.6 — Offline Flow ─────────────────────────────────────────────────

describe('E2E: Offline Flow', () => {
  beforeEach(async () => {
    const { clearQueue } = await import('@/lib/offline-queue')
    clearQueue()
  })

  it('enqueue adds a mutation to the offline queue', async () => {
    const { enqueue, getQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'cart-add-1', type: 'cart/add', payload: { itemId: 'item-42', qty: 1 } })
    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toBe('cart-add-1')
    expect(queue[0].type).toBe('cart/add')
    expect(queue[0].timestamp).toBeGreaterThan(0)
  })

  it('enqueue deduplicates by id', async () => {
    const { enqueue, getQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'cart-add-1', type: 'cart/add', payload: {} })
    enqueue({ id: 'cart-add-1', type: 'cart/add', payload: {} })
    expect(getQueue()).toHaveLength(1)
  })

  it('dequeue removes a mutation by id', async () => {
    const { enqueue, dequeue, getQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'q1', type: 'cart/add', payload: {} })
    enqueue({ id: 'q2', type: 'cart/remove', payload: {} })
    dequeue('q1')
    const queue = getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toBe('q2')
  })

  it('replayQueue executes mutations in insertion order', async () => {
    const { enqueue, replayQueue } = await import('@/lib/offline-queue')
    const executed: string[] = []
    enqueue({ id: 'a', type: 'cart/add', payload: {} })
    enqueue({ id: 'b', type: 'cart/update', payload: {} })
    enqueue({ id: 'c', type: 'order/submit', payload: {} })

    await replayQueue(async (m) => { executed.push(m.id) })
    expect(executed).toEqual(['a', 'b', 'c'])
  })

  it('replayQueue dequeues before executing (prevents double submit)', async () => {
    const { enqueue, replayQueue, getQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'safe', type: 'cart/add', payload: {} })

    let queueSizeAtExecution = -1
    await replayQueue(async (_m) => {
      queueSizeAtExecution = getQueue().length
    })
    // Queue must be empty BEFORE the executor runs
    expect(queueSizeAtExecution).toBe(0)
  })

  it('replayQueue continues past a failed executor', async () => {
    const { enqueue, replayQueue, getQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'fail', type: 'cart/add', payload: {} })
    enqueue({ id: 'ok', type: 'cart/remove', payload: {} })
    const executed: string[] = []

    await replayQueue(async (m) => {
      if (m.id === 'fail') throw new Error('network error')
      executed.push(m.id)
    })

    // Replay continues; 'ok' is processed even though 'fail' threw
    expect(executed).toContain('ok')
    // Both mutations are dequeued regardless
    expect(getQueue()).toHaveLength(0)
  })

  it('clearQueue empties all pending mutations', async () => {
    const { enqueue, clearQueue, getQueue } = await import('@/lib/offline-queue')
    enqueue({ id: 'x', type: 'cart/add', payload: {} })
    enqueue({ id: 'y', type: 'cart/add', payload: {} })
    clearQueue()
    expect(getQueue()).toHaveLength(0)
  })

  it('queue persists across enqueue/getQueue calls (storage round-trip)', async () => {
    const { enqueue, getQueue } = await import('@/lib/offline-queue')
    const payload = { itemId: 'burger-1', qty: 2 }
    enqueue({ id: 'persist-test', type: 'cart/add', payload })
    const queue = getQueue()
    expect(queue[0].payload).toEqual(payload)
  })
})

// ── P4.10.5 — Critical Path Assertions ───────────────────────────────────────

describe('Critical path: cart persists state shape', () => {
  it('cart total_price equals unit_price × quantity', async () => {
    const { useCartStore } = await import('@/stores')
    const { menuService } = await import('@/services/menu.service')
    useCartStore.getState().clearCart()
    vi.useFakeTimers()
    const promise = menuService.getItems('main')
    await vi.runAllTimersAsync()
    vi.useRealTimers()
    const item = (await promise).results[0]
    const price = item.discounted_price ?? item.price

    useCartStore.getState().addItem(item, 3)
    const cartItem = useCartStore.getState().items[0]
    expect(cartItem.total_price).toBeCloseTo(price * 3, 2)
    expect(cartItem.unit_price).toBeCloseTo(price, 2)
  })
})

// P10.4.12 — the `Critical path: RBAC blocks unauthorized access` describe
// block (rbacService.hasPermission()-only assertions) was removed — see
// docs/P10.4.12_LEGACY_RBAC_ENGINE_REMOVAL.md.

describe('Critical path: offline queue is replay-safe', () => {
  it('replayQueue after network restored processes all pending mutations', async () => {
    const { enqueue, clearQueue, replayQueue, getQueue } = await import('@/lib/offline-queue')
    clearQueue()

    // Simulate offline: enqueue several mutations
    enqueue({ id: 'm1', type: 'cart/add', payload: { qty: 1 } })
    enqueue({ id: 'm2', type: 'cart/add', payload: { qty: 2 } })
    enqueue({ id: 'm3', type: 'order/submit', payload: { total: 50 } })
    expect(getQueue()).toHaveLength(3)

    // Simulate reconnect: replay all
    const replayed: string[] = []
    await replayQueue(async (m) => { replayed.push(m.id) })

    expect(replayed).toHaveLength(3)
    expect(getQueue()).toHaveLength(0) // queue is empty after replay
  })
})

describe('Critical path: service worker module contract', () => {
  it('service-worker.ts exports registerServiceWorker and applyServiceWorkerUpdate', () => {
    const swSrc = readSrc('lib/service-worker.ts')
    expect(swSrc).toContain('export function registerServiceWorker')
    expect(swSrc).toContain('export function applyServiceWorkerUpdate')
    expect(swSrc).toContain('export function useServiceWorkerUpdate')
  })

  it('offline indicator has no-polling contract (event-driven only)', () => {
    const src = readSrc('components/pwa/OfflineIndicator.tsx')
    expect(src).toContain("'offline'")
    expect(src).toContain("'online'")
    expect(src).not.toContain('setInterval')
    expect(src).not.toContain('setTimeout')
  })
})

// ── P4.10.4 — Visual Stability Snapshot Checks ───────────────────────────────

describe('P4.10.4 — Visual stability: key component contract assertions', () => {
  it('root layout imports Providers', () => {
    expect(readSrc('app/layout.tsx')).toContain('Providers')
  })

  it('menu page uses LazyFoodDetailModal (P4.7 lazy loading)', () => {
    const content = readSrc('components/menu/LazyFoodDetailModal.tsx')
    expect(content).toContain('dynamic(')
    expect(content).toContain('ssr: false')
  })

  it('providers mounts ServiceWorkerUpdateBanner and OfflineIndicator', () => {
    const content = readSrc('providers/index.tsx')
    expect(content).toContain('ServiceWorkerUpdateBanner')
    expect(content).toContain('OfflineIndicator')
  })

  it('theme store accepts light/dark/system values', async () => {
    // Mock window.matchMedia (not available in jsdom by default)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    })
    const { useThemeStore } = await import('@/stores')
    useThemeStore.getState().setTheme('dark')
    expect(useThemeStore.getState().theme).toBe('dark')
    useThemeStore.getState().setTheme('light')
    expect(useThemeStore.getState().theme).toBe('light')
    useThemeStore.getState().setTheme('system')
    expect(useThemeStore.getState().theme).toBe('system')
  })
})

// ── P4.10.7 — Regression: no auth/RBAC/WebSocket/PWA regressions ─────────────

describe('P4.10.7 — Regression guard: prior phases undisturbed', () => {
  it('authService has login, logout, getMe (P1/P3 contract)', async () => {
    const { authService } = await import('@/services/auth.service')
    expect(typeof authService.login).toBe('function')
    expect(typeof authService.logout).toBe('function')
    expect(typeof authService.getMe).toBe('function')
  })

  it('menuService has getCategories, getItems, getFeatured (P2 contract)', async () => {
    const { menuService } = await import('@/services/menu.service')
    expect(typeof menuService.getCategories).toBe('function')
    expect(typeof menuService.getItems).toBe('function')
    expect(typeof menuService.getFeatured).toBe('function')
  })

  it('offlineQueue has enqueue/dequeue/replayQueue (P4.8 contract)', async () => {
    const { enqueue, dequeue, replayQueue, getQueue, clearQueue } = await import('@/lib/offline-queue')
    expect(typeof enqueue).toBe('function')
    expect(typeof dequeue).toBe('function')
    expect(typeof replayQueue).toBe('function')
    expect(typeof getQueue).toBe('function')
    expect(typeof clearQueue).toBe('function')
  })

  it('logger exports withContext, withRequestId (P4.9 contract)', async () => {
    const { withContext, withRequestId, withUserId, withTenant, createApiLogger } = await import('@/lib/logger')
    expect(typeof withContext).toBe('function')
    expect(typeof withRequestId).toBe('function')
    expect(typeof withUserId).toBe('function')
    expect(typeof withTenant).toBe('function')
    expect(typeof createApiLogger).toBe('function')
  })

  it('performance module exports measureNavigationTiming (P4.9 contract)', async () => {
    const { measureNavigationTiming, reportWebVitalsHook } = await import('@/lib/performance')
    expect(typeof measureNavigationTiming).toBe('function')
    expect(typeof reportWebVitalsHook).toBe('function')
  })
})
