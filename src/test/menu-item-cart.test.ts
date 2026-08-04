import { describe, expect, it } from 'vitest'
import { findPlainCartLine, getPlainCartQuantity, menuItemRequiresConfiguration } from '@/lib/menu-item-cart'
import type { CartItem, MenuItem } from '@/types'

const baseItem: MenuItem = {
  id: 'item-1',
  branch_id: 'branch-1',
  category_id: 'cat-1',
  name: 'Burger',
  slug: 'burger',
  description: 'Tasty',
  price: 10,
  image: '/burger.jpg',
  preparation_time: 15,
  rating: 4.5,
  rating_count: 10,
  available: true,
  is_active: true,
}

function cartLine(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'line-1',
    branch_id: 'branch-1',
    menu_item: baseItem,
    quantity: 1,
    extras: [],
    unit_price: 10,
    total_price: 10,
    ...overrides,
  }
}

describe('menuItemRequiresConfiguration', () => {
  it('returns false for plain items', () => {
    expect(menuItemRequiresConfiguration(baseItem)).toBe(false)
  })

  it('returns false when only optional inline extras are present', () => {
    expect(
      menuItemRequiresConfiguration({
        ...baseItem,
        extras: [{ id: 'e1', name: 'Cheese', price: 1, available: true }],
      }),
    ).toBe(false)
  })

  it('returns true when extra groups are assigned', () => {
    expect(
      menuItemRequiresConfiguration({
        ...baseItem,
        extra_group_ids: ['grp-1'],
      }),
    ).toBe(true)
  })
})

describe('findPlainCartLine', () => {
  it('finds a cart line with no extras or notes', () => {
    const items = [cartLine()]
    expect(findPlainCartLine(items, 'item-1')?.id).toBe('line-1')
  })

  it('ignores lines with extras', () => {
    const items = [
      cartLine({
        extras: [{ id: 'e1', name: 'Cheese', price: 1, available: true }],
      }),
    ]
    expect(findPlainCartLine(items, 'item-1')).toBeUndefined()
  })

  it('ignores lines with notes', () => {
    const items = [cartLine({ notes: 'No onions' })]
    expect(findPlainCartLine(items, 'item-1')).toBeUndefined()
  })
})

describe('getPlainCartQuantity', () => {
  it('returns quantity for a plain line', () => {
    expect(getPlainCartQuantity([cartLine({ quantity: 3 })], 'item-1')).toBe(3)
  })

  it('returns 0 when no plain line exists', () => {
    expect(getPlainCartQuantity([], 'item-1')).toBe(0)
  })
})
