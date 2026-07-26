import type { DrfPaginationParams, PaginatedResponse } from '@/types'

export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 100

/** Resolved DRF pagination params — always includes explicit page and page_size. */
export type ResolvedDrfPaginationParams = Required<DrfPaginationParams>

/**
 * Builds DRF pagination query params with service-layer defaults applied.
 * Does not mutate the input object.
 */
export function buildDrfPaginationParams(
  filters?: DrfPaginationParams | null,
): ResolvedDrfPaginationParams {
  return {
    page: filters?.page ?? DEFAULT_PAGE,
    page_size: filters?.page_size ?? DEFAULT_PAGE_SIZE,
  }
}

/** Returns the total number of pages for a given item count and page size. */
export function getTotalPages(count: number, pageSize: number): number {
  if (pageSize <= 0) return 1
  return Math.max(1, Math.ceil(count / pageSize))
}

/**
 * Paginates an in-memory list into a DRF-shaped response.
 * Used when a service must emulate DRF pagination locally (e.g. mock mode).
 */
export function paginateList<T>(
  items: T[],
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  const count = items.length
  const totalPages = getTotalPages(count, pageSize)
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const start = (safePage - 1) * pageSize
  const results = items.slice(start, start + pageSize)

  return {
    count,
    next: safePage < totalPages ? String(safePage + 1) : null,
    previous: safePage > 1 ? String(safePage - 1) : null,
    results,
  }
}

/** @deprecated Use {@link paginateList} — kept for existing call sites. */
export const toPaginatedResponse = paginateList
