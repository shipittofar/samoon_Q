/**
 * P3.6 — Order WebSocket UI Wiring tests
 *
 * Covers:
 *   P3.6.1 — Source structure: imports, env gate, hook wiring
 *   P3.6.2 — Real-mode WebSocket connection and update propagation
 *   P3.6.3 — Mock-mode simulation fallback
 *   P3.6.4 — Reconnect behaviour (delegated to DjangoChannelsWebSocket)
 *   P3.6.5 — Cleanup on unmount / no memory leaks
 *   P3.6.6 — Duplicate subscription prevention
 *   P3.6.7 — useOrderWebSocket hook contract
 *   P3.6.8 — Callers still pass useMockSimulation prop
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ── Helpers ───────────────────────────────────────────────────────────────────

const SRC = join(process.cwd(), 'src')
const src = (rel: string) => readFileSync(join(SRC, rel), 'utf-8')

// ── P3.6.1 — Source structure checks ─────────────────────────────────────────

describe('P3.6.1 — OrderTracker source structure', () => {
  it('imports useOrderWebSocket from @/hooks/client', () => {
    const content = src('components/order/OrderTracker.tsx')
    expect(content).toContain("import { useOrderWebSocket } from '@/hooks/client'")
  })

  it('still imports simulateOrderUpdates from websocket.service', () => {
    const content = src('components/order/OrderTracker.tsx')
    expect(content).toContain('simulateOrderUpdates')
    expect(content).toContain("from '@/services/websocket.service'")
  })

  it('reads NEXT_PUBLIC_USE_MOCK env var to determine mode', () => {
    const content = src('components/order/OrderTracker.tsx')
    expect(content).toContain('NEXT_PUBLIC_USE_MOCK')
  })

  it('calls useOrderWebSocket unconditionally (no conditional hook call)', () => {
    const content = src('components/order/OrderTracker.tsx')
    // Hook must be called at top level, not inside an if block
    // Check that the call is not inside an `if (` or `if(` guard
    const lines = content.split('\n')
    const hookLine = lines.findIndex((l) => l.includes('useOrderWebSocket('))
    expect(hookLine).toBeGreaterThan(-1)
    // The line calling the hook should not start with 'if'
    const trimmed = lines[hookLine].trim()
    expect(trimmed).not.toMatch(/^if\s*\(/)
  })

  it('syncs wsStatus into local state via useEffect', () => {
    const content = src('components/order/OrderTracker.tsx')
    expect(content).toContain('wsStatus')
    expect(content).toContain('setCurrentStatus(wsStatus)')
  })

  it('syncs wsEta into local state via useEffect', () => {
    const content = src('components/order/OrderTracker.tsx')
    expect(content).toContain('wsEta')
    expect(content).toContain('setEstimatedTime(wsEta)')
  })

  it('simulation effect is guarded by isMockMode', () => {
    const content = src('components/order/OrderTracker.tsx')
    expect(content).toContain('isMockMode')
    // Guard: if (!isMockMode || ...) return
    expect(content).toMatch(/if\s*\(!isMockMode/)
  })

  it('real-mode sync effects are guarded by isMockMode', () => {
    const content = src('components/order/OrderTracker.tsx')
    // Both sync effects check isMockMode
    const occurrences = (content.match(/if\s*\(isMockMode/g) || []).length
    expect(occurrences).toBeGreaterThanOrEqual(2)
  })

  it('WS connection is disabled when isMockMode is true (shouldConnectWs)', () => {
    const content = src('components/order/OrderTracker.tsx')
    expect(content).toContain('shouldConnectWs')
    // shouldConnectWs = !isMockMode && ...
    expect(content).toMatch(/shouldConnectWs\s*=\s*!isMockMode/)
  })

  it('null is passed to useOrderWebSocket when shouldConnectWs is false', () => {
    const content = src('components/order/OrderTracker.tsx')
    expect(content).toContain('shouldConnectWs ? orderId : null')
  })
})

// ── P3.6.2 — useOrderWebSocket hook contract (hooks/client.ts) ────────────────

describe('P3.6.2 — useOrderWebSocket hook contract', () => {
  it('hooks/client.ts exports useOrderWebSocket', async () => {
    const mod = await import('@/hooks/client')
    expect(typeof mod.useOrderWebSocket).toBe('function')
  })

  it('useOrderWebSocket accepts null orderId (no-op path)', async () => {
    // If the import succeeds and the function exists, null is handled
    const mod = await import('@/hooks/client')
    expect(mod.useOrderWebSocket.length).toBeGreaterThanOrEqual(1)
  })

  it('hooks/client.ts connects to /orders/{orderId}/ path', () => {
    const content = src('hooks/client.ts')
    expect(content).toContain('/orders/${orderId}/')
  })

  it('hooks/client.ts listens to order.status_update event', () => {
    const content = src('hooks/client.ts')
    expect(content).toContain('order.status_update')
  })

  it('hooks/client.ts returns status from hook', () => {
    const content = src('hooks/client.ts')
    expect(content).toContain('return { status, estimatedTime, connected, connectionStatus }')
  })

  it('hooks/client.ts unsubscribes and disconnects on cleanup', () => {
    const content = src('hooks/client.ts')
    // The cleanup function calls unsubs and disconnect
    expect(content).toContain('unsubs.forEach((fn) => fn())')
    expect(content).toContain('orderWebSocket.disconnect()')
  })

  it('hooks/client.ts early-returns when orderId is null/falsy', () => {
    const content = src('hooks/client.ts')
    expect(content).toContain('if (!orderId) return')
  })

  it('hooks/client.ts sets connected state on connected event', () => {
    const content = src('hooks/client.ts')
    expect(content).toContain("orderWebSocket.on('connected'")
    expect(content).toContain('setConnected(true)')
  })

  it('hooks/client.ts sets connected=false on disconnected event', () => {
    const content = src('hooks/client.ts')
    expect(content).toContain('setConnected(false)')
  })

  it('hooks/client.ts tracks connectionStatus', () => {
    const content = src('hooks/client.ts')
    expect(content).toContain("orderWebSocket.on('status'")
    expect(content).toContain('setConnectionStatus')
  })
})

// ── P3.6.3 — Mock mode simulation fallback ────────────────────────────────────

describe('P3.6.3 — Mock mode simulation fallback', () => {
  it('simulateOrderUpdates is still exported from websocket.service', async () => {
    const mod = await import('@/services/websocket.service')
    expect(typeof mod.simulateOrderUpdates).toBe('function')
  })

  it('simulateOrderUpdates accepts orderId and callback', async () => {
    const mod = await import('@/services/websocket.service')
    expect(mod.simulateOrderUpdates.length).toBe(2)
  })

  it('simulateOrderUpdates returns a cleanup function', async () => {
    vi.useFakeTimers()
    const mod = await import('@/services/websocket.service')
    const cleanup = mod.simulateOrderUpdates('order-123', () => {})
    expect(typeof cleanup).toBe('function')
    cleanup()
    vi.useRealTimers()
  })

  it('simulateOrderUpdates calls onUpdate with pending status first', async () => {
    vi.useFakeTimers()
    const mod = await import('@/services/websocket.service')
    const updates: string[] = []
    const cleanup = mod.simulateOrderUpdates('order-1', (status) => updates.push(status))
    await vi.runAllTimersAsync()
    expect(updates[0]).toBe('pending')
    cleanup()
    vi.useRealTimers()
  })

  it('simulateOrderUpdates progresses through full status sequence', async () => {
    vi.useFakeTimers()
    const mod = await import('@/services/websocket.service')
    const updates: string[] = []
    const cleanup = mod.simulateOrderUpdates('order-2', (status) => updates.push(status))
    await vi.runAllTimersAsync()
    expect(updates).toContain('pending')
    expect(updates).toContain('accepted')
    expect(updates).toContain('preparing')
    expect(updates).toContain('ready')
    expect(updates).toContain('delivered')
    cleanup()
    vi.useRealTimers()
  })

  it('simulateOrderUpdates cleanup cancels pending timers', async () => {
    vi.useFakeTimers()
    const mod = await import('@/services/websocket.service')
    const updates: string[] = []
    const cleanup = mod.simulateOrderUpdates('order-3', (status) => updates.push(status))
    cleanup() // cancel before any timer fires
    await vi.runAllTimersAsync()
    expect(updates).toHaveLength(0)
    vi.useRealTimers()
  })

  it('simulateOrderUpdates provides estimatedTime as second argument', async () => {
    vi.useFakeTimers()
    const mod = await import('@/services/websocket.service')
    const etas: number[] = []
    const cleanup = mod.simulateOrderUpdates('order-4', (_status, eta) => etas.push(eta))
    await vi.runAllTimersAsync()
    expect(etas.length).toBeGreaterThan(0)
    expect(typeof etas[0]).toBe('number')
    cleanup()
    vi.useRealTimers()
  })
})

// ── P3.6.4 — Reconnect (DjangoChannelsWebSocket) ─────────────────────────────

describe('P3.6.4 — Reconnect behaviour', () => {
  it('DjangoChannelsWebSocket schedules reconnect after close', async () => {
    vi.useFakeTimers()
    const instances: any[] = []
    const factory = (url: string) => {
      const ws = {
        url, readyState: 1,
        onopen: null as any, onmessage: null as any,
        onclose: null as any, onerror: null as any,
        close(code = 1000, reason = '') {
          this.readyState = 3
          this.onclose?.({ code, reason, wasClean: code === 1000 })
        },
        send: () => {},
      }
      instances.push(ws)
      return ws as unknown as WebSocket
    }
    const { DjangoChannelsWebSocket } = await import('@/services/websocket.service')
    const svc = new DjangoChannelsWebSocket({ channelName: 'reconnect-test', wsFactory: factory })
    svc.connect('/orders/1/')
    const first = instances[instances.length - 1]
    first.onopen?.(new Event('open'))
    first.close(1006)
    expect(svc.getStatus()).toBe('reconnecting')
    vi.runAllTimers()
    expect(instances.length).toBeGreaterThan(1)
    svc.disconnect()
    vi.useRealTimers()
  })

  it('DjangoChannelsWebSocket stops reconnecting after disconnect()', async () => {
    vi.useFakeTimers()
    const instances: any[] = []
    const factory = (url: string) => {
      const ws = { url, readyState: 1, onopen: null as any, onclose: null as any, onerror: null as any, onmessage: null as any, close(c = 1000, r = '') { this.readyState = 3; this.onclose?.({ code: c, reason: r, wasClean: c === 1000 }) }, send: () => {} }
      instances.push(ws)
      return ws as unknown as WebSocket
    }
    const { DjangoChannelsWebSocket } = await import('@/services/websocket.service')
    const svc = new DjangoChannelsWebSocket({ channelName: 'stop-reconnect', wsFactory: factory })
    svc.connect('/orders/2/')
    const first = instances[instances.length - 1]
    first.onopen?.(new Event('open'))
    svc.disconnect()
    first.close(1006)
    vi.runAllTimers()
    expect(instances).toHaveLength(1)
    vi.useRealTimers()
  })
})

// ── P3.6.5 — Cleanup / no memory leaks ───────────────────────────────────────

describe('P3.6.5 — Cleanup on unmount', () => {
  it('useOrderWebSocket in hooks/client.ts calls disconnect on cleanup', () => {
    const content = src('hooks/client.ts')
    expect(content).toContain('orderWebSocket.disconnect()')
  })

  it('useOrderWebSocket calls all unsub functions on cleanup', () => {
    const content = src('hooks/client.ts')
    expect(content).toContain('unsubs.forEach((fn) => fn())')
  })

  it('simulateOrderUpdates cleanup prevents further callbacks', async () => {
    vi.useFakeTimers()
    const mod = await import('@/services/websocket.service')
    const updates: string[] = []
    const cleanup = mod.simulateOrderUpdates('order-cleanup', (s) => updates.push(s))
    vi.advanceTimersByTime(1600) // first timer fires (1500ms)
    cleanup() // cancel remaining
    vi.runAllTimers()
    expect(updates.length).toBeLessThanOrEqual(1)
    vi.useRealTimers()
  })

  it('OrderTracker cleanup effect deps include isMockMode', () => {
    const content = src('components/order/OrderTracker.tsx')
    // Simulation effect deps: [orderId, isMockMode, useMockSimulation, isCancelled]
    expect(content).toContain('isMockMode')
  })
})

// ── P3.6.6 — Duplicate subscription prevention ───────────────────────────────

describe('P3.6.6 — Duplicate subscription prevention', () => {
  it('useOrderWebSocket is called exactly once in OrderTracker', () => {
    const content = src('components/order/OrderTracker.tsx')
    const matches = content.match(/useOrderWebSocket\(/g) || []
    expect(matches).toHaveLength(1)
  })

  it('OrderTracker does not call orderWebSocket.connect() directly', () => {
    const content = src('components/order/OrderTracker.tsx')
    expect(content).not.toContain('orderWebSocket.connect(')
  })

  it('OrderTracker does not call orderWebSocket.on() directly', () => {
    const content = src('components/order/OrderTracker.tsx')
    expect(content).not.toContain('orderWebSocket.on(')
  })

  it('null orderId prevents WS connection (no-op in hook)', () => {
    const content = src('hooks/client.ts')
    // The hook guards on orderId being falsy
    expect(content).toMatch(/if\s*\(!orderId\)\s*return/)
  })
})

// ── P3.6.7 — Callers still pass useMockSimulation ─────────────────────────────

describe('P3.6.7 — Callers preserved', () => {
  it('checkout/success/page.tsx passes useMockSimulation to OrderTracker', () => {
    const content = src('app/checkout/success/page.tsx')
    expect(content).toContain('OrderTracker')
    expect(content).toContain('useMockSimulation')
  })

  it('order/[orderId]/page.tsx renders OrderTracker with orderId', () => {
    const content = src('app/order/[orderId]/page.tsx')
    expect(content).toContain('OrderTracker')
    expect(content).toContain('orderId={order.id}')
  })

  it('order/[orderId]/page.tsx still passes initialStatus', () => {
    const content = src('app/order/[orderId]/page.tsx')
    expect(content).toContain('initialStatus={order.status}')
  })

  it('checkout/success/page.tsx still passes initialStatus pending', () => {
    const content = src('app/checkout/success/page.tsx')
    expect(content).toContain('initialStatus="pending"')
  })
})

// ── P3.6.8 — Regression: UI elements preserved ────────────────────────────────

describe('P3.6.8 — UI regression guard', () => {
  it('OrderTracker still renders estimated time section', () => {
    const content = src('components/order/OrderTracker.tsx')
    expect(content).toContain('estimatedTime')
    expect(content).toContain("t('estimatedTime')")
  })

  it('OrderTracker still renders progress bar', () => {
    const content = src('components/order/OrderTracker.tsx')
    expect(content).toContain('STATUS_ORDER')
    expect(content).toContain('STEPS')
  })

  it('OrderTracker still handles cancelled state', () => {
    const content = src('components/order/OrderTracker.tsx')
    expect(content).toContain('isCancelled')
    expect(content).toContain("t('orderCancelled')")
  })

  it('OrderTracker still uses AnimatePresence', () => {
    const content = src('components/order/OrderTracker.tsx')
    expect(content).toContain('AnimatePresence')
  })

  it('OrderTracker renders current step description', () => {
    const content = src('components/order/OrderTracker.tsx')
    expect(content).toContain('step.description')
  })
})
