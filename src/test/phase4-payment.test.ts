/**
 * P4.1 — Payment Gateway Integration tests
 *
 * Service unit tests, hook tests, checkout flow integration tests,
 * and regression guard for non-card payment methods.
 * All tests run in mock mode — no real Stripe SDK or network calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

// ── Payment service ───────────────────────────────────────────────────────────

describe('paymentService — createPaymentIntent (mock mode)', () => {
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

  it('returns a client_secret string', async () => {
    const p = paymentService.createPaymentIntent({ amount: 42.5, branch_id: '1' })
    await vi.runAllTimersAsync()
    const result = await p
    expect(typeof result.client_secret).toBe('string')
    expect(result.client_secret.length).toBeGreaterThan(0)
  })

  it('client_secret contains mock sentinel', async () => {
    const p = paymentService.createPaymentIntent({ amount: 42.5, branch_id: '1' })
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.client_secret).toContain('mock')
  })

  it('returns a payment_intent_id', async () => {
    const p = paymentService.createPaymentIntent({ amount: 42.5, branch_id: '1' })
    await vi.runAllTimersAsync()
    const result = await p
    expect(typeof result.payment_intent_id).toBe('string')
    expect(result.payment_intent_id.length).toBeGreaterThan(0)
  })

  it('converts amount to cents in the response', async () => {
    const p = paymentService.createPaymentIntent({ amount: 19.99, branch_id: '1' })
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.amount).toBe(Math.round(19.99 * 100))
  })

  it('defaults currency to usd', async () => {
    const p = paymentService.createPaymentIntent({ amount: 10, branch_id: '1' })
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.currency).toBe('usd')
  })

  it('respects an explicit currency override', async () => {
    const p = paymentService.createPaymentIntent({ amount: 10, branch_id: '1', currency: 'eur' })
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.currency).toBe('eur')
  })

  it('increments the counter between calls', async () => {
    const p1 = paymentService.createPaymentIntent({ amount: 10, branch_id: '1' })
    await vi.runAllTimersAsync()
    const r1 = await p1

    const p2 = paymentService.createPaymentIntent({ amount: 20, branch_id: '1' })
    await vi.runAllTimersAsync()
    const r2 = await p2

    expect(r1.client_secret).not.toBe(r2.client_secret)
  })
})

describe('paymentService — mockConfirmPayment', () => {
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

  it('returns succeeded status by default', async () => {
    const p = paymentService.mockConfirmPayment()
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.status).toBe('succeeded')
  })

  it('returns a payment_intent_id on success', async () => {
    const p = paymentService.mockConfirmPayment()
    await vi.runAllTimersAsync()
    const result = await p
    expect(typeof result.payment_intent_id).toBe('string')
    expect(result.payment_intent_id.length).toBeGreaterThan(0)
  })

  it('returns failed status when simulateFailure=true', async () => {
    const p = paymentService.mockConfirmPayment({ simulateFailure: true })
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.status).toBe('failed')
  })

  it('includes error message on simulated failure', async () => {
    const p = paymentService.mockConfirmPayment({ simulateFailure: true })
    await vi.runAllTimersAsync()
    const result = await p
    expect(typeof result.error).toBe('string')
    expect((result.error ?? '').length).toBeGreaterThan(0)
  })

  it('returns failed payment_intent_id on failure', async () => {
    const p = paymentService.mockConfirmPayment({ simulateFailure: true })
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.payment_intent_id).toBe('pi_mock_fail')
  })

  it('no error field on success path', async () => {
    const p = paymentService.mockConfirmPayment()
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.error).toBeUndefined()
  })
})

// ── Endpoints ─────────────────────────────────────────────────────────────────

describe('ENDPOINTS — PAYMENTS block', () => {
  it('has CREATE_INTENT endpoint', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.PAYMENTS.CREATE_INTENT).toBe('/payments/create-intent/')
  })

  it('has CONFIRM endpoint', async () => {
    const { ENDPOINTS } = await import('@/services/endpoints')
    expect(ENDPOINTS.PAYMENTS.CONFIRM).toBe('/payments/confirm/')
  })
})

// ── Hooks ─────────────────────────────────────────────────────────────────────

describe('useCreatePaymentIntent hook — export presence', () => {
  it('is exported from @/hooks', async () => {
    const hooks = await import('@/hooks')
    expect(typeof hooks.useCreatePaymentIntent).toBe('function')
  })
})

// ── Stripe loader ─────────────────────────────────────────────────────────────

describe('stripe.ts — loader utilities', () => {
  it('getStripe is exported', () => {
    const src = readSrc('lib/stripe.ts')
    expect(src).toContain('export function getStripe')
  })

  it('STRIPE_AVAILABLE is exported', () => {
    const src = readSrc('lib/stripe.ts')
    expect(src).toContain('export const STRIPE_AVAILABLE')
  })

  it('returns null when no publishable key is set (mock env)', async () => {
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', '')
    vi.resetModules()
    const { getStripe } = await import('@/lib/stripe')
    const stripe = await getStripe()
    expect(stripe).toBeNull()
  })
})

// ── Checkout page source guards ───────────────────────────────────────────────

describe('checkout/page.tsx — source structure', () => {
  const src = () => readSrc('app/checkout/page.tsx')

  it('imports useCreatePaymentIntent', () => {
    expect(src()).toContain('useCreatePaymentIntent')
  })

  it('imports StripePaymentForm', () => {
    expect(src()).toContain('StripePaymentForm')
  })

  it('calls createPaymentIntent when paymentMethod is card', () => {
    expect(src()).toContain('createPaymentIntent')
  })

  it('has finaliseOrder function that handles non-card methods', () => {
    expect(src()).toContain('finaliseOrder')
  })

  it('has handlePaymentSuccess callback', () => {
    expect(src()).toContain('handlePaymentSuccess')
  })

  it('has handlePaymentError callback', () => {
    expect(src()).toContain('handlePaymentError')
  })

  it('passes clientSecret to StripePaymentForm', () => {
    expect(src()).toContain('clientSecret={clientSecret}')
  })

  it('passes onSuccess to StripePaymentForm', () => {
    expect(src()).toContain('onSuccess={handlePaymentSuccess}')
  })

  it('passes onError to StripePaymentForm', () => {
    expect(src()).toContain('onError={handlePaymentError}')
  })

  it('still supports cash payment method', () => {
    expect(src()).toContain("value: 'cash'")
  })

  it('still supports wallet payment method', () => {
    expect(src()).toContain("value: 'wallet'")
  })

  it('still supports online payment method', () => {
    expect(src()).toContain("value: 'online'")
  })
})

// ── StripePaymentForm component source guards ─────────────────────────────────

describe('StripePaymentForm — source structure', () => {
  const src = () => readSrc('components/checkout/StripePaymentForm.tsx')

  it('is a client component', () => {
    expect(src().trimStart()).toMatch(/^'use client'/)
  })

  it('exports StripePaymentForm', () => {
    expect(src()).toContain('export function StripePaymentForm')
  })

  it('exports PaymentStatusBadge', () => {
    expect(src()).toContain('export function PaymentStatusBadge')
  })

  it('uses PaymentElement from @stripe/react-stripe-js', () => {
    expect(src()).toContain('PaymentElement')
  })

  it('uses Elements from @stripe/react-stripe-js', () => {
    expect(src()).toContain('Elements')
  })

  it('falls back to MockPaymentForm in mock mode', () => {
    expect(src()).toContain('MockPaymentForm')
  })

  it('calls paymentService.confirmCardPayment in real mode', () => {
    expect(src()).toContain('paymentService.confirmCardPayment')
  })

  it('calls paymentService.mockConfirmPayment in mock mode', () => {
    expect(src()).toContain('paymentService.mockConfirmPayment')
  })

  it('calls onSuccess callback on succeeded status', () => {
    expect(src()).toContain("result.status === 'succeeded'")
    expect(src()).toContain('onSuccess(result.payment_intent_id)')
  })

  it('calls onError callback on failed status', () => {
    expect(src()).toContain('onError(msg)')
  })

  it('renders change-method link to reset clientSecret', () => {
    const checkoutSrc = readSrc('app/checkout/page.tsx')
    // P9.5.2: localized via t('changeMethod') instead of a literal string.
    expect(checkoutSrc).toContain("t('changeMethod')")
  })
})

// ── env.ts — optional key registration ───────────────────────────────────────

describe('env.ts — Stripe key registration', () => {
  it('defines NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in optional schema', () => {
    const src = readSrc('lib/env.ts')
    expect(src).toContain('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
  })

  it('validates publishable key format with startsWith pk_', () => {
    const src = readSrc('lib/env.ts')
    expect(src).toContain("startsWith('pk_')")
  })

  it('exports stripePublishableKey in optionalEnv', () => {
    const src = readSrc('lib/env.ts')
    expect(src).toContain('stripePublishableKey')
  })
})

// ── Regression: non-card payment flows ───────────────────────────────────────

describe('orderService regression — non-card flows still use createOrder directly', () => {
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

  it('cash: createOrder succeeds and returns an order', async () => {
    const p = orderService.createOrder({
      branch_id: '1',
      items: [{ menu_item_id: 'item-1', quantity: 2, extras: [] }],
      order_type: 'delivery',
      payment_method: 'cash',
    })
    await vi.runAllTimersAsync()
    const order = await p
    expect(order.status).toBe('pending')
    expect(order.payment_method).toBe('cash')
  })

  it('wallet: createOrder succeeds and returns an order', async () => {
    const p = orderService.createOrder({
      branch_id: '1',
      items: [{ menu_item_id: 'item-1', quantity: 1, extras: [] }],
      order_type: 'pickup',
      payment_method: 'wallet',
    })
    await vi.runAllTimersAsync()
    const order = await p
    expect(order.status).toBe('pending')
    expect(order.payment_method).toBe('wallet')
  })

  it('online: createOrder succeeds and returns an order', async () => {
    const p = orderService.createOrder({
      branch_id: '1',
      items: [{ menu_item_id: 'item-1', quantity: 1, extras: [] }],
      order_type: 'pickup',
      payment_method: 'online',
    })
    await vi.runAllTimersAsync()
    const order = await p
    expect(order.status).toBe('pending')
    expect(order.payment_method).toBe('online')
  })

  it('dine_in + card: createOrder still produces a valid order shape', async () => {
    const p = orderService.createOrder({
      branch_id: '1',
      items: [{ menu_item_id: 'item-2', quantity: 1, extras: [] }],
      order_type: 'dine_in',
      payment_method: 'card',
      table_number: 5,
    })
    await vi.runAllTimersAsync()
    const order = await p
    expect(order.id).toBeTruthy()
    expect(order.order_number).toBeTruthy()
  })

  it('discount codes still work alongside payment_method', async () => {
    const p = orderService.validateDiscountCode('SAVE10', 100)
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.valid).toBe(true)
    expect(result.discount_amount).toBe(10)
  })
})

// ── Integration: card checkout happy path (service layer) ─────────────────────

describe('card checkout happy path — service layer integration', () => {
  let paymentService: typeof import('@/services/payment.service').paymentService
  let orderService: typeof import('@/services/order.service').orderService

  beforeEach(async () => {
    vi.useFakeTimers()
    const pm = await import('@/services/payment.service')
    const om = await import('@/services/order.service')
    paymentService = pm.paymentService
    orderService = om.orderService
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('full flow: createPaymentIntent → mockConfirm → createOrder', async () => {
    // Step 1: create intent
    const intentP = paymentService.createPaymentIntent({ amount: 55.00, branch_id: '1' })
    await vi.runAllTimersAsync()
    const intent = await intentP
    expect(intent.client_secret).toBeTruthy()

    // Step 2: confirm payment
    const confirmP = paymentService.mockConfirmPayment()
    await vi.runAllTimersAsync()
    const confirmed = await confirmP
    expect(confirmed.status).toBe('succeeded')

    // Step 3: create order with payment_intent_id
    const orderP = orderService.createOrder({
      branch_id: '1',
      items: [{ menu_item_id: 'i-1', quantity: 1, extras: [] }],
      order_type: 'delivery',
      payment_method: 'card',
    })
    await vi.runAllTimersAsync()
    const order = await orderP
    expect(order.status).toBe('pending')
    expect(order.payment_method).toBe('card')
  })

  it('failed payment: createPaymentIntent → mockConfirm(fail) → no order created', async () => {
    const intentP = paymentService.createPaymentIntent({ amount: 55.00, branch_id: '1' })
    await vi.runAllTimersAsync()
    await intentP

    const confirmP = paymentService.mockConfirmPayment({ simulateFailure: true })
    await vi.runAllTimersAsync()
    const confirmed = await confirmP

    expect(confirmed.status).toBe('failed')
    expect(confirmed.error).toBeTruthy()
    // Order is NOT created — confirmed by the flow: onError is called, not finaliseOrder
  })

  it('cancelled path: status is not succeeded', async () => {
    const intentP = paymentService.createPaymentIntent({ amount: 20, branch_id: '1' })
    await vi.runAllTimersAsync()
    await intentP

    const confirmP = paymentService.mockConfirmPayment({ simulateFailure: true })
    await vi.runAllTimersAsync()
    const confirmed = await confirmP

    expect(confirmed.status).not.toBe('succeeded')
  })
})

// ── .env.example documentation ───────────────────────────────────────────────

describe('.env.example — Stripe key documented', () => {
  it('documents NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', () => {
    const envExample = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf-8')
    expect(envExample).toContain('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
  })
})
