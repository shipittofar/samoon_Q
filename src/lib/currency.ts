/**
 * Money: conversion between currencies and formatting.
 *
 * Mirrors the backend (currencies/services.py) — keep both in step:
 *   - an owner's explicit price for a currency (MenuItem.prices) always wins;
 *   - otherwise amount × rate(source) ÷ rate(target), rounded half-up to the
 *     target's rounding step and decimals;
 *   - same currency: unchanged; a missing rate on either side: not convertible
 *     (callers then show the amount in its own currency).
 * Rates are "base-currency units per one unit" (base = Iranian toman, IRT).
 * Orders are charged in the business currency; conversion is for display.
 */

export interface CurrencyInfo {
  code: string
  name: string
  symbol: string
  decimals: number
  roundingStep: string | number | null
  /** Base units per one unit; null = no rate set. */
  rate: string | number | null
  isBase: boolean
  enabled: boolean
}

export type CurrencyTable = Record<string, CurrencyInfo>

export const BASE_CURRENCY_FALLBACK = 'IRT'

/** Base currency only — what the site shows before the list loads. */
export const DEFAULT_CURRENCY_TABLE: CurrencyTable = {
  IRT: { code: 'IRT', name: 'Toman', symbol: 'تومان', decimals: 0, roundingStep: 1000, rate: 1, isBase: true, enabled: true },
}

const num = (v: string | number | null | undefined): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : NaN
}

/**
 * Round half-up to the currency's step (prices), or only to its decimals
 * with `useStep: false` (tax, fees, discounts — small amounts must not
 * round to zero). Same rule as the backend.
 */
export function roundTo(amount: number, info: CurrencyInfo, { useStep = true }: { useStep?: boolean } = {}): number {
  const step = useStep && num(info.roundingStep) > 0 ? num(info.roundingStep) : Math.pow(10, -info.decimals)
  // Work in integer units of the smallest decimal to avoid float drift.
  const scale = Math.pow(10, Math.max(info.decimals, 4))
  const units = Math.round((amount / step) * 1e6) / 1e6
  const stepped = Math.sign(units) * Math.floor(Math.abs(units) + 0.5) * step
  return Math.round(stepped * scale) / scale
}

/** `amount` in `source` expressed in `target`, or null when impossible. */
export function convertAmount(
  amount: number,
  source: string,
  target: string,
  table: CurrencyTable,
  { useStep = true }: { useStep?: boolean } = {},
): number | null {
  if (!Number.isFinite(amount)) return null
  if (source === target) return amount
  const src = table[source]
  const dst = table[target]
  if (!src || !dst) return null
  const srcRate = src.isBase ? 1 : num(src.rate)
  const dstRate = dst.isBase ? 1 : num(dst.rate)
  if (!(srcRate > 0) || !(dstRate > 0)) return null
  return roundTo((amount * srcRate) / dstRate, dst, { useStep })
}

export interface PricedItem {
  price: number
  /** Percent off (0–100). */
  discount?: number
  /** Currency `price` is in (the branch's). */
  currency?: string
  /** Owner's own prices in other currencies, e.g. { USD: "3.00" }. */
  prices?: Record<string, string | number> | null
}

/**
 * An item's unit price in `target`: the owner's explicit price when set,
 * otherwise the converted base price. `discounted` applies the item's
 * percentage discount (then rounds to the target's step).
 */
export function itemPriceIn(
  item: PricedItem,
  target: string,
  table: CurrencyTable,
  { discounted = false, base = BASE_CURRENCY_FALLBACK }: { discounted?: boolean; base?: string } = {},
): { amount: number; currency: string } {
  const source = item.currency || base
  const explicit = item.prices?.[target]
  let amount: number | null = explicit !== undefined && explicit !== null && explicit !== '' ? num(explicit) : null
  if (amount === null || !Number.isFinite(amount)) amount = convertAmount(item.price, source, target, table)
  if (amount === null) {
    // Not convertible: stay in the item's own currency.
    const own = discounted && item.discount ? item.price * (1 - item.discount / 100) : item.price
    return { amount: own, currency: source }
  }
  if (discounted && item.discount) {
    const info = table[target]
    const off = amount * (1 - item.discount / 100)
    amount = info && target !== source ? roundTo(off, info) : off
  }
  return { amount, currency: target }
}

const TOMAN_LABEL: Record<string, string> = { fa: 'تومان', ar: 'تومان', en: 'Toman' }

function intlLocale(locale: string): string {
  if (locale.startsWith('fa')) return 'fa-IR'
  if (locale.startsWith('ar')) return 'ar'
  return locale || 'en-US'
}

/** "۲۰۰٬۰۰۰ تومان", "$3.00", "2.80 €", "12.50 USDT" … in the page language. */
export function formatMoney(
  amount: number | string | null | undefined,
  code: string,
  locale = 'en',
  table: CurrencyTable = DEFAULT_CURRENCY_TABLE,
): string {
  const value = num(amount as string | number)
  const safe = Number.isFinite(value) ? value : 0
  const info = table[code]
  const decimals = info?.decimals ?? (code === 'IRT' || code === 'IRR' ? 0 : 2)
  const loc = intlLocale(locale)
  if (code === 'IRT') {
    const n = new Intl.NumberFormat(loc, { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(safe)
    return `${n} ${TOMAN_LABEL[locale.slice(0, 2)] ?? TOMAN_LABEL.en}`
  }
  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(safe)
  } catch {
    // Not an ISO code (e.g. USDT): number + code/symbol.
    const n = new Intl.NumberFormat(loc, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(safe)
    return `${n} ${info?.symbol && info.symbol !== code ? info.symbol : code}`
  }
}
