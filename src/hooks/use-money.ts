'use client'

/**
 * useMoney — every customer-facing price goes through here, so the chosen
 * display currency applies everywhere at once (menu, product page, cart,
 * checkout, favorites). The console uses `formatIn` (business currency, no
 * conversion).
 */
import { useCallback, useEffect, useMemo } from 'react'
import { useLocale } from 'next-intl'
import api from '@/services/axios.instance'
import { ENDPOINTS } from '@/services/endpoints'
import { useCurrencyStore } from '@/stores/currency'
import {
  convertAmount,
  formatMoney,
  itemPriceIn,
  type CurrencyInfo,
  type PricedItem,
} from '@/lib/currency'

let loading: Promise<void> | null = null

/** Loads the enabled currencies once per page load (shared by all callers). */
export function loadCurrencies(): Promise<void> {
  if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') return Promise.resolve()
  if (!loading) {
    loading = api
      .get<{ base: string; currencies: CurrencyInfo[] }>(ENDPOINTS.CURRENCIES.LIST)
      .then(({ data }) => useCurrencyStore.getState().setTable(data.base, data.currencies ?? []))
      .catch(() => {
        loading = null // try again on the next mount
      })
  }
  return loading
}

export function useMoney() {
  const locale = useLocale()
  const { base, table, selected } = useCurrencyStore()

  useEffect(() => {
    void loadCurrencies()
  }, [])

  /** The display currency for something priced in `source`. */
  const targetFor = useCallback((source: string) => (selected && table[selected]?.enabled ? selected : source), [selected, table])

  /** An amount in its own currency, no conversion (console, receipts). */
  const formatIn = useCallback(
    (amount: number | string | null | undefined, currency?: string) => formatMoney(amount, currency || base, locale, table),
    [base, locale, table],
  )

  /** An amount priced in `source`, shown in the visitor's currency. */
  const format = useCallback(
    (amount: number | string | null | undefined, source?: string) => {
      const from = source || base
      const to = targetFor(from)
      const value = typeof amount === 'number' ? amount : parseFloat(String(amount ?? '0'))
      const converted = convertAmount(value, from, to, table)
      return converted === null ? formatMoney(value, from, locale, table) : formatMoney(converted, to, locale, table)
    },
    [base, locale, table, targetFor],
  )

  /** A menu item's price (explicit price for the currency when the owner set one). */
  const itemPrice = useCallback(
    (item: PricedItem, opts: { discounted?: boolean } = {}) => {
      const to = targetFor(item.currency || base)
      return itemPriceIn(item, to, table, { discounted: opts.discounted, base })
    },
    [base, table, targetFor],
  )

  const formatItem = useCallback(
    (item: PricedItem, opts: { discounted?: boolean } = {}) => {
      const p = itemPrice(item, opts)
      return formatMoney(p.amount, p.currency, locale, table)
    },
    [itemPrice, locale, table],
  )

  /**
   * A cart line in the display currency, like the backend's order snapshot:
   * the item's explicit price for that currency when set (with the same
   * discount), extras converted. Falls back to the line's own currency.
   */
  const cartLine = useCallback(
    (line: { menu_item: PricedItem & { discounted_price?: number }; extras?: { price: number }[]; unit_price: number; quantity: number }) => {
      const source = line.menu_item.currency || base
      const to = targetFor(source)
      const extras = (line.extras ?? []).reduce((sum, e) => sum + (Number(e.price) || 0), 0)
      const unitSource = line.unit_price - extras
      if (to === source) return { amount: line.unit_price * line.quantity, currency: source }
      const explicit = line.menu_item.prices?.[to]
      let unit: number | null
      if (explicit !== undefined && explicit !== null && explicit !== '') {
        const ratio = line.menu_item.price ? unitSource / line.menu_item.price : 1
        unit = itemPriceIn({ ...line.menu_item, discount: (1 - ratio) * 100 }, to, table, { discounted: ratio !== 1, base }).amount
      } else {
        unit = convertAmount(unitSource, source, to, table)
      }
      const extrasTo = extras ? convertAmount(extras, source, to, table, { useStep: false }) : 0
      if (unit === null || extrasTo === null) return { amount: line.unit_price * line.quantity, currency: source }
      return { amount: (unit + extrasTo) * line.quantity, currency: to }
    },
    [base, table, targetFor],
  )

  /**
   * Cart / checkout summary in the display currency: lines as cartLine,
   * every other amount (discount, tax, fees) converted, total = lines +
   * converted adjustments — the same way the backend snapshots the order.
   * `charged` is what the customer actually pays (business currency).
   */
  const cartSummary = useCallback(
    (
      lines: Parameters<typeof cartLine>[0][],
      amounts: { subtotal: number; total: number; discount?: number; tax?: number; serviceCharge?: number },
      sourceCurrency?: string,
    ) => {
      const source = lines[0]?.menu_item.currency || sourceCurrency || base
      const to = targetFor(source)
      const lineMoney = lines.map((l) => cartLine(l))
      const allConverted = lineMoney.every((m) => m.currency === to)
      const conv = (v: number | undefined) => (v ? convertAmount(v, source, to, table, { useStep: false }) : 0)
      const adjustments = conv(amounts.total - amounts.subtotal)
      const usable = to !== source && allConverted && adjustments !== null
      const currency = usable ? to : source
      const pick = (v: number | undefined) => (usable ? conv(v) ?? 0 : v ?? 0)
      const subtotal = usable ? lineMoney.reduce((s2, m) => s2 + m.amount, 0) : amounts.subtotal
      const fmt = (v: number) => formatMoney(v, currency, locale, table)
      return {
        currency,
        converted: usable,
        lines: lineMoney.map((m) => formatMoney(usable ? m.amount : NaN, currency, locale, table)),
        lineLabel: (i: number) => (usable ? fmt(lineMoney[i].amount) : formatMoney(lines[i].unit_price * lines[i].quantity, source, locale, table)),
        subtotal: fmt(subtotal),
        discount: fmt(pick(amounts.discount)),
        tax: fmt(pick(amounts.tax)),
        serviceCharge: fmt(pick(amounts.serviceCharge)),
        total: fmt(usable ? subtotal + (adjustments ?? 0) : amounts.total),
        /** The amount actually charged (business currency). */
        charged: formatMoney(amounts.total, source, locale, table),
        sourceCurrency: source,
      }
    },
    [base, cartLine, locale, table, targetFor],
  )

  return useMemo(
    () => ({ base, table, selected, targetFor, format, formatIn, itemPrice, formatItem, cartLine, cartSummary }),
    [base, table, selected, targetFor, format, formatIn, itemPrice, formatItem, cartLine, cartSummary],
  )
}
