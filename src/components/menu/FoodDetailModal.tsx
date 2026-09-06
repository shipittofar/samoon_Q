'use client'

import { ProductDetailShell } from '@/components/product/ProductDetailShell'
import type { MenuItem } from '@/types'
import type { CartOwnershipInput } from '@/lib/active-cart'

interface FoodDetailModalProps {
  item: MenuItem | null
  open: boolean
  onClose: () => void
  branchId?: string
  onOpenRelated?: (item: MenuItem) => void
  orderingContext?: CartOwnershipInput
}

export function FoodDetailModal({
  item,
  open,
  onClose,
  branchId,
  onOpenRelated,
  orderingContext,
}: FoodDetailModalProps) {
  if (!item) return null

  return (
    <ProductDetailShell
      item={item}
      open={open}
      active={open}
      branchId={branchId}
      onClose={onClose}
      onOpenRelated={onOpenRelated}
      orderingContext={orderingContext}
    />
  )
}

// Re-export for tests and consumers
export { ProductDetailView } from '@/components/product/ProductDetailView'
export { useProductDetailState } from '@/components/product/useProductDetailState'
export { useItemReviews, useCreateReview } from '@/hooks'
