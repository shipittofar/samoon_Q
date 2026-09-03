'use client'

import { useState, useMemo } from 'react'
import { Star, Filter, ChevronDown } from 'lucide-react'
import { cn } from '@/utils'
import { ReviewCard } from './ReviewCard'
import { RatingBreakdown } from './RatingBreakdown'
import { useBusinessReviews, useMarkHelpful } from '@/hooks'
import type { BusinessReviewFilters } from '@/types/business-review'
import { DEFAULT_REVIEW_FILTERS } from '@/types/business-review'

interface ReviewsSectionProps {
  tenantId: string
  tenantSlug: string
  branchId?: string
  initialRating?: number
  initialReviewCount?: number
}

const SORT_OPTIONS: { value: BusinessReviewFilters['sort']; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'highest', label: 'Highest rated' },
  { value: 'lowest', label: 'Lowest rated' },
  { value: 'most_helpful', label: 'Most helpful' },
]

const PAGE_SIZE = 6

export function ReviewsSection({
  tenantId,
  tenantSlug,
  branchId,
  initialRating,
  initialReviewCount,
}: ReviewsSectionProps) {
  const [filters, setFilters] = useState<Partial<BusinessReviewFilters>>({
    ...DEFAULT_REVIEW_FILTERS,
    branchId,
  })
  const [page, setPage] = useState(1)

  const { data, isLoading } = useBusinessReviews(tenantId, filters)
  const markHelpfulMutation = useMarkHelpful(tenantId)

  const reviews = data?.reviews ?? []
  const breakdown = data?.breakdown

  const displayedAvg = breakdown?.average ?? initialRating ?? 0
  const displayedCount = breakdown?.total ?? initialReviewCount ?? 0

  const visible = useMemo(() => reviews.slice(0, page * PAGE_SIZE), [reviews, page])
  const hasMore = visible.length < reviews.length

  function toggleFilter<K extends keyof BusinessReviewFilters>(key: K, value: BusinessReviewFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }))
    setPage(1)
  }

  function setSort(sort: BusinessReviewFilters['sort']) {
    setFilters((prev) => ({ ...prev, sort }))
    setPage(1)
  }

  return (
    <section aria-labelledby="reviews-heading">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h2 id="reviews-heading"className="text-xl font-semibold text-[var(--fg)]">
          Customer Reviews
        </h2>
        {displayedCount > 0 && (
          <span className="flex items-center gap-1 text-sm text-[var(--fg-muted)]">
            <Star className="w-4 h-4 text-[var(--rating)] fill-[var(--rating)]"aria-hidden="true"/>
            <strong className="text-[var(--fg)]">{displayedAvg.toFixed(1)}</strong>
            <span>· {displayedCount.toLocaleString()} reviews</span>
          </span>
        )}
      </div>

      {/* Breakdown + filters row */}
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 mb-8">
        {breakdown && <RatingBreakdown breakdown={breakdown} className="sm:w-56 shrink-0"/>}

        <div className="space-y-3">
          {/* Sort */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-widest">Sort:</span>
            {SORT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSort(value)}
                aria-pressed={filters.sort === value}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]',
                  filters.sort === value
                    ? 'bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--card-hover)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Quick filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-widest">
              <Filter className="w-3 h-3 inline mr-1"aria-hidden="true"/>
              Filter:
            </span>
            <button
              type="button"
              onClick={() => toggleFilter('verified', true)}
              aria-pressed={filters.verified === true}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]',
                filters.verified === true
                  ? 'bg-[var(--success)] text-[var(--success-fg)] border-[var(--success)]'
                  : 'border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--card-hover)]',
              )}
            >
              Verified only
            </button>
            <button
              type="button"
              onClick={() => toggleFilter('withPhotos', true)}
              aria-pressed={filters.withPhotos === true}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]',
                filters.withPhotos === true
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--card-hover)]',
              )}
            >
              With photos
            </button>
            {[5, 4, 3].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => toggleFilter('rating', star as BusinessReviewFilters['rating'])}
                aria-pressed={filters.rating === star}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]',
                  filters.rating === star
                    ? 'bg-[var(--rating)] text-[var(--rating-fg)] border-[var(--rating)]'
                    : 'border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--card-hover)]',
                )}
              >
                {star}★
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Review cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="h-48 rounded-2xl bg-[var(--card)] border border-[var(--border)] animate-pulse"aria-hidden="true"/>
          ))}
        </div>
      ) : visible.length > 0 ? (
        <>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            role="list"
            aria-label={`${visible.length} reviews`}
          >
            {visible.map((review) => (
              <div key={review.id} role="listitem">
                <ReviewCard
                  review={review}
                  onMarkHelpful={(id) => markHelpfulMutation.mutate(id)}
                  className="h-full"
                />
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--fg-muted)] hover:bg-[var(--card-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <ChevronDown className="w-4 h-4"aria-hidden="true"/>
                Show more reviews ({reviews.length - visible.length} remaining)
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-[var(--fg-muted)] py-6 text-center">
          No reviews match the selected filters.
        </p>
      )}
    </section>
  )
}
