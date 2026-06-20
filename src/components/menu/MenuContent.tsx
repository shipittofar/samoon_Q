'use client'

import { useState, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, SlidersHorizontal, X, ChevronDown, Grid3X3, List, Sparkles } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer, FloatingCart } from '@/components/cart/CartDrawer'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { FoodCard } from '@/components/menu/FoodCard'
import { LazyFoodDetailModal } from '@/components/menu/LazyFoodDetailModal'
import { FoodCardSkeleton, Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { useCategories, useMenuItems } from '@/hooks'
import { useRecentlyViewedStore } from '@/stores'
import { cn, debounce } from '@/utils'
import type { MenuItem } from '@/types'
import type { MenuFilters } from '@/services/menu.service'

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
]

export function MenuContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
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
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const categoryBarRef = useRef<HTMLDivElement>(null)
  const { items: recentlyViewed } = useRecentlyViewedStore()

  const debouncedSetSearch = useCallback(
    debounce((v: string) => setDebouncedSearch(v), 350),
    [],
  )

  const handleSearch = (v: string) => {
    setSearch(v)
    debouncedSetSearch(v)
  }

  const { data: categories, isLoading: catsLoading } = useCategories()

  const filters: MenuFilters = {
    category: activeCategory || undefined,
    search: debouncedSearch || undefined,
    sort,
    min_price: priceRange[0] > 0 ? priceRange[0] : undefined,
    max_price: priceRange[1] < 100 ? priceRange[1] : undefined,
    min_rating: minRating > 0 ? minRating : undefined,
    available: onlyAvailable ? true : undefined,
  }

  const { data, isLoading } = useMenuItems(filters)
  const items = data?.results || []

  const handleCategoryChange = (slug: string) => {
    setActiveCategory(slug)
    const params = new URLSearchParams(searchParams.toString())
    if (slug) params.set('category', slug)
    else params.delete('category')
    router.replace(`/menu?${params.toString()}`, { scroll: false })
  }

  const handleOpenDetail = (item: MenuItem) => {
    setSelectedItem(item)
    setModalOpen(true)
  }

  const clearFilters = () => {
    setPriceRange([0, 100])
    setMinRating(0)
    setOnlyAvailable(false)
    setSort('popular')
    setSearch('')
    setDebouncedSearch('')
    setActiveCategory('')
  }

  const hasActiveFilters =
    priceRange[0] > 0 || priceRange[1] < 100 || minRating > 0 || onlyAvailable || !!debouncedSearch

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <ErrorBoundary feature="CartDrawer"><CartDrawer /></ErrorBoundary>
      <ErrorBoundary feature="FloatingCart"><FloatingCart /></ErrorBoundary>

      {/* Hero */}
      <div className="pt-16 bg-gradient-to-b from-orange-50/80 to-transparent dark:from-orange-950/20 dark:to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8">
            <p className="text-sm font-medium text-orange-500 uppercase tracking-widest mb-2">Explore</p>
            <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl font-bold text-[var(--fg)] mb-3">
              Our Full Menu
            </h1>
            <p className="text-[var(--fg-muted)] max-w-lg mx-auto">
              Discover {data?.count || '...'} handcrafted dishes made with the finest ingredients.
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search dishes, ingredients…"
                className="w-full h-14 ps-11 pe-14 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 shadow-[var(--shadow-soft)] transition-all"
                aria-label="Search menu"
              />
              {search && (
                <button
                  onClick={() => handleSearch('')}
                  className="absolute end-4 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                  aria-label="Clear search"
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
            aria-label="Menu categories"
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
              ✨ All
              {data && <Badge variant={activeCategory === '' ? 'secondary' : 'secondary'} className="text-[10px]">{data.count}</Badge>}
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
                    {cat.icon && <span>{cat.icon}</span>}
                    {cat.name}
                    {cat.items_count !== undefined && (
                      <Badge variant="secondary" className="text-[10px]">{cat.items_count}</Badge>
                    )}
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
                Filters
                {hasActiveFilters && (
                  <span className="ms-1 h-4 w-4 rounded-full bg-white/30 text-[10px] font-bold flex items-center justify-center">!</span>
                )}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} leftIcon={<X className="h-3.5 w-3.5" />}>
                  Clear
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
                  aria-label="Sort by"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute end-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--fg-muted)] pointer-events-none" />
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
                    aria-label={`${mode} view`}
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
                    Price Range: ${priceRange[0]} – ${priceRange[1] >= 100 ? '100+' : priceRange[1]}
                  </label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={0} max={100} value={priceRange[0]} onChange={(e) => setPriceRange([+e.target.value, priceRange[1]])} className="flex-1 accent-orange-500" />
                    <input type="range" min={0} max={100} value={priceRange[1]} onChange={(e) => setPriceRange([priceRange[0], +e.target.value])} className="flex-1 accent-orange-500" />
                  </div>
                </div>

                {/* Min Rating */}
                <div>
                  <label className="text-sm font-medium text-[var(--fg)] mb-3 block">
                    Minimum Rating: {minRating > 0 ? `${minRating}+` : 'Any'}
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
                        {r === 0 ? 'Any' : `${r}★`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Availability */}
                <div>
                  <label className="text-sm font-medium text-[var(--fg)] mb-3 block">Availability</label>
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
                    Available only
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && !debouncedSearch && !activeCategory && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-orange-500" />
              <h2 className="text-sm font-semibold text-[var(--fg)]">Recently Viewed</h2>
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
          <h2 className="text-sm text-[var(--fg-muted)]">
            {isLoading ? 'Loading…' : `${items.length} ${items.length === 1 ? 'item' : 'items'} found`}
          </h2>
        </div>

        {isLoading ? (
          <div className={cn('grid gap-6', viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1')}>
            {Array.from({ length: 8 }).map((_, i) => <FoodCardSkeleton key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <span className="text-5xl">🍽️</span>
            <h3 className="font-[var(--font-display)] text-xl font-semibold text-[var(--fg)]">No dishes found</h3>
            <p className="text-[var(--fg-muted)] max-w-sm">
              {debouncedSearch
                ? `No results for "${debouncedSearch}". Try different keywords.`
                : 'No items match your current filters.'}
            </p>
            <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
          </div>
        ) : (
          <motion.div
            layout
            className={cn(
              'grid gap-6',
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
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
                  transition={{ delay: i * 0.04 }}
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
        onClose={() => { setModalOpen(false); setTimeout(() => setSelectedItem(null), 300) }}
      />
    </div>
  )
}
