import { describe, expect, it } from 'vitest'
import {
  groupMenuItemsByCategory,
  menuCategorySectionId,
  placeCategoryQuickNav,
  resolveActiveMenuCategory,
} from '@/lib/menu-category-sections'
import type { Category, MenuItem } from '@/types'

function category(overrides: Partial<Category> & Pick<Category, 'id' | 'name'>): Category {
  return {
    branch_id: 'branch-1',
    slug: overrides.id,
    sort_order: 0,
    is_active: true,
    created_at: '',
    ...overrides,
  }
}

function item(overrides: Partial<MenuItem> & Pick<MenuItem, 'id' | 'category_id'>): MenuItem {
  return {
    branch_id: 'branch-1',
    name: overrides.id,
    slug: overrides.id,
    description: '',
    price: 1,
    image: '',
    preparation_time: 1,
    rating: 0,
    rating_count: 0,
    available: true,
    is_active: true,
    ...overrides,
  }
}

describe('groupMenuItemsByCategory', () => {
  const categories = [
    category({ id: 'drinks', name: 'Drinks', sort_order: 3 }),
    category({ id: 'mains', name: 'Main Courses', sort_order: 2 }),
    category({ id: 'apps', name: 'Appetizers', sort_order: 1 }),
    category({ id: 'empty', name: 'Empty', sort_order: 0 }),
  ]

  it('orders sections by sort_order and skips categories with no loaded items', () => {
    const items = [
      item({ id: 'd1', category_id: 'drinks' }),
      item({ id: 'a1', category_id: 'apps' }),
      item({ id: 'm1', category_id: 'mains' }),
      item({ id: 'a2', category_id: 'apps' }),
    ]

    const grouped = groupMenuItemsByCategory(categories, items)

    expect(grouped.sections.map((section) => section.name)).toEqual([
      'Appetizers',
      'Main Courses',
      'Drinks',
    ])
    expect(grouped.sections.map((section) => section.id)).toEqual(['apps', 'mains', 'drinks'])
    expect(grouped.sections[0]?.items.map((entry) => entry.id)).toEqual(['a1', 'a2'])
    expect(grouped.unmatched).toEqual([])
  })

  it('keeps API category order when sort_order ties', () => {
    const tied = [
      category({ id: 'b', name: 'B', sort_order: 1 }),
      category({ id: 'a', name: 'A', sort_order: 1 }),
    ]
    const grouped = groupMenuItemsByCategory(tied, [
      item({ id: '1', category_id: 'a' }),
      item({ id: '2', category_id: 'b' }),
    ])
    expect(grouped.sections.map((section) => section.id)).toEqual(['b', 'a'])
  })

  it('matches on category_id and ignores a string category field', () => {
    const grouped = groupMenuItemsByCategory(
      [category({ id: 'apps', name: 'Appetizers', sort_order: 1 })],
      [
        item({
          id: '1',
          category_id: 'apps',
          category: 'Not a category object' as unknown as Category,
        }),
      ],
    )
    expect(grouped.sections).toHaveLength(1)
    expect(grouped.sections[0]?.name).toBe('Appetizers')
    expect(menuCategorySectionId(grouped.sections[0]!.id)).toBe('menu-category-apps')
  })

  it('keeps items whose category is not in the loaded category list', () => {
    const grouped = groupMenuItemsByCategory(
      [category({ id: 'apps', name: 'Appetizers', sort_order: 1 })],
      [
        item({ id: 'known', category_id: 'apps' }),
        item({ id: 'orphan', category_id: 'missing' }),
        item({ id: 'blank', category_id: '' }),
      ],
    )
    expect(grouped.sections.map((section) => section.id)).toEqual(['apps'])
    expect(grouped.unmatched.map((entry) => entry.id)).toEqual(['orphan', 'blank'])
  })

  it('returns no sections when categories are unavailable', () => {
    const items = [item({ id: '1', category_id: 'apps' })]
    expect(groupMenuItemsByCategory(undefined, items)).toEqual({
      sections: [],
      unmatched: items,
    })
  })
})

describe('resolveActiveMenuCategory', () => {
  const ids = ['apps', 'mains']

  it('stays on All until a section reaches the activation line', () => {
    const tops = new Map<string, number>([
      ['menu-category-apps', 400],
      ['menu-category-mains', 900],
    ])
    expect(resolveActiveMenuCategory(ids, tops, 160)).toBe('')
  })

  it('activates the last section that has crossed the line', () => {
    const tops = new Map<string, number>([
      ['menu-category-apps', 40],
      ['menu-category-mains', 120],
    ])
    expect(resolveActiveMenuCategory(ids, tops, 160)).toBe('mains')
  })
})

describe('placeCategoryQuickNav', () => {
  const anchor = { left: 900, right: 1040, top: 80, bottom: 124 }

  it('keeps a desktop panel at or under half the viewport and inside the screen', () => {
    const placed = placeCategoryQuickNav(anchor, { width: 1440, height: 900 }, 'ltr')
    expect(placed.width).toBeLessThanOrEqual(1440 * 0.5)
    expect(placed.width).toBeLessThanOrEqual(28 * 16)
    expect(placed.left).toBeGreaterThanOrEqual(12)
    expect(placed.left + placed.width).toBeLessThanOrEqual(1440 - 12)
    expect(placed.top).toBe(anchor.bottom + 8)
  })

  it('uses the usable viewport width on a narrow screen', () => {
    const placed = placeCategoryQuickNav(
      { left: 16, right: 140, top: 120, bottom: 164 },
      { width: 320, height: 700 },
      'ltr',
    )
    expect(placed.width).toBe(320 - 24)
    expect(placed.left).toBe(12)
    expect(placed.left + placed.width).toBeLessThanOrEqual(320)
  })

  it('opens toward the inline end in rtl without leaving the viewport', () => {
    const placed = placeCategoryQuickNav(
      { left: 16, right: 160, top: 80, bottom: 124 },
      { width: 1280, height: 800 },
      'rtl',
    )
    expect(placed.left).toBe(16)
    expect(placed.left + placed.width).toBeLessThanOrEqual(1280 - 12)
  })
})
