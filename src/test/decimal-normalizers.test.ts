import { describe, it, expect } from 'vitest'
import { parseDecimal } from '@/utils/decimal'
import { normalizeExtra, normalizeMenuItem } from '@/lib/menu-normalizers'
import { formatCurrency } from '@/utils'

describe('parseDecimal', () => {
  it('parses Django decimal strings', () => {
    expect(parseDecimal('8000.00')).toBe(8000)
    expect(parseDecimal('12.50')).toBe(12.5)
  })

  it('passes through finite numbers', () => {
    expect(parseDecimal(9.99)).toBe(9.99)
  })

  it('returns fallback for invalid values', () => {
    expect(parseDecimal('not-a-number')).toBe(0)
    expect(parseDecimal(null)).toBe(0)
    expect(parseDecimal(undefined, 5)).toBe(5)
    expect(parseDecimal(Number.NaN)).toBe(0)
  })
})

describe('menu normalizers', () => {
  it('normalizeExtra coerces string price to number', () => {
    const extra = normalizeExtra({
      id: 'ext-1',
      name: 'Extra Cheese',
      price: '8000.00',
      available: true,
    })
    expect(extra.price).toBe(8000)
    expect(typeof extra.price).toBe('number')
  })

  it('normalizeMenuItem coerces nested extra prices', () => {
    const item = normalizeMenuItem({
      id: 'item-1',
      branch_id: 'branch-1',
      category_id: 'cat-1',
      name: 'Burger',
      slug: 'burger',
      description: 'Tasty',
      price: '15.50',
      image: '',
      preparation_time: 10,
      rating: 4.5,
      rating_count: 10,
      available: true,
      extras: [{ id: 'ext-1', name: 'Cheese', price: '2.00', available: true }],
    })
    expect(item.price).toBe(15.5)
    expect(item.extras?.[0]?.price).toBe(2)
  })
})

describe('formatCurrency with decimal strings', () => {
  it('formats string decimal prices', () => {
    expect(formatCurrency('12.5', 'USD', 'en')).toBe('$12.50')
    // Default: the platform base currency (toman, no decimals).
    expect(formatCurrency('200000.00', undefined, 'en')).toBe('200,000 Toman')
  })
})
