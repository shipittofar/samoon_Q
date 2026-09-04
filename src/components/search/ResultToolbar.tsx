'use client'

import { type ReactNode, type SelectHTMLAttributes } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/utils'

interface SortOption {
  value: string
  label: string
}

interface ResultToolbarProps {
  resultLabel: string
  sortValue: string
  sortOptions: SortOption[]
  onSortChange: (value: string) => void
  sortAriaLabel: string
  filtersLabel?: string
  filtersCount?: number
  onOpenFilters?: () => void
  trailing?: ReactNode
}

export function ResultToolbar({
  resultLabel,
  sortValue,
  sortOptions,
  onSortChange,
  sortAriaLabel,
  filtersLabel,
  filtersCount = 0,
  onOpenFilters,
  trailing,
}: ResultToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-sm text-[var(--fg-muted)] min-w-0" aria-live="polite" aria-atomic="true">
        {resultLabel}
      </p>
      <div className="flex items-center gap-2 ms-auto">
        {onOpenFilters && filtersLabel && (
          <button
            type="button"
            onClick={onOpenFilters}
            className={cn(
              'inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl text-sm font-medium border',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
              filtersCount > 0
                ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-[var(--accent-text)]'
                : 'bg-[var(--card)] border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            {filtersLabel}
            {filtersCount > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] text-[10px] font-bold inline-flex items-center justify-center">
                {filtersCount}
              </span>
            )}
          </button>
        )}
        <SortSelect
          value={sortValue}
          options={sortOptions}
          onChange={onSortChange}
          aria-label={sortAriaLabel}
        />
        {trailing}
      </div>
    </div>
  )
}

interface SortSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SortOption[]
  onChange: (value: string) => void
}

function SortSelect({ value, options, onChange, className, ...rest }: SortSelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-11 ps-3 pe-8 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)]',
          'appearance-none cursor-pointer',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
          className,
        )}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="absolute end-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--fg-muted)] pointer-events-none"
        aria-hidden="true"
      />
    </div>
  )
}
