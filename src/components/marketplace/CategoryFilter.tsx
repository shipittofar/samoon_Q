'use client'

import { cn } from '@/utils'
import { BUSINESS_TYPE_LABELS } from '@/types/marketplace'

const ICONS: Record<string, string> = {
  restaurant:  '🍽️',
  cafe:        '☕',
  bar:         '🍸',
  food_court:  '🏬',
  food_truck:  '🚚',
  mobile_cafe: '🚐',
  hotel:       '🏨',
  other:       '🍴',
}

interface CategoryFilterProps {
  /** Available business type keys derived from the fetched tenant list. */
  categories: string[]
  selected: string
  onChange: (category: string) => void
}

export function CategoryFilter({ categories, selected, onChange }: CategoryFilterProps) {
  if (categories.length === 0) return null

  return (
    <nav aria-label="Filter by business type">
      <ul className="flex flex-wrap gap-2" role="list">
        {/* "All" chip */}
        <li>
          <button
            type="button"
            onClick={() => onChange('')}
            aria-pressed={selected === ''}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors',
              selected === ''
                ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                : 'bg-[var(--card)] border border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--card-hover)]',
            )}
          >
            All
          </button>
        </li>

        {categories.map((cat) => (
          <li key={cat}>
            <button
              type="button"
              onClick={() => onChange(cat)}
              aria-pressed={selected === cat}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                selected === cat
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                  : 'bg-[var(--card)] border border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--card-hover)]',
              )}
            >
              <span aria-hidden="true">{ICONS[cat] ?? '🍴'}</span>
              {BUSINESS_TYPE_LABELS[cat] ?? cat}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
