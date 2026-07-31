'use client'

import { cn } from '@/utils'

export type ProductDetailTab = 'details' | 'customize' | 'reviews'

interface ProductDetailSectionTabsProps {
  active: ProductDetailTab
  onChange: (tab: ProductDetailTab) => void
  detailsLabel: string
  customizeLabel: string
  reviewsLabel: string
  className?: string
}

export function ProductDetailSectionTabs({
  active,
  onChange,
  detailsLabel,
  customizeLabel,
  reviewsLabel,
  className,
}: ProductDetailSectionTabsProps) {
  const tabs: { id: ProductDetailTab; label: string }[] = [
    { id: 'details', label: detailsLabel },
    { id: 'customize', label: customizeLabel },
    { id: 'reviews', label: reviewsLabel },
  ]

  return (
    <div
      role="tablist"
      aria-label="Product sections"
      className={cn('flex gap-1 p-1 rounded-xl bg-[var(--card-hover)]', className)}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
            active === tab.id
              ? 'bg-[var(--card)] text-[var(--fg)] shadow-[var(--shadow-soft)]'
              : 'text-[var(--fg-muted)] hover:text-[var(--fg)]',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
