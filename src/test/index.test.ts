import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { formatCurrency, formatRelativeTime, getDiscountedPrice, truncate, cn, debounce, isRTL } from '@/utils'
import { useCartStore } from '@/stores'
import { MOCK_MENU_ITEMS } from '@/lib/mock-data'

// ── Utility Tests ─────────────────────────────────────────────────────────────
describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(12.5)).toBe('$12.50')
    expect(formatCurrency(0)).toBe('$0.00')
    expect(formatCurrency(1000)).toBe('$1,000.00')
  })
  it('handles other currencies', () => {
    expect(formatCurrency(10, 'EUR', 'de-DE')).toContain('10')
  })
})

describe('getDiscountedPrice', () => {
  it('applies percentage discount', () => {
    expect(getDiscountedPrice(100, 10)).toBe(90)
    expect(getDiscountedPrice(50, 20)).toBe(40)
    expect(getDiscountedPrice(100, 0)).toBe(100)
  })
  it('returns original price when no discount', () => {
    expect(getDiscountedPrice(99.99)).toBe(99.99)
    expect(getDiscountedPrice(99.99, undefined)).toBe(99.99)
  })
})

describe('truncate', () => {
  it('truncates long text', () => {
    expect(truncate('Hello World', 5)).toBe('Hello…')
  })
  it('leaves short text unchanged', () => {
    expect(truncate('Hi', 10)).toBe('Hi')
  })
})

describe('cn (class merge)', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
    expect(cn('p-4', 'p-2')).toBe('p-2') // tailwind-merge should dedupe
  })
  it('handles conditional classes', () => {
    expect(cn('base', false && 'excluded', 'included')).toBe('base included')
  })
})

describe('isRTL', () => {
  it('detects RTL locales', () => {
    expect(isRTL('fa')).toBe(true)
    expect(isRTL('ar')).toBe(true)
    expect(isRTL('en')).toBe(false)
    expect(isRTL('de')).toBe(false)
  })
})

describe('formatRelativeTime', () => {
  it('returns "just now" for recent timestamps', () => {
    expect(formatRelativeTime(new Date().toISOString())).toBe('just now')
  })
  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago')
  })
})

describe('debounce', () => {
  it('delays function execution', async () => {
    let callCount = 0
    const debounced = debounce(() => callCount++, 50)
    debounced(); debounced(); debounced()
    expect(callCount).toBe(0)
    await new Promise((r) => setTimeout(r, 100))
    expect(callCount).toBe(1)
  })
})

// ── Cart Store Tests ──────────────────────────────────────────────────────────
describe('Cart Store', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  const mockItem = MOCK_MENU_ITEMS[0]

  it('starts empty', () => {
    expect(useCartStore.getState().items).toHaveLength(0)
    expect(useCartStore.getState().getItemCount()).toBe(0)
  })

  it('adds item to cart', () => {
    useCartStore.getState().addItem(mockItem)
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().getItemCount()).toBe(1)
  })

  it('increases quantity for same item', () => {
    useCartStore.getState().addItem(mockItem)
    useCartStore.getState().addItem(mockItem)
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].quantity).toBe(2)
  })

  it('removes item from cart', () => {
    useCartStore.getState().addItem(mockItem)
    const { id } = useCartStore.getState().items[0]
    useCartStore.getState().removeItem(id)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('updates quantity', () => {
    useCartStore.getState().addItem(mockItem)
    const { id } = useCartStore.getState().items[0]
    useCartStore.getState().updateQuantity(id, 5)
    expect(useCartStore.getState().items[0].quantity).toBe(5)
  })

  it('removes item when quantity set to 0', () => {
    useCartStore.getState().addItem(mockItem)
    const { id } = useCartStore.getState().items[0]
    useCartStore.getState().updateQuantity(id, 0)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('calculates subtotal correctly', () => {
    useCartStore.getState().addItem(mockItem, 2)
    const expectedSubtotal = mockItem.price * 2
    expect(useCartStore.getState().getSubtotal()).toBeCloseTo(expectedSubtotal, 2)
  })

  it('applies discount code', () => {
    useCartStore.getState().addItem(mockItem, 1)
    useCartStore.getState().setDiscount('SAVE10', 5)
    expect(useCartStore.getState().discountCode).toBe('SAVE10')
    expect(useCartStore.getState().discountAmount).toBe(5)
  })

  it('clears cart', () => {
    useCartStore.getState().addItem(mockItem)
    useCartStore.getState().clearCart()
    expect(useCartStore.getState().items).toHaveLength(0)
    expect(useCartStore.getState().discountCode).toBe('')
  })
})

// ── Mock Data Tests ───────────────────────────────────────────────────────────
describe('Mock Data', () => {
  it('has all required menu item fields', () => {
    MOCK_MENU_ITEMS.forEach((item) => {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('name')
      expect(item).toHaveProperty('price')
      expect(item).toHaveProperty('image')
      expect(item).toHaveProperty('rating')
      expect(item).toHaveProperty('category_id')
      expect(typeof item.price).toBe('number')
      expect(item.price).toBeGreaterThan(0)
      expect(item.rating).toBeGreaterThanOrEqual(0)
      expect(item.rating).toBeLessThanOrEqual(5)
    })
  })

  it('has items from multiple categories', () => {
    const categoryIds = new Set(MOCK_MENU_ITEMS.map((i) => i.category_id))
    expect(categoryIds.size).toBeGreaterThan(1)
  })
})
