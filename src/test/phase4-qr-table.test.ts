/**
 * P4.4 — QR Table Ordering Completion tests
 *
 * Verifies parameter parsing, state initialization, order payload correctness,
 * and regression coverage for the existing checkout and table page flows.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

// ── Audit: checkout/page.tsx source structure ─────────────────────────────────

describe('checkout/page.tsx — P4.4 source structure', () => {
  const src = () => readSrc('app/checkout/page.tsx')

  it('imports useSearchParams from next/navigation', () => {
    expect(src()).toContain('useSearchParams')
    expect(src()).toContain("from 'next/navigation'")
  })

  it('imports Suspense from react', () => {
    expect(src()).toContain('Suspense')
    expect(src()).toContain("from 'react'")
  })

  it('wraps CheckoutContent in Suspense in the default export', () => {
    expect(src()).toContain('<Suspense>')
    expect(src()).toContain('<CheckoutContent />')
  })

  it('reads orderType param from searchParams', () => {
    expect(src()).toContain("searchParams.get('orderType')")
  })

  it('reads table param from searchParams', () => {
    expect(src()).toContain("searchParams.get('table')")
  })

  it('validates orderType via backend checkout resolution', () => {
    expect(src()).toContain('resolveCheckoutOrderWireType')
    expect(src()).not.toContain('VALID_ORDER_TYPES')
  })

  it('derives initial order type from branch checkout config', () => {
    expect(src()).toContain('getCheckoutOrderTypeOptions')
    expect(src()).toContain('initialOrderType')
  })

  it('validates table param as numeric', () => {
    expect(src()).toContain('/^\\d+$/.test(paramTable)')
  })

  it('passes initialOrderType as initial useState value', () => {
    expect(src()).toContain('useState(initialOrderType)')
  })

  it('passes initialTableNumber as table_number defaultValue', () => {
    expect(src()).toContain('table_number: initialTableNumber')
  })

  it('renders a dine-in context banner when arriving from QR', () => {
    expect(src()).toContain('requiresTableNumber')
    expect(src()).toContain('initialTableNumber')
    // P9.5.2: localized via t('dineInBanner', { table }) instead of a literal string.
    expect(src()).toContain("t('dineInBanner'")
  })

  it('derives payment methods from branch checkout config', () => {
    expect(src()).toContain('getCheckoutPaymentOptions')
  })

  it('still imports StripePaymentForm (P4.1 no regression)', () => {
    expect(src()).toContain('StripePaymentForm')
  })

  it('still has finaliseOrder function', () => {
    expect(src()).toContain('finaliseOrder')
  })
})

// ── table/[tableId]/page.tsx — link target ────────────────────────────────────

describe('table/[tableId]/page.tsx — QR redirect link', () => {
  const src = () => readSrc('app/table/[tableId]/page.tsx')

  it('links to /checkout with orderType=dine_in param', () => {
    expect(src()).toContain('orderType=dine_in')
  })

  it('links to /checkout with table param', () => {
    expect(src()).toContain('table=${tableNumber}')
  })

  it('builds the href as a template literal', () => {
    expect(src()).toContain('/checkout?orderType=dine_in&table=')
  })

  it('parses tableId as integer', () => {
    expect(src()).toContain('parseInt(tableId')
  })

  it('validates table number range 1-100', () => {
    expect(src()).toContain('tableNumber < 1')
    expect(src()).toContain('tableNumber > 100')
  })
})

// ── URL parameter parsing logic — unit tests ──────────────────────────────────

describe('P4.4 — URL param parsing logic', () => {
  const VALID_ORDER_TYPES = new Set(['delivery', 'pickup', 'dine_in'])

  const parseOrderType = (param: string | null): string => {
    return param && VALID_ORDER_TYPES.has(param) ? param : 'delivery'
  }

  const parseTableNumber = (param: string | null): string => {
    const val = param ?? ''
    return val && /^\d+$/.test(val) ? val : ''
  }

  it('dine_in is a valid orderType', () => {
    expect(parseOrderType('dine_in')).toBe('dine_in')
  })

  it('delivery is a valid orderType', () => {
    expect(parseOrderType('delivery')).toBe('delivery')
  })

  it('pickup is a valid orderType', () => {
    expect(parseOrderType('pickup')).toBe('pickup')
  })

  it('null orderType falls back to delivery', () => {
    expect(parseOrderType(null)).toBe('delivery')
  })

  it('unknown orderType falls back to delivery', () => {
    expect(parseOrderType('express')).toBe('delivery')
  })

  it('empty string orderType falls back to delivery', () => {
    expect(parseOrderType('')).toBe('delivery')
  })

  it('table param "5" parses to "5"', () => {
    expect(parseTableNumber('5')).toBe('5')
  })

  it('table param "12" parses to "12"', () => {
    expect(parseTableNumber('12')).toBe('12')
  })

  it('null table param returns empty string', () => {
    expect(parseTableNumber(null)).toBe('')
  })

  it('non-numeric table param returns empty string', () => {
    expect(parseTableNumber('abc')).toBe('')
  })

  it('empty table param returns empty string', () => {
    expect(parseTableNumber('')).toBe('')
  })

  it('table param "0" returns "0" (valid digit sequence)', () => {
    expect(parseTableNumber('0')).toBe('0')
  })
})

// ── Order service: dine_in payload correctness ────────────────────────────────

describe('orderService — dine_in order payload (P4.4)', () => {
  let orderService: typeof import('@/services/order.service').orderService

  beforeEach(async () => {
    vi.useFakeTimers()
    const mod = await import('@/services/order.service')
    orderService = mod.orderService
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('dine_in order with table_number is accepted', async () => {
    const p = orderService.createOrder({
      branch_id: '1',
      items: [{ menu_item_id: 'item-1', quantity: 1, extras: [] }],
      order_type: 'dine_in',
      payment_method: 'cash',
      table_number: 5,
    })
    await vi.runAllTimersAsync()
    const order = await p
    expect(order.status).toBe('pending')
    expect(order.order_type).toBe('dine_in')
    expect(order.table_number).toBe(5)
  })

  it('dine_in order without delivery_address is accepted', async () => {
    const p = orderService.createOrder({
      branch_id: '1',
      items: [{ menu_item_id: 'item-1', quantity: 1, extras: [] }],
      order_type: 'dine_in',
      payment_method: 'cash',
      table_number: 3,
    })
    await vi.runAllTimersAsync()
    const order = await p
    expect(order.delivery_address).toBeUndefined()
  })

  it('dine_in order gets an order_number', async () => {
    const p = orderService.createOrder({
      branch_id: '1',
      items: [{ menu_item_id: 'item-1', quantity: 2, extras: [] }],
      order_type: 'dine_in',
      payment_method: 'card',
      table_number: 7,
    })
    await vi.runAllTimersAsync()
    const order = await p
    expect(order.order_number).toBeTruthy()
    expect(order.id).toBeTruthy()
  })

  it('delivery order is unaffected by dine_in changes (regression)', async () => {
    const p = orderService.createOrder({
      branch_id: '1',
      items: [{ menu_item_id: 'item-2', quantity: 1, extras: [] }],
      order_type: 'delivery',
      payment_method: 'cash',
      delivery_address: { street: '123 Main St', city: 'Testville' },
    })
    await vi.runAllTimersAsync()
    const order = await p
    expect(order.order_type).toBe('delivery')
    expect(order.status).toBe('pending')
  })

  it('pickup order is unaffected (regression)', async () => {
    const p = orderService.createOrder({
      branch_id: '1',
      items: [{ menu_item_id: 'item-3', quantity: 1, extras: [] }],
      order_type: 'pickup',
      payment_method: 'wallet',
    })
    await vi.runAllTimersAsync()
    const order = await p
    expect(order.order_type).toBe('pickup')
  })
})

// ── Regression: P4.1 payment flow unaffected ─────────────────────────────────

describe('paymentService regression — P4.1 unaffected', () => {
  let paymentService: typeof import('@/services/payment.service').paymentService

  beforeEach(async () => {
    vi.useFakeTimers()
    const mod = await import('@/services/payment.service')
    paymentService = mod.paymentService
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('createPaymentIntent still works after P4.4 changes', async () => {
    const p = paymentService.createPaymentIntent({ amount: 30, branch_id: '1' })
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.client_secret).toBeTruthy()
  })
})
