'use client'

import { Clock, Store, UtensilsCrossed, MapPin, X } from 'lucide-react'
import { cn } from '@/utils'
import { HighlightText } from './HighlightText'

export type SuggestionKind = 'recent' | 'business' | 'cuisine' | 'city' | 'category'

export interface SuggestionItem {
  id: string
  kind: SuggestionKind
  label: string
  href?: string
  query?: string
}

interface SuggestionRowProps {
  item: SuggestionItem
  query: string
  active?: boolean
  onSelect: (item: SuggestionItem) => void
  onRemove?: (item: SuggestionItem) => void
  removeLabel?: string
}

const ICONS: Record<SuggestionKind, typeof Clock> = {
  recent: Clock,
  business: Store,
  cuisine: UtensilsCrossed,
  city: MapPin,
  category: UtensilsCrossed,
}

export function SuggestionRow({
  item,
  query,
  active,
  onSelect,
  onRemove,
  removeLabel,
}: SuggestionRowProps) {
  const Icon = ICONS[item.kind]
  return (
    <div
      className={cn(
        'flex items-center min-h-11 rounded-xl',
        active && 'bg-[var(--card-hover)]',
      )}
    >
      <button
        type="button"
        id={item.id}
        role="option"
        aria-selected={active}
        onClick={() => onSelect(item)}
        className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2 text-start text-sm text-[var(--fg)] focus-visible:outline-none"
      >
        <Icon className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
        <HighlightText text={item.label} query={query} className="truncate" />
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(item)}
          aria-label={removeLabel}
          className="h-11 w-11 shrink-0 inline-flex items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-xl"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export interface SuggestionGroup {
  id: string
  label: string
  items: SuggestionItem[]
}

interface SuggestionListProps {
  groups: SuggestionGroup[]
  query: string
  activeId?: string
  listId: string
  labelledBy?: string
  onSelect: (item: SuggestionItem) => void
  onRemoveRecent?: (item: SuggestionItem) => void
  removeRecentLabel?: (query: string) => string
}

export function SuggestionList({
  groups,
  query,
  activeId,
  listId,
  labelledBy,
  onSelect,
  onRemoveRecent,
  removeRecentLabel,
}: SuggestionListProps) {
  const visible = groups.filter((g) => g.items.length > 0)
  if (visible.length === 0) return null

  return (
    <div id={listId} role="listbox" aria-labelledby={labelledBy} className="flex flex-col gap-4">
      {visible.map((group) => (
        <section key={group.id} className="flex flex-col gap-1">
          <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
            {group.label}
          </h3>
          {group.items.map((item) => (
            <SuggestionRow
              key={item.id}
              item={item}
              query={query}
              active={activeId === item.id}
              onSelect={onSelect}
              onRemove={item.kind === 'recent' ? onRemoveRecent : undefined}
              removeLabel={item.kind === 'recent' ? removeRecentLabel?.(item.label) : undefined}
            />
          ))}
        </section>
      ))}
    </div>
  )
}
