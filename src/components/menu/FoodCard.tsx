'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Heart, Clock, Flame, Star } from 'lucide-react'
import { useRecentlyViewedStore, useBranchStore, useTenantStore } from '@/stores'
import { useFavoriteAction } from '@/hooks'
import { cn, formatCurrency, getDiscountedPrice } from '@/utils'
import { isBranchOrderingEnabled } from '@/lib/branch-checkout'
import { canOrderFromTenant } from '@/lib/tenant-state'
import { Badge } from '@/components/ui'
import { MenuItemCartControls } from '@/components/menu/MenuItemCartControls'
import type { MenuItem } from '@/types'

interface FoodCardProps {
  item: MenuItem
  onOpenDetail?: (item: MenuItem) => void
  compact?: boolean
  className?: string
}

export function FoodCard({ item, onOpenDetail, compact = false, className }: FoodCardProps) {
  const t = useTranslations('menu')
  const activeBranchCheckout = useBranchStore((s) => s.activeBranch?.checkout)
  const orderingEnabled =
    canOrderFromTenant(useTenantStore((s) => s.tenant)) &&
    isBranchOrderingEnabled(activeBranchCheckout)
  const { favorited, isPending, handleFavorite } = useFavoriteAction(item.id)
  const addRecentlyViewed = useRecentlyViewedStore((s) => s.addItem)

  const discountedPrice = item.discount ? getDiscountedPrice(item.price, item.discount) : item.price

  const handleFavoriteClick = (e: React.MouseEvent) => {
    handleFavorite(e)
  }

  const handleClick = (e: React.MouseEvent) => {
    // Guard against Add/qty clicks that bubble through motion/button layers.
    if ((e.target as HTMLElement).closest('[data-menu-item-cart-controls]')) return
    addRecentlyViewed(item)
    onOpenDetail?.(item)
  }

  if (compact) {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        onClick={handleClick}
        className={cn(
          'group flex gap-3 bg-[var(--card)] rounded-xl border border-[var(--border)] p-3 cursor-pointer hover:border-orange-200 dark:hover:border-orange-900 hover:shadow-md transition-all duration-200',
          !item.available && 'opacity-60',
          className,
        )}
      >
        <div className="relative h-20 w-20 rounded-lg overflow-hidden shrink-0 bg-[var(--bg-secondary)]">
          {item.image ? (
            <Image src={item.image} alt={item.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="80px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-2xl opacity-30" aria-hidden="true">🍽️</span>
            </div>
          )}
          {!item.available && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white text-[10px] font-medium">{t('unavailableShort')}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-[var(--fg)] truncate">{item.name}</h3>
          <p className="text-xs text-[var(--fg-muted)] line-clamp-2 mt-0.5">{item.description}</p>
          <div className="flex items-center justify-between mt-2">
            <div>
              <span className="text-sm font-bold text-[var(--fg)]">{formatCurrency(discountedPrice)}</span>
              {item.discount && (
                <span className="text-xs text-[var(--fg-subtle)] line-through ms-1">{formatCurrency(item.price)}</span>
              )}
            </div>
            {orderingEnabled && (
              <MenuItemCartControls
                item={item}
                onOpenDetail={onOpenDetail}
                disabled={!orderingEnabled || !item.available}
                layout="icon"
              />
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={handleClick}
      className={cn(
        'group relative bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden cursor-pointer hover:border-orange-200 dark:hover:border-orange-900 hover:shadow-xl transition-all duration-300',
        !item.available && 'opacity-70',
        className,
      )}
    >
      {/* Image — C3: fallback for missing image */}
      <div className="relative h-48 overflow-hidden">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-950/30 dark:to-stone-900 flex items-center justify-center">
            <span className="text-5xl opacity-30" aria-hidden="true">🍽️</span>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 start-3 flex flex-col gap-1.5">
          {item.is_new && <Badge variant="info" className="shadow-sm text-[10px]">{t('new')}</Badge>}
          {item.is_popular && <Badge variant="warning" className="shadow-sm text-[10px]">{t('popular')}</Badge>}
          {item.is_featured && <Badge variant="default" className="shadow-sm text-[10px]">{t('featured')}</Badge>}
          {item.discount && (
            <Badge variant="danger" className="shadow-sm text-[10px]">{t('discount', { percent: item.discount })}</Badge>
          )}
        </div>

        {/* Favorite */}
        <button
          type="button"
          onClick={handleFavoriteClick}
          disabled={isPending}
          className={cn(
            'absolute top-3 end-3 h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg',
            favorited
              ? 'bg-red-500 text-white scale-110'
              : 'bg-white/80 backdrop-blur-sm text-gray-500 hover:bg-white hover:text-red-500',
            isPending && 'opacity-70 cursor-wait',
          )}
          aria-label={favorited ? t('removeFromFavorites') : t('addToFavorites')}
          aria-busy={isPending}
        >
          <Heart className={cn('h-4 w-4', favorited && 'fill-current')} />
        </button>

        {/* Not available overlay */}
        {!item.available && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge variant="secondary" className="text-xs">{t('unavailable')}</Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-[var(--font-display)] font-semibold text-[var(--fg)] leading-snug mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-1">
          {item.name}
        </h3>
        <p className="text-xs text-[var(--fg-muted)] line-clamp-2 mb-3 leading-relaxed">
          {item.description}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-3 mb-4 text-xs text-[var(--fg-muted)]">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
            {item.rating?.toFixed(1) ?? "0.0"}
            {item.rating_count > 0 && (
              <span className="text-[var(--fg-subtle)]">{t('ratingCountShort', { count: item.rating_count })}</span>
            )}
          </span>
          {/* H6: friendlier prep time label */}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {t('prepTimeApprox', { min: item.preparation_time })}
          </span>
          {item.calories && (
            <span className="flex items-center gap-1">
              <Flame className="h-3 w-3" />
              {t('calories', { count: item.calories })}
            </span>
          )}
        </div>

        {/* Price + Add */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-[var(--fg)]">{formatCurrency(discountedPrice)}</span>
            {item.discount && (
              <span className="text-xs text-[var(--fg-subtle)] line-through ms-1.5">
                {formatCurrency(item.price)}
              </span>
            )}
          </div>
          {orderingEnabled && (
            <MenuItemCartControls
              item={item}
              onOpenDetail={onOpenDetail}
              disabled={!orderingEnabled || !item.available}
              layout="button"
            />
          )}
        </div>
      </div>
    </motion.div>
  )
}
