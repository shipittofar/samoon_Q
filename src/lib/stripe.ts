/**
 * Stripe loader — P4.1
 *
 * Lazy-loads the Stripe.js SDK so it is not bundled into the initial JS
 * payload. Returns null in mock mode or when the publishable key is absent,
 * allowing the checkout page to render a simulated payment form instead.
 */
import { loadStripe, type Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null> | null = null

export function getStripe(): Promise<Stripe | null> {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!key) return Promise.resolve(null)

  if (!stripePromise) {
    stripePromise = loadStripe(key)
  }
  return stripePromise
}

export const STRIPE_AVAILABLE =
  typeof process !== 'undefined' &&
  Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
