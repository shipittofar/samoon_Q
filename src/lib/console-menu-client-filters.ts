import type { MenuItem } from '@/types'

/**
 * Client-side filters for the Console Menu page.
 *
 * The console items endpoint (`GET /menu/console-menu/items/{branchId}/`) does not
 * document search, category, or status query params in the frontend/backend contract.
 * Storefront `/menu/items/` supports MenuFilters, but that is a separate endpoint.
 *
 * This module isolates interim client-side filtering so it can be removed once the
 * console endpoint documents equivalent server-side params — without affecting
 * pagination architecture.
 */
export interface ConsoleMenuClientFilters {
  search: string
  /** Category id, or `'all'` for no category filter. */
  categoryId: string
}

function resolveItemCategoryId(item: MenuItem): string {
  if (item.category_id != null && item.category_id !== '') {
    return String(item.category_id)
  }
  if (item.category?.id != null) return String(item.category.id)
  return ''
}

export function applyConsoleMenuClientFilters(
  items: MenuItem[],
  filters: ConsoleMenuClientFilters,
): MenuItem[] {
  const normalizedSearch = filters.search.trim().toLowerCase()
  const categoryFilter = String(filters.categoryId)

  return items.filter((item) => {
    const matchCategory =
      categoryFilter === 'all' || resolveItemCategoryId(item) === categoryFilter
    const matchSearch =
      !normalizedSearch || item.name.toLowerCase().includes(normalizedSearch)

    return matchCategory && matchSearch
  })
}
