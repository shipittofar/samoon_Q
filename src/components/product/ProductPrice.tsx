'use client'

import { Badge } from '@/components/ui'
import { formatCurrency } from '@/utils'

export interface ProductPriceProps {
  price: number
  discountedPrice: number
  discountPercent?: number
  totalPrice?: number
  showTotal?: boolean
  totalLabel: string
  /** Phase 1 — wraps the formatted price (e.g. "From {price}" for starting prices). */
  formatPrice?: (formatted: string) => string
  /** Already formatted in the visitor's currency (useMoney); preferred over the numbers. */
  labels?: { price: string; discounted: string }
}

export function ProductPrice({
  price,
  discountedPrice,
  discountPercent,
  totalPrice,
  showTotal = false,
  totalLabel,
  formatPrice = (formatted) => formatted,
  labels,
}: ProductPriceProps) {
  const hasDiscount = discountPercent != null && discountPercent > 0 && discountedPrice < price

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-2xl font-bold text-[var(--fg)]">{formatPrice(labels?.discounted ?? formatCurrency(discountedPrice))}</span>
      {hasDiscount && (
        <>
          <span className="text-base text-[var(--fg-subtle)] line-through">{labels?.price ?? formatCurrency(price)}</span>
          <Badge variant="danger" className="text-[10px]">
            {discountPercent}% OFF
          </Badge>
        </>
      )}
      {showTotal && totalLabel && (
        <span className="text-sm text-[var(--fg-muted)]">· {totalLabel}</span>
      )}
    </div>
  )
}
