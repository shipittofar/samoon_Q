'use client'

import { X, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/utils'
import { type FilterState, PRICE_LEVEL_LABELS } from '@/types/marketplace'

const SERVICE_OPTIONS = [
  { key: 'reservations.enabled', label: 'Reservations' },
  { key: 'loyalty.enabled', label: 'Loyalty Program' },
]

interface AdvancedFiltersProps {
  availableCuisines: string[]
  availableCities: string[]
  availableAmenities: string[]
  filters: FilterState
  onChange: (f: FilterState) => void
  onReset: () => void
  activeCount: number
  isOpen: boolean
  onToggle: () => void
}

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
        active
          ? 'bg-[var(--accent)] text-[var(--accent-fg)] border-transparent'
          : 'bg-[var(--card)] border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--card-hover)]',
      )}
    >
      {label}
    </button>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[var(--fg)] uppercase tracking-widest mb-2">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function AdvancedFilters({
  availableCuisines,
  availableCities,
  availableAmenities,
  filters,
  onChange,
  onReset,
  activeCount,
  isOpen,
  onToggle,
}: AdvancedFiltersProps) {
  return (
    <div>
      {/* Toggle button */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="advanced-filters-panel"
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors',
          activeCount > 0
            ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400'
            : 'bg-[var(--card)] border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--card-hover)]',
        )}
      >
        <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
        Filters
        {activeCount > 0 && (
          <span
            className="h-5 w-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center"
            aria-label={`${activeCount} active filters`}
          >
            {activeCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          id="advanced-filters-panel"
          className="mt-3 p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-5"
          role="region"
          aria-label="Advanced filters"
        >
          <div className="flex items-center justify-between">
            <p className="font-semibold text-[var(--fg)]">Advanced Filters</p>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="flex items-center gap-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                aria-label="Clear all filters"
              >
                <X className="w-3 h-3" aria-hidden="true" />
                Clear all ({activeCount})
              </button>
            )}
          </div>

          {/* Open Now toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={filters.openNow}
              onClick={() => onChange({ ...filters, openNow: !filters.openNow })}
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1',
                filters.openNow ? 'bg-emerald-500' : 'bg-[var(--border)]',
              )}
            >
              <span
                className={cn(
                  'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                  filters.openNow ? 'translate-x-4' : 'translate-x-0.5',
                )}
              />
              <span className="sr-only">Open Now</span>
            </button>
            <span className="text-sm text-[var(--fg-muted)]">Open Now only</span>
          </div>

          {/* Price Level */}
          <FilterSection title="Price Level">
            {([1, 2, 3, 4] as const).map((p) => (
              <Chip
                key={p}
                label={PRICE_LEVEL_LABELS[p]}
                active={filters.priceLevels.includes(p)}
                onClick={() => onChange({ ...filters, priceLevels: toggle(filters.priceLevels, p) })}
              />
            ))}
          </FilterSection>

          {/* Cuisines */}
          {availableCuisines.length > 0 && (
            <FilterSection title="Cuisine">
              {availableCuisines.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={filters.cuisines.includes(c)}
                  onClick={() => onChange({ ...filters, cuisines: toggle(filters.cuisines, c) })}
                />
              ))}
            </FilterSection>
          )}

          {/* Cities */}
          {availableCities.length > 1 && (
            <FilterSection title="City">
              {availableCities.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={filters.cities.includes(c)}
                  onClick={() => onChange({ ...filters, cities: toggle(filters.cities, c) })}
                />
              ))}
            </FilterSection>
          )}

          {/* Services */}
          <FilterSection title="Services">
            {SERVICE_OPTIONS.map(({ key, label }) => (
              <Chip
                key={key}
                label={label}
                active={filters.services.includes(key)}
                onClick={() => onChange({ ...filters, services: toggle(filters.services, key) })}
              />
            ))}
          </FilterSection>

          {/* Amenities */}
          {availableAmenities.length > 0 && (
            <FilterSection title="Amenities">
              {availableAmenities.map((a) => (
                <Chip
                  key={a}
                  label={a}
                  active={filters.amenities.includes(a)}
                  onClick={() => onChange({ ...filters, amenities: toggle(filters.amenities, a) })}
                />
              ))}
            </FilterSection>
          )}
        </div>
      )}
    </div>
  )
}
