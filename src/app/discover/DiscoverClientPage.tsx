'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LocationChip } from '@/components/location/LocationChip'
import Link from 'next/link'
import { List, Loader2, Map as MapIcon, Route, Store, X } from 'lucide-react'
import { DiscoverMap } from '@/components/location/DiscoverMap'
import { useUserLocation } from '@/hooks/location'
import { useNavigationStore } from '@/stores/navigation-store'
import { computeNearby, rankNearby, matchesMenuQuery, type NearbyResult } from '@/lib/nearby'
import { readMapsSettings } from '@/lib/maps/config'
import type { GeoPoint } from '@/types/branch'
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
  countAdvancedFilters,
  DEFAULT_FILTERS,
  getMarketplaceMeta,
  collectBranchCuisines,
  collectBranchAmenities,
  BUSINESS_TYPE_LABELS,
} from '@/types/marketplace'
import type { FilterState, SortOption } from '@/types/marketplace'
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
  { value: 'nearest', labelKey: 'nearest' },
  { value: 'highest_rated', labelKey: 'highestRated' },
  { value: 'most_reviewed', labelKey: 'mostReviewed' },
  { value: 'newest', labelKey: 'newest' },
  { value: 'alphabetical', labelKey: 'alphabetical' },
  { value: 'price_asc', labelKey: 'priceLowToHigh' },
  { value: 'open_now', labelKey: 'openNowFirst' },
]

const SORT_VALUES = new Set<string>(SORT_OPTION_KEYS.map((o) => o.value))

export type DiscoverQueryState = {
  q: string
  category: string
  openNow: boolean
  sort: SortOption
  /** Phase L3 — list (default) or split list + map. */
  view: 'list' | 'map'
  /** Phase L3 — only businesses whose service area covers the customer. */
  near: boolean
}

export function parseDiscoverQuery(searchParams: { get: (key: string) => string | null }): DiscoverQueryState {
  const sort = searchParams.get('sort')
  return {
    q: searchParams.get('q') ?? '',
    category: searchParams.get('category') ?? '',
    openNow: searchParams.get('openNow') === '1',
    sort: sort && SORT_VALUES.has(sort) ? (sort as SortOption) : 'recommended',
    view: searchParams.get('view') === 'map' ? 'map' : 'list',
    near: searchParams.get('near') === '1',
  }
}

export function serializeDiscoverQuery(state: DiscoverQueryState): string {
  const params = new URLSearchParams()
  if (state.q) params.set('q', state.q)
  if (state.category) params.set('category', state.category)
  if (state.openNow) params.set('openNow', '1')
  if (state.sort !== 'recommended') params.set('sort', state.sort)
  if (state.near) params.set('near', '1')
  if (state.view === 'map') params.set('view', 'map')
  return params.toString()
}

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

type ProximityProps = {
  nearby?: Map<string, NearbyResult<DiscoverItem>>
  highlightedId?: string | null
  onHover?: (tenantId: string | null) => void
}

function BusinessGrid({
  items,
  highlightQuery,
  compact,
  nearby,
  highlightedId,
  onHover,
}: {
  items: DiscoverItem[]
  highlightQuery?: string
  /** Split (map) view: fewer columns. */
  compact?: boolean
} & ProximityProps) {
  return (
    <div className={compact ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-5' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'}>
      {items.map(({ tenant, meta, branches }) => (
        <BusinessCard
          key={tenant.id}
          tenant={tenant}
          meta={meta}
          branches={branches}
          highlightQuery={highlightQuery}
          proximity={nearby?.get(tenant.id)?.best}
          highlighted={highlightedId === tenant.id}
          onHoverChange={onHover ? (h) => onHover(h ? tenant.id : null) : undefined}
        />
      ))}
    </div>
  )
}

/** Rail "Near you": serving or close businesses, within this distance. */
const NEAR_YOU_MAX_KM = 15

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
  const tNear = useTranslations('nearby')
  const { data: discoverItems = [], isLoading, isError } = useDiscover()
  const router = useRouter()
  const searchParams = useSearchParams()
  const url = useMemo(() => parseDiscoverQuery(searchParams), [searchParams])
  const searchQuery = url.q
  const selectedCategory = url.category
  const sortBy = url.sort

  const [overlayOpen, setOverlayOpen] = useState(false)
  const [draftQuery, setDraftQuery] = useState(() => url.q)
  const [showFilters, setShowFilters] = useState(false)
  const [advancedFilters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const filters: FilterState = useMemo(
    () => ({ ...advancedFilters, openNow: url.openNow }),
    [advancedFilters, url.openNow],
  )
  const recents = useRecentSearches('discover')

  // Phase L3 — where to measure from: a map area the customer chose, else their location.
  const { location } = useUserLocation()
  const maxRadiusKm = useMemo(() => readMapsSettings().maxServiceRadiusKm, [])
  // Phase L4 — a travel mode the customer picked in Directions changes card ETAs too.
  const travelPref = useNavigationStore((s) => s.travelMode)
  const travelMode = travelPref === 'auto' ? undefined : travelPref
  const [areaCenter, setAreaCenter] = useState<GeoPoint | null>(null)
  const origin = areaCenter ?? location.point
  // The platform default centre is a guess — don't print distances from it.
  const located = areaCenter !== null || location.source !== 'default'
  const isMap = url.view === 'map'
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const ignoreFocusRef = useRef(false)

  useEffect(() => {
    if (!overlayOpen) setDraftQuery(searchQuery)
  }, [searchQuery, overlayOpen])

  const replaceDiscoverQuery = useCallback(
    (patch: Partial<DiscoverQueryState>) => {
      const qs = serializeDiscoverQuery({ ...url, ...patch })
      if (qs === serializeDiscoverQuery(url)) return
      router.replace(qs ? `/discover?${qs}` : '/discover', { scroll: false })
    },
    [router, url],
  )

  const setSelectedCategory = useCallback(
    (category: string) => replaceDiscoverQuery({ category }),
    [replaceDiscoverQuery],
  )

  const setSortBy = useCallback(
    (sort: SortOption) => replaceDiscoverQuery({ sort }),
    [replaceDiscoverQuery],
  )

  const commitSearch = useCallback(
    (q: string) => {
      const next = q.trim()
      ignoreFocusRef.current = true
      setDraftQuery(next)
      setOverlayOpen(false)
      replaceDiscoverQuery({ q: next })
      if (next) recents.add(next)
    },
    [recents.add, replaceDiscoverQuery],
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

  const nearbyResults = useMemo(
    () => computeNearby(allWithMeta, origin, { maxRadiusKm, itemQuery: searchQuery, travelMode }),
    [allWithMeta, origin, maxRadiusKm, searchQuery, travelMode],
  )
  const nearbyById = useMemo(
    () => new Map(nearbyResults.map((r) => [r.item.tenant.id, r])),
    [nearbyResults],
  )

  const isSearchMode = !!searchQuery
  // Item search ("pizza") or a chosen map area ranks by distance unless the customer picked a sort.
  const rankByDistance = located && (sortBy === 'nearest' || (sortBy === 'recommended' && (isSearchMode || areaCenter !== null)))

  const filtered = useMemo(() => {
    let result = allWithMeta
    if (selectedCategory) {
      result = result.filter(({ tenant }) => matchesCategory(tenant.businessTypes, selectedCategory))
    }
    if (searchQuery) {
      result = result.filter(({ tenant, meta, branches }) =>
        matchesSearch(tenant.name, meta, tenant.businessTypes, searchQuery) ||
        matchesMenuQuery(branches, searchQuery),
      )
    }
    if (hasActiveFilters(filters)) {
      result = result.filter(({ tenant, meta }) => {
        const flags = tenant.settings?.featureFlags ?? {}
        return matchesFilters(meta, flags, filters)
      })
    }
    if (url.near && located) {
      result = result.filter(({ tenant }) => nearbyById.get(tenant.id)?.best?.inside === true)
    }
    if (rankByDistance) {
      const keep = new Set(result)
      return rankNearby(nearbyResults.filter((r) => keep.has(r.item))).map((r) => r.item)
    }
    return sortItems(result, sortBy === 'nearest' ? 'recommended' : sortBy)
  }, [allWithMeta, searchQuery, selectedCategory, filters, sortBy, url.near, located, nearbyById, nearbyResults, rankByDistance])

  const cardNearby = located ? nearbyById : undefined
  const mapResults = useMemo(
    () => filtered.map((i) => nearbyById.get(i.tenant.id)).filter((r): r is NearbyResult<DiscoverItem> => !!r),
    [filtered, nearbyById],
  )
  const nearYou = useMemo(
    () =>
      located && !areaCenter
        ? rankNearby(nearbyResults)
            .filter((r) => r.best && (r.best.inside || r.best.distanceKm <= NEAR_YOU_MAX_KM))
            .map((r) => r.item)
        : [],
    [located, areaCenter, nearbyResults],
  )
  const selectedOnMap = highlightedId ? filtered.find((i) => i.tenant.id === highlightedId) : undefined

  const selectFromMap = useCallback((tenantId: string) => {
    setHighlightedId(tenantId)
    if (typeof document !== 'undefined') {
      document
        .querySelector(`[data-discover-list] [data-tenant-id="${CSS.escape(tenantId)}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [])
  const filterCount = countAdvancedFilters(filters)
  const showRails = !selectedCategory && !isMap

  const featured = useMemo(() => allWithMeta.filter(({ meta }) => meta.featured), [allWithMeta])
  const popular = useMemo(() => allWithMeta.filter(({ meta }) => meta.popular && !meta.featured), [allWithMeta])
  const newest = useMemo(() => allWithMeta.filter(({ meta }) => meta.isNew), [allWithMeta])
  const topRated = useMemo(
    () => sortItems([...allWithMeta], 'highest_rated').filter(({ meta }) => (meta.rating ?? 0) >= 4.5),
    [allWithMeta],
  )

  const rails = useMemo(() => {
    const candidates = [
      ...(nearYou.length > 0 ? [{ key: 'near', title: tNear('nearYouRail'), items: nearYou }] : []),
      { key: 'featured', title: t('sectionFeatured'), items: featured },
      { key: 'popular', title: t('sectionPopular'), items: popular },
      { key: 'new', title: t('sectionNewlyOpened'), items: newest },
    ].filter((rail) => rail.items.length > 0)
    if (candidates.length < 2 && topRated.length > 0) {
      candidates.push({ key: 'rated', title: t('sectionTopRated'), items: topRated })
    }
    return candidates.slice(0, nearYou.length > 0 ? 4 : 3)
  }, [featured, popular, newest, topRated, t, tNear, nearYou])

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
    setFilters(DEFAULT_FILTERS)
    setAreaCenter(null)
    replaceDiscoverQuery({ q: '', category: '', openNow: false, sort: 'recommended', near: false })
  }

  function resetAdvancedFilters() {
    setFilters((f) => ({ ...DEFAULT_FILTERS, openNow: f.openNow }))
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
            {/* Phase L2 — where we think the customer is, one tap to correct it. */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <LocationChip />
              {/* Phase L5 — multi-stop day planner */}
              <Link
                href="/plan"
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-[var(--accent-text)] hover:bg-[var(--accent-subtle)]"
                data-testid="plan-my-day-link"
              >
                <Route className="h-4 w-4" aria-hidden="true" />
                {tNear('planMyDay')}
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <form
                className="min-w-0 flex-1"
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
                    replaceDiscoverQuery({ q: '' })
                  }}
                  label={tMarket('searchBusinesses')}
                  clearLabel={tSearch('clear')}
                  placeholder={t('searchPlaceholder')}
                />
              </form>
              <FilterChip
                className="shrink-0"
                selected={filters.openNow}
                onClick={() => replaceDiscoverQuery({ openNow: !filters.openNow })}
              >
                {tMarket('openNow')}
              </FilterChip>
              {located && (
                <FilterChip
                  className="shrink-0"
                  selected={url.near}
                  onClick={() => replaceDiscoverQuery({ near: !url.near })}
                >
                  {tNear('servesMe')}
                </FilterChip>
              )}
              <button
                type="button"
                onClick={() => replaceDiscoverQuery({ view: isMap ? 'list' : 'map' })}
                aria-pressed={isMap}
                className="hidden lg:inline-flex shrink-0 min-h-[36px] items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-[var(--fg)] hover:bg-[var(--card-hover)]"
              >
                {isMap ? <List className="h-4 w-4" aria-hidden="true" /> : <MapIcon className="h-4 w-4" aria-hidden="true" />}
                {isMap ? tNear('hideMap') : tNear('showMap')}
              </button>
            </div>
            {areaCenter && (
              <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]" data-testid="area-search">
                <span>{tNear('searchingArea')}</span>
                <button
                  type="button"
                  onClick={() => setAreaCenter(null)}
                  className="inline-flex items-center gap-1 text-[var(--accent-text)] hover:underline"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  {tNear('resetArea')}
                </button>
              </div>
            )}

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

        <div
          className={isMap ? 'max-w-[1600px] mx-auto px-4 py-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6' : 'max-w-7xl mx-auto px-4 py-6'}
        >
          {isMap && !isLoading && !isError && (
            <aside className="order-2 lg:order-none lg:col-start-2 lg:row-start-1">
              <div className="lg:sticky lg:top-56 h-[calc(100dvh-16rem)] min-h-[320px] lg:h-[calc(100dvh-15rem)]">
                <DiscoverMap
                  results={mapResults}
                  user={located ? origin : null}
                  highlightedTenantId={highlightedId}
                  onSelectTenant={selectFromMap}
                  onSearchArea={(c) => {
                    setAreaCenter(c)
                    setHighlightedId(null)
                  }}
                  className="h-full"
                />
              </div>
              {selectedOnMap && (
                <div className="mt-3 lg:hidden">
                  <BusinessCard
                    tenant={selectedOnMap.tenant}
                    meta={selectedOnMap.meta}
                    branches={selectedOnMap.branches}
                    proximity={cardNearby?.get(selectedOnMap.tenant.id)?.best}
                  />
                </div>
              )}
            </aside>
          )}
          <div className={isMap ? 'hidden lg:block lg:col-start-1 lg:row-start-1 min-w-0' : undefined} data-discover-list>
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
                      <BusinessGrid
                        items={filtered}
                        highlightQuery={searchQuery}
                        compact={isMap}
                        nearby={cardNearby}
                        highlightedId={highlightedId}
                        onHover={isMap ? setHighlightedId : undefined}
                      />
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
                              setFilters(DEFAULT_FILTERS)
                              setDraftQuery('')
                              replaceDiscoverQuery({ q: '', category: s.id, openNow: false })
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
                  {showRails && rails.map((rail) => (
                    <CollectionRail key={rail.key} title={rail.title}>
                      {rail.items.slice(0, 8).map(({ tenant, meta, branches }) => (
                        <CollectionRailCard key={tenant.id}>
                          <BusinessCard
                            tenant={tenant}
                            meta={meta}
                            branches={branches}
                            proximity={cardNearby?.get(tenant.id)?.best}
                          />
                        </CollectionRailCard>
                      ))}
                    </CollectionRail>
                  ))}

                  <section aria-labelledby="all-businesses-heading" className={showRails && rails.length > 0 ? 'mt-2' : undefined}>
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
                      <BusinessGrid
                        items={filtered}
                        compact={isMap}
                        nearby={cardNearby}
                        highlightedId={highlightedId}
                        onHover={isMap ? setHighlightedId : undefined}
                      />
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
        </div>

        {/* Phase L3 — mobile list ⇄ map toggle */}
        {!isLoading && !isError && (
          <button
            type="button"
            onClick={() => replaceDiscoverQuery({ view: isMap ? 'list' : 'map' })}
            className="lg:hidden fixed left-1/2 z-40 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-[var(--fg)] px-5 py-3 text-sm font-semibold text-[var(--bg)] shadow-xl"
            style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
            data-testid="discover-view-toggle"
          >
            {isMap ? <List className="h-4 w-4" aria-hidden="true" /> : <MapIcon className="h-4 w-4" aria-hidden="true" />}
            {isMap ? tNear('showList') : tNear('showMap')}
          </button>
        )}
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
        onReset={resetAdvancedFilters}
      >
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
