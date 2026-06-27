'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, Store, SearchX, Sparkles, TrendingUp, Star, Flame } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { BusinessCard } from '@/components/marketplace/BusinessCard'
import { BusinessSearch } from '@/components/marketplace/BusinessSearch'
import { CategoryFilter } from '@/components/marketplace/CategoryFilter'
import { AdvancedFilters } from '@/components/marketplace/AdvancedFilters'
import { SortBar } from '@/components/marketplace/SortBar'
import { usePublicTenants } from '@/hooks'
import {
  getMarketplaceMeta,
  matchesSearch,
  matchesCategory,
  matchesFilters,
  sortItems,
  hasActiveFilters,
  countActiveFilters,
  DEFAULT_FILTERS,
} from '@/types/marketplace'
import type { FilterState, SortOption } from '@/types/marketplace'
import { debounce } from '@/utils'
import type { Tenant } from '@/types'
import type { MarketplaceMeta } from '@/types/marketplace'

// ── Types ─────────────────────────────────────────────────────────────────────

type TenantWithMeta = { tenant: Tenant; meta: MarketplaceMeta }

function withMeta(tenants: Tenant[]): TenantWithMeta[] {
  return tenants.flatMap((t) => {
    const meta = getMarketplaceMeta(t.settings)
    return meta ? [{ tenant: t, meta }] : []
  })
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  title,
  items,
  icon,
}: {
  title: string
  items: TenantWithMeta[]
  icon?: React.ReactNode
}) {
  if (items.length === 0) return null
  const id = `section-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  return (
    <section aria-labelledby={id} className="mb-12">
      <h2 id={id} className="text-xl font-semibold text-[var(--fg)] mb-5 flex items-center gap-2">
        {icon && <span aria-hidden="true">{icon}</span>}
        {title}
      </h2>
      <BusinessGrid items={items} />
    </section>
  )
}

function BusinessGrid({ items }: { items: TenantWithMeta[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {items.map(({ tenant, meta }) => (
        <BusinessCard key={tenant.id} tenant={tenant} meta={meta} />
      ))}
    </div>
  )
}

// ── Loading / Error ───────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className="h-72 rounded-2xl bg-[var(--card)] border border-[var(--border)] animate-pulse"
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({
  query,
  category,
  hasFilters,
  onClearAll,
  topItems,
}: {
  query: string
  category: string
  hasFilters: boolean
  onClearAll: () => void
  topItems: TenantWithMeta[]
}) {
  const suggestions = [
    { label: 'Restaurants', href: '/discover?category=restaurant' },
    { label: 'Cafés', href: '/discover?category=cafe' },
    { label: 'Bars', href: '/discover?category=bar' },
  ]

  return (
    <div className="py-16">
      <div className="flex flex-col items-center text-center mb-10">
        <SearchX className="w-12 h-12 text-[var(--fg-muted)] mb-4" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-2">No businesses found</h3>
        <p className="text-[var(--fg-muted)] text-sm max-w-sm mb-6">
          {query && category
            ? `No ${category} businesses match "${query}". Try adjusting your search or filters.`
            : query
              ? `No businesses match "${query}". Try a different term or browse by category.`
              : hasFilters
                ? 'No businesses match the active filters. Try removing some.'
                : 'No businesses in this category yet.'}
        </p>
        {(query || category || hasFilters) && (
          <button
            type="button"
            onClick={onClearAll}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Suggested categories */}
      {suggestions.length > 0 && (
        <div className="max-w-sm mx-auto">
          <p className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-widest mb-3 text-center">
            Try browsing
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="px-4 py-2 rounded-full border border-[var(--border)] text-sm text-[var(--fg-muted)] hover:bg-[var(--card-hover)] transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Featured fallback */}
      {topItems.length > 0 && (
        <div className="mt-12">
          <p className="text-sm font-semibold text-[var(--fg-muted)] mb-5 text-center">
            Popular businesses you might like
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {topItems.slice(0, 3).map(({ tenant, meta }) => (
              <BusinessCard key={tenant.id} tenant={tenant} meta={meta} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DiscoverClientPage() {
  const { data: tenants = [], isLoading, isError } = usePublicTenants()

  // Search state
  const [rawQuery, setRawQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  // Category chip filter
  const [selectedCategory, setSelectedCategory] = useState('')
  // Advanced filter panel
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  // Sort
  const [sortBy, setSortBy] = useState<SortOption>('recommended')

  // Debounce: update the actual filter 300ms after last keystroke
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const applySearch = useCallback(
    debounce((q: string) => setSearchQuery(q), 300),
    [],
  )

  function handleSearchChange(q: string) {
    setRawQuery(q)
    applySearch(q)
  }

  function clearAll() {
    setRawQuery('')
    setSearchQuery('')
    setSelectedCategory('')
    setFilters(DEFAULT_FILTERS)
  }

  // Build list with marketplace metadata
  const allWithMeta = useMemo(() => withMeta(tenants), [tenants])

  // Derive available filter options from data
  const availableCategories = useMemo(() => {
    const seen = new Set<string>()
    allWithMeta.forEach(({ tenant }) => tenant.businessTypes.forEach((bt) => seen.add(bt)))
    return Array.from(seen)
  }, [allWithMeta])

  const availableCuisines = useMemo(() => {
    const seen = new Set<string>()
    allWithMeta.forEach(({ meta }) => meta.cuisines.forEach((c) => seen.add(c)))
    return Array.from(seen).sort()
  }, [allWithMeta])

  const availableCities = useMemo(() => {
    const seen = new Set<string>()
    allWithMeta.forEach(({ meta }) => seen.add(meta.city))
    return Array.from(seen).sort()
  }, [allWithMeta])

  const availableAmenities = useMemo(() => {
    const seen = new Set<string>()
    allWithMeta.forEach(({ meta }) => (meta.amenities ?? []).forEach((a) => seen.add(a)))
    return Array.from(seen).sort()
  }, [allWithMeta])

  // Apply search + category + advanced filters + sort
  const filtered = useMemo(() => {
    let result = allWithMeta

    if (selectedCategory) {
      result = result.filter(({ tenant }) => matchesCategory(tenant.businessTypes, selectedCategory))
    }

    if (searchQuery) {
      result = result.filter(({ tenant, meta }) =>
        matchesSearch(tenant.name, meta, tenant.businessTypes, searchQuery),
      )
    }

    if (hasActiveFilters(filters)) {
      result = result.filter(({ tenant, meta }) => {
        const flags = (tenant.settings?.featureFlags as Record<string, boolean | undefined>) ?? {}
        return matchesFilters(meta, flags, filters)
      })
    }

    return sortItems(result, sortBy)
  }, [allWithMeta, searchQuery, selectedCategory, filters, sortBy])

  const isFiltering = !!searchQuery || !!selectedCategory || hasActiveFilters(filters)
  const filterCount = countActiveFilters(filters)

  // Collections for discovery view
  const featured  = useMemo(() => allWithMeta.filter(({ meta }) => meta.featured), [allWithMeta])
  const popular   = useMemo(() => allWithMeta.filter(({ meta }) => meta.popular && !meta.featured), [allWithMeta])
  const newest    = useMemo(() => allWithMeta.filter(({ meta }) => meta.isNew), [allWithMeta])
  const topRated  = useMemo(
    () => sortItems([...allWithMeta], 'highest_rated').filter(({ meta }) => meta.rating >= 4.5),
    [allWithMeta],
  )
  const familyFriendly = useMemo(
    () => allWithMeta.filter(({ meta }) => meta.tags.includes('Family Friendly')),
    [allWithMeta],
  )
  const coffeeShops = useMemo(
    () => allWithMeta.filter(({ tenant }) =>
      tenant.businessTypes.some((t) => ['cafe', 'mobile_cafe'].includes(t)),
    ),
    [allWithMeta],
  )

  return (
    <>
      <Header />

      <main id="main-content">
        {/* ── Hero ── */}
        <section
          className="relative bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-stone-900 dark:via-stone-950 dark:to-stone-900 border-b border-[var(--border)] py-16 px-4"
          aria-labelledby="discover-heading"
        >
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-[var(--accent)] mb-3">
              Discover
            </p>
            <h1
              id="discover-heading"
              className="text-4xl sm:text-5xl font-bold text-[var(--fg)] mb-4"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Find Your Next{' '}
              <span className="text-[var(--accent)]">Favourite Spot</span>
            </h1>
            <p className="text-[var(--fg-muted)] text-lg mb-8 max-w-xl mx-auto">
              Browse restaurants, cafés, bars, food trucks and more — all on one platform.
            </p>

            <BusinessSearch
              value={rawQuery}
              onChange={handleSearchChange}
              placeholder="Search by name, city, cuisine, amenity, or type…"
            />
          </div>
        </section>

        {/* ── Body ── */}
        <div className="max-w-7xl mx-auto px-4 py-10">
          {/* Category chips + filters row */}
          {!isLoading && (
            <div className="mb-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <CategoryFilter
                  categories={availableCategories}
                  selected={selectedCategory}
                  onChange={setSelectedCategory}
                />
                <div className="ml-auto">
                  <AdvancedFilters
                    availableCuisines={availableCuisines}
                    availableCities={availableCities}
                    availableAmenities={availableAmenities}
                    filters={filters}
                    onChange={setFilters}
                    onReset={() => setFilters(DEFAULT_FILTERS)}
                    activeCount={filterCount}
                    isOpen={showFilters}
                    onToggle={() => setShowFilters((o) => !o)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error state */}
          {isError && (
            <div className="py-20 text-center" role="alert">
              <Store className="w-12 h-12 text-[var(--fg-muted)] mx-auto mb-4" aria-hidden="true" />
              <p className="text-[var(--fg-muted)]">Failed to load businesses. Please try again.</p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div aria-live="polite" aria-busy="true">
              <div className="flex items-center gap-2 text-[var(--fg-muted)] mb-6">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span className="sr-only">Loading businesses…</span>
              </div>
              <LoadingSkeleton />
            </div>
          )}

          {/* Results */}
          {!isLoading && !isError && (
            <div aria-live="polite" aria-atomic="false">
              {isFiltering ? (
                /* ── Filtered view ── */
                <>
                  <div className="mb-6">
                    <SortBar
                      value={sortBy}
                      onChange={setSortBy}
                      resultCount={filtered.length}
                      resultLabel={
                        filtered.length === 0
                          ? 'No results'
                          : `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}${searchQuery ? ` for "${searchQuery}"` : ''}`
                      }
                    />
                  </div>

                  {filtered.length > 0 ? (
                    <section aria-label="Search results">
                      <BusinessGrid items={filtered} />
                    </section>
                  ) : (
                    <EmptyState
                      query={searchQuery}
                      category={selectedCategory}
                      hasFilters={hasActiveFilters(filters)}
                      onClearAll={clearAll}
                      topItems={featured.length > 0 ? featured : popular}
                    />
                  )}
                </>
              ) : (
                /* ── Discovery view — curated collections ── */
                <>
                  {/* Sort bar for "All Businesses" discovery */}
                  <div className="mb-8">
                    <SortBar
                      value={sortBy}
                      onChange={setSortBy}
                      resultCount={allWithMeta.length}
                      resultLabel={`${allWithMeta.length} ${allWithMeta.length === 1 ? 'business' : 'businesses'} on the platform`}
                    />
                  </div>

                  <Section title="Featured" items={featured} icon={<Sparkles className="w-5 h-5 text-orange-400" />} />
                  <Section title="Popular Right Now" items={popular} icon={<Flame className="w-5 h-5 text-red-400" />} />
                  <Section title="Newly Opened" items={newest} icon={<span>🆕</span>} />
                  <Section title="Top Rated" items={topRated} icon={<Star className="w-5 h-5 text-amber-400" />} />
                  <Section title="Family Friendly" items={familyFriendly} icon={<span>👨‍👩‍👧</span>} />
                  <Section title="Coffee Shops" items={coffeeShops} icon={<span>☕</span>} />

                  <section aria-labelledby="all-businesses-heading" className="mb-12">
                    <div className="flex items-center gap-2 mb-5">
                      <TrendingUp className="w-5 h-5 text-[var(--fg-muted)]" aria-hidden="true" />
                      <h2 id="all-businesses-heading" className="text-xl font-semibold text-[var(--fg)]">
                        All Businesses
                      </h2>
                      <span className="text-sm text-[var(--fg-muted)] ml-auto">{allWithMeta.length} listed</span>
                    </div>
                    {allWithMeta.length > 0 ? (
                      <BusinessGrid items={sortItems([...allWithMeta], sortBy)} />
                    ) : (
                      <EmptyState
                        query=""
                        category=""
                        hasFilters={false}
                        onClearAll={clearAll}
                        topItems={[]}
                      />
                    )}
                  </section>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  )
}
