'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Heart, MapPin, Store, Clock, Star, Zap } from 'lucide-react'
import { useFavoriteAction } from '@/hooks'
import { cn } from '@/utils'
import { useMoney } from '@/hooks/use-money'
import { Badge } from '@/components/ui'
import { MenuItemCartControls } from '@/components/menu/MenuItemCartControls'
import type { UserFavorite } from '@/types/favorites'
import type { MenuItem } from '@/types'

interface FavoriteCardProps {
  favorite: UserFavorite
  onOpenDetail?: (item: MenuItem) => void
  className?: string
}

export function FavoriteCard({ favorite, onOpenDetail, className }: FavoriteCardProps) {
  const tMenu = useTranslations('menu')
  const tDashboard = useTranslations('dashboard')
  const { menu_item: item, tenant, branch } = favorite
  const { favorited, isPending, handleFavorite } = useFavoriteAction(item.id)

  const money = useMoney()
  const discountedLabel = money.formatItem(item, { discounted: true })
  const hasDiscount = !!item.discount && item.discount > 0

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-menu-item-cart-controls]')) return
    onOpenDetail?.(item)
  }

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={handleCardClick}
      className={cn(
        'group relative flex flex-col bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden cursor-pointer',
        'hover:border-[var(--accent-border)]/50 hover:shadow-xl transition-all duration-300',
        !item.available && 'opacity-75',
        className,
      )}
    >
      <div className="relative h-44 overflow-hidden shrink-0">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--accent-subtle)] to-[var(--card-hover)] flex items-center justify-center">
            <span className="text-5xl opacity-30"aria-hidden="true">🍽️</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"/>

        <button
          type="button"
          onClick={handleFavorite}
          disabled={isPending}
          className={cn(
            'absolute top-3 end-3 h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg',
            favorited
              ? 'bg-[var(--danger)] text-[var(--danger-fg)]'
              : 'bg-white/90 backdrop-blur-sm text-[var(--fg-muted)] hover:bg-[var(--card)] hover:text-[var(--danger-text)]',
            isPending && 'opacity-70 cursor-wait',
          )}
          aria-label={favorited ? tMenu('removeFromFavorites') : tMenu('addToFavorites')}
          aria-busy={isPending}
        >
          <Heart className={cn('h-4 w-4', favorited && 'fill-current')} />
        </button>

        {!item.available && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge variant="secondary"className="text-xs">{tMenu('unavailable')}</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-text)] max-w-full truncate">
            <Store className="h-3 w-3 shrink-0"aria-hidden="true"/>
            <span className="truncate">{tenant.name}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--bg-secondary)] text-[var(--fg-muted)] max-w-full truncate">
            <MapPin className="h-3 w-3 shrink-0"aria-hidden="true"/>
            <span className="truncate">{branch.name}</span>
          </span>
        </div>

        <div className="space-y-1">
          <h3 className="font-[var(--font-display)] text-lg font-semibold text-[var(--fg)] leading-snug line-clamp-2 group-hover:text-[var(--accent-text)] transition-colors">
            {item.name}
          </h3>
          <div className="flex items-center gap-3 text-xs text-[var(--fg-muted)]">
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 text-[var(--rating)] fill-[var(--rating)]"aria-hidden="true"/>
              {item.rating?.toFixed(1) ?? '0.0'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3"aria-hidden="true"/>
              {tMenu('prepTimeApprox', { min: item.preparation_time })}
            </span>
          </div>
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
            <span className="text-2xl font-bold text-[var(--accent-text)] leading-none">
              {discountedLabel}
            </span>
            {hasDiscount && (
              <>
                <span className="text-sm text-[var(--fg-subtle)] line-through pb-0.5">
                  {money.formatItem(item)}
                </span>
                <Badge variant="danger"className="text-[10px] mb-0.5">
                  {tMenu('discount', { percent: item.discount! })}
                </Badge>
              </>
            )}
          </div>

          <MenuItemCartControls
            item={item}
            onOpenDetail={onOpenDetail}
            disabled={!item.available}
            layout="full"
            addLabel={tDashboard('favoriteQuickOrder', { price: discountedLabel })}
            addIcon={<Zap className="h-4 w-4"aria-hidden="true"/>}
            orderingContext={{
              tenantId: tenant.id,
              tenantSlug: tenant.slug,
              tenantName: tenant.name,
              branchId: branch.id,
              branchSlug: branch.slug ?? '',
              branchName: branch.name,
            }}
          />
        </div>
      </div>
    </motion.article>
  )
}
