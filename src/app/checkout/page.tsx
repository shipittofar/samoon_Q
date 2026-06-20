'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { useCartStore, useBranchStore, useAuthStore } from '@/stores'
import { useCreateOrder } from '@/hooks'
import { formatCurrency, cn } from '@/utils'
import { orderService } from '@/services/order.service'
import toast from 'react-hot-toast'
import type { OrderType, PaymentMethod } from '@/types'

const checkoutSchema = z.object({
  first_name: z.string().min(2, 'First name is required'),
  last_name: z.string().min(2, 'Last name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(10, 'Valid phone required'),
  street: z.string().optional(),
  city: z.string().optional(),
  table_number: z.string().optional(),
  notes: z.string().optional(),
})

type CheckoutFormData = z.infer<typeof checkoutSchema>

const ORDER_TYPES: { value: OrderType; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'delivery', label: 'Delivery', icon: Package, desc: 'Delivered to your address' },
  { value: 'pickup', label: 'Pickup', icon: UtensilsCrossed, desc: 'Pick up at the restaurant' },
  { value: 'dine_in', label: 'Dine In', icon: UtensilsCrossed, desc: 'Order at your table' },
]

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'card', label: 'Credit / Debit Card', icon: CreditCard, desc: 'Visa, Mastercard, Amex' },
  { value: 'cash', label: 'Cash on Delivery', icon: Banknote, desc: 'Pay when you receive' },
  { value: 'online', label: 'Online Payment', icon: Smartphone, desc: 'PayPal, Apple Pay, Google Pay' },
  { value: 'wallet', label: 'Wallet Balance', icon: Wallet, desc: 'Use your Savor credits' },
]

export default function CheckoutPage() {
  const router = useRouter()
  const { items, getSubtotal, getTax, getServiceCharge, getTotal, discountAmount, discountCode, clearCart } = useCartStore()
  const { activeBranch } = useBranchStore()
  const { user } = useAuthStore()
  const { mutate: createOrder, isPending } = useCreateOrder()
  const [orderType, setOrderType] = useState<OrderType>('delivery')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card')
  const [step, setStep] = useState<'details' | 'payment'>('details')

  const { register, handleSubmit, formState: { errors }, watch } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || '',
      phone: user?.phone || '',
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
          <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">Your cart is empty</h2>
          <p className="text-[var(--fg-muted)]">Add some dishes before proceeding to checkout.</p>
          <Link href="/menu">
            <Button leftIcon={<ArrowLeft className="h-4 w-4" />}>Browse Menu</Button>
          </Link>
        </div>
      </div>
    )
  }

  const onSubmit = (data: CheckoutFormData) => {
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
    }

    createOrder(payload, {
      onSuccess: (order) => {
        clearCart()
        toast.success('Order placed successfully! 🎉')
        router.push(`/checkout/success?orderId=${order.id}&orderNumber=${order.order_number}`)
      },
      onError: () => {
        toast.error('Failed to place order. Please try again.')
        router.push('/checkout/failure')
      },
    })
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <div className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8 flex items-center gap-4">
            <Link href="/menu">
              <Button variant="ghost" size="icon-sm" aria-label="Back to menu">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">Checkout</h1>
              <p className="text-sm text-[var(--fg-muted)]">{items.length} items · {formatCurrency(total)}</p>
            </div>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-3 mb-8">
            {['details', 'payment'].map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className={cn('flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all', step === s ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : i < ['details','payment'].indexOf(step) ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600' : 'bg-[var(--card)] border border-[var(--border)] text-[var(--fg-muted)]')}>
                  {i < ['details','payment'].indexOf(step) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="h-4 w-4 rounded-full border-2 border-current flex items-center justify-center text-[10px]">{i + 1}</span>}
                  <span className="capitalize">{s}</span>
                </div>
                {i < 1 && <ChevronRight className="h-4 w-4 text-[var(--fg-subtle)]" />}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left: Form */}
              <div className="lg:col-span-2 space-y-6">
                <AnimatePresence mode="wait">
                  {step === 'details' ? (
                    <motion.div key="details" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
                      {/* Order Type */}
                      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
                        <h2 className="font-semibold text-[var(--fg)] mb-4">Order Type</h2>
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
                        <h2 className="font-semibold text-[var(--fg)] mb-4">Contact Information</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input label="First Name" required {...register('first_name')} error={errors.first_name?.message} />
                          <Input label="Last Name" required {...register('last_name')} error={errors.last_name?.message} />
                          <Input label="Email" type="email" required {...register('email')} error={errors.email?.message} />
                          <Input label="Phone" type="tel" required {...register('phone')} error={errors.phone?.message} />
                        </div>
                      </div>

                      {/* Delivery Address */}
                      <AnimatePresence>
                        {orderType === 'delivery' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
                            <h2 className="font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-orange-500" /> Delivery Address
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="sm:col-span-2">
                                <Input label="Street Address" required={orderType === 'delivery'} {...register('street')} error={errors.street?.message} placeholder="123 Main St, Apt 4B" />
                              </div>
                              <Input label="City" required={orderType === 'delivery'} {...register('city')} error={errors.city?.message} />
                            </div>
                          </motion.div>
                        )}
                        {orderType === 'dine_in' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
                            <h2 className="font-semibold text-[var(--fg)] mb-4">Table Number</h2>
                            <Input label="Table Number" type="number" {...register('table_number')} placeholder="e.g. 5" />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Notes */}
                      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
                        <h2 className="font-semibold text-[var(--fg)] mb-4">Order Notes</h2>
                        <textarea
                          {...register('notes')}
                          rows={3}
                          placeholder="Any special instructions for your order?"
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all"
                        />
                      </div>

                      <Button type="button" className="w-full" size="lg" rightIcon={<ChevronRight className="h-4 w-4" />} onClick={() => setStep('payment')}>
                        Continue to Payment
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
                        <h2 className="font-semibold text-[var(--fg)] mb-4">Payment Method</h2>
                        <div className="space-y-3">
                          {PAYMENT_METHODS.map((method) => (
                            <button
                              key={method.value}
                              type="button"
                              onClick={() => setPaymentMethod(method.value)}
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

                      <div className="flex gap-3">
                        <Button type="button" variant="secondary" onClick={() => setStep('details')} leftIcon={<ArrowLeft className="h-4 w-4" />}>
                          Back
                        </Button>
                        <Button type="submit" className="flex-1" size="lg" loading={isPending} leftIcon={<Lock className="h-4 w-4" />}>
                          {isPending ? 'Placing Order…' : `Place Order · ${formatCurrency(total)}`}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right: Summary */}
              <div className="space-y-4">
                <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 sticky top-24">
                  <h2 className="font-semibold text-[var(--fg)] mb-4">Order Summary</h2>

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
                    <div className="flex justify-between text-[var(--fg-muted)]"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                    {discountAmount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−{formatCurrency(discountAmount)}</span></div>}
                    <div className="flex justify-between text-[var(--fg-muted)]"><span>Tax (9%)</span><span>{formatCurrency(tax)}</span></div>
                    <div className="flex justify-between text-[var(--fg-muted)]"><span>Service (5%)</span><span>{formatCurrency(serviceCharge)}</span></div>
                    <Divider />
                    <div className="flex justify-between font-bold text-[var(--fg)] text-base">
                      <span>Total</span><span>{formatCurrency(total)}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-xs text-[var(--fg-muted)] bg-[var(--card-hover)] rounded-xl p-3">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <span>Your payment information is encrypted and secure.</span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
