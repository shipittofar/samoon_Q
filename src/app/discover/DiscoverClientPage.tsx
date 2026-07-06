'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Loader2, Store, SearchX, Sparkles, Star, Flame } from 'lucide-react'
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
    <section aria-labelledby={id} className="mb-14">
      {/* H5: upgraded section heading typography for stronger hierarchy */}
      <h2
        id={id}
        className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-6 flex items-center gap-2 pb-3 border-b border-[var(--border)]"
      >
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
      {Array.from({ length: 8 }).map((_, i) => (
        <div
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
  const t = useTranslations('discover')
  const tHome = useTranslations('home')
  const suggestions = [
    { label: tHome('categories.restaurants'), href: '/discover?category=restaurant' },
    { label: tHome('categories.cafes'), href: '/discover?category=cafe' },
    { label: tHome('categories.bars'), href: '/discover?category=bar' },
  ]

  return (
    <div className="py-16">
      <div className="flex flex-col items-center text-center mb-10">
        <SearchX className="w-12 h-12 text-[var(--fg-muted)] mb-4" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-2">{t('noBusinessesFound')}</h3>
        <p className="text-[var(--fg-muted)] text-sm max-w-sm mb-6">
          {query && category
            ? t('noMatchCategoryQuery', { category, query })
            : query
              ? t('noMatchQuery', { query })
              : hasFilters
                ? t('noMatchFilters')
                : t('noBusinessesCategory')}
        </p>
        {(query || category || hasFilters) && (
          <button
            type="button"
            onClick={onClearAll}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
          >
            {t('clearAllFilters')}
          </button>
        )}
      </div>

      {/* Suggested categories */}
      {suggestions.length > 0 && (
        <div className="max-w-sm mx-auto">
          <p className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-widest mb-3 text-center">
            {t('tryBrowsing')}
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
            {t('popularBusinessesYouMightLike')}
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
  const t = useTranslations('discover')
  const { data: tenants = [], isLoading, isError } = usePublicTenants()
  const router = useRouter()
  const searchParams = useSearchParams()

  // C4: Initialise state from URL on mount
  const [rawQuery, setRawQuery] = useState(() => searchParams.get('q') ?? '')
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '')
  const [selectedCategory, setSelectedCategory] = useState(() => searchParams.get('category') ?? '')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...DEFAULT_FILTERS,
    openNow: searchParams.get('openNow') === '1',
  }))
  const [sortBy, setSortBy] = useState<SortOption>(
    () => (searchParams.get('sort') as SortOption | null) ?? 'recommended',
  )

  // C4: Sync URL whenever key state changes (replace to avoid polluting history)
  useEffect(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (selectedCategory) params.set('category', selectedCategory)
    if (filters.openNow) params.set('openNow', '1')
    if (sortBy !== 'recommended') params.set('sort', sortBy)
    const qs = params.toString()
    router.replace(qs ? `/discover?${qs}` : '/discover', { scroll: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedCategory, filters.openNow, sortBy])

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

  function handleFiltersChange(next: FilterState) {
    setFilters(next)
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

  // H6: per-category counts for chip labels
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    allWithMeta.forEach(({ tenant }) => {
      tenant.businessTypes.forEach((bt) => {
        counts[bt] = (counts[bt] ?? 0) + 1
      })
    })
    return counts
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
        {/* ── Hero — C1: reduced vertical padding so cards appear closer to fold ── */}
        <section
          className="relative bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-stone-900 dark:via-stone-950 dark:to-stone-900 border-b border-[var(--border)] py-10 px-4"
          aria-labelledby="discover-heading"
        >
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-[var(--accent)] mb-2">
              {t('eyebrow')}
            </p>
            <h1
              id="discover-heading"
              className="text-3xl sm:text-4xl font-bold text-[var(--fg)] mb-3"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('headingPrefix')}{' '}
              <span className="text-[var(--accent)]">{t('headingAccent')}</span>
            </h1>
            {/* H7: platform capability subtext */}
            <p className="text-[var(--fg-muted)] text-base mb-6 max-w-xl mx-auto">
              {t('subtitle')}
            </p>

            <BusinessSearch
              value={rawQuery}
              onChange={handleSearchChange}
              placeholder={t('searchPlaceholder')}
            />
          </div>
        </section>

        {/* ── Body ── */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Category chips + Open Now + filters row */}
          {!isLoading && (
            <div className="mb-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <CategoryFilter
                  categories={availableCategories}
                  selected={selectedCategory}
                  onChange={setSelectedCategory}
                  counts={categoryCounts}
                  openNow={filters.openNow}
                  onOpenNowChange={(val) => handleFiltersChange({ ...filters, openNow: val })}
                />
                <div className="shrink-0">
                  <AdvancedFilters
                    availableCuisines={availableCuisines}
                    availableCities={availableCities}
                    availableAmenities={availableAmenities}
                    filters={filters}
                    onChange={handleFiltersChange}
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
              <p className="text-[var(--fg-muted)]">{t('errorLoad')}</p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div aria-live="polite" aria-busy="true">
              <div className="flex items-center gap-2 text-[var(--fg-muted)] mb-6">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span className="sr-only">{t('loadingBusinesses')}</span>
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
                        searchQuery
                          ? t('resultsCountForQuery', { count: filtered.length, query: searchQuery })
                          : t('resultsCount', { count: filtered.length })
                      }
                    />
                  </div>

                  {filtered.length > 0 ? (
                    <section aria-label={t('searchResultsAria')}>
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
                /* H3: SortBar removed from discovery mode — it only affects "All Businesses"
                   at the bottom and misleads users into thinking it reorders the curated sections above. */
                <>
                  <Section title={t('sectionFeatured')} items={featured} icon={<Sparkles className="w-5 h-5 text-orange-400" />} />
                  <Section title={t('sectionPopular')} items={popular} icon={<Flame className="w-5 h-5 text-red-400" />} />
                  <Section title={t('sectionNewlyOpened')} items={newest} icon={<span>🆕</span>} />
                  <Section title={t('sectionTopRated')} items={topRated} icon={<Star className="w-5 h-5 text-amber-400" />} />
                  <Section title={t('sectionFamilyFriendly')} items={familyFriendly} icon={<span>👨‍👩‍👧</span>} />
                  <Section title={t('sectionCoffeeShops')} items={coffeeShops} icon={<span>☕</span>} />

                  <section aria-labelledby="all-businesses-heading" className="mb-12">
                    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[var(--border)]">
                      <h2
                        id="all-businesses-heading"
                        className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]"
                      >
                        {t('allBusinesses')}
                      </h2>
                      <span className="text-sm text-[var(--fg-muted)] ml-auto">{t('listedCount', { count: allWithMeta.length })}</span>
                    </div>
                    {/* Sort bar only inside "All Businesses" section where it is accurate */}
                    {allWithMeta.length > 0 && (
                      <div className="mb-5">
                        <SortBar
                          value={sortBy}
                          onChange={setSortBy}
                          resultCount={allWithMeta.length}
                          resultLabel={t('sortBusinesses', { count: allWithMeta.length })}
                        />
                      </div>
                    )}
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
