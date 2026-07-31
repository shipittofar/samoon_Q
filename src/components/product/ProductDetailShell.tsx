'use client'

import { Modal } from '@/components/ui/Modal'
import { ProductDetailView, type ProductDetailViewProps } from './ProductDetailView'

export interface ProductDetailShellProps extends ProductDetailViewProps {
  open: boolean
}

/**
 * Product detail modal shell. Owns the scroll contract (Modal scrollable=false).
 */
export function ProductDetailShell({
  open,
  onClose,
  item,
  ...viewProps
}: ProductDetailShellProps) {
  if (!item) return null

  return (
    <Modal
      open={open}
      onClose={onClose ?? (() => {})}
      size="product"
      showClose={false}
      scrollable={false}
      contentClassName="p-0 overflow-hidden flex flex-col min-h-0"
      ariaTitle={item.name}
    >
      <ProductDetailView
        item={item}
        active={open}
        onClose={onClose}
        {...viewProps}
      />
    </Modal>
  )
}
