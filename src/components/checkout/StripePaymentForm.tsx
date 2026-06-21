'use client'

/**
 * StripePaymentForm — P4.1
 *
 * Renders the Stripe PaymentElement when a real publishable key is available,
 * or a mock card form when running in NEXT_PUBLIC_USE_MOCK=true mode.
 * The parent (checkout page) is responsible for creating the PaymentIntent and
 * providing the client_secret; this component only handles rendering + confirm.
 */
import { useState } from 'react'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Lock, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getStripe } from '@/lib/stripe'
import { paymentService } from '@/services/payment.service'
import { cn } from '@/utils'

// ── Inner form rendered inside <Elements> ────────────────────────────────────

interface StripeInnerFormProps {
  clientSecret: string
  total: number
  onSuccess: (paymentIntentId: string) => void
  onError: (message: string) => void
  returnUrl: string
}

function StripeInnerForm({ clientSecret, total, onSuccess, onError, returnUrl }: StripeInnerFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [confirming, setConfirming] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setConfirming(true)
    setFieldError(null)

    const result = await paymentService.confirmCardPayment(stripe, elements, clientSecret, returnUrl)

    setConfirming(false)

    if (result.status === 'succeeded') {
      onSuccess(result.payment_intent_id)
    } else {
      const msg = result.error ?? 'Payment failed. Please try again.'
      setFieldError(msg)
      onError(msg)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          fields: { billingDetails: { email: 'never', name: 'never' } },
        }}
      />

      {fieldError && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-xl p-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{fieldError}</span>
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        loading={confirming}
        disabled={!stripe || !elements}
        leftIcon={<Lock className="h-4 w-4" />}
      >
        {confirming ? 'Processing…' : `Pay · ${formatAmount(total)}`}
      </Button>
    </form>
  )
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

// ── Mock form (no Stripe key configured) ────────────────────────────────────

interface MockPaymentFormProps {
  total: number
  onSuccess: (paymentIntentId: string) => void
  onError: (message: string) => void
  simulateFailure?: boolean
}

function MockPaymentForm({ total, onSuccess, onError, simulateFailure }: MockPaymentFormProps) {
  const [confirming, setConfirming] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setConfirming(true)
    setFieldError(null)

    const result = await paymentService.mockConfirmPayment({ simulateFailure })

    setConfirming(false)

    if (result.status === 'succeeded') {
      onSuccess(result.payment_intent_id)
    } else {
      const msg = result.error ?? 'Payment failed.'
      setFieldError(msg)
      onError(msg)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="mock-payment-form">
      {/* Simulated card UI */}
      <div className="rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--card-hover)] p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)] mb-2">
          <CreditCard className="h-3.5 w-3.5" />
          <span>Simulated card input — mock mode active</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <div className="h-10 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] flex items-center px-3 text-sm text-[var(--fg-muted)]">
            4242 4242 4242 4242
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-10 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] flex items-center px-3 text-sm text-[var(--fg-muted)]">
              12 / 28
            </div>
            <div className="h-10 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] flex items-center px-3 text-sm text-[var(--fg-muted)]">
              123
            </div>
          </div>
        </div>
      </div>

      {fieldError && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-xl p-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{fieldError}</span>
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        size="lg"
        loading={confirming}
        leftIcon={<Lock className="h-4 w-4" />}
      >
        {confirming ? 'Processing…' : `Pay · ${formatAmount(total)}`}
      </Button>
    </form>
  )
}

// ── Public wrapper ────────────────────────────────────────────────────────────

export interface StripePaymentFormProps {
  clientSecret: string | null
  total: number
  onSuccess: (paymentIntentId: string) => void
  onError: (message: string) => void
  returnUrl?: string
  /** Set to true in tests to trigger the mock failure path */
  simulateFailure?: boolean
}

export function StripePaymentForm({
  clientSecret,
  total,
  onSuccess,
  onError,
  returnUrl = typeof window !== 'undefined' ? `${window.location.origin}/checkout/success` : '/checkout/success',
  simulateFailure,
}: StripePaymentFormProps) {
  const isMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true' || !clientSecret

  if (isMock) {
    return (
      <MockPaymentForm
        total={total}
        onSuccess={onSuccess}
        onError={onError}
        simulateFailure={simulateFailure}
      />
    )
  }

  const stripePromise = getStripe()

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: { colorPrimary: '#f97316', borderRadius: '12px' },
        },
      }}
    >
      <StripeInnerForm
        clientSecret={clientSecret}
        total={total}
        onSuccess={onSuccess}
        onError={onError}
        returnUrl={returnUrl}
      />
    </Elements>
  )
}

// Re-export status indicator for use in checkout page
export function PaymentStatusBadge({ status }: { status: 'idle' | 'loading' | 'success' | 'error' }) {
  if (status === 'idle' || status === 'loading') return null
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm rounded-xl p-3 mt-2',
        status === 'success'
          ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600'
          : 'bg-red-50 dark:bg-red-950/20 text-red-600',
      )}
    >
      {status === 'success' ? (
        <><CheckCircle2 className="h-4 w-4 shrink-0" /><span>Payment confirmed</span></>
      ) : (
        <><AlertCircle className="h-4 w-4 shrink-0" /><span>Payment could not be processed</span></>
      )}
    </div>
  )
}
