'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, SlidersHorizontal, X, ChevronDown, Grid3X3, List, Sparkles } from 'lucide-react'
import { TenantHeader } from '@/components/layout/TenantHeader'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer, FloatingCart } from '@/components/cart/CartDrawer'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { FoodCard } from '@/components/menu/FoodCard'
import { LazyFoodDetailModal } from '@/components/menu/LazyFoodDetailModal'
import { FoodCardSkeleton, Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { useCategories, useMenuItems } from '@/hooks'
import { useRecentlyViewedStore, useCartStore, useTenantStore, useBranchStore } from '@/stores'
import { cn, debounce } from '@/utils'
import { useTranslations } from 'next-intl'
import type { MenuItem } from '@/types'
import type { MenuFilters } from '@/services/menu.service'

interface MenuContentProps {
  /** Branch slug to scope the menu to. Falls back to the customer's active branch (useBranchStore) when omitted — see docs/BRANCH_MENU_ANALYSIS.md. */
  branchId?: string
}

export function MenuContent({ branchId }: MenuContentProps = {}) {
  const t = useTranslations('menu')
  const tCommon = useTranslations('common')

  const SORT_OPTIONS = [
    { value: 'popular', label: t('sortOptions.popular') },
    { value: 'rating', label: t('sortOptions.rating') },
    { value: 'price_asc', label: t('sortOptions.priceAsc') },
    { value: 'price_desc', label: t('sortOptions.priceDesc') },
    { value: 'newest', label: t('sortOptions.newest') },
  ]

  const DIETARY_TAGS = [
    { label: t('dietaryVegan'), tag: 'vegan' },
    { label: t('dietaryVegetarian'), tag: 'vegetarian' },
    { label: t('dietaryHalal'), tag: 'halal' },
    { label: t('dietaryGlutenFree'), tag: 'gluten-free' },
    { label: t('dietarySpicy'), tag: 'spicy' },
  ]
  const searchParams = useSearchParams()
  const router = useRouter()
  // C1: use pathname for correct relative URL building
  const pathname = usePathname()
  const categoryFromUrl = searchParams.get('category') || ''

  const [activeCategory, setActiveCategory] = useState(categoryFromUrl)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState<MenuFilters['sort']>('popular')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100])
  const [minRating, setMinRating] = useState(0)
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  // C2/H5: dietary quick-filters
  const [activeDietaryTags, setActiveDietaryTags] = useState<string[]>([])
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const categoryBarRef = useRef<HTMLDivElement>(null)
  const { items: recentlyViewed } = useRecentlyViewedStore()
  // H1: detect cart for bottom padding
  const cartCount = useCartStore((s) => s.getItemCount())
  // H7: tenant/branch name for heading
  const tenantName = useTenantStore((s) => s.tenant?.name)
  const branchName = useBranchStore((s) => s.activeBranch?.name)

  const debouncedSetSearch = useCallback(
    debounce((v: string) => setDebouncedSearch(v), 350),
    [],
  )

  const handleSearch = (v: string) => {
    setSearch(v)
    debouncedSetSearch(v)
  }

  const { data: categories, isLoading: catsLoading } = useCategories(branchId)

  // URL/state keep the human-readable slug; the API filters by category ID.
  const categoryFilterId = useMemo(() => {
    if (!activeCategory) return undefined
    const match = categories?.find(
      (c) => c.slug === activeCategory || c.id === activeCategory,
    )
    return match?.id
  }, [activeCategory, categories])

  const filters: MenuFilters = {
    category: categoryFilterId,
    search: debouncedSearch || undefined,
    sort,
    min_price: priceRange[0] > 0 ? priceRange[0] : undefined,
    max_price: priceRange[1] < 100 ? priceRange[1] : undefined,
    min_rating: minRating > 0 ? minRating : undefined,
    available: onlyAvailable ? true : undefined,
  }

  const { data, isLoading } = useMenuItems(branchId, filters)
  const allItems = data?.results || []

  // C2: filter by dietary tags client-side (item.tags)
  const items = activeDietaryTags.length > 0
    ? allItems.filter((item) =>
        activeDietaryTags.every((tag) =>
          (item.tags ?? []).some((t) => t.toLowerCase() === tag.toLowerCase()),
        ),
      )
    : allItems

  const handleCategoryChange = (slug: string) => {
    setActiveCategory(slug)
    const params = new URLSearchParams(searchParams.toString())
    if (slug) params.set('category', slug)
    else params.delete('category')
    // C1: use pathname (current route) not hardcoded '/menu'
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // H2: scroll active category tab into view
  useEffect(() => {
    if (!categoryBarRef.current) return
    const active = categoryBarRef.current.querySelector('[aria-selected="true"]') as HTMLElement | null
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeCategory])

  const handleOpenDetail = (item: MenuItem) => {
    setSelectedItem(item)
    setModalOpen(true)
  }

  const toggleDietaryTag = (tag: string) => {
    setActiveDietaryTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  const clearFilters = () => {
    setPriceRange([0, 100])
    setMinRating(0)
    setOnlyAvailable(false)
    setSort('popular')
    setSearch('')
    setDebouncedSearch('')
    setActiveCategory('')
    setActiveDietaryTags([])
  }

  const hasActiveFilters =
    priceRange[0] > 0 || priceRange[1] < 100 || minRating > 0 || onlyAvailable || !!debouncedSearch || activeDietaryTags.length > 0

  // H7: compose page heading
  const pageHeading = branchName
    ? t('branchMenu', { branch: branchName })
    : tenantName
      ? t('tenantMenu', { tenant: tenantName })
      : t('ourFullMenu')

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <TenantHeader />
      <ErrorBoundary feature="CartDrawer"><CartDrawer /></ErrorBoundary>
      <ErrorBoundary feature="FloatingCart"><FloatingCart /></ErrorBoundary>

      {/* Hero */}
      <div className="pt-16 bg-gradient-to-b from-orange-50/80 to-transparent dark:from-orange-950/20 dark:to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="text-center mb-8">
            <p className="text-sm font-medium text-orange-500 uppercase tracking-widest mb-2">{t('explore')}</p>
            {/* H7: tenant/branch-aware heading */}
            <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl font-bold text-[var(--fg)] mb-3">
              {pageHeading}
            </h1>
            <p className="text-[var(--fg-muted)] max-w-lg mx-auto">
              {t('discoverDishes', { count: data?.count || '...' })}
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full h-14 ps-11 pe-14 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 shadow-[var(--shadow-soft)] transition-all"
                aria-label={t('searchAriaLabel')}
              />
              {search && (
                <button
                  onClick={() => handleSearch('')}
                  className="absolute end-4 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                  aria-label={t('clearSearch')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Controls */}
      <div className="sticky top-16 z-30 bg-[var(--bg)]/90 backdrop-blur-xl border-b border-[var(--border)] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Category Tabs */}
          <div
            ref={categoryBarRef}
            className="flex gap-2 overflow-x-auto scrollbar-hide py-3"
            role="tablist"
            aria-label={t('categoriesAriaLabel')}
          >
            <button
              role="tab"
              aria-selected={activeCategory === ''}
              onClick={() => handleCategoryChange('')}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-all shrink-0',
                activeCategory === ''
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                  : 'bg-[var(--card)] text-[var(--fg-muted)] hover:text-[var(--fg)] border border-[var(--border)] hover:border-orange-200',
              )}
            >
              ✨ {t('allCategories')}
              {data && <Badge variant="secondary" className="text-[10px]">{data.count}</Badge>}
            </button>

            {catsLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-9 w-24 rounded-xl bg-[var(--card-hover)] animate-pulse shrink-0" />
                ))
              : categories?.map((cat) => (
                  <button
                    key={cat.id}
                    role="tab"
                    aria-selected={activeCategory === cat.slug}
                    onClick={() => handleCategoryChange(cat.slug)}
                    className={cn(
                      'flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-all shrink-0',
                      activeCategory === cat.slug
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                        : 'bg-[var(--card)] text-[var(--fg-muted)] hover:text-[var(--fg)] border border-[var(--border)] hover:border-orange-200',
                    )}
                  >
                    {cat.icon && <span aria-hidden="true">{cat.icon}</span>}
                    {cat.name}
                    {cat.items_count !== undefined && (
                      <Badge variant="secondary" className="text-[10px]">{cat.items_count}</Badge>
                    )}
                  </button>
                ))}
          </div>

          {/* H5: Dietary quick-filter chips */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2" role="group" aria-label={t('dietaryFiltersAriaLabel')}>
            {DIETARY_TAGS.map(({ label, tag }) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleDietaryTag(tag)}
                aria-pressed={activeDietaryTags.includes(tag)}
                className={cn(
                  'whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 border',
                  activeDietaryTags.includes(tag)
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-[var(--card)] text-[var(--fg-muted)] border-[var(--border)] hover:border-orange-300 hover:text-[var(--fg)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between py-2 gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant={showFilters ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setShowFilters((v) => !v)}
                leftIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
              >
                {t('filters')}
                {/* H2 (filter count): show count of active non-dietary filters */}
                {(priceRange[0] > 0 || priceRange[1] < 100 || minRating > 0 || onlyAvailable) && (
                  <span className="ms-1 h-4 w-4 rounded-full bg-white/30 text-[10px] font-bold flex items-center justify-center">
                    {[priceRange[0] > 0, priceRange[1] < 100, minRating > 0, onlyAvailable].filter(Boolean).length}
                  </span>
                )}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} leftIcon={<X className="h-3.5 w-3.5" />}>
                  {tCommon('clear')}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Sort */}
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as MenuFilters['sort'])}
                  className="h-8 ps-3 pe-8 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 appearance-none cursor-pointer"
                  aria-label={t('sortAriaLabel')}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute end-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--fg-muted)] pointer-events-none" aria-hidden="true" />
              </div>

              {/* View mode */}
              <div className="flex rounded-xl border border-[var(--border)] overflow-hidden">
                {(['grid', 'list'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      'h-8 w-8 flex items-center justify-center transition-colors',
                      viewMode === mode ? 'bg-orange-500 text-white' : 'bg-[var(--card)] text-[var(--fg-muted)] hover:bg-[var(--card-hover)]',
                    )}
                    aria-label={mode === 'grid' ? t('gridView') : t('listView')}
                    aria-pressed={viewMode === mode}
                  >
                    {mode === 'grid' ? <Grid3X3 className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-[var(--border)] bg-[var(--card)] overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Price Range */}
                <div>
                  <label className="text-sm font-medium text-[var(--fg)] mb-3 block">
                    {t('priceRangeLabel', { min: `$${priceRange[0]}`, max: priceRange[1] >= 100 ? '$100+' : `$${priceRange[1]}` })}
                  </label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={0} max={100} value={priceRange[0]} onChange={(e) => setPriceRange([+e.target.value, priceRange[1]])} className="flex-1 accent-orange-500" aria-label={t('minPriceAria')} />
                    <input type="range" min={0} max={100} value={priceRange[1]} onChange={(e) => setPriceRange([priceRange[0], +e.target.value])} className="flex-1 accent-orange-500" aria-label={t('maxPriceAria')} />
                  </div>
                </div>

                {/* Min Rating */}
                <div>
                  <label className="text-sm font-medium text-[var(--fg)] mb-3 block">
                    {t('minRatingLabel', { rating: minRating > 0 ? `${minRating}+` : t('any') })}
                  </label>
                  <div className="flex gap-2">
                    {[0, 3, 3.5, 4, 4.5].map((r) => (
                      <button
                        key={r}
                        onClick={() => setMinRating(r)}
                        className={cn(
                          'px-3 py-1.5 rounded-xl text-sm border transition-all',
                          minRating === r
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-300',
                        )}
                      >
                        {r === 0 ? t('any') : `${r}★`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Availability */}
                <div>
                  <label className="text-sm font-medium text-[var(--fg)] mb-3 block">{t('availability')}</label>
                  <button
                    onClick={() => setOnlyAvailable((v) => !v)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-all',
                      onlyAvailable
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-300',
                    )}
                  >
                    <span className={cn('h-4 w-4 rounded border-2 flex items-center justify-center', onlyAvailable ? 'border-white bg-white/20' : 'border-current')}>
                      {onlyAvailable && <span className="text-white text-[10px]">✓</span>}
                    </span>
                    {t('availableOnly')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* H1: pb-28 when floating cart is visible to prevent overlap */}
      <main className={cn('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10', cartCount > 0 && 'pb-28')}>
        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && !debouncedSearch && !activeCategory && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-orange-500" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[var(--fg)]">{t('recentlyViewed')}</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentlyViewed.slice(0, 6).map((item) => (
                <FoodCard key={item.id} item={item} compact onOpenDetail={handleOpenDetail} />
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-[var(--fg-muted)]" aria-live="polite" aria-atomic="true">
            {isLoading ? tCommon('loading') : t('itemsFound', { count: items.length })}
          </p>
        </div>

        {isLoading ? (
          <div className={cn('grid gap-6', viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3' : 'grid-cols-1')}>
            {Array.from({ length: 9 }).map((_, i) => <FoodCardSkeleton key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <span className="text-5xl" aria-hidden="true">🍽️</span>
            <h3 className="font-[var(--font-display)] text-xl font-semibold text-[var(--fg)]">{t('noDishesFound')}</h3>
            <p className="text-[var(--fg-muted)] max-w-sm">
              {debouncedSearch
                ? t('noResultsFor', { query: debouncedSearch })
                : t('noItemsMatchFilters')}
            </p>
            {/* H3: category shortcuts in empty state */}
            {debouncedSearch && categories && categories.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-[var(--fg-muted)] mb-3">{t('browseByCategoryInstead')}</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {categories.slice(0, 4).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => { handleSearch(''); handleCategoryChange(cat.slug) }}
                      className="px-3 py-1.5 rounded-full border border-[var(--border)] text-sm text-[var(--fg-muted)] hover:border-orange-300 hover:text-[var(--fg)] transition-colors"
                    >
                      {cat.icon && <span aria-hidden="true">{cat.icon} </span>}{cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Button variant="outline" onClick={clearFilters}>{t('clearFiltersButton')}</Button>
          </div>
        ) : (
          <motion.div
            layout
            className={cn(
              'grid gap-6',
              viewMode === 'grid'
                // M4: cap at 3 columns (was xl:grid-cols-4)
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1 max-w-2xl',
            )}
          >
            <AnimatePresence mode="popLayout">
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  // H8: cap stagger delay at 200ms
                  transition={{ delay: Math.min(i * 0.04, 0.2) }}
                >
                  <FoodCard
                    item={item}
                    compact={viewMode === 'list'}
                    onOpenDetail={handleOpenDetail}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      <Footer />

      {/* Detail Modal */}
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
