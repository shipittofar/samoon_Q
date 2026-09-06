'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, Store } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { BusinessCard } from '@/components/marketplace/BusinessCard'
import { Button } from '@/components/ui/Button'
import { useDiscover } from '@/hooks'
import {
  matchesSearch,
  matchesCategory,
  matchesFilters,
  sortItems,
  hasActiveFilters,
  countActiveFilters,
  DEFAULT_FILTERS,
  getMarketplaceMeta,
  collectBranchCuisines,
  collectBranchAmenities,
  BUSINESS_TYPE_LABELS,
} from '@/types/marketplace'
import type { FilterState, SortOption } from '@/types/marketplace'
import { debounce } from '@/utils'
import type { Tenant } from '@/types'
import type { MarketplaceMeta } from '@/types/marketplace'
import type { DiscoverItem } from '@/lib/discover-adapter'
import {
  SearchField,
  SearchOverlay,
  ScopeScroller,
  FilterSheet,
  FilterSection,
  FilterChip,
  ActiveFilterRow,
  ResultToolbar,
  EmptySearch,
  CollectionRail,
  CollectionRailCard,
  useRecentSearches,
  buildDiscoverSuggestions,
  PRICE_LEVEL_SYMBOLS,
} from '@/components/search'
import type { SuggestionItem } from '@/components/search'
import type { ActiveFilter } from '@/components/search'

export type TenantWithMeta = { tenant: Tenant; meta: MarketplaceMeta }
export type DiscoverRow = DiscoverItem

const SERVICE_OPTIONS = [
  { key: 'reservations.enabled', labelKey: 'reservations' },
  { key: 'loyalty.enabled', labelKey: 'loyaltyProgram' },
] as const

const SORT_OPTION_KEYS: { value: SortOption; labelKey: string }[] = [
  { value: 'recommended', labelKey: 'recommended' },
  { value: 'highest_rated', labelKey: 'highestRated' },
  { value: 'most_reviewed', labelKey: 'mostReviewed' },
  { value: 'newest', labelKey: 'newest' },
  { value: 'alphabetical', labelKey: 'alphabetical' },
  { value: 'price_asc', labelKey: 'priceLowToHigh' },
  { value: 'open_now', labelKey: 'openNowFirst' },
]

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]
}

/**
 * Phase Z.6.2 — previously dropped any tenant whose `settings.marketplace`
 * was absent entirely. Every tenant is now kept.
 */
export function withMeta(tenants: Tenant[]): TenantWithMeta[] {
  return tenants.map((t) => ({ tenant: t, meta: getMarketplaceMeta(t.settings) ?? {} }))
}

function BusinessGrid({
  items,
  highlightQuery,
}: {
  items: DiscoverItem[]
  highlightQuery?: string
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map(({ tenant, meta, branches }) => (
        <BusinessCard
          key={tenant.id}
          tenant={tenant}
          meta={meta}
          branches={branches}
          highlightQuery={highlightQuery}
        />
      ))}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-72 rounded-2xl bg-[var(--card)] border border-[var(--border)] animate-pulse"
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

export function DiscoverClientPage() {
  const t = useTranslations('discover')
  const tMarket = useTranslations('marketplace')
  const tSearch = useTranslations('searchUi')
  const { data: discoverItems = [], isLoading, isError } = useDiscover()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [overlayOpen, setOverlayOpen] = useState(false)
  const [draftQuery, setDraftQuery] = useState(() => searchParams.get('q') ?? '')
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
  const recents = useRecentSearches('discover')
  const ignoreFocusRef = useRef(false)

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

  const commitSearch = useCallback(
    (q: string) => {
      const next = q.trim()
      ignoreFocusRef.current = true
      setDraftQuery(next)
      setSearchQuery(next)
      setOverlayOpen(false)
      if (next) recents.add(next)
    },
    [recents.add],
  )

  const handleSuggestion = useCallback(
    (item: SuggestionItem) => {
      if (item.href) {
        recents.add(item.label)
        router.push(item.href)
        return
      }
      commitSearch(item.query ?? item.label)
    },
    [commitSearch, recents.add, router],
  )

  const allWithMeta = useMemo(() => discoverItems, [discoverItems])

  const availableCategories = useMemo(() => {
    const seen = new Set<string>()
    allWithMeta.forEach(({ tenant }) => tenant.businessTypes.forEach((bt) => seen.add(bt)))
    return Array.from(seen)
  }, [allWithMeta])

  const availableCuisines = useMemo(() => {
    const seen = new Set<string>()
    allWithMeta.forEach(({ branches, meta }) => {
      collectBranchCuisines(branches ?? meta.branches).forEach((c) => seen.add(c))
    })
    return Array.from(seen).sort()
  }, [allWithMeta])

  const availableCities = useMemo(() => {
    const seen = new Set<string>()
    allWithMeta.forEach(({ meta }) => { if (meta.city) seen.add(meta.city) })
    return Array.from(seen).sort()
  }, [allWithMeta])

  const availableAmenities = useMemo(() => {
    const seen = new Set<string>()
    allWithMeta.forEach(({ branches, meta }) => {
      collectBranchAmenities(branches ?? meta.branches).forEach((a) => seen.add(a))
    })
    return Array.from(seen).sort()
  }, [allWithMeta])

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
        const flags = tenant.settings?.featureFlags ?? {}
        return matchesFilters(meta, flags, filters)
      })
    }
    return sortItems(result, sortBy)
  }, [allWithMeta, searchQuery, selectedCategory, filters, sortBy])

  const isSearchMode = !!searchQuery
  const filterCount = countActiveFilters(filters)

  const featured = useMemo(() => allWithMeta.filter(({ meta }) => meta.featured), [allWithMeta])
  const popular = useMemo(() => allWithMeta.filter(({ meta }) => meta.popular && !meta.featured), [allWithMeta])
  const newest = useMemo(() => allWithMeta.filter(({ meta }) => meta.isNew), [allWithMeta])
  const topRated = useMemo(
    () => sortItems([...allWithMeta], 'highest_rated').filter(({ meta }) => (meta.rating ?? 0) >= 4.5),
    [allWithMeta],
  )

  const rails = useMemo(() => {
    const candidates = [
      { key: 'featured', title: t('sectionFeatured'), items: featured },
      { key: 'popular', title: t('sectionPopular'), items: popular },
      { key: 'new', title: t('sectionNewlyOpened'), items: newest },
    ].filter((rail) => rail.items.length > 0)
    if (candidates.length < 2 && topRated.length > 0) {
      candidates.push({ key: 'rated', title: t('sectionTopRated'), items: topRated })
    }
    return candidates.slice(0, 3)
  }, [featured, popular, newest, topRated, t])

  const suggestionGroups = useMemo(
    () => buildDiscoverSuggestions(draftQuery, allWithMeta),
    [draftQuery, allWithMeta],
  )

  const scopeItems = useMemo(
    () => [
      { id: '', label: tMarket('all') },
      ...availableCategories.map((cat) => ({
        id: cat,
        label: BUSINESS_TYPE_LABELS[cat] ? tMarket(`businessTypes.${cat}`) : cat,
      })),
    ],
    [availableCategories, tMarket],
  )

  const shortcutItems = scopeItems.filter((s) => s.id).slice(0, 3)

  const activeFilterChips: ActiveFilter[] = useMemo(() => {
    const chips: ActiveFilter[] = []
    if (filters.openNow) chips.push({ id: 'openNow', label: tMarket('openNow') })
    filters.priceLevels.forEach((p) =>
      chips.push({ id: `price-${p}`, label: PRICE_LEVEL_SYMBOLS[p] ?? String(p) }),
    )
    filters.cuisines.forEach((c) => chips.push({ id: `cuisine-${c}`, label: c }))
    filters.cities.forEach((c) => chips.push({ id: `city-${c}`, label: c }))
    filters.services.forEach((s) => {
      const opt = SERVICE_OPTIONS.find((o) => o.key === s)
      chips.push({ id: `service-${s}`, label: opt ? tMarket(opt.labelKey) : s })
    })
    filters.amenities.forEach((a) => chips.push({ id: `amenity-${a}`, label: a }))
    return chips
  }, [filters, tMarket])

  function removeActiveFilter(id: string) {
    if (id === 'openNow') {
      setFilters((f) => ({ ...f, openNow: false }))
      return
    }
    if (id.startsWith('price-')) {
      const n = Number(id.slice(6))
      setFilters((f) => ({ ...f, priceLevels: f.priceLevels.filter((p) => p !== n) }))
      return
    }
    if (id.startsWith('cuisine-')) {
      const v = id.slice(8)
      setFilters((f) => ({ ...f, cuisines: f.cuisines.filter((c) => c !== v) }))
      return
    }
    if (id.startsWith('city-')) {
      const v = id.slice(5)
      setFilters((f) => ({ ...f, cities: f.cities.filter((c) => c !== v) }))
      return
    }
    if (id.startsWith('service-')) {
      const v = id.slice(8)
      setFilters((f) => ({ ...f, services: f.services.filter((s) => s !== v) }))
      return
    }
    if (id.startsWith('amenity-')) {
      const v = id.slice(8)
      setFilters((f) => ({ ...f, amenities: f.amenities.filter((a) => a !== v) }))
    }
  }

  function clearAll() {
    setDraftQuery('')
    setSearchQuery('')
    setSelectedCategory('')
    setFilters(DEFAULT_FILTERS)
  }

  const resultLabel = searchQuery
    ? t('resultsCountForQuery', { count: filtered.length, query: searchQuery })
    : t('resultsCount', { count: filtered.length })

  const sortOptions = SORT_OPTION_KEYS.map(({ value, labelKey }) => ({
    value,
    label: tMarket(`sortOptions.${labelKey}`),
  }))

  return (
    <>
      <Header />

      <main id="main-content">
        <h1 className="sr-only">{t('headingPrefix')} {t('headingAccent')}</h1>

        <div className="sticky top-16 z-30 bg-[var(--bg)]/95 backdrop-blur-xl border-b border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 py-2 space-y-2">
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault()
                commitSearch(draftQuery)
              }}
            >
              <SearchField
                variant="chrome"
                value={overlayOpen ? draftQuery : searchQuery}
                onChange={(q) => {
                  setDraftQuery(q)
                  if (!overlayOpen) setOverlayOpen(true)
                }}
                onFocus={() => {
                  if (ignoreFocusRef.current) {
                    ignoreFocusRef.current = false
                    return
                  }
                  setDraftQuery(searchQuery)
                  setOverlayOpen(true)
                }}
                onSubmitQuery={commitSearch}
                onClear={() => {
                  setDraftQuery('')
                  setSearchQuery('')
                }}
                label={tMarket('searchBusinesses')}
                clearLabel={tSearch('clear')}
                placeholder={t('searchPlaceholder')}
              />
            </form>

            {!isLoading && (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <ScopeScroller
                    items={scopeItems}
                    selected={selectedCategory}
                    onChange={setSelectedCategory}
                    ariaLabel={tMarket('filterByBusinessTypeAria')}
                    variant="filter"
                  />
                </div>
                <FilterChip
                  selected={filterCount > 0}
                  onClick={() => setShowFilters(true)}
                  count={filterCount > 0 ? filterCount : undefined}
                >
                  {tSearch('filters')}
                </FilterChip>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          {isError && (
            <div className="py-20 text-center" role="alert">
              <Store className="w-12 h-12 text-[var(--fg-muted)] mx-auto mb-4" aria-hidden="true" />
              <p className="text-[var(--fg-muted)]">{t('errorLoad')}</p>
            </div>
          )}

          {isLoading && (
            <div aria-live="polite" aria-busy="true">
              <span className="sr-only">{t('loadingBusinesses')}</span>
              <div className="flex items-center gap-2 text-[var(--fg-muted)] mb-6">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              </div>
              <LoadingSkeleton />
            </div>
          )}

          {!isLoading && !isError && (
            <div>
              {isSearchMode ? (
                <>
                  <div className="mb-4 space-y-3">
                    <ResultToolbar
                      resultLabel={resultLabel}
                      sortValue={sortBy}
                      sortOptions={sortOptions}
                      onSortChange={(v) => setSortBy(v as SortOption)}
                      sortAriaLabel={tMarket('sortResults')}
                    />
                    <ActiveFilterRow
                      filters={activeFilterChips}
                      onRemove={removeActiveFilter}
                      ariaLabel={tSearch('activeFilters')}
                      removeLabel={(label) => tSearch('removeFilter', { label })}
                    />
                  </div>

                  {filtered.length > 0 ? (
                    <section aria-label={t('searchResultsAria')}>
                      <BusinessGrid items={filtered} highlightQuery={searchQuery} />
                    </section>
                  ) : (
                    <EmptySearch
                      title={t('noBusinessesFound')}
                      description={
                        selectedCategory
                          ? t('noMatchCategoryQuery', { category: selectedCategory, query: searchQuery })
                          : t('noMatchQuery', { query: searchQuery })
                      }
                      action={
                        <Button onClick={clearAll}>{t('clearAllFilters')}</Button>
                      }
                    >
                      <div className="flex flex-wrap justify-center gap-2 -mt-4 mb-8">
                        {shortcutItems.map((s) => (
                          <FilterChip
                            key={s.id}
                            onClick={() => {
                              setSearchQuery('')
                              setDraftQuery('')
                              setFilters(DEFAULT_FILTERS)
                              setSelectedCategory(s.id)
                            }}
                          >
                            {s.label}
                          </FilterChip>
                        ))}
                      </div>
                    </EmptySearch>
                  )}
                </>
              ) : (
                <>
                  {rails.map((rail) => (
                    <CollectionRail key={rail.key} title={rail.title}>
                      {rail.items.slice(0, 8).map(({ tenant, meta, branches }) => (
                        <CollectionRailCard key={tenant.id}>
                          <BusinessCard tenant={tenant} meta={meta} branches={branches} />
                        </CollectionRailCard>
                      ))}
                    </CollectionRail>
                  ))}

                  <section aria-labelledby="all-businesses-heading" className={rails.length > 0 ? 'mt-2' : undefined}>
                    <h2
                      id="all-businesses-heading"
                      className="font-[var(--font-display)] text-lg sm:text-xl font-semibold text-[var(--fg)] mb-2"
                    >
                      {t('allBusinesses')}
                    </h2>
                    {allWithMeta.length > 0 && (
                      <div className="mb-4">
                        <ResultToolbar
                          resultLabel={t('listedCount', { count: filtered.length })}
                          sortValue={sortBy}
                          sortOptions={sortOptions}
                          onSortChange={(v) => setSortBy(v as SortOption)}
                          sortAriaLabel={tMarket('sortResults')}
                        />
                      </div>
                    )}
                    {filtered.length > 0 ? (
                      <BusinessGrid items={filtered} />
                    ) : (
                      <EmptySearch
                        title={t('noBusinessesFound')}
                        description={
                          selectedCategory
                            ? t('noBusinessesCategory')
                            : hasActiveFilters(filters)
                              ? t('noMatchFilters')
                              : undefined
                        }
                        action={
                          (selectedCategory || hasActiveFilters(filters)) ? (
                            <Button onClick={clearAll}>{t('clearAllFilters')}</Button>
                          ) : undefined
                        }
                      />
                    )}
                  </section>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      <SearchOverlay
        open={overlayOpen}
        value={draftQuery}
        onChange={setDraftQuery}
        onClose={() => {
          ignoreFocusRef.current = true
          setOverlayOpen(false)
          setDraftQuery(searchQuery)
        }}
        onSubmit={commitSearch}
        onSelectSuggestion={handleSuggestion}
        recents={recents.items}
        onRemoveRecent={recents.remove}
        suggestionGroups={suggestionGroups}
        placeholder={t('searchPlaceholder')}
        label={tMarket('searchBusinesses')}
        shortcuts={shortcutItems}
        onShortcut={(id) => {
          ignoreFocusRef.current = true
          setOverlayOpen(false)
          setSelectedCategory(id)
        }}
      />

      <FilterSheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        title={tSearch('filters')}
        dirty={filterCount > 0}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      >
        <FilterSection title={tMarket('openNow')}>
          <FilterChip
            selected={filters.openNow}
            onClick={() => setFilters((f) => ({ ...f, openNow: !f.openNow }))}
          >
            {tMarket('openNow')}
          </FilterChip>
        </FilterSection>
        <FilterSection title={tMarket('priceLevel')}>
          {([1, 2, 3, 4] as const).map((p) => (
            <FilterChip
              key={p}
              selected={filters.priceLevels.includes(p)}
              onClick={() => setFilters((f) => ({ ...f, priceLevels: toggle(f.priceLevels, p) }))}
            >
              {PRICE_LEVEL_SYMBOLS[p]} · {tMarket(`priceLevels.${p}`)}
            </FilterChip>
          ))}
        </FilterSection>
        {availableCuisines.length > 0 && (
          <FilterSection title={tMarket('cuisine')}>
            {availableCuisines.map((c) => (
              <FilterChip
                key={c}
                selected={filters.cuisines.includes(c)}
                onClick={() => setFilters((f) => ({ ...f, cuisines: toggle(f.cuisines, c) }))}
              >
                {c}
              </FilterChip>
            ))}
          </FilterSection>
        )}
        {availableCities.length > 1 && (
          <FilterSection title={tMarket('city')}>
            {availableCities.map((c) => (
              <FilterChip
                key={c}
                selected={filters.cities.includes(c)}
                onClick={() => setFilters((f) => ({ ...f, cities: toggle(f.cities, c) }))}
              >
                {c}
              </FilterChip>
            ))}
          </FilterSection>
        )}
        <FilterSection title={tMarket('services')}>
          {SERVICE_OPTIONS.map(({ key, labelKey }) => (
            <FilterChip
              key={key}
              selected={filters.services.includes(key)}
              onClick={() => setFilters((f) => ({ ...f, services: toggle(f.services, key) }))}
            >
              {tMarket(labelKey)}
            </FilterChip>
          ))}
        </FilterSection>
        {availableAmenities.length > 0 && (
          <FilterSection title={tMarket('amenities')}>
            {availableAmenities.map((a) => (
              <FilterChip
                key={a}
                selected={filters.amenities.includes(a)}
                onClick={() => setFilters((f) => ({ ...f, amenities: toggle(f.amenities, a) }))}
              >
                {a}
              </FilterChip>
            ))}
          </FilterSection>
        )}
      </FilterSheet>

      <Footer />
    </>
  )
}
