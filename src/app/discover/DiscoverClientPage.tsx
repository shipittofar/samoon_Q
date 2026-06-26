'use client'

import { useState, useMemo, useCallback } from 'react'
import { Loader2, Store, SearchX } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { BusinessCard } from '@/components/marketplace/BusinessCard'
import { BusinessSearch } from '@/components/marketplace/BusinessSearch'
import { CategoryFilter } from '@/components/marketplace/CategoryFilter'
import { usePublicTenants } from '@/hooks'
import { getMarketplaceMeta, matchesSearch, matchesCategory } from '@/types/marketplace'
import { debounce } from '@/utils'
import type { Tenant } from '@/types'
import type { MarketplaceMeta } from '@/types/marketplace'

// ── helpers ───────────────────────────────────────────────────────────────────

type TenantWithMeta = { tenant: Tenant; meta: MarketplaceMeta }

function withMeta(tenants: Tenant[]): TenantWithMeta[] {
  return tenants.flatMap((t) => {
    const meta = getMarketplaceMeta(t.settings)
    return meta ? [{ tenant: t, meta }] : []
  })
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, items }: { title: string; items: TenantWithMeta[] }) {
  if (items.length === 0) return null
  return (
    <section aria-labelledby={`section-${title.toLowerCase().replace(/\s+/g, '-')}`} className="mb-12">
      <h2
        id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
        className="text-xl font-semibold text-[var(--fg)] mb-5"
      >
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

// ── Loading / Empty states ────────────────────────────────────────────────────

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

function EmptyState({ query, category }: { query: string; category: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <SearchX className="w-12 h-12 text-[var(--fg-muted)] mb-4" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-[var(--fg)] mb-2">No businesses found</h3>
      <p className="text-[var(--fg-muted)] text-sm max-w-sm">
        {query && category
          ? `No ${category} businesses match your search. Try clearing the search or the category filter.`
          : query
            ? `No businesses match your search. Try a different term.`
            : 'No businesses in this category yet.'}
      </p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DiscoverClientPage() {
  const { data: tenants = [], isLoading, isError } = usePublicTenants()

  const [rawQuery, setRawQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

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

  // Build list with marketplace metadata
  const allWithMeta = useMemo(() => withMeta(tenants), [tenants])

  // Available categories derived from the actual tenant list
  const availableCategories = useMemo(() => {
    const seen = new Set<string>()
    allWithMeta.forEach(({ tenant }) => tenant.businessTypes.forEach((bt) => seen.add(bt)))
    return Array.from(seen)
  }, [allWithMeta])

  // Apply search + category filters
  const filtered = useMemo(() => {
    if (!searchQuery && !selectedCategory) return allWithMeta
    return allWithMeta.filter(
      ({ tenant, meta }) =>
        matchesCategory(tenant.businessTypes, selectedCategory) &&
        matchesSearch(tenant.name, meta, tenant.businessTypes, searchQuery),
    )
  }, [allWithMeta, searchQuery, selectedCategory])

  // Section splits — only shown when no active search/category filter
  const isFiltering = !!searchQuery || !!selectedCategory
  const featured = useMemo(() => allWithMeta.filter(({ meta }) => meta.featured), [allWithMeta])
  const popular  = useMemo(() => allWithMeta.filter(({ meta }) => meta.popular && !meta.featured), [allWithMeta])
  const newest   = useMemo(() => allWithMeta.filter(({ meta }) => meta.isNew), [allWithMeta])

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
            />
          </div>
        </section>

        {/* ── Body ── */}
        <div className="max-w-7xl mx-auto px-4 py-10">
          {/* Category chips */}
          {!isLoading && (
            <div className="mb-8">
              <CategoryFilter
                categories={availableCategories}
                selected={selectedCategory}
                onChange={setSelectedCategory}
              />
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
                /* Filtered view */
                filtered.length > 0 ? (
                  <section aria-label="Search results">
                    <p className="text-sm text-[var(--fg-muted)] mb-5">
                      {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
                      {searchQuery && <> for <strong>&ldquo;{searchQuery}&rdquo;</strong></>}
                    </p>
                    <BusinessGrid items={filtered} />
                  </section>
                ) : (
                  <EmptyState query={searchQuery} category={selectedCategory} />
                )
              ) : (
                /* Discovery view — sectioned */
                <>
                  <Section title="✨ Featured" items={featured} />
                  <Section title="🔥 Popular Right Now" items={popular} />
                  <Section title="🆕 Newly Opened" items={newest} />

                  <section aria-labelledby="all-businesses-heading" className="mb-12">
                    <div className="flex items-center justify-between mb-5">
                      <h2
                        id="all-businesses-heading"
                        className="text-xl font-semibold text-[var(--fg)]"
                      >
                        All Businesses
                      </h2>
                      <span className="text-sm text-[var(--fg-muted)]">
                        {allWithMeta.length} listed
                      </span>
                    </div>
                    {allWithMeta.length > 0 ? (
                      <BusinessGrid items={allWithMeta} />
                    ) : (
                      <EmptyState query="" category="" />
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
