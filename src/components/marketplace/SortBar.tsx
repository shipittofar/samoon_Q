'use client'

import { useTranslations } from 'next-intl'
import { ArrowUpDown } from 'lucide-react'
import type { SortOption } from '@/types/marketplace'

const SORT_OPTIONS: { value: SortOption; labelKey: string }[] = [
  { value: 'recommended',   labelKey: 'recommended' },
  { value: 'highest_rated', labelKey: 'highestRated' },
  { value: 'most_reviewed', labelKey: 'mostReviewed' },
  { value: 'newest',        labelKey: 'newest' },
  { value: 'alphabetical',  labelKey: 'alphabetical' },
  { value: 'price_asc',     labelKey: 'priceLowToHigh' },
  { value: 'open_now',      labelKey: 'openNowFirst' },
]

interface SortBarProps {
  value: SortOption
  onChange: (sort: SortOption) => void
  resultCount: number
  resultLabel?: string
}

export function SortBar({ value, onChange, resultCount, resultLabel }: SortBarProps) {
  const t = useTranslations('marketplace')
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <p className="text-sm text-[var(--fg-muted)]" aria-live="polite" aria-atomic="true">
        {resultLabel ?? t('businessesCount', { count: resultCount })}
      </p>

      <div className="flex items-center gap-2">
        <ArrowUpDown className="w-3.5 h-3.5 text-[var(--fg-muted)]" aria-hidden="true" />
        <label htmlFor="sort-select" className="sr-only">
          {t('sortResults')}
        </label>
        <select
          id="sort-select"
          value={value}
          onChange={(e) => onChange(e.target.value as SortOption)}
          className="text-sm bg-[var(--card)] border border-[var(--border)] rounded-2xl px-3 py-2 text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer"
        >
          {SORT_OPTIONS.map(({ value: v, labelKey }) => (
            <option key={v} value={v}>
              {t(`sortOptions.${labelKey}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
