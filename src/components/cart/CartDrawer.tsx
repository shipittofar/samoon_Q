'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Tag, ShoppingBag, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCartStore, useTenantStore, useBranchStore } from '@/stores'
import { useValidateDiscount } from '@/hooks'
import { Drawer } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { Divider } from '@/components/ui'
import { formatCurrency } from '@/utils'
import { isBranchOrderingEnabled } from '@/lib/branch-checkout'
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
        <Image src={item.menu_item.image} alt={item.menu_item.name} fill className="object-cover" sizes="64px" />
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
              className="p-1 text-[var(--fg-subtle)] hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
              aria-label={t('removeItemAria')}
            >
              <Trash2 className="h-3.5 w-3.5" />
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
  const { items, isOpen, setOpen, discountCode, discountAmount, setDiscount, clearCart, getSubtotal } = useCartStore()
  const { mutate: validateDiscount, isPending: validating } = useValidateDiscount()
  const [codeInput, setCodeInput] = useState(discountCode || '')
  const router = useRouter()
  const tenantSlug = useTenantStore((s) => s.tenant?.slug)
  const branchSlug = useBranchStore((s) => s.activeBranch?.slug)
  const orderingEnabled = isBranchOrderingEnabled(useBranchStore((s) => s.activeBranch?.checkout))

  const handleBrowseMenu = () => {
    setOpen(false)
    if (tenantSlug && branchSlug) {
      router.push(`/${tenantSlug}/${branchSlug}/menu`)
    } else if (tenantSlug) {
      router.push(`/${tenantSlug}`)
    } else {
      router.push('/discover')
    }
  }

  const subtotal = getSubtotal()
  // TODO: fetch cart quote from ENDPOINTS.ORDERS.QUOTE — frontend must not invent tax/fees/grand_total
  const displayAmount = subtotal - discountAmount

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

  return (
    <Drawer open={isOpen} onClose={() => setOpen(false)} title={t('title')} side="right" size="md">
      <div className="flex flex-col h-full">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center py-12">
            <ShoppingBag className="h-12 w-12 text-[var(--fg-subtle)]" />
            <p className="text-[var(--fg-muted)]">{t('empty')}</p>
            <Button onClick={handleBrowseMenu}>{t('browseMenu')}</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto scrollbar-thin px-1">
              <AnimatePresence>
                {items.map((item) => <CartItemRow key={item.id} item={item} />)}
              </AnimatePresence>
            </div>

            <div className="border-t border-[var(--border)] pt-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder={t('discountPlaceholder')}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  leftIcon={<Tag className="h-4 w-4" />}
                  className="flex-1"
                />
                <Button variant="secondary" onClick={handleApplyCode} loading={validating} size="sm">
                  {t('apply')}
                </Button>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-[var(--fg-muted)]">
                  <span>{t('subtotal')}</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>{t('discount')}</span>
                    <span>−{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {/* TODO: render quote.lines from ENDPOINTS.ORDERS.QUOTE when backend ships contract */}
                <Divider />
                <div className="flex justify-between font-bold text-[var(--fg)]">
                  <span>{t('total')}</span>
                  <span>{formatCurrency(displayAmount)}</span>
                </div>
              </div>

              {orderingEnabled ? (
                <Link href="/checkout" onClick={() => setOpen(false)}>
                  <Button className="w-full" rightIcon={<ArrowRight className="h-4 w-4" />}>
                    {t('checkout')}
                  </Button>
                </Link>
              ) : (
                <Button className="w-full" variant="secondary" onClick={handleBrowseMenu}>
                  {t('browseMenu')}
                </Button>
              )}
              <Button variant="ghost" className="w-full text-[var(--fg-muted)]" onClick={clearCart}>
                {t('clearCart')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}

export function FloatingCart() {
  const t = useTranslations('cart')
  const { getItemCount, setOpen, getSubtotal, discountAmount } = useCartStore()
  const count = getItemCount()
  const displayAmount = getSubtotal() - discountAmount

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 80, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 80, scale: 0.8 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          onClick={() => setOpen(true)}
          className="fixed bottom-6 inset-x-4 md:inset-x-auto md:end-6 md:w-auto z-30 bg-[var(--accent)] text-white rounded-2xl shadow-[var(--shadow-brand)] flex items-center justify-between md:justify-center gap-4 px-5 py-3.5 md:py-3 hover:bg-[var(--accent-hover)] transition-colors active:scale-[0.98]"
          aria-label={t('viewCartAria', { count })}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -top-1 -end-1 h-4 min-w-4 rounded-full bg-white text-orange-600 text-[10px] font-bold flex items-center justify-center px-0.5">
                {count}
              </span>
            </div>
            <span className="font-medium text-sm">{t('viewCart')}</span>
          </div>
          <span className="font-bold text-sm md:ms-2">{formatCurrency(displayAmount)}</span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
