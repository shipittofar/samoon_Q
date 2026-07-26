'use client'

import { Button } from '@/components/ui/Button'
import { getTotalPages } from '@/utils/pagination'

export interface PaginationControlsProps {
  page: number
  pageSize: number
  count: number
  onPageChange: (page: number) => void
  /** DRF `next` URL — when provided, takes precedence over count-based next detection. */
  next?: string | null
  /** DRF `previous` URL — when provided, takes precedence over count-based previous detection. */
  previous?: string | null
  previousLabel?: string
  nextLabel?: string
  /** Translated summary, e.g. "Page 1 of 5 (42 items)". */
  pageOfLabel?: string
  className?: string
}

/**
 * Presentational DRF pagination controls.
 * Supports count/page-based navigation and optional next/previous URL hints.
 */
export function PaginationControls({
  page,
  pageSize,
  count,
  onPageChange,
  next,
  previous,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  pageOfLabel,
  className,
}: PaginationControlsProps) {
  const totalPages = getTotalPages(count, pageSize)
  const usesDrfLinks = next !== undefined || previous !== undefined

  const canGoPrevious = usesDrfLinks
    ? previous != null
    : page > 1
  const canGoNext = usesDrfLinks
    ? next != null
    : page < totalPages

  if (!canGoPrevious && !canGoNext) return null

  return (
    <div className={`border-t border-[var(--border)] px-4 py-3 flex items-center justify-between ${className ?? ''}`}>
      <span className="text-xs text-[var(--fg-muted)]">
        {pageOfLabel ?? `Page ${page} of ${totalPages} (${count})`}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!canGoPrevious}
        >
          {previousLabel}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!canGoNext}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  )
}
