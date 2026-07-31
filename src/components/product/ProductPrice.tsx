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
}

export function ProductPrice({
  price,
  discountedPrice,
  discountPercent,
  totalPrice,
  showTotal = false,
  totalLabel,
}: ProductPriceProps) {
  const hasDiscount = discountPercent != null && discountPercent > 0 && discountedPrice < price

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-2xl font-bold text-[var(--fg)]">{formatCurrency(discountedPrice)}</span>
      {hasDiscount && (
        <>
          <span className="text-base text-[var(--fg-subtle)] line-through">{formatCurrency(price)}</span>
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
