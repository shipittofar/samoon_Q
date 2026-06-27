'use client'

import { ArrowUpDown } from 'lucide-react'
import type { SortOption } from '@/types/marketplace'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recommended',   label: 'Recommended' },
  { value: 'highest_rated', label: 'Highest Rated' },
  { value: 'most_reviewed', label: 'Most Reviewed' },
  { value: 'newest',        label: 'Newest' },
  { value: 'alphabetical',  label: 'A–Z' },
  { value: 'price_asc',     label: 'Price: Low to High' },
  { value: 'open_now',      label: 'Open Now First' },
]

interface SortBarProps {
  value: SortOption
  onChange: (sort: SortOption) => void
  resultCount: number
  resultLabel?: string
}

export function SortBar({ value, onChange, resultCount, resultLabel }: SortBarProps) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <p className="text-sm text-[var(--fg-muted)]" aria-live="polite" aria-atomic="true">
        {resultLabel ?? `${resultCount} ${resultCount === 1 ? 'business' : 'businesses'}`}
      </p>

      <div className="flex items-center gap-2">
        <ArrowUpDown className="w-3.5 h-3.5 text-[var(--fg-muted)]" aria-hidden="true" />
        <label htmlFor="sort-select" className="sr-only">
          Sort results
        </label>
        <select
          id="sort-select"
          value={value}
          onChange={(e) => onChange(e.target.value as SortOption)}
          className="text-sm bg-[var(--card)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          {SORT_OPTIONS.map(({ value: v, label: l }) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
