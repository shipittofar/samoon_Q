import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import React from 'react'
import {
  convertAmount,
  formatMoney,
  itemPriceIn,
  roundTo,
  type CurrencyTable,
} from '@/lib/currency'
import { useCurrencyStore } from '@/stores/currency'
import { useMoney } from '@/hooks/use-money'
import { menuItemFormToWriteRequest, menuItemToFormInput } from '@/types'
import type { MenuItem } from '@/types'

// Same numbers as the backend tests (currencies/tests/test_currencies.py).
const TABLE: CurrencyTable = {
  IRT: { code: 'IRT', name: 'Toman', symbol: 'تومان', decimals: 0, roundingStep: '1000', rate: '1', isBase: true, enabled: true },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2, roundingStep: '0.10', rate: '600000', isBase: false, enabled: true },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, roundingStep: '0.10', rate: '650000', isBase: false, enabled: true },
  GBP: { code: 'GBP', name: 'Pound', symbol: '£', decimals: 2, roundingStep: '0.10', rate: null, isBase: false, enabled: false },
}

describe('conversion (mirrors the backend)', () => {
  it('converts through the base and rounds to each currency step', () => {
    expect(convertAmount(200000, 'IRT', 'USD', TABLE)).toBe(0.3)
    expect(convertAmount(3, 'USD', 'IRT', TABLE)).toBe(1800000)
    expect(convertAmount(3, 'USD', 'EUR', TABLE)).toBe(2.8)
    expect(convertAmount(400000, 'IRT', 'EUR', TABLE)).toBe(0.6)
    expect(convertAmount(123456, 'IRT', 'IRT', TABLE)).toBe(123456)
  })

  it('tax and fees round to decimals, not the price step', () => {
    expect(convertAmount(7200, 'IRT', 'USD', TABLE, { useStep: false })).toBe(0.01)
    expect(convertAmount(7200, 'IRT', 'USD', TABLE)).toBe(0)
  })

  it('is not convertible without a rate', () => {
    expect(convertAmount(100, 'IRT', 'GBP', TABLE)).toBeNull()
  })

  it('rounds half up', () => {
    expect(roundTo(1500, TABLE.IRT)).toBe(2000)
    expect(roundTo(1499, TABLE.IRT)).toBe(1000)
    expect(roundTo(0.25, TABLE.USD)).toBe(0.3)
  })

  it("an owner's explicit price wins; discount applies to it", () => {
    const espresso = { price: 200000, currency: 'IRT', prices: { USD: '3.00' } }
    expect(itemPriceIn(espresso, 'USD', TABLE)).toEqual({ amount: 3, currency: 'USD' })
    expect(itemPriceIn(espresso, 'EUR', TABLE)).toEqual({ amount: 0.3, currency: 'EUR' })
    expect(itemPriceIn({ ...espresso, discount: 10 }, 'USD', TABLE, { discounted: true }).amount).toBe(2.7)
    // Not convertible: stays in its own currency
    expect(itemPriceIn(espresso, 'GBP', TABLE)).toEqual({ amount: 200000, currency: 'IRT' })
  })
})

describe('formatting', () => {
  it('toman in each language', () => {
    expect(formatMoney(200000, 'IRT', 'fa', TABLE)).toBe('۲۰۰٬۰۰۰ تومان')
    expect(formatMoney(200000, 'IRT', 'en', TABLE)).toBe('200,000 Toman')
  })

  it('ISO currencies with their decimals, non-ISO with the code', () => {
    expect(formatMoney(3, 'USD', 'en', TABLE)).toBe('$3.00')
    expect(formatMoney(12.5, 'USDT', 'en', {})).toBe('12.50 USDT')
  })
})

describe('useMoney', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={{}}>{children}</NextIntlClientProvider>
  )

  beforeEach(() => {
    useCurrencyStore.setState({ base: 'IRT', table: TABLE, selected: '', loaded: true })
  })

  const espresso = { id: 'e', price: 200000, currency: 'IRT', prices: { USD: '3.00' } } as unknown as MenuItem

  it('shows business currency until the visitor picks another', () => {
    const { result, rerender } = renderHook(() => useMoney(), { wrapper })
    expect(result.current.formatItem(espresso)).toBe('200,000 Toman')
    useCurrencyStore.setState({ selected: 'USD' })
    rerender()
    expect(result.current.formatItem(espresso)).toBe('$3.00')
    useCurrencyStore.setState({ selected: 'EUR' })
    rerender()
    expect(result.current.formatItem(espresso)).toBe('€0.30')
  })

  it('cart summary matches the backend snapshot rule', () => {
    useCurrencyStore.setState({ selected: 'USD' })
    const { result } = renderHook(() => useMoney(), { wrapper })
    const line = { menu_item: espresso, extras: [], unit_price: 200000, quantity: 2 }
    const s = result.current.cartSummary([line], { subtotal: 400000, total: 400000 })
    expect(s.converted).toBe(true)
    expect(s.total).toBe('$6.00') // 2 × explicit $3.00 (backend: display_total 6.00)
    expect(s.charged).toBe('400,000 Toman')
  })

  it('a disabled choice falls back to the business currency', () => {
    useCurrencyStore.setState({ selected: 'GBP' })
    const { result } = renderHook(() => useMoney(), { wrapper })
    expect(result.current.formatItem(espresso)).toBe('200,000 Toman')
  })
})

describe('owner form', () => {
  it('round-trips per-currency prices and drops empty ones', () => {
    const item = { id: 'e', name: 'Espresso', description: '', price: 200000, prices: { USD: '3.00' }, category_id: 'c', available: true, is_active: true, preparation_time: 5, image: '' } as unknown as MenuItem
    const form = menuItemToFormInput(item)
    expect(form.prices).toEqual({ USD: '3.00' })
    const req = menuItemFormToWriteRequest({ ...form, prices: { USD: ' 3.50 ', EUR: '' } })
    expect(req.prices).toEqual({ USD: '3.50' })
  })
})
