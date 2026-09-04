'use client'

import { type ReactNode } from 'react'
import { cn } from '@/utils'
import { ChipRail } from './ChipRail'
import { FilterChip } from './FilterChip'

export interface ScopeItem {
  id: string
  label: string
}

interface ScopeScrollerProps {
  items: ScopeItem[]
  selected: string
  onChange: (id: string) => void
  ariaLabel: string
  /** `filter` = Discover type chips. `nav` = Menu category spine. */
  variant?: 'filter' | 'nav'
  trailing?: ReactNode
}

export function ScopeScroller({
  items,
  selected,
  onChange,
  ariaLabel,
  variant = 'filter',
  trailing,
}: ScopeScrollerProps) {
  if (variant === 'nav') {
    return (
      <ChipRail role="tablist" aria-label={ariaLabel}>
        {items.map((item) => {
          const isSelected = selected === item.id
          return (
            <button
              key={item.id || 'all'}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onChange(item.id)}
              className={cn(
                'relative min-h-11 px-3 text-sm whitespace-nowrap shrink-0 snap-start',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-lg',
                isSelected
                  ? 'text-[var(--fg)] font-semibold'
                  : 'text-[var(--fg-muted)] hover:text-[var(--fg)]',
              )}
            >
              {item.label}
              <span
                className={cn(
                  'absolute inset-x-3 bottom-1 h-0.5 rounded-full',
                  isSelected ? 'bg-[var(--accent)]' : 'bg-transparent',
                )}
                aria-hidden="true"
              />
            </button>
          )
        })}
        {trailing}
      </ChipRail>
    )
  }

  return (
    <ChipRail role="list" aria-label={ariaLabel}>
      {items.map((item) => (
        <div key={item.id || 'all'} role="listitem" className="snap-start">
          <FilterChip selected={selected === item.id} onClick={() => onChange(item.id)}>
            {item.label}
          </FilterChip>
        </div>
      ))}
      {trailing}
    </ChipRail>
  )
}
