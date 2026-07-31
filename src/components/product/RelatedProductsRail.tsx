'use client'

import { FoodCard } from '@/components/menu/FoodCard'
import { Skeleton } from '@/components/ui'
import type { MenuItem } from '@/types'

interface RelatedProductsRailProps {
  items?: MenuItem[]
  loading?: boolean
  title: string
  onOpenDetail?: (item: MenuItem) => void
}

export function RelatedProductsRail({ items, loading, title, onOpenDetail }: RelatedProductsRailProps) {
  if (loading) {
    return (
      <div className="border-t border-[var(--border)] p-6 shrink-0">
        <h3 className="font-[var(--font-display)] font-semibold text-[var(--fg)] mb-4">{title}</h3>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-56 shrink-0 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!items || items.length === 0) return null

  return (
    <div className="border-t border-[var(--border)] p-6 shrink-0">
      <h3 className="font-[var(--font-display)] font-semibold text-[var(--fg)] mb-4">{title}</h3>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 pt-2 -mx-1 px-1 snap-x snap-mandatory">
        {items.slice(0, 6).map((rel) => (
          <div key={rel.id} className="w-90 shrink-0 snap-start">
            <FoodCard item={rel} compact onOpenDetail={onOpenDetail} />
          </div>
        ))}
      </div>
    </div>
  )
}
