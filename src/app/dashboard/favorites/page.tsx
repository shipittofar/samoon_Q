'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import Link from 'next/link'
import { FoodCard } from '@/components/menu/FoodCard'
import { FoodDetailModal } from '@/components/menu/FoodDetailModal'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { FoodCardSkeleton } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { useFavoritesStore } from '@/stores'
import { useMenuItems } from '@/hooks'
import type { MenuItem } from '@/types'

export default function FavoritesPage() {
  const { favorites } = useFavoritesStore()
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const { data, isLoading } = useMenuItems()
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
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">Favorites</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-0.5">{favorites.size} saved dishes</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <FoodCardSkeleton key={i} />)}
        </div>
      ) : favoriteItems.length === 0 ? (
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-12 text-center">
          <Heart className="h-12 w-12 text-[var(--fg-subtle)] mx-auto mb-4" />
          <h3 className="font-semibold text-[var(--fg)] mb-2">No favorites yet</h3>
          <p className="text-sm text-[var(--fg-muted)] mb-4">Heart dishes you love to save them here.</p>
          <Link href="/menu"><Button>Browse Menu</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favoriteItems.map((item) => (
            <FoodCard key={item.id} item={item} onOpenDetail={(i) => { setSelectedItem(i); setModalOpen(true) }} />
          ))}
        </div>
      )}

      <FoodDetailModal item={selectedItem} open={modalOpen} onClose={() => { setModalOpen(false); setTimeout(() => setSelectedItem(null), 300) }} />
    </div>
  )
}
