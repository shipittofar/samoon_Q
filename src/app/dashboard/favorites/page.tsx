'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { FoodCard } from '@/components/menu/FoodCard'
import { FoodDetailModal } from '@/components/menu/FoodDetailModal'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { FoodCardSkeleton } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { useFavoritesStore, useBranchStore } from '@/stores'
import { useMenuItems, useActiveBranchId } from '@/hooks'
import type { MenuItem } from '@/types'

export default function FavoritesPage() {
  const { favorites } = useFavoritesStore()
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  // KNOWN LIMITATION (see docs/BRANCH_MENU_IMPLEMENTATION.md "Remaining TODOs"):
  // favorites are stored as bare item ids with no branch association, so this
  // only resolves favorites belonging to the customer's currently active
  // branch (useMenuItems' store fallback) — a favorite saved at a different
  // branch will not appear here until that branch is active again.
  const { data, isLoading } = useMenuItems()
  const storeBranchId = useBranchStore((s) => s.activeBranch?.id)
  const activeBranchId = useActiveBranchId()
  const branchId = storeBranchId ?? activeBranchId
  const t = useTranslations('dashboard')
  const allItems = data?.results || []
  const favoriteItems = allItems.filter((item) => favorites.has(item.id))

  return (
    <div className="space-y-6">
      <ErrorBoundary feature="CartDrawer"><CartDrawer /></ErrorBoundary>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
          <Heart className="h-5 w-5 text-red-500 fill-red-500" />
        </div>
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('favorites')}</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-0.5">{t('savedDishesCount', { count: favorites.size })}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <FoodCardSkeleton key={i} />)}
        </div>
      ) : favoriteItems.length === 0 ? (
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-12 text-center">
          <Heart className="h-12 w-12 text-[var(--fg-subtle)] mx-auto mb-4" />
          <h3 className="font-semibold text-[var(--fg)] mb-2">{t('noFavoritesYet')}</h3>
          <p className="text-sm text-[var(--fg-muted)] mb-4">{t('heartDishesHint')}</p>
          <Link href="/menu"><Button>{t('orderNow')}</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favoriteItems.map((item) => (
            <FoodCard key={item.id} item={item} onOpenDetail={(i) => { setSelectedItem(i); setModalOpen(true) }} />
          ))}
        </div>
      )}

      <FoodDetailModal
        item={selectedItem}
        open={modalOpen}
        branchId={branchId}
        onClose={() => { setModalOpen(false); setTimeout(() => setSelectedItem(null), 300) }}
        onOpenRelated={(i) => { setSelectedItem(i); setModalOpen(true) }}
      />
    </div>
  )
}
