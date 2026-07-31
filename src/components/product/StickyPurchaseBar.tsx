'use client'

import { Button } from '@/components/ui/Button'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { cn } from '@/utils'

export interface StickyPurchaseBarProps {
  quantity: number
  onQuantityChange: (value: number) => void
  onAddToCart: () => void
  available: boolean
  ctaLabel: string
  unavailableLabel: string
  addedLabel: string
  decreaseLabel: string
  increaseLabel: string
  loading?: boolean
  added?: boolean
  className?: string
}

export function StickyPurchaseBar({
  quantity,
  onQuantityChange,
  onAddToCart,
  available,
  ctaLabel,
  unavailableLabel,
  addedLabel,
  decreaseLabel,
  increaseLabel,
  loading = false,
  added = false,
  className,
}: StickyPurchaseBarProps) {
  return (
    <div
      className={cn(
        'shrink-0 border-t border-[var(--border)] p-6 bg-[var(--card)]/95 backdrop-blur-md',
        'flex items-center gap-4',
        className,
      )}
    >
      <QuantityStepper
        value={quantity}
        onChange={onQuantityChange}
        decreaseLabel={decreaseLabel}
        increaseLabel={increaseLabel}
      />
      <Button
        className="flex-1"
        size="lg"
        onClick={onAddToCart}
        disabled={!available}
        loading={loading}
      >
        {!available ? unavailableLabel : added ? addedLabel : ctaLabel}
      </Button>
    </div>
  )
}
