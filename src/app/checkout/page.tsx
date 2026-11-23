'use client'

import { useState, Suspense, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, Package, UtensilsCrossed, CreditCard,
  ChevronRight, Lock, ArrowLeft, CheckCircle2
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Divider } from '@/components/ui'
import { useCartStore, useCartHasHydrated, useBranchStore, useAuthStore, useDineInStore } from '@/stores'
import { useCreateOrder, useCreatePaymentIntent, useCheckServiceability } from '@/hooks'
import { cn } from '@/utils'
import { useMoney } from '@/hooks/use-money'
import { useQuery } from '@tanstack/react-query'
import { balanceIn, walletService } from '@/services/wallet.service'
import { orderService } from '@/services/order.service'
import { StripePaymentForm } from '@/components/checkout/StripePaymentForm'
import { AddressPicker, DeliveryInfoCard, type AddressPickerValue } from '@/components/address'
import toast from 'react-hot-toast'
import type { PaymentMethod } from '@/types'
import type { CheckServiceabilityPayload } from '@/types/address'
import {
  getCheckoutOrderTypeOptions,
  getCheckoutPaymentOptions,
  resolveCheckoutOrderWireType,
  resolveCheckoutPaymentWireMethod,
  findCheckoutOrderTypeOption,
  getCheckoutOrderTypeLabel,
  getCheckoutOrderTypeDesc,
  getCheckoutOrderTypeIcon,
  getCheckoutPaymentLabel,
  getCheckoutPaymentDesc,
  getCheckoutPaymentIcon,
  resolveEffectiveMinimumOrder,
  resolveBranchCurrencyCode,
  resolvePaymentCurrencyCode,
  isBelowMinimumOrder,
  isDeliveryBlockedByServiceability,
  isCheckoutOrderingEnabled,
} from '@/lib/branch-checkout'
import {
  getActiveCartContext,
  isActiveCartCheckoutEnabled,
  resolveCartMenuUrl,
  resolveCheckoutBranchId,
} from '@/lib/active-cart'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { AuthModal } from '@/components/auth/AuthModal'
import { useTranslations } from 'next-intl'
import { checkoutSchema, type CheckoutFormData } from '@/lib/checkout-form'

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('checkout')
  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const tCart = useTranslations('cart')
  const tValidation = useTranslations('validation')
  const tAddressServiceability = useTranslations('address.serviceability')

  // P4.4 — Read QR / deep-link params and use as initial state
  const paramOrderType = searchParams.get('orderType')
  const paramTable = searchParams.get('table') ?? ''

  const { items, getSubtotal, getTax, getServiceCharge, getTotal, discountAmount, discountCode, clearCart, ownership } = useCartStore()
  const cartHasHydrated = useCartHasHydrated()
  const { activeBranch } = useBranchStore()
  const cartContext = getActiveCartContext(items, ownership)
  const cartBranchId = resolveCheckoutBranchId(items, ownership)
  const checkoutConfig =
    cartContext?.checkout ??
    (activeBranch?.id === cartBranchId ? activeBranch.checkout : undefined)
  const orderingAvailable = isActiveCartCheckoutEnabled(cartContext) && (
    checkoutConfig ? isCheckoutOrderingEnabled(checkoutConfig) : true
  )

  const orderTypeOptions = useMemo(
    () =>
      getCheckoutOrderTypeOptions(checkoutConfig).map((opt) => ({
        ...opt,
        label: getCheckoutOrderTypeLabel(opt.wireType, t),
        desc: getCheckoutOrderTypeDesc(opt.wireType, t),
        icon: getCheckoutOrderTypeIcon(opt.wireType),
      })),
    [checkoutConfig, t],
  )

  const { user, isAuthenticated } = useAuthStore()
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const { mutate: createOrder, isPending } = useCreateOrder()
  const { mutateAsync: createPaymentIntent, isPending: isCreatingIntent } = useCreatePaymentIntent()

  // Resolve defaults only on checkout/branch/param change — never during render (random fallback).
  const [orderType, setOrderType] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [step, setStep] = useState<'details' | 'payment'>('details')

  useEffect(() => {
    setOrderType(resolveCheckoutOrderWireType(checkoutConfig, paramOrderType))
  }, [checkoutConfig, paramOrderType, cartBranchId])

  // P4.4 — Fallback: persisted table number from dine-in store when URL param absent
  const persistedTableNumber = useDineInStore((s) => s.tableNumber)
  const initialTableNumber = paramTable && /^\d+$/.test(paramTable)
    ? paramTable
    : persistedTableNumber !== null ? String(persistedTableNumber) : ''

  const paymentMethodOptions = useMemo(
    () =>
      getCheckoutPaymentOptions(checkoutConfig, orderType).map((opt) => ({
        ...opt,
        label: getCheckoutPaymentLabel(opt.wireMethod, t),
        desc: getCheckoutPaymentDesc(opt.wireMethod, t),
        icon: getCheckoutPaymentIcon(opt.wireMethod),
      })),
    [checkoutConfig, orderType, t],
  )

  const selectedOrderOption = useMemo(
    () => findCheckoutOrderTypeOption(checkoutConfig, orderType),
    [checkoutConfig, orderType],
  )

  // Card-payment state — populated after PaymentIntent creation
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [pendingFormData, setPendingFormData] = useState<CheckoutFormData | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [addressPicker, setAddressPicker] = useState<AddressPickerValue>({ mode: 'saved' })

  const serviceabilityPayload: CheckServiceabilityPayload | null =
    selectedOrderOption?.requiresDeliveryAddress && cartBranchId
      ? addressPicker.mode === 'saved' && addressPicker.addressId
        ? { branch_id: cartBranchId, address_id: addressPicker.addressId }
        : addressPicker.mode === 'temporary' && addressPicker.temporaryAddress
          ? {
              branch_id: cartBranchId,
              delivery_address: {
                street: addressPicker.temporaryAddress.street,
                city: addressPicker.temporaryAddress.city,
                province: addressPicker.temporaryAddress.province,
                district: addressPicker.temporaryAddress.district,
                building_number: addressPicker.temporaryAddress.building_number,
                unit: addressPicker.temporaryAddress.unit,
                floor: addressPicker.temporaryAddress.floor,
                postal_code: addressPicker.temporaryAddress.postal_code,
                phone: addressPicker.temporaryAddress.phone,
                delivery_notes: addressPicker.temporaryAddress.delivery_notes,
                latitude: addressPicker.temporaryAddress.latitude,
                longitude: addressPicker.temporaryAddress.longitude,
              },
              latitude: addressPicker.temporaryAddress.latitude ?? undefined,
              longitude: addressPicker.temporaryAddress.longitude ?? undefined,
            }
          : null
      : null

  const { data: serviceability, isLoading: serviceabilityLoading } = useCheckServiceability(serviceabilityPayload)

  useEffect(() => {
    setPaymentMethod((current) => {
      const wires = paymentMethodOptions.map((m) => m.wireMethod)
      if (current && wires.includes(current)) return current
      return resolveCheckoutPaymentWireMethod(checkoutConfig, orderType)
    })
  }, [paymentMethodOptions, checkoutConfig, orderType, cartBranchId])

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email ?? '',
      phone_number: user?.phone_number || '',
      // P4.4 — Pre-populate table number from QR URL param
      table_number: initialTableNumber,
    },
  })

  useEffect(() => {
    if (!user) return
    if (user.first_name) setValue('first_name', user.first_name)
    if (user.last_name) setValue('last_name', user.last_name)
    if (user.email) setValue('email', user.email)
    if (user.phone_number) setValue('phone_number', user.phone_number)
  }, [user, setValue])

  const subtotal = getSubtotal()
  const tax = getTax()
  const serviceCharge = getServiceCharge()
  const total = getTotal()

  const branchCurrency = resolveBranchCurrencyCode(
    cartContext?.currency ?? (activeBranch?.id === cartBranchId ? activeBranch.currency : undefined),
  )
  const paymentCurrency = resolvePaymentCurrencyCode(
    cartContext?.currency ?? (activeBranch?.id === cartBranchId ? activeBranch.currency : undefined),
  )
  const minimumOrderAmount = resolveEffectiveMinimumOrder(serviceability, checkoutConfig)
  const money = useMoney()
  const tCurrency = useTranslations('currencyDisplay')
  // Everything in the visitor's currency; the order is charged in branchCurrency.
  const summary = money.cartSummary(items, { subtotal, total, discount: discountAmount, tax, serviceCharge }, branchCurrency)
  const formatCurrency = (amount: number | string | null | undefined, currency?: string) => money.format(amount, currency || branchCurrency)
  // Wallet: the order is charged in branchCurrency, so that balance must cover it.
  const tWallet = useTranslations('wallet')
  const walletOffered = paymentMethodOptions.some((m) => m.wireMethod === 'wallet')
  const { data: walletAccounts } = useQuery({
    queryKey: ['wallet', 'mine'],
    queryFn: () => walletService.mine(),
    enabled: walletOffered,
  })
  const walletBalance = balanceIn(walletAccounts, branchCurrency)
  const walletInsufficient = walletBalance < total
  const walletBalanceLabel = money.formatIn(walletBalance, branchCurrency)

  const hasDeliveryAddress =
    !!selectedOrderOption?.requiresDeliveryAddress &&
    ((addressPicker.mode === 'saved' && !!addressPicker.addressId) ||
      (addressPicker.mode === 'temporary' && !!addressPicker.temporaryAddress))

  const deliveryBlocked = isDeliveryBlockedByServiceability(
    orderType,
    serviceability,
    serviceabilityLoading,
    hasDeliveryAddress,
    checkoutConfig,
  )

  const belowMinimum =
    !!selectedOrderOption?.requiresDeliveryAddress &&
    isBelowMinimumOrder(subtotal, minimumOrderAmount)

  const canContinueToPayment =
    !(selectedOrderOption?.requiresDeliveryAddress && !hasDeliveryAddress) &&
    !deliveryBlocked &&
    !belowMinimum

  const canPlaceOrder = canContinueToPayment

  useEffect(() => {
    if (!cartHasHydrated || isAuthenticated) return
    setAuthModalOpen(true)
  }, [cartHasHydrated, isAuthenticated])

  const ensureAuthenticated = () => {
    if (isAuthenticated) return true
    toast.error(tAuth('enterPhoneToContinue'))
    return false
  }

  // SSR + first client paint: identical shell until localStorage cart rehydrates.
  // Do not treat an empty in-memory cart as "empty cart" before hydration.
  if (!cartHasHydrated) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header />
        <div
          className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4"
          aria-busy="true"
          aria-live="polite"
        >
          <p className="text-[var(--fg-muted)]">{tCommon('loading')}</p>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header />
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
          <span className="text-5xl">🛒</span>
          <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('emptyCartTitle')}</h2>
          <p className="text-[var(--fg-muted)]">{t('emptyCartDesc')}</p>
          <Link href={resolveCartMenuUrl(cartContext)}>
            <Button leftIcon={<ArrowLeft className="h-4 w-4"/>}>{tCart('browseMenu')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Cart ownership is the source of truth for which branch receives the order.
  // Current route/activeBranch must never silently redirect a cart to another branch.
  if (!cartBranchId) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header />
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
          <MapPin className="h-12 w-12 text-[var(--fg-subtle)]"/>
          <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('noBranchSelectedTitle')}</h2>
          <p className="text-[var(--fg-muted)]">{t('noBranchSelectedDesc')}</p>
          <Link href={resolveCartMenuUrl(cartContext)}>
            <Button leftIcon={<ArrowLeft className="h-4 w-4"/>}>{tCart('browseMenu')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!orderingAvailable) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header />
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
          <Package className="h-12 w-12 text-[var(--fg-subtle)]"/>
          <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('orderingDisabledTitle')}</h2>
          <p className="text-[var(--fg-muted)]">{t('orderingDisabledDesc')}</p>
          <Link href={resolveCartMenuUrl(cartContext)}>
            <Button leftIcon={<ArrowLeft className="h-4 w-4"/>}>{tCart('browseMenu')}</Button>
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
    if (!ensureAuthenticated()) return
    if (!cartBranchId) {
      toast.error(t('noBranchSelectedDesc'))
      return
    }
    if (!canPlaceOrder) {
      if (deliveryBlocked) {
        toast.error(t('cannotDeliverHere'))
        return
      }
      if (belowMinimum) {
        toast.error(tAddressServiceability('minimumOrder', { amount: formatCurrency(minimumOrderAmount ?? 0, branchCurrency) }))
        return
      }
      if (selectedOrderOption?.requiresDeliveryAddress && !hasDeliveryAddress) {
        toast.error(t('deliveryAddress'))
        return
      }
    }
    const payload = {
      branch_id: cartBranchId,
      items: orderService.fromCartItems(items),
      order_type: orderType,
      payment_method: paymentMethod as PaymentMethod,
      notes: data.notes,
      table_number: data.table_number ? parseInt(data.table_number) : undefined,
      ...(selectedOrderOption?.requiresDeliveryAddress && addressPicker.mode === 'saved' && addressPicker.addressId
        ? {
            address_id: addressPicker.addressId,
            ...(addressPicker.override && Object.keys(addressPicker.override).length > 0
              ? { delivery_address_override: addressPicker.override }
              : {}),
          }
        : {}),
      ...(selectedOrderOption?.requiresDeliveryAddress && addressPicker.mode === 'temporary' && addressPicker.temporaryAddress
        ? {
            delivery_address: {
              street: addressPicker.temporaryAddress.street,
              city: addressPicker.temporaryAddress.city,
              province: addressPicker.temporaryAddress.province,
              district: addressPicker.temporaryAddress.district,
              building_number: addressPicker.temporaryAddress.building_number,
              unit: addressPicker.temporaryAddress.unit,
              floor: addressPicker.temporaryAddress.floor,
              postal_code: addressPicker.temporaryAddress.postal_code,
              phone: addressPicker.temporaryAddress.phone,
              delivery_notes: addressPicker.temporaryAddress.delivery_notes,
              latitude: addressPicker.temporaryAddress.latitude,
              longitude: addressPicker.temporaryAddress.longitude,
            },
          }
        : {}),
      discount_code: discountCode || undefined,
      // Recorded on the order with the rates used (it is charged in branchCurrency).
      ...(summary.converted ? { display_currency: summary.currency } : {}),
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
    if (!ensureAuthenticated()) return
    if (!cartBranchId) {
      toast.error(t('noBranchSelectedDesc'))
      return
    }
    if (!canPlaceOrder) {
      if (deliveryBlocked) toast.error(t('cannotDeliverHere'))
      else if (belowMinimum) toast.error(tAddressServiceability('minimumOrder', { amount: formatCurrency(minimumOrderAmount ?? 0, branchCurrency) }))
      else if (selectedOrderOption?.requiresDeliveryAddress && !hasDeliveryAddress) toast.error(t('deliveryAddress'))
      return
    }
    if (paymentMethod === 'card') {
      setPendingFormData(data)
      setPaymentError(null)
      try {
        const intent = await createPaymentIntent({
          amount: total,
          currency: paymentCurrency,
          order_description: `Order for ${data.first_name} ${data.last_name}`,
          branch_id: cartBranchId,
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
    <div className="min-h-screen bg-[var(--bg)]" data-testid="checkout-page">
      <Header />
      <div className="pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 flex items-center gap-4">
            <Link href={resolveCartMenuUrl(cartContext)}>
              <Button variant="ghost"size="icon-sm"aria-label={t('backToMenuAria')}>
                <ArrowLeft className="h-4 w-4"/>
              </Button>
            </Link>
            <div>
              <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">{t('title')}</h1>
              <p className="text-sm text-[var(--fg-muted)]">{t('itemsCountTotal', { count: items.length, total: summary.total })}</p>
            </div>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-3 mb-8">
            {(['details', 'payment'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className={cn('flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all', step === s ? 'bg-[var(--accent)] text-[var(--accent-fg)] shadow-lg shadow-[var(--accent)]/30' : i < ['details','payment'].indexOf(step) ? 'bg-[var(--success-subtle)] text-[var(--success-text)]' : 'bg-[var(--card)] border border-[var(--border)] text-[var(--fg-muted)]')}>
                  {i < ['details','payment'].indexOf(step) ? <CheckCircle2 className="h-3.5 w-3.5"/> : <span className="h-4 w-4 rounded-full border-2 border-current flex items-center justify-center text-[10px]">{i + 1}</span>}
                  <span>{s === 'details' ? t('stepDetails') : t('stepPayment')}</span>
                </div>
                {i < 1 && <ChevronRight className="h-4 w-4 text-[var(--fg-subtle)]"/>}
              </div>
            ))}
          </div>

          {/* P4.4 — Dine-in context banner when arriving from QR scan */}
          {findCheckoutOrderTypeOption(checkoutConfig, orderType || paramOrderType || '')?.requiresTableNumber && initialTableNumber && (
            <div className="mb-6 flex items-center gap-3 bg-[var(--accent-subtle)] border border-[var(--accent-border)]/40 rounded-2xl px-5 py-3 text-sm text-[var(--accent-text)]">
              <UtensilsCrossed className="h-4 w-4 shrink-0"/>
              <span>{t('dineInBanner', { table: initialTableNumber })}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Form */}
            <div className="lg:col-span-2 space-y-6">
              <AnimatePresence mode="wait">
                {/* ── Step 1: Details ── */}
                {step === 'details' && (
                  <motion.div key="details"initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                    {/* Order Type */}
                    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
                      <h2 className="font-semibold text-[var(--fg)] mb-4">{t('orderType')}</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {orderTypeOptions.map((type) => (
                          <button
                            key={type.wireType}
                            type="button"
                            onClick={() => setOrderType(type.wireType)}
                            className={cn(
                              'flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all',
                              orderType === type.wireType
                                ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)]'
                                : 'border-[var(--border)] hover:border-[var(--accent-border)]/50',
                            )}
                          >
                            <type.icon className={cn('h-5 w-5', orderType === type.wireType ? 'text-[var(--accent-text)]' : 'text-[var(--fg-muted)]')} />
                            <span className={cn('text-sm font-medium', orderType === type.wireType ? 'text-[var(--accent-text)]' : 'text-[var(--fg)]')}>{type.label}</span>
                            {type.desc ? <span className="text-xs text-[var(--fg-muted)]">{type.desc}</span> : null}
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
                        <Input label={tAuth('email')} type="email" {...register('email')} error={errors.email?.message ? tValidation(errors.email.message) : undefined} />
                        <Input label={tAuth('phone_number')} type="tel"required {...register('phone_number')} error={errors.phone_number?.message ? tValidation(errors.phone_number.message) : undefined} />
                      </div>
                    </div>

                    {/* Delivery Address */}
                    <AnimatePresence>
                      {selectedOrderOption?.requiresDeliveryAddress && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 space-y-4">
                          <h2 className="font-semibold text-[var(--fg)] flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[var(--accent-text)]"/> {t('deliveryAddress')}
                          </h2>
                          <AddressPicker value={addressPicker} onChange={setAddressPicker} />
                          {serviceabilityLoading && (
                            <p className="text-sm text-[var(--fg-muted)]">{t('checkingServiceability')}</p>
                          )}
                          {serviceability && <DeliveryInfoCard result={serviceability} checkout={checkoutConfig} />}
                          {serviceability && !serviceability.deliverable && (
                            <p className="text-sm text-[var(--warning-text)]"role="alert">{t('cannotDeliverHere')}</p>
                          )}
                        </motion.div>
                      )}
                      {selectedOrderOption?.requiresTableNumber && (
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
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40 focus:border-[var(--focus-ring)] transition-all"
                      />
                    </div>

                    {isAuthenticated ? (
                    <Button
                      type="button"
                      className="w-full"
                      size="lg"
                      rightIcon={<ChevronRight className="h-4 w-4"/>}
                      disabled={!canContinueToPayment}
                      onClick={() => {
                        if (!canContinueToPayment) return
                        setStep('payment')
                      }}
                    >
                      {t('continueToPayment')}
                    </Button>
                    ) : (
                    <Button
                      type="button"
                      className="w-full"
                      size="lg"
                      onClick={() => setAuthModalOpen(true)}
                    >
                      {tAuth('signInArrow')}
                    </Button>
                    )}
                  </motion.div>
                )}

                {/* ── Step 2: Payment ── */}
                {step === 'payment' && (
                  <motion.div key="payment"initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">

                    {!showStripeForm && (
                      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
                        <h2 className="font-semibold text-[var(--fg)] mb-4">{t('paymentMethod')}</h2>
                        <div className="space-y-3">
                          {paymentMethodOptions.map((method) => (
                            <button
                              key={method.wireMethod}
                              type="button"
                              disabled={method.wireMethod === 'wallet' && walletInsufficient}
                              onClick={() => {
                                setPaymentMethod(method.wireMethod)
                                setClientSecret(null)
                                setPaymentError(null)
                              }}
                              className={cn(
                                'flex items-center gap-4 w-full p-4 rounded-xl border-2 text-start transition-all disabled:cursor-not-allowed disabled:opacity-60',
                                paymentMethod === method.wireMethod
                                  ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)]'
                                  : 'border-[var(--border)] hover:border-[var(--accent-border)]/50',
                              )}
                            >
                              <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', paymentMethod === method.wireMethod ? 'bg-[var(--accent)]/20' : 'bg-[var(--card-hover)]')}>
                                <method.icon className={cn('h-5 w-5', paymentMethod === method.wireMethod ? 'text-[var(--accent-text)]' : 'text-[var(--fg-muted)]')} />
                              </div>
                              <div className="flex-1">
                                <p className={cn('text-sm font-medium', paymentMethod === method.wireMethod ? 'text-[var(--accent-text)]' : 'text-[var(--fg)]')}>{method.label}</p>
                                {method.wireMethod === 'wallet' ? (
                                  <p className={cn('text-xs', walletInsufficient ? 'text-[var(--danger-text)]' : 'text-[var(--fg-muted)]')}>
                                    {walletInsufficient
                                      ? tWallet('checkoutInsufficient', { amount: walletBalanceLabel })
                                      : tWallet('checkoutBalance', { amount: walletBalanceLabel })}
                                  </p>
                                ) : method.desc ? (
                                  <p className="text-xs text-[var(--fg-muted)]">{method.desc}</p>
                                ) : null}
                              </div>
                              <div className={cn('h-4 w-4 rounded-full border-2 transition-all', paymentMethod === method.wireMethod ? 'border-[var(--accent-border)] bg-[var(--accent)]' : 'border-[var(--border-strong)]')}>
                                {paymentMethod === method.wireMethod && <div className="h-full w-full rounded-full bg-[var(--card)] scale-50"/>}
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
                            <CreditCard className="h-4 w-4 text-[var(--accent-text)]"/> {t('cardPayment')}
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
                      <div className="text-sm text-[var(--danger-text)] bg-[var(--danger-subtle)] rounded-xl p-3">
                        {paymentError}
                      </div>
                    )}

                    {!showStripeForm && (
                      <form onSubmit={handleSubmit(onSubmit)}>
                        <div className="flex gap-3">
                          <Button type="button"variant="secondary"onClick={() => setStep('details')} leftIcon={<ArrowLeft className="h-4 w-4"/>}>
                            {tCommon('back')}
                          </Button>
                          <Button
                            type="submit"
                            className="flex-1"
                            size="lg"
                            loading={isPending || isCreatingIntent}
                            disabled={!canPlaceOrder}
                            leftIcon={<Lock className="h-4 w-4"/>}
                          >
                            {paymentMethod === 'card'
                              ? isCreatingIntent ? t('preparingPayment') : t('payWithCard', { total: summary.total })
                              : isPending ? t('placingOrder') : t('placeOrderWithTotal', { total: summary.total })}
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

                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto scrollbar-thin">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3 items-start">
                      <div className="relative h-12 w-12 rounded-xl overflow-hidden shrink-0 bg-[var(--card-hover)]">
                        <Image src={item.menu_item.image} alt={item.menu_item.name} fill className="object-cover"sizes="48px"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--fg)] truncate">{item.menu_item.name}</p>
                        {item.extras.length > 0 && <p className="text-xs text-[var(--fg-muted)]">+{item.extras.map(e => e.name).join(', ')}</p>}
                        <p className="text-xs text-[var(--fg-muted)]">×{item.quantity}</p>
                      </div>
                      <span className="text-sm font-medium text-[var(--fg)] shrink-0">{summary.lineLabel(items.indexOf(item))}</span>
                    </div>
                  ))}
                </div>

                <Divider className="my-4"/>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between text-[var(--fg-muted)]"><span>{tCart('subtotal')}</span><span>{summary.subtotal}</span></div>
                  {belowMinimum && minimumOrderAmount != null && (
                    <p className="text-[var(--warning-text)] text-xs"role="alert">
                      {tAddressServiceability('minimumOrder', { amount: formatCurrency(minimumOrderAmount, branchCurrency) })}
                    </p>
                  )}
                  {discountAmount > 0 && <div className="flex justify-between text-[var(--success-text)]"><span>{tCart('discount')}</span><span>−{summary.discount}</span></div>}
                  <div className="flex justify-between text-[var(--fg-muted)]"><span>{tCart('tax')}</span><span>{summary.tax}</span></div>
                  <div className="flex justify-between text-[var(--fg-muted)]"><span>{tCart('serviceCharge')}</span><span>{summary.serviceCharge}</span></div>
                  <Divider />
                  <div className="flex justify-between font-bold text-[var(--fg)] text-base">
                    <span>{tCart('total')}</span><span>{summary.total}</span>
                  </div>
                  {summary.converted && (
                    <p className="text-xs text-[var(--fg-muted)]">
                      {tCurrency('chargedNote', { currency: summary.sourceCurrency, amount: summary.charged })}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-[var(--fg-muted)] bg-[var(--card-hover)] rounded-xl p-3">
                  <Lock className="h-3.5 w-3.5 shrink-0"/>
                  <span>{t('secureNote')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => setAuthModalOpen(false)}
      />
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
