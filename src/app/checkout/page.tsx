'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Package, UtensilsCrossed, CreditCard, Banknote,
  Smartphone, Wallet, ChevronRight, Lock, ArrowLeft, CheckCircle2
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Divider } from '@/components/ui'
import { useCartStore, useBranchStore, useAuthStore, useDineInStore } from '@/stores'
import { useCreateOrder, useCreatePaymentIntent } from '@/hooks'
import { formatCurrency, cn } from '@/utils'
import { orderService } from '@/services/order.service'
import { StripePaymentForm } from '@/components/checkout/StripePaymentForm'
import toast from 'react-hot-toast'
import type { OrderType, PaymentMethod } from '@/types'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useTranslations } from 'next-intl'

// Schema messages are `validation` namespace keys (Phase E), resolved via
// `tValidation()` wherever `errors.<field>.message` is rendered below.
const checkoutSchema = z.object({
  first_name: z.string().min(2, 'required'),
  last_name: z.string().min(2, 'required'),
  email: z.string().email('invalid_email'),
  phone: z.string().min(10, 'invalid_phone'),
  street: z.string().optional(),
  city: z.string().optional(),
  table_number: z.string().optional(),
  notes: z.string().optional(),
})

type CheckoutFormData = z.infer<typeof checkoutSchema>

const VALID_ORDER_TYPES = new Set<OrderType>(['delivery', 'pickup', 'dine_in'])

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('checkout')
  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tCart = useTranslations('cart')
  const tValidation = useTranslations('validation')

  const ORDER_TYPES: { value: OrderType; label: string; icon: React.ElementType; desc: string }[] = [
    { value: 'delivery', label: t('delivery'), icon: Package, desc: t('deliveryDesc') },
    { value: 'pickup', label: t('pickup'), icon: UtensilsCrossed, desc: t('pickupDesc') },
    { value: 'dine_in', label: t('dineIn'), icon: UtensilsCrossed, desc: t('dineInDesc') },
  ]

  const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ElementType; desc: string }[] = [
    { value: 'card', label: t('card'), icon: CreditCard, desc: t('cardDesc') },
    { value: 'cash', label: t('cash'), icon: Banknote, desc: t('cashDesc') },
    { value: 'online', label: t('online'), icon: Smartphone, desc: t('onlineDesc') },
    { value: 'wallet', label: t('wallet'), icon: Wallet, desc: t('walletDesc') },
  ]

  // P4.4 — Read QR / deep-link params and use as initial state
  const paramOrderType = searchParams.get('orderType') as OrderType | null
  const paramTable = searchParams.get('table') ?? ''
  const initialOrderType: OrderType =
    paramOrderType && VALID_ORDER_TYPES.has(paramOrderType) ? paramOrderType : 'delivery'

  // P4.4 — Fallback: persisted table number from dine-in store when URL param absent
  // Must be called before any conditional returns (rules of hooks).
  const persistedTableNumber = useDineInStore((s) => s.tableNumber)

  // Priority: A) URL param, B) persisted store value, C) empty string
  const initialTableNumber = paramTable && /^\d+$/.test(paramTable)
    ? paramTable
    : persistedTableNumber !== null ? String(persistedTableNumber) : ''

  const { items, getSubtotal, getTax, getServiceCharge, getTotal, discountAmount, discountCode, clearCart } = useCartStore()
  const { activeBranch } = useBranchStore()
  const { user } = useAuthStore()
  const { mutate: createOrder, isPending } = useCreateOrder()
  const { mutateAsync: createPaymentIntent, isPending: isCreatingIntent } = useCreatePaymentIntent()

  const [orderType, setOrderType] = useState<OrderType>(initialOrderType)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [step, setStep] = useState<'details' | 'payment'>('details')

  // Card-payment state — populated after PaymentIntent creation
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [pendingFormData, setPendingFormData] = useState<CheckoutFormData | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      // P4.4 — Pre-populate table number from QR URL param
      table_number: initialTableNumber,
    },
  })

  const subtotal = getSubtotal()
  const tax = getTax()
  const serviceCharge = getServiceCharge()
  const total = getTotal()

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header />
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
          <span className="text-5xl">🛒</span>
          <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('emptyCartTitle')}</h2>
          <p className="text-[var(--fg-muted)]">{t('emptyCartDesc')}</p>
          <Link href="/menu">
            <Button leftIcon={<ArrowLeft className="h-4 w-4" />}>{tCart('browseMenu')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  /**
   * Finalises the order after payment is confirmed (or for non-card methods).
   * Called either directly from onSubmit (cash/wallet/online) or from the
   * Stripe success callback (card).
   */
  const finaliseOrder = (data: CheckoutFormData, paymentIntentId?: string) => {
    const branchId = activeBranch?.id || '1'
    const payload = {
      branch_id: branchId,
      items: orderService.fromCartItems(items),
      order_type: orderType,
      payment_method: paymentMethod,
      notes: data.notes,
      table_number: data.table_number ? parseInt(data.table_number) : undefined,
      delivery_address: orderType === 'delivery' ? {
        street: data.street || '',
        city: data.city || '',
      } : undefined,
      discount_code: discountCode || undefined,
      ...(paymentIntentId ? { payment_intent_id: paymentIntentId } : {}),
    }

    createOrder(payload as Parameters<typeof createOrder>[0], {
      onSuccess: (order) => {
        clearCart()
        toast.success(t('orderPlacedSuccess'))
        router.push(`/checkout/success?orderId=${order.id}&orderNumber=${order.order_number}`)
      },
      onError: () => {
        toast.error(t('orderPlaceFailed'))
        router.push('/checkout/failure')
      },
    })
  }

  /**
   * Form submit handler.
   * — card: creates PaymentIntent → transitions to Stripe form render
   * — non-card: calls createOrder directly (unchanged behaviour)
   */
  const onSubmit = async (data: CheckoutFormData) => {
    if (paymentMethod === 'card') {
      setPendingFormData(data)
      setPaymentError(null)
      try {
        const intent = await createPaymentIntent({
          amount: total,
          currency: 'usd',
          order_description: `Order for ${data.first_name} ${data.last_name}`,
          branch_id: activeBranch?.id || '1',
        })
        setClientSecret(intent.client_secret)
      } catch {
        toast.error(t('couldNotInitPayment'))
        setPaymentError(t('couldNotInitPayment'))
      }
    } else {
      finaliseOrder(data)
    }
  }

  const handlePaymentSuccess = (paymentIntentId: string) => {
    if (!pendingFormData) return
    finaliseOrder(pendingFormData, paymentIntentId)
  }

  const handlePaymentError = (message: string) => {
    setPaymentError(message)
    toast.error(message)
  }

  const showStripeForm = paymentMethod === 'card' && clientSecret !== null

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <div className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 flex items-center gap-4">
            <Link href="/menu">
              <Button variant="ghost" size="icon-sm" aria-label={t('backToMenuAria')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">{t('title')}</h1>
              <p className="text-sm text-[var(--fg-muted)]">{t('itemsCountTotal', { count: items.length, total: formatCurrency(total) })}</p>
            </div>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-3 mb-8">
            {(['details', 'payment'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className={cn('flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all', step === s ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : i < ['details','payment'].indexOf(step) ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600' : 'bg-[var(--card)] border border-[var(--border)] text-[var(--fg-muted)]')}>
                  {i < ['details','payment'].indexOf(step) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-4 w-4 rounded-full border-2 border-current flex items-center justify-center text-[10px]">{i + 1}</span>}
                  <span>{s === 'details' ? t('stepDetails') : t('stepPayment')}</span>
                </div>
                {i < 1 && <ChevronRight className="h-4 w-4 text-[var(--fg-subtle)]" />}
              </div>
            ))}
          </div>

          {/* P4.4 — Dine-in context banner when arriving from QR scan */}
          {initialOrderType === 'dine_in' && initialTableNumber && (
            <div className="mb-6 flex items-center gap-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-2xl px-5 py-3 text-sm text-orange-700 dark:text-orange-300">
              <UtensilsCrossed className="h-4 w-4 shrink-0" />
              <span>{t('dineInBanner', { table: initialTableNumber })}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Form */}
            <div className="lg:col-span-2 space-y-6">
              <AnimatePresence mode="wait">
                {/* ── Step 1: Details ── */}
                {step === 'details' && (
                  <motion.div key="details" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                    {/* Order Type */}
                    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
                      <h2 className="font-semibold text-[var(--fg)] mb-4">{t('orderType')}</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {ORDER_TYPES.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setOrderType(type.value)}
                            className={cn(
                              'flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all',
                              orderType === type.value
                                ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                                : 'border-[var(--border)] hover:border-orange-200',
                            )}
                          >
                            <type.icon className={cn('h-5 w-5', orderType === type.value ? 'text-orange-500' : 'text-[var(--fg-muted)]')} />
                            <span className={cn('text-sm font-medium', orderType === type.value ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--fg)]')}>{type.label}</span>
                            <span className="text-xs text-[var(--fg-muted)]">{type.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
                      <h2 className="font-semibold text-[var(--fg)] mb-4">{t('contactInformation')}</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input label={tAuth('firstName')} required {...register('first_name')} error={errors.first_name?.message ? tValidation(errors.first_name.message) : undefined} />
                        <Input label={tAuth('lastName')} required {...register('last_name')} error={errors.last_name?.message ? tValidation(errors.last_name.message) : undefined} />
                        <Input label={tAuth('email')} type="email" required {...register('email')} error={errors.email?.message ? tValidation(errors.email.message) : undefined} />
                        <Input label={tAuth('phone')} type="tel" required {...register('phone')} error={errors.phone?.message ? tValidation(errors.phone.message) : undefined} />
                      </div>
                    </div>

                    {/* Delivery Address */}
                    <AnimatePresence>
                      {orderType === 'delivery' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
                          <h2 className="font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-orange-500" /> {t('deliveryAddress')}
                          </h2>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                              <Input label={t('streetAddress')} required={orderType === 'delivery'} {...register('street')} error={errors.street?.message} placeholder={t('streetAddressPlaceholder')} />
                            </div>
                            <Input label={t('city')} required={orderType === 'delivery'} {...register('city')} error={errors.city?.message} />
                          </div>
                        </motion.div>
                      )}
                      {orderType === 'dine_in' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
                          <h2 className="font-semibold text-[var(--fg)] mb-4">{t('tableNumber')}</h2>
                          <Input label={t('tableNumber')} type="number" {...register('table_number')} placeholder={t('tableNumberPlaceholder')} />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Notes */}
                    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
                      <h2 className="font-semibold text-[var(--fg)] mb-4">{t('notes')}</h2>
                      <textarea
                        {...register('notes')}
                        rows={3}
                        placeholder={t('notesPlaceholder')}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                      />
                    </div>

                    <Button type="button" className="w-full" size="lg" rightIcon={<ChevronRight className="h-4 w-4" />} onClick={() => setStep('payment')}>
                      {t('continueToPayment')}
                    </Button>
                  </motion.div>
                )}

                {/* ── Step 2: Payment ── */}
                {step === 'payment' && (
                  <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">

                    {!showStripeForm && (
                      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
                        <h2 className="font-semibold text-[var(--fg)] mb-4">{t('paymentMethod')}</h2>
                        <div className="space-y-3">
                          {PAYMENT_METHODS.map((method) => (
                            <button
                              key={method.value}
                              type="button"
                              onClick={() => {
                                setPaymentMethod(method.value)
                                setClientSecret(null)
                                setPaymentError(null)
                              }}
                              className={cn(
                                'flex items-center gap-4 w-full p-4 rounded-xl border-2 text-start transition-all',
                                paymentMethod === method.value
                                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                                  : 'border-[var(--border)] hover:border-orange-200',
                              )}
                            >
                              <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', paymentMethod === method.value ? 'bg-orange-500/20' : 'bg-[var(--card-hover)]')}>
                                <method.icon className={cn('h-5 w-5', paymentMethod === method.value ? 'text-orange-500' : 'text-[var(--fg-muted)]')} />
                              </div>
                              <div className="flex-1">
                                <p className={cn('text-sm font-medium', paymentMethod === method.value ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--fg)]')}>{method.label}</p>
                                <p className="text-xs text-[var(--fg-muted)]">{method.desc}</p>
                              </div>
                              <div className={cn('h-4 w-4 rounded-full border-2 transition-all', paymentMethod === method.value ? 'border-orange-500 bg-orange-500' : 'border-[var(--border-strong)]')}>
                                {paymentMethod === method.value && <div className="h-full w-full rounded-full bg-white scale-50" />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {showStripeForm && (
                      <motion.div
                        key="stripe-form"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="font-semibold text-[var(--fg)] flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-orange-500" /> {t('cardPayment')}
                          </h2>
                          <button
                            type="button"
                            onClick={() => { setClientSecret(null); setPaymentError(null) }}
                            className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] underline"
                          >
                            {t('changeMethod')}
                          </button>
                        </div>
                        <StripePaymentForm
                          clientSecret={clientSecret}
                          total={total}
                          onSuccess={handlePaymentSuccess}
                          onError={handlePaymentError}
                        />
                      </motion.div>
                    )}

                    {paymentError && !showStripeForm && (
                      <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/20 rounded-xl p-3">
                        {paymentError}
                      </div>
                    )}

                    {!showStripeForm && (
                      <form onSubmit={handleSubmit(onSubmit)}>
                        <div className="flex gap-3">
                          <Button type="button" variant="secondary" onClick={() => setStep('details')} leftIcon={<ArrowLeft className="h-4 w-4" />}>
                            {tCommon('back')}
                          </Button>
                          <Button
                            type="submit"
                            className="flex-1"
                            size="lg"
                            loading={isPending || isCreatingIntent}
                            leftIcon={<Lock className="h-4 w-4" />}
                          >
                            {paymentMethod === 'card'
                              ? isCreatingIntent ? t('preparingPayment') : t('payWithCard', { total: formatCurrency(total) })
                              : isPending ? t('placingOrder') : t('placeOrderWithTotal', { total: formatCurrency(total) })}
                          </Button>
                        </div>
                      </form>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: Order Summary */}
            <div className="space-y-4">
              <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 sticky top-24">
                <h2 className="font-semibold text-[var(--fg)] mb-4">{t('orderSummary')}</h2>

                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3 items-start">
                      <div className="relative h-12 w-12 rounded-xl overflow-hidden shrink-0 bg-[var(--card-hover)]">
                        <Image src={item.menu_item.image} alt={item.menu_item.name} fill className="object-cover" sizes="48px" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--fg)] truncate">{item.menu_item.name}</p>
                        {item.extras.length > 0 && <p className="text-xs text-[var(--fg-muted)]">+{item.extras.map(e => e.name).join(', ')}</p>}
                        <p className="text-xs text-[var(--fg-muted)]">×{item.quantity}</p>
                      </div>
                      <span className="text-sm font-medium text-[var(--fg)] shrink-0">{formatCurrency(item.total_price)}</span>
                    </div>
                  ))}
                </div>

                <Divider className="my-4" />

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between text-[var(--fg-muted)]"><span>{tCart('subtotal')}</span><span>{formatCurrency(subtotal)}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-emerald-600"><span>{tCart('discount')}</span><span>−{formatCurrency(discountAmount)}</span></div>}
                  <div className="flex justify-between text-[var(--fg-muted)]"><span>{tCart('tax')}</span><span>{formatCurrency(tax)}</span></div>
                  <div className="flex justify-between text-[var(--fg-muted)]"><span>{tCart('serviceCharge')}</span><span>{formatCurrency(serviceCharge)}</span></div>
                  <Divider />
                  <div className="flex justify-between font-bold text-[var(--fg)] text-base">
                    <span>{tCart('total')}</span><span>{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-[var(--fg-muted)] bg-[var(--card-hover)] rounded-xl p-3">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  <span>{t('secureNote')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <ErrorBoundary feature="Checkout">
      <Suspense>
        <CheckoutContent />
      </Suspense>
    </ErrorBoundary>
  )
}
