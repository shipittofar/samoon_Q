/**
 * Payment service — P4.1
 *
 * Handles Stripe PaymentIntent creation and confirmation.
 * In mock mode both methods simulate the full backend round-trip so
 * the checkout flow can be tested without a real Stripe account.
 */
import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import type { Stripe, StripeElements } from '@stripe/stripe-js'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 800) => new Promise((r) => setTimeout(r, ms))

export interface CreatePaymentIntentPayload {
  amount: number
  currency?: string
  order_description?: string
  branch_id: string
}

export interface PaymentIntentResult {
  client_secret: string
  payment_intent_id: string
  amount: number
  currency: string
}

export interface ConfirmPaymentResult {
  status: 'succeeded' | 'requires_action' | 'canceled' | 'failed'
  payment_intent_id: string
  error?: string
}

let mockIntentCounter = 1

export const paymentService = {
  async createPaymentIntent(payload: CreatePaymentIntentPayload): Promise<PaymentIntentResult> {
    if (USE_MOCK) {
      await delay(600)
      return {
        client_secret: `pi_mock_${mockIntentCounter}_secret_mock_${mockIntentCounter++}`,
        payment_intent_id: `pi_mock_${mockIntentCounter}`,
        amount: Math.round(payload.amount * 100),
        currency: payload.currency ?? 'usd',
      }
    }
    const { data } = await api.post<PaymentIntentResult>(ENDPOINTS.PAYMENTS.CREATE_INTENT, payload)
    return data
  },

  async confirmCardPayment(
    stripe: Stripe,
    elements: StripeElements,
    clientSecret: string,
    returnUrl: string,
  ): Promise<ConfirmPaymentResult> {
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    })

    if (error) {
      return {
        status: 'failed',
        payment_intent_id: error.payment_intent?.id ?? '',
        error: error.message,
      }
    }

    if (!paymentIntent) {
      return { status: 'failed', payment_intent_id: '', error: 'No payment intent returned' }
    }

    return {
      status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'requires_action',
      payment_intent_id: paymentIntent.id,
    }
  },

  /**
   * Mock confirmation path — used by the mock PaymentForm when no real
   * Stripe key is configured. Simulates a short network delay then succeeds.
   * Pass `simulateFailure: true` in tests to exercise the failure path.
   */
  async mockConfirmPayment(opts?: { simulateFailure?: boolean }): Promise<ConfirmPaymentResult> {
    await delay(1000)
    if (opts?.simulateFailure) {
      return {
        status: 'failed',
        payment_intent_id: 'pi_mock_fail',
        error: 'Your card was declined.',
      }
    }
    return { status: 'succeeded', payment_intent_id: `pi_mock_${mockIntentCounter}` }
  },
}
