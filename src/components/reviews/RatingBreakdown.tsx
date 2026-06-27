'use client'

import { Star } from 'lucide-react'
import type { RatingBreakdownData } from '@/types/business-review'

interface RatingBreakdownProps {
  breakdown: RatingBreakdownData
  className?: string
}

export function RatingBreakdown({ breakdown, className }: RatingBreakdownProps) {
  return (
    <div className={className}>
      {/* Big average */}
      <div className="flex items-end gap-3 mb-4">
        <span className="text-5xl font-bold text-[var(--fg)]" aria-label={`Average rating: ${breakdown.average} out of 5`}>
          {breakdown.average.toFixed(1)}
        </span>
        <div className="pb-1">
          <div className="flex gap-0.5 mb-1" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                className={`w-4 h-4 ${i < Math.round(breakdown.average) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 fill-gray-300'}`}
                aria-hidden="true"
              />
            ))}
          </div>
          <p className="text-xs text-[var(--fg-muted)]">{breakdown.total.toLocaleString()} reviews</p>
        </div>
      </div>

      {/* Per-star bars */}
      <div className="space-y-1.5" role="list" aria-label="Rating distribution">
        {breakdown.distribution.map(({ star, count, percentage }) => (
          <div key={star} className="flex items-center gap-2" role="listitem">
            <span className="text-xs text-[var(--fg-muted)] w-8 shrink-0 text-right">{star}★</span>
            <div
              className="flex-1 bg-[var(--bg-secondary)] rounded-full h-2 overflow-hidden"
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${star} star: ${percentage}%`}
            >
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-xs text-[var(--fg-muted)] w-7 shrink-0">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
