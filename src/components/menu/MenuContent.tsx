'use client'

import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { TenantHeader } from '@/components/layout/TenantHeader'
import { Footer } from '@/components/layout/Footer'
import { FoodCard } from '@/components/menu/FoodCard'
import { LazyFoodDetailModal } from '@/components/menu/LazyFoodDetailModal'
import { MenuTagLabel } from '@/components/menu/MenuTagBadge'
import { FoodCardSkeleton } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { useCategories, useMenuItems, useAvailableMenuTags, useActiveBranchId } from '@/hooks'
import { useRecentlyViewedStore, useCartItemCount } from '@/stores'
import { cn, debounce } from '@/utils'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { CategoryQuickNav } from '@/components/menu/CategoryQuickNav'
import type { MenuItem } from '@/types'
import type { MenuFilters } from '@/services/menu.service'
import { DEFAULT_PAGE_SIZE } from '@/utils/pagination'
import {
  MENU_ALL_ANCHOR_ID,
  groupMenuItemsByCategory,
  menuCategorySectionId,
  resolveActiveMenuCategory,
} from '@/lib/menu-category-sections'
import {
  SearchField,
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
  PRICE_LEVEL_SYMBOLS,
  bandsToPriceRange,
} from '@/components/search'
import type { ActiveFilter } from '@/components/search'

function MenuItemGrid({
  items,
  compact = false,
  highlightQuery = '',
  reduceMotion,
  onOpenDetail,
}: {
  items: MenuItem[]
  compact?: boolean
  highlightQuery?: string
  reduceMotion: boolean
  onOpenDetail: (item: MenuItem) => void
}) {
  return (
    <motion.div
      layout={!reduceMotion}
      className={cn(
        'grid gap-6',
        compact ? 'grid-cols-1 max-w-2xl' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      )}
    >
      <AnimatePresence mode="popLayout">
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            layout={!reduceMotion}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ delay: reduceMotion ? 0 : Math.min(i * 0.04, 0.2) }}
          >
            <FoodCard
              item={item}
              compact={compact}
              highlightQuery={highlightQuery}
              onOpenDetail={onOpenDetail}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

interface MenuContentProps {
  /** Branch slug to scope the menu to. Falls back to the customer's active branch (useBranchStore) when omitted. */
  branchId?: string
}

function parseTagIdsFromUrl(raw: string | null): number[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0)
}

function parsePriceBands(raw: string | null): number[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => n >= 1 && n <= 3)
}

export function MenuContent({ branchId }: MenuContentProps = {}) {
  const t = useTranslations('menu')
  const tCommon = useTranslations('common')
  const tSearch = useTranslations('searchUi')
  const reduceMotion = useReducedMotion()

  const SORT_OPTIONS = [
    { value: 'popular', label: t('sortOptions.popular') },
    { value: 'rating', label: t('sortOptions.rating') },
    { value: 'price_asc', label: t('sortOptions.priceAsc') },
    { value: 'price_desc', label: t('sortOptions.priceDesc') },
    { value: 'newest', label: t('sortOptions.newest') },
  ]

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const categoryFromUrl = searchParams.get('category') || ''
  const qFromUrl = searchParams.get('q') || ''
  const selectedTagIds = useMemo(
    () => parseTagIdsFromUrl(searchParams.get('tags')),
    [searchParams],
  )
  const priceBandsFromUrl = useMemo(
    () => parsePriceBands(searchParams.get('price')),
    [searchParams],
  )

  const [activeCategory, setActiveCategory] = useState(categoryFromUrl)
  const [search, setSearch] = useState(qFromUrl)
  const [debouncedSearch, setDebouncedSearch] = useState(qFromUrl)
  const [sort, setSort] = useState<MenuFilters['sort']>('popular')
  const [showFilters, setShowFilters] = useState(false)
  const [priceBands, setPriceBands] = useState<number[]>(priceBandsFromUrl)
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const categoryBarRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const categoriesButtonRef = useRef<HTMLButtonElement>(null)
  const [quickNavOpen, setQuickNavOpen] = useState(false)
  const [quickNavCategoryId, setQuickNavCategoryId] = useState('')
  const [scrollOffset, setScrollOffset] = useState(0)
  const recents = useRecentSearches('menu')
  const { items: recentlyViewed } = useRecentlyViewedStore()
  const cartCount = useCartItemCount()
  const fallbackBranchId = useActiveBranchId()
  const scopedBranchId = branchId ?? fallbackBranchId

  const isSearching = debouncedSearch.trim().length > 0

  const debouncedSetSearch = useCallback(
    debounce((v: string) => setDebouncedSearch(v), 350),
    [],
  )

  const handleSearch = (v: string) => {
    setSearch(v)
    debouncedSetSearch(v)
  }

  const { data: categories, isLoading: catsLoading, isError: categoriesError } = useCategories(branchId)
  const {
    data: availableTags,
    isLoading: tagsLoading,
    isError: tagsError,
  } = useAvailableMenuTags(branchId)

  const categoryFilterId = useMemo(() => {
    if (!activeCategory) return undefined
    const match = categories?.find(
      (c) => c.slug === activeCategory || c.id === activeCategory,
    )
    return match?.id
  }, [activeCategory, categories])

  const priceRange = bandsToPriceRange(priceBands)

  const browsingAll = !activeCategory && !debouncedSearch

  const filters: MenuFilters = {
    category: categoryFilterId,
    search: debouncedSearch || undefined,
    sort,
    min_price: priceRange.min,
    max_price: priceRange.max,
    available: onlyAvailable ? true : undefined,
    tags: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    // All view only. Category tabs and search keep the previous unpaged request.
    // page_size is the documented list param; sections are built from this page.
    ...(browsingAll ? { page: 1, page_size: DEFAULT_PAGE_SIZE } : {}),
  }

  const { data, isLoading } = useMenuItems(branchId, filters)
  const items = data?.results || []

  const { sections, unmatched } = useMemo(
    () => groupMenuItemsByCategory(categoriesError ? undefined : categories, items),
    [categories, categoriesError, items],
  )
  const showCategorySections = browsingAll && !categoriesError && sections.length > 0 && !isLoading
  const canQuickNav = showCategorySections

  const replaceParams = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString())
    const before = params.toString()
    mutate(params)
    const after = params.toString()
    if (after === before) return
    router.replace(after ? `${pathname}?${after}` : pathname, { scroll: false })
  }

  const syncTagsToUrl = (tagIds: number[]) => {
    replaceParams((params) => {
      if (tagIds.length > 0) params.set('tags', tagIds.join(','))
      else params.delete('tags')
    })
  }

  const handleCategoryChange = (slug: string) => {
    setActiveCategory(slug)
    replaceParams((params) => {
      if (slug) params.set('category', slug)
      else params.delete('category')
    })
  }

  useEffect(() => {
    setActiveCategory(categoryFromUrl)
  }, [categoryFromUrl])

  useEffect(() => {
    if (qFromUrl !== debouncedSearch) {
      setSearch(qFromUrl)
      setDebouncedSearch(qFromUrl)
    }
    // Only follow URL → state when the URL itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qFromUrl])

  useEffect(() => {
    replaceParams((params) => {
      if (debouncedSearch) params.set('q', debouncedSearch)
      else params.delete('q')
      if (priceBands.length > 0) params.set('price', priceBands.join(','))
      else params.delete('price')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, priceBands])

  useEffect(() => {
    if (!categoryBarRef.current) return
    const active = categoryBarRef.current.querySelector('[aria-selected="true"]') as HTMLElement | null
    active?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' })
  }, [activeCategory, reduceMotion])

  useEffect(() => {
    if (canQuickNav) return
    setQuickNavOpen(false)
    setQuickNavCategoryId('')
  }, [canQuickNav])

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return
    const update = () => {
      const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 0
      const toolbarHeight = toolbar.getBoundingClientRect().height
      setScrollOffset(Math.ceil(headerHeight + toolbarHeight + 12))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(toolbar)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [catsLoading, isLoading])

  useEffect(() => {
    if (!showCategorySections) return
    const nodes = sections
      .map((section) => document.getElementById(menuCategorySectionId(section.id)))
      .filter((node): node is HTMLElement => node instanceof HTMLElement)
    if (nodes.length === 0) return

    const sectionIds = sections.map((section) => section.id)
    const observer = new IntersectionObserver(
      () => {
        const tops = new Map<string, number>()
        for (const node of nodes) tops.set(node.id, node.getBoundingClientRect().top)
        const next = resolveActiveMenuCategory(sectionIds, tops, scrollOffset)
        setQuickNavCategoryId((prev) => (prev === next ? prev : next))
      },
      {
        root: null,
        rootMargin: `-${scrollOffset}px 0px -40% 0px`,
        threshold: [0, 0.25, 0.5, 1],
      },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [showCategorySections, sections, scrollOffset])

  const closeQuickNav = () => {
    setQuickNavOpen(false)
    categoriesButtonRef.current?.focus({ preventScroll: true })
  }

  const scrollToCategorySection = (categoryId: string) => {
    const targetId = categoryId ? menuCategorySectionId(categoryId) : MENU_ALL_ANCHOR_ID
    const target = document.getElementById(targetId)
    if (!target) return
    setQuickNavCategoryId(categoryId)
    target.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  const chooseQuickNavCategory = (categoryId: string) => {
    setQuickNavOpen(false)
    scrollToCategorySection(categoryId)
    categoriesButtonRef.current?.focus({ preventScroll: true })
  }

  const handleOpenDetail = (item: MenuItem) => {
    setSelectedItem(item)
    setModalOpen(true)
  }

  const toggleTag = (tagId: number) => {
    const next = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId]
    syncTagsToUrl(next)
  }

  const clearFilters = () => {
    setPriceBands([])
    setOnlyAvailable(false)
    setSort('popular')
    setSearch('')
    setDebouncedSearch('')
    setActiveCategory('')
    replaceParams((params) => {
      params.delete('category')
      params.delete('tags')
      params.delete('q')
      params.delete('price')
    })
  }

  const sheetDirty = priceBands.length > 0 || selectedTagIds.length > 0

  const showTagFilters = !!scopedBranchId && !tagsError && (tagsLoading || (availableTags?.length ?? 0) > 0)

  const categoryItems = useMemo(
    () => [
      { id: '', label: t('allCategories') },
      ...(categories ?? []).map((cat) => ({ id: cat.slug, label: cat.name })),
    ],
    [categories, t],
  )

  const activeFilterChips: ActiveFilter[] = useMemo(() => {
    const chips: ActiveFilter[] = []
    priceBands.forEach((b) => chips.push({ id: `price-${b}`, label: PRICE_LEVEL_SYMBOLS[b] ?? String(b) }))
    availableTags
      ?.filter((tag) => selectedTagIds.includes(tag.id))
      .forEach((tag) => chips.push({ id: `tag-${tag.id}`, label: tag.name }))
    return chips
  }, [priceBands, availableTags, selectedTagIds])

  function removeActiveFilter(id: string) {
    if (id.startsWith('price-')) {
      const n = Number(id.slice(6))
      setPriceBands((prev) => prev.filter((b) => b !== n))
      return
    }
    if (id.startsWith('tag-')) {
      const n = Number(id.slice(4))
      syncTagsToUrl(selectedTagIds.filter((tid) => tid !== n))
    }
  }

  const resultLabel = isSearching
    ? t('resultsForQuery', { count: items.length, query: debouncedSearch })
    : t('itemsFound', { count: items.length })

  const showRecent = !isSearching && !activeCategory && recentlyViewed.length > 0

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <TenantHeader />

      <div ref={toolbarRef} className="sticky top-16 z-30 bg-[var(--bg)]/95 backdrop-blur-xl border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-1.5">
          <form
            role="search"
            className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center"
            onSubmit={(e) => {
              e.preventDefault()
              setDebouncedSearch(search)
              if (search.trim()) recents.add(search.trim())
            }}
          >
            <SearchField
              className="w-full min-w-0 min-[480px]:flex-1"
              variant="chrome"
              value={search}
              onChange={handleSearch}
              onClear={() => {
                setSearch('')
                setDebouncedSearch('')
              }}
              label={t('searchAriaLabel')}
              clearLabel={t('clearSearch')}
              placeholder={t('searchPlaceholder')}
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                aria-pressed={onlyAvailable}
                aria-label={t('availableToggleAria')}
                onClick={() => setOnlyAvailable((v) => !v)}
                className={cn(
                  'shrink-0 min-h-11 px-3 rounded-xl text-sm font-medium border',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                  onlyAvailable
                    ? 'bg-[var(--accent)] text-[var(--accent-fg)] border-transparent'
                    : 'bg-[var(--card)] text-[var(--fg-muted)] border-[var(--border)]',
                )}
              >
                {t('available')}
              </button>
              <button
                ref={categoriesButtonRef}
                type="button"
                aria-expanded={quickNavOpen}
                aria-controls="menu-category-quick-nav"
                aria-label={t('categoriesNavAria')}
                disabled={!canQuickNav}
                onClick={() => setQuickNavOpen((open) => !open)}
                className={cn(
                  'inline-flex items-center gap-1 shrink-0 min-h-11 px-3 rounded-xl text-sm font-medium border',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  quickNavOpen
                    ? 'bg-[var(--accent)] text-[var(--accent-fg)] border-transparent'
                    : 'bg-[var(--card)] text-[var(--fg-muted)] border-[var(--border)]',
                )}
              >
                {t('categoriesNav')}
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 motion-reduce:transition-none transition-transform duration-[var(--search-motion)]',
                    quickNavOpen && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              </button>
            </div>
          </form>

          <CategoryQuickNav
            open={quickNavOpen}
            anchorRef={categoriesButtonRef}
            sections={sections}
            activeId={quickNavCategoryId}
            title={t('categoriesNav')}
            allLabel={t('allCategories')}
            closeLabel={tCommon('close')}
            listLabel={t('categoryQuickNavAria')}
            onClose={closeQuickNav}
            onSelect={chooseQuickNavCategory}
          />

          <div ref={categoryBarRef} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              {catsLoading ? (
                <div className="flex gap-2 overflow-hidden py-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-11 w-24 rounded-lg bg-[var(--card-hover)] animate-pulse shrink-0" />
                  ))}
                </div>
              ) : (
                <ScopeScroller
                  items={categoryItems}
                  selected={activeCategory}
                  onChange={handleCategoryChange}
                  ariaLabel={t('categoriesAriaLabel')}
                  variant="nav"
                />
              )}
            </div>
            <FilterChip
              selected={sheetDirty}
              onClick={() => setShowFilters(true)}
              count={sheetDirty ? priceBands.length + selectedTagIds.length : undefined}
            >
              {tSearch('filters')}
            </FilterChip>
          </div>
        </div>
      </div>

      <main className={cn('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6', cartCount > 0 && 'pb-28')}>
        <div className="mb-4 space-y-3">
          <ResultToolbar
            resultLabel={
              isLoading || (browsingAll && catsLoading && !categories)
                ? tCommon('loading')
                : resultLabel
            }
            sortValue={sort ?? 'popular'}
            sortOptions={SORT_OPTIONS.map((o) => ({ value: o.value ?? 'popular', label: o.label }))}
            onSortChange={(v) => setSort(v as MenuFilters['sort'])}
            sortAriaLabel={t('sortAriaLabel')}
          />
          <ActiveFilterRow
            filters={activeFilterChips}
            onRemove={removeActiveFilter}
            ariaLabel={tSearch('activeFilters')}
            removeLabel={(label) => tSearch('removeFilter', { label })}
          />
        </div>

        {isLoading || (browsingAll && catsLoading && !categories) ? (
          <div className={cn('grid gap-6', isSearching ? 'grid-cols-1 max-w-2xl' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
            {Array.from({ length: 9 }).map((_, i) => <FoodCardSkeleton key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <EmptySearch
            title={t('noDishesFound')}
            description={
              debouncedSearch
                ? t('noResultsFor', { query: debouncedSearch })
                : t('noItemsMatchFilters')
            }
            action={<Button variant="outline" onClick={clearFilters}>{t('clearFiltersButton')}</Button>}
          >
            {debouncedSearch && categories && categories.length > 0 && (
              <div className="flex flex-col items-center -mt-4 mb-8">
                <p className="text-sm text-[var(--fg-muted)] mb-3">{t('browseByCategoryInstead')}</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {categories.slice(0, 3).map((cat) => (
                    <FilterChip
                      key={cat.id}
                      onClick={() => { handleSearch(''); handleCategoryChange(cat.slug) }}
                    >
                      {cat.name}
                    </FilterChip>
                  ))}
                </div>
              </div>
            )}
          </EmptySearch>
        ) : showCategorySections ? (
          <div id={MENU_ALL_ANCHOR_ID} className="space-y-10" style={{ scrollMarginTop: scrollOffset }}>
            {sections.map((section) => (
              <section
                key={section.id}
                id={menuCategorySectionId(section.id)}
                aria-labelledby={`menu-category-heading-${section.id}`}
                style={{ scrollMarginTop: scrollOffset }}
              >
                <h2
                  id={`menu-category-heading-${section.id}`}
                  className="mb-4 font-[var(--font-display)] text-xl font-semibold text-[var(--fg)]"
                >
                  {section.name}
                </h2>
                <MenuItemGrid
                  items={section.items}
                  reduceMotion={!!reduceMotion}
                  onOpenDetail={handleOpenDetail}
                />
              </section>
            ))}
            {unmatched.length > 0 && (
              <section
                aria-labelledby="menu-category-heading-unassigned"
                style={{ scrollMarginTop: scrollOffset }}
              >
                <h2
                  id="menu-category-heading-unassigned"
                  className="mb-4 font-[var(--font-display)] text-xl font-semibold text-[var(--fg)]"
                >
                  {t('otherCategory')}
                </h2>
                <MenuItemGrid
                  items={unmatched}
                  reduceMotion={!!reduceMotion}
                  onOpenDetail={handleOpenDetail}
                />
              </section>
            )}
          </div>
        ) : (
          <MenuItemGrid
            items={items}
            compact={isSearching}
            highlightQuery={debouncedSearch}
            reduceMotion={!!reduceMotion}
            onOpenDetail={handleOpenDetail}
          />
        )}

        {showRecent && items.length > 0 && (
          <div className="mt-10">
            <CollectionRail title={t('recentlyViewed')}>
              {recentlyViewed.slice(0, 4).map((item) => (
                <CollectionRailCard key={item.id} className="w-[min(80vw,18rem)] sm:w-64">
                  <FoodCard item={item} compact onOpenDetail={handleOpenDetail} />
                </CollectionRailCard>
              ))}
            </CollectionRail>
          </div>
        )}
      </main>

      <Footer />

      <FilterSheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        title={tSearch('filters')}
        dirty={sheetDirty}
        onReset={() => {
          setPriceBands([])
          syncTagsToUrl([])
        }}
      >
        <FilterSection title={t('priceBand')}>
          {([1, 2, 3] as const).map((band) => (
            <FilterChip
              key={band}
              selected={priceBands.includes(band)}
              onClick={() =>
                setPriceBands((prev) =>
                  prev.includes(band) ? prev.filter((b) => b !== band) : [...prev, band],
                )
              }
            >
              {PRICE_LEVEL_SYMBOLS[band]}
            </FilterChip>
          ))}
        </FilterSection>
        {showTagFilters && (
          <FilterSection title={t('tagFiltersAriaLabel')}>
            {tagsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-11 w-20 rounded-full bg-[var(--card-hover)] animate-pulse" />
                ))
              : availableTags?.map((tag) => (
                  <FilterChip
                    key={tag.id}
                    selected={selectedTagIds.includes(tag.id)}
                    onClick={() => toggleTag(tag.id)}
                  >
                    <MenuTagLabel tag={tag} />
                  </FilterChip>
                ))}
          </FilterSection>
        )}
      </FilterSheet>

      <LazyFoodDetailModal
        item={selectedItem}
        open={modalOpen}
        branchId={branchId}
        onClose={() => { setModalOpen(false); setTimeout(() => setSelectedItem(null), 300) }}
        onOpenRelated={handleOpenDetail}
      />
    </div>
  )
}
