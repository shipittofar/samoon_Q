'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Tag, ShoppingBag, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useCartStore, useCartItemCount } from '@/stores'
import { useValidateDiscount } from '@/hooks'
import { useCheckoutAuthGate } from '@/hooks/use-checkout-auth-gate'
import { AuthModal } from '@/components/auth/AuthModal'
import { Drawer } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { Divider } from '@/components/ui'
import { formatCurrency } from '@/utils'
import { getActiveCartContext, isActiveCartCheckoutEnabled, resolveCartMenuUrl } from '@/lib/active-cart'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'
import type { CartItem } from '@/types'

function CartItemRow({ item }: { item: CartItem }) {
  const t = useTranslations('cart')
  const { updateQuantity, removeItem } = useCartStore()
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex gap-3 py-4 border-b border-[var(--border)] last:border-0"
    >
      <div className="relative h-16 w-16 rounded-xl overflow-hidden shrink-0 bg-[var(--card-hover)]">
        <Image src={item.menu_item.image} alt={item.menu_item.name} fill className="object-cover"sizes="64px"/>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-[var(--fg)] truncate">{item.menu_item.name}</h4>
        {item.extras.length > 0 && (
          <p className="text-xs text-[var(--fg-muted)] truncate">
            + {item.extras.map((e) => e.name).join(', ')}
          </p>
        )}
        {item.notes && (
          <p className="text-xs text-[var(--fg-subtle)] italic truncate">&quot;{item.notes}&quot;</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <QuantityStepper
            size="sm"
            value={item.quantity}
            onChange={(q) => updateQuantity(item.id, q)}
            decreaseLabel={t('decreaseQuantity')}
            increaseLabel={t('increaseQuantity')}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--fg)]">
              {formatCurrency(item.total_price)}
            </span>
            <button
              onClick={() => removeItem(item.id)}
              className="p-1 text-[var(--fg-subtle)] hover:text-[var(--danger-text)] transition-colors rounded-lg hover:bg-[var(--danger-subtle)]"
              aria-label={t('removeItemAria')}
            >
              <Trash2 className="h-3.5 w-3.5"/>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export function CartDrawer() {
  const t = useTranslations('cart')
  const tNotifications = useTranslations('notifications')
  const { items, isOpen, setOpen, discountCode, discountAmount, setDiscount, clearCart, getSubtotal, getTax, getServiceCharge, getTotal, ownership } = useCartStore()
  const { mutate: validateDiscount, isPending: validating } = useValidateDiscount()
  const [codeInput, setCodeInput] = useState(discountCode || '')
  const router = useRouter()
  const pathname = usePathname()
  const {
    authModalOpen,
    requestCheckout,
    handleAuthSuccess,
    handleAuthClose,
  } = useCheckoutAuthGate()
  const cartOwnership = getActiveCartContext(items, ownership)
  const orderingEnabled = isActiveCartCheckoutEnabled(cartOwnership)

  const handleBrowseMenu = () => {
    setOpen(false)
    router.push(resolveCartMenuUrl(cartOwnership))
  }

  const subtotal = getSubtotal()
  const tax = getTax()
  const serviceCharge = getServiceCharge()
  const total = getTotal()

  const handleApplyCode = () => {
    if (!codeInput.trim()) return
    validateDiscount(
      { code: codeInput.trim(), subtotal },
      {
        onSuccess: (res) => {
          if (res.valid) {
            setDiscount(codeInput.trim(), res.discount_amount)
            toast.success(tNotifications('discountApplied', { amount: formatCurrency(res.discount_amount) }))
          } else {
            toast.error(res.message || t('invalidCode'))
          }
        },
        onError: () => toast.error(t('validateCodeFailed')),
      },
    )
  }

  const handleProceedToCheckout = () => {
    if (pathname === '/checkout') {
      setOpen(false)
      return
    }
    requestCheckout('/checkout')
  }

  return (
    <>
    <Drawer open={isOpen} onClose={() => setOpen(false)} title={t('title')} side="right"size="md">
      <div className="flex flex-col h-full">
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="h-20 w-20 rounded-full bg-[var(--card-hover)] flex items-center justify-center">
              <ShoppingBag className="h-8 w-8 text-[var(--fg-subtle)]"/>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--fg)] mb-1">{t('empty')}</h3>
              <p className="text-sm text-[var(--fg-muted)]">{t('emptyDesc')}</p>
            </div>
            <Button onClick={handleBrowseMenu} variant="outline">
              {t('browseMenu')}
            </Button>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="flex-1 overflow-y-auto px-4 scrollbar-thin">
              {cartOwnership && (cartOwnership.tenantName || cartOwnership.branchName) && (
                <p className="pt-4 pb-1 text-xs font-medium text-[var(--fg-muted)]">
                  {t('originLabel', {
                    tenant: cartOwnership.tenantName || cartOwnership.tenantSlug || '—',
                    branch: cartOwnership.branchName || cartOwnership.branchSlug || '—',
                  })}
                </p>
              )}
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <CartItemRow key={item.id} item={item} />
                ))}
              </AnimatePresence>
            </div>

            {/* Summary */}
            <div className="border-t border-[var(--border)] p-4 space-y-4 bg-[var(--card)]">
              {/* Discount Code */}
              <div className="flex gap-2">
                <Input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder={t('discountCodePlaceholder')}
                  leftIcon={<Tag className="h-3.5 w-3.5"/>}
                  className="flex-1 h-9 text-xs"
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyCode()}
                />
                <Button variant="secondary"size="sm"onClick={handleApplyCode} loading={validating}>
                  {t('applyCode')}
                </Button>
              </div>

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-[var(--fg-muted)]">
                  <span>{t('subtotal')}</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[var(--success-text)]">
                    <span>{t('discountLabel', { code: discountCode })}</span>
                    <span>−{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--fg-muted)]">
                  <span>{t('tax')}</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between text-[var(--fg-muted)]">
                  <span>{t('serviceCharge')}</span>
                  <span>{formatCurrency(serviceCharge)}</span>
                </div>
                <Divider />
                <div className="flex justify-between font-bold text-[var(--fg)] text-base">
                  <span>{t('total')}</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Checkout CTA */}
              {orderingEnabled && (
              <Button
                type="button"
                className="w-full"
                size="lg"
                rightIcon={<ArrowRight className="h-4 w-4"/>}
                data-testid="cart-checkout-cta"
                onClick={handleProceedToCheckout}
              >
                {t('checkout')}
              </Button>
              )}
              <button
                onClick={clearCart}
                className="w-full text-xs text-[var(--fg-subtle)] hover:text-[var(--danger-text)] transition-colors py-1"
              >
                {t('clearCart')}
              </button>
            </div>
          </>
        )}
      </div>
    </Drawer>
    <AuthModal
      open={authModalOpen}
      onClose={handleAuthClose}
      onSuccess={() => {
        setOpen(false)
        handleAuthSuccess()
      }}
    />
    </>
  )
}

// ── Floating Cart Button ───────────────────────────────────────────────────────
export function FloatingCart() {
  const t = useTranslations('cart')
  const { setOpen, getTotal } = useCartStore()
  const count = useCartItemCount()

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 80, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 80, scale: 0.8 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          onClick={() => setOpen(true)}
          className="fixed bottom-6 inset-x-4 md:inset-x-auto md:end-6 md:w-auto z-30 bg-[var(--accent)] text-[var(--accent-fg)] rounded-2xl shadow-[var(--shadow-brand)] flex items-center justify-between md:justify-center gap-4 px-5 py-3.5 md:py-3 hover:bg-[var(--accent-hover)] transition-colors active:scale-[0.98]"
          aria-label={t('viewCartAria', { count })}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <ShoppingBag className="h-5 w-5"/>
              <span className="absolute -top-1 -end-1 h-4 min-w-4 rounded-full bg-[var(--card)] text-[var(--accent-text)] text-[10px] font-bold flex items-center justify-center px-0.5">
                {count}
              </span>
            </div>
            <span className="font-medium text-sm">{t('viewCart')}</span>
          </div>
          <span className="font-bold text-sm md:ms-2">{formatCurrency(getTotal())}</span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
