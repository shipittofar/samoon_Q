import { describe, expect, it } from 'vitest'
import { applyConsoleMenuClientFilters } from '@/lib/console-menu-client-filters'
import type { MenuItem } from '@/types'

const baseItem = (overrides: Partial<MenuItem> = {}): MenuItem => ({
  id: 'item-1',
  branch_id: 'branch-1',
  category_id: '',
  name: 'Burger',
  slug: 'burger',
  description: 'Tasty',
  price: 10,
  image: '',
  available: true,
  is_active: true,
  rating: 4,
  rating_count: 1,
  preparation_time: 10,
  ...overrides,
})

describe('applyConsoleMenuClientFilters', () => {
  it('filters by top-level category_id', () => {
    const items = [
      baseItem({ id: '1', category_id: 'cat-a', name: 'A' }),
      baseItem({ id: '2', category_id: 'cat-b', name: 'B' }),
    ]

    const filtered = applyConsoleMenuClientFilters(items, {
      search: '',
      categoryId: 'cat-a',
    })

    expect(filtered.map((i) => i.id)).toEqual(['1'])
  })

  it('falls back to nested category.id and coerces numeric ids', () => {
    const items = [
      baseItem({
        id: '1',
        category_id: '',
        category: { id: '42', branch_id: 'b', name: 'Pizza', slug: 'pizza', sort_order: 1, is_active: true, created_at: '' },
      }),
    ]

    const filtered = applyConsoleMenuClientFilters(items, {
      search: '',
      categoryId: '42',
    })

    expect(filtered).toHaveLength(1)
  })
})
