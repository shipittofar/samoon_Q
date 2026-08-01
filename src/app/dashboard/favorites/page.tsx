'use client'

import { useState } from 'react'
import { Heart, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { FavoriteCard } from '@/components/favorites/FavoriteCard'
import { FoodDetailModal } from '@/components/menu/FoodDetailModal'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { FoodCardSkeleton } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { useFavoritesList, useRefreshFavorites } from '@/hooks'
import { cn } from '@/utils'
import type { MenuItem } from '@/types'

export default function FavoritesPage() {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const { favoriteItems, count, isLoading, isError } = useFavoritesList()
  const { refresh, isRefreshing } = useRefreshFavorites()
  const t = useTranslations('dashboard')

  const showInitialSkeleton = isLoading && favoriteItems.length === 0

  return (
    <div className="space-y-6">
      <ErrorBoundary feature="CartDrawer"><CartDrawer /></ErrorBoundary>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
            <Heart className="h-5 w-5 text-red-500 fill-red-500" />
          </div>
          <div className="min-w-0">
            <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('favorites')}</h1>
            <p className="text-sm text-[var(--fg-muted)] mt-0.5">{t('savedDishesCount', { count })}</p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={refresh}
          disabled={isRefreshing || showInitialSkeleton}
          leftIcon={
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
          }
        >
          {isRefreshing ? t('refreshing') : t('refresh')}
        </Button>
      </div>

      {showInitialSkeleton ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <FoodCardSkeleton key={i} />)}
        </div>
      ) : isError && favoriteItems.length === 0 ? (
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-12 text-center">
          <p className="text-sm text-[var(--fg-muted)]">{t('favoritesLoadError')}</p>
        </div>
      ) : favoriteItems.length === 0 ? (
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-12 text-center">
          <Heart className="h-12 w-12 text-[var(--fg-subtle)] mx-auto mb-4" />
          <h3 className="font-semibold text-[var(--fg)] mb-2">{t('noFavoritesYet')}</h3>
          <p className="text-sm text-[var(--fg-muted)] mb-4">{t('heartDishesHint')}</p>
          <Link href="/menu"><Button>{t('orderNow')}</Button></Link>
        </div>
      ) : (
        <div
          className={cn(
            'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity',
            isRefreshing && 'opacity-80',
          )}
        >
          {favoriteItems.map((favorite) => (
            <FavoriteCard
              key={favorite.id}
              favorite={favorite}
              onOpenDetail={(item) => { setSelectedItem(item); setModalOpen(true) }}
            />
          ))}
        </div>
      )}

      <FoodDetailModal
        item={selectedItem}
        open={modalOpen}
        branchId={selectedItem?.branch_id}
        onClose={() => { setModalOpen(false); setTimeout(() => setSelectedItem(null), 300) }}
        onOpenRelated={(item) => { setSelectedItem(item); setModalOpen(true) }}
      />
    </div>
  )
}
