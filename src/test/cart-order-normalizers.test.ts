/**
 * Cart and order item normalization — guest/login persistence contract.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeCartItem,
  normalizeCartItems,
  mergeCartItems,
  isCanonicalCartItem,
} from '@/lib/cart-normalizers'
import { normalizeOrderItem, normalizeOrder } from '@/lib/order-normalizers'
import type { CartItem, Extra } from '@/types'

const sampleExtra: Extra = {
  id: 'e1',
  branch_id: 'branch-1',
  group_id: 'g1',
  name: 'Bacon',
  price: 2,
  available: true,
  order: 1,
  created_at: '2024-01-01T00:00:00.000Z',
}

describe('normalizeCartItem', () => {
  it('preserves canonical cart items with nested menu_item', () => {
    const canonical: CartItem = {
      id: '1-123',
      branch_id: 'branch-rest-01',
      menu_item: {
        id: '1',
        branch_id: 'branch-rest-01',
        category_id: 'cat-1',
        name: 'Wagyu Smash Burger',
        slug: 'wagyu-smash',
        description: 'Tasty',
        price: 24.99,
        image: 'https://example.com/burger.jpg',
        preparation_time: 15,
        rating: 4.9,
        rating_count: 100,
        available: true,
        is_active: true,
      },
      quantity: 2,
      extras: [sampleExtra],
      unit_price: 26.99,
      total_price: 53.98,
    }

    const normalized = normalizeCartItem(canonical)
    expect(normalized?.menu_item.id).toBe('1')
    expect(normalized?.menu_item.name).toBe('Wagyu Smash Burger')
    expect(normalized?.menu_item.image).toBe('https://example.com/burger.jpg')
    expect(normalized?.quantity).toBe(2)
    expect(isCanonicalCartItem(normalized)).toBe(true)
  })

  it('rebuilds menu_item from flat legacy persisted shape (no nested menu_item)', () => {
    const flat = {
      id: '1-999',
      branch_id: 'branch-rest-01',
      name: 'Pasta',
      image: 'https://example.com/pasta.jpg',
      quantity: 1,
      unit_price: 21.99,
      total_price: 21.99,
      extras: [],
    }

    const normalized = normalizeCartItem(flat)
    expect(normalized).not.toBeNull()
    expect(normalized!.menu_item.name).toBe('Pasta')
    expect(normalized!.menu_item.image).toBe('https://example.com/pasta.jpg')
    expect(normalized!.menu_item.id).toBe('1')
    expect(normalized!.menu_item.price).toBe(21.99)
  })

  it('rebuilds menu_item from menu_item_id reference shape', () => {
    const apiLike = {
      id: 'line-1',
      menu_item_id: '6',
      branch_id: 'branch-rest-01',
      name: 'Crispy Chicken',
      image: 'https://example.com/chicken.jpg',
      quantity: 3,
      unit_price: 19.99,
      total_price: 59.97,
      extras: [],
    }

    const normalized = normalizeCartItem(apiLike)
    expect(normalized!.menu_item.id).toBe('6')
    expect(normalized!.menu_item.name).toBe('Crispy Chicken')
    expect(normalized!.quantity).toBe(3)
  })
})

describe('mergeCartItems', () => {
  it('merges same product + same modifiers without duplicates', () => {
    const base = normalizeCartItems([
      {
        id: '1-a',
        branch_id: 'b1',
        menu_item_id: '1',
        name: 'Burger',
        image: '/b.jpg',
        quantity: 2,
        unit_price: 10,
        total_price: 20,
        extras: [],
      },
    ])

    const guest = normalizeCartItems([
      {
        id: '1-b',
        branch_id: 'b1',
        menu_item_id: '1',
        name: 'Burger',
        image: '/b.jpg',
        quantity: 1,
        unit_price: 10,
        total_price: 10,
        extras: [],
      },
    ])

    const merged = mergeCartItems(base, guest)
    expect(merged).toHaveLength(1)
    expect(merged[0].quantity).toBe(3)
    expect(merged[0].menu_item.name).toBe('Burger')
  })

  it('keeps separate lines when modifiers differ', () => {
    const a = normalizeCartItems([
      {
        id: '1-a',
        branch_id: 'b1',
        menu_item_id: '1',
        name: 'Burger',
        quantity: 1,
        unit_price: 12,
        total_price: 12,
        extras: [sampleExtra],
      },
    ])
    const b = normalizeCartItems([
      {
        id: '1-b',
        branch_id: 'b1',
        menu_item_id: '1',
        name: 'Burger',
        quantity: 1,
        unit_price: 10,
        total_price: 10,
        extras: [],
      },
    ])

    const merged = mergeCartItems(a, b)
    expect(merged).toHaveLength(2)
  })
})

describe('normalizeOrderItem', () => {
  it('builds menu_item from API flat order line', () => {
    const raw = {
      id: 'ol-1',
      menu_item_id: '8',
      name: 'Carbonara',
      image: 'https://example.com/carbonara.jpg',
      quantity: 2,
      unit_price: 21.99,
      total_price: 43.98,
      extras: [],
    }

    const item = normalizeOrderItem(raw)
    expect(item).not.toBeNull()
    expect(item!.menu_item.id).toBe('8')
    expect(item!.menu_item.name).toBe('Carbonara')
    expect(item!.menu_item.image).toBe('https://example.com/carbonara.jpg')
    expect(item!.name).toBe('Carbonara')
    expect(item!.image).toBe('https://example.com/carbonara.jpg')
  })

  it('normalizeOrder normalizes all items', () => {
    const order = normalizeOrder({
      id: 'ord-1',
      order_number: '#100',
      branch_id: 'b1',
      items: [
        {
          id: '1',
          menu_item_id: '10',
          name: 'Coffee',
          image: '/coffee.jpg',
          quantity: 1,
          unit_price: 7.99,
          total_price: 7.99,
          extras: [],
        },
      ],
      status: 'pending',
      order_type: 'pickup',
      payment_method: 'card',
      payment_status: 'paid',
      subtotal: 7.99,
      discount_amount: 0,
      tax: 0,
      service_charge: 0,
      total: 7.99,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      status_history: [],
    })

    expect(order.items[0].menu_item.name).toBe('Coffee')
    expect(order.items[0].menu_item.image).toBe('/coffee.jpg')
  })
})
