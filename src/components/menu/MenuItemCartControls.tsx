'use client'

import { Plus, Minus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCartStore } from '@/stores'
import { cn, getDiscountedPrice } from '@/utils'
import { Button } from '@/components/ui/Button'
import { findPlainCartLine, getPlainCartQuantity, menuItemRequiresConfiguration } from '@/lib/menu-item-cart'
import type { MenuItem } from '@/types'

type ControlSize = 'sm' | 'icon-sm'

interface MenuItemCartControlsProps {
  item: MenuItem
  onOpenDetail?: (item: MenuItem) => void
  disabled?: boolean
  /** `icon` — compact plus icon; `button` — labeled Add; `full` — full-width CTA */
  layout?: 'icon' | 'button' | 'full'
  size?: ControlSize
  addLabel?: string
  addIcon?: React.ReactNode
  className?: string
  buttonClassName?: string
}

interface MenuCardQuantityProps {
  quantity: number
  onDecrease: (e: React.MouseEvent) => void
  onIncrease: (e: React.MouseEvent) => void
  size?: ControlSize
  fullWidth?: boolean
  decreaseLabel: string
  increaseLabel: string
  removeLabel: string
  className?: string
}

function stopCardClick(e: React.SyntheticEvent) {
  e.stopPropagation()
}

function MenuCardQuantity({
  quantity,
  onDecrease,
  onIncrease,
  size = 'sm',
  fullWidth = false,
  decreaseLabel,
  increaseLabel,
  removeLabel,
  className,
}: MenuCardQuantityProps) {
  const btnSize = size === 'icon-sm' ? 'h-7 w-7' : 'h-8 w-8'
  const iconSize = size === 'icon-sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const valueWidth = size === 'icon-sm' ? 'w-6 text-sm' : fullWidth ? 'flex-1 text-base' : 'w-8 text-sm'

  return (
    <div
      data-menu-item-cart-controls
      className={cn(
        'flex items-center rounded-xl border border-[var(--border)] overflow-hidden shrink-0 bg-[var(--card)]',
        fullWidth && 'w-full',
        className,
      )}
      onClick={stopCardClick}
      onPointerDown={stopCardClick}
    >
      <button
        type="button"
        onClick={onDecrease}
        aria-label={quantity <= 1 ? removeLabel : decreaseLabel}
        className={cn(
          btnSize,
          fullWidth && 'flex-1',
          'flex items-center justify-center text-[var(--fg-muted)] hover:bg-[var(--card-hover)] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset',
        )}
      >
        {quantity <= 1 ? (
          <Trash2 className={cn(iconSize, 'text-red-500')} />
        ) : (
          <Minus className={iconSize} />
        )}
      </button>
      <span
        className={cn(valueWidth, 'text-center font-semibold text-[var(--fg)] tabular-nums')}
        aria-live="polite"
        aria-atomic="true"
      >
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        aria-label={increaseLabel}
        className={cn(
          btnSize,
          fullWidth && 'flex-1',
          'flex items-center justify-center text-[var(--fg-muted)] hover:bg-[var(--card-hover)] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset',
        )}
      >
        <Plus className={iconSize} />
      </button>
    </div>
  )
}

export function MenuItemCartControls({
  item,
  onOpenDetail,
  disabled = false,
  layout = 'button',
  size = 'sm',
  addLabel,
  addIcon,
  className,
  buttonClassName,
}: MenuItemCartControlsProps) {
  const t = useTranslations('menu')
  const tCart = useTranslations('cart')
  const quantity = useCartStore((s) => getPlainCartQuantity(s.items, item.id))

  const discountedPrice = item.discount ? getDiscountedPrice(item.price, item.discount) : item.price
  const requiresConfig = menuItemRequiresConfiguration(item)

  const addToCart = () => {
    useCartStore.getState().addItem({ ...item, discounted_price: discountedPrice })
  }

  const handleAdd = (e: React.MouseEvent) => {
    stopCardClick(e)
    if (disabled || !item.available) return
    if (requiresConfig) {
      onOpenDetail?.(item)
      return
    }
    addToCart()
  }

  const handleDecrease = (e: React.MouseEvent) => {
    stopCardClick(e)
    const cartLine = findPlainCartLine(useCartStore.getState().items, item.id)
    if (!cartLine) return
    if (cartLine.quantity <= 1) {
      useCartStore.getState().removeItem(cartLine.id)
    } else {
      useCartStore.getState().updateQuantity(cartLine.id, cartLine.quantity - 1)
    }
  }

  const handleIncrease = (e: React.MouseEvent) => {
    stopCardClick(e)
    if (disabled || !item.available) return
    const cartLine = findPlainCartLine(useCartStore.getState().items, item.id)
    if (cartLine) {
      useCartStore.getState().updateQuantity(cartLine.id, cartLine.quantity + 1)
    } else {
      addToCart()
    }
  }

  if (!requiresConfig && quantity > 0) {
    return (
      <MenuCardQuantity
        quantity={quantity}
        onDecrease={handleDecrease}
        onIncrease={handleIncrease}
        size={layout === 'icon' ? 'icon-sm' : size}
        fullWidth={layout === 'full'}
        decreaseLabel={tCart('decreaseQuantity')}
        increaseLabel={tCart('increaseQuantity')}
        removeLabel={tCart('removeItemAria')}
        className={className}
      />
    )
  }

  const label = addLabel ?? t('add')
  const icon = addIcon ?? <Plus className="h-3.5 w-3.5" />

  if (layout === 'icon') {
    return (
      <div data-menu-item-cart-controls onClick={stopCardClick} onPointerDown={stopCardClick}>
        <Button
          type="button"
          size="icon-sm"
          onClick={handleAdd}
          disabled={disabled || !item.available}
          aria-label={t('addToCart')}
          className={className}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  if (layout === 'full') {
    return (
      <div
        data-menu-item-cart-controls
        onClick={stopCardClick}
        onPointerDown={stopCardClick}
        className={cn('w-full', className)}
      >
        <Button
          type="button"
          size="md"
          onClick={handleAdd}
          disabled={disabled || !item.available}
          leftIcon={icon}
          className={cn('w-full font-semibold shadow-sm', buttonClassName)}
        >
          {label}
        </Button>
      </div>
    )
  }

  return (
    <div data-menu-item-cart-controls onClick={stopCardClick} onPointerDown={stopCardClick}>
      <Button
        type="button"
        size="sm"
        onClick={handleAdd}
        disabled={disabled || !item.available}
        leftIcon={icon}
        className={buttonClassName}
      >
        {label}
      </Button>
    </div>
  )
}
