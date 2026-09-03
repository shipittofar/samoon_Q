'use client'

import { useTranslations } from 'next-intl'
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
  /** Per-category business counts to display next to each chip label. */
  counts?: Record<string, number>
  /** C2: Open Now quick-filter — controlled externally so it integrates with AdvancedFilters state. */
  openNow?: boolean
  onOpenNowChange?: (value: boolean) => void
}

export function CategoryFilter({
  categories,
  selected,
  onChange,
  counts,
  openNow,
  onOpenNowChange,
}: CategoryFilterProps) {
  const t = useTranslations('marketplace')
  if (categories.length === 0) return null

  return (
    <nav aria-label={t('filterByBusinessTypeAria')}>
      <ul className="flex flex-wrap gap-2"role="list">
        {/* "All"chip */}
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
            {t('all')}
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
              {BUSINESS_TYPE_LABELS[cat] ? t(`businessTypes.${cat}`) : cat}
              {/* H6: show per-category count */}
              {counts && counts[cat] != null && (
                <span className="text-xs opacity-60">({counts[cat]})</span>
              )}
            </button>
          </li>
        ))}

        {/* C2: Open Now quick-filter chip — always visible, no panel required */}
        {onOpenNowChange && (
          <li>
            <button
              type="button"
              onClick={() => onOpenNowChange(!openNow)}
              aria-pressed={openNow}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                openNow
                  ? 'bg-[var(--success)] text-[var(--success-fg)]'
                  : 'bg-[var(--card)] border border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--card-hover)]',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', openNow ? 'bg-[var(--card)]' : 'bg-[var(--success)]')} aria-hidden="true"/>
              {t('openNow')}
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}
