'use client'

/**
 * Localization Developer API — P9.5.1A Phase J
 *
 * Thin hooks wrapping (never replacing) `next-intl`'s existing client APIs
 * and the runtime service (`src/i18n/runtime.ts`). Every existing
 * `useTranslations()`/`t()` call site keeps working unmodified — these are
 * additive, ergonomic wrappers for new code, per
 * `docs/P9.5.0_DEVELOPER_GUIDE.md` §6's "what doesn't change" guarantee.
 */
import { useMemo } from 'react'
import { useLocale as useNextIntlLocale, useTranslations, useFormatter as useNextIntlFormatter } from 'next-intl'
import { useLangStore } from '@/stores'
import {
  getDirection,
  getLanguageInfo,
  resolveSupportedLocales,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatDate,
  formatRelativeTime,
  formatList,
} from './runtime'

/** The active BCP-47-ish locale code, straight from next-intl's request context. */
export function useLocale(): string {
  return useNextIntlLocale()
}

/** `{ direction, isRTL }` for the active locale — no component needs to know which languages are RTL. */
export function useDirection(): { direction: 'ltr' | 'rtl'; isRTL: boolean } {
  const locale = useLocale()
  const direction = getDirection(locale)
  return { direction, isRTL: direction === 'rtl' }
}

/** Full language metadata (native name, currency, timezone, …) plus the enabled-language roster. */
export function useLanguage() {
  const locale = useLocale()
  const setLocale = useLangStore((s) => s.setLocale)
  return useMemo(
    () => ({
      locale,
      info: getLanguageInfo(locale),
      supportedLocales: resolveSupportedLocales(),
      setLocale,
    }),
    [locale, setLocale],
  )
}

/** Re-exported for call sites that want the namespace-scoped translator without a second import. */
export function useTranslation(namespace?: string) {
  return useTranslations(namespace)
}

/** next-intl's own formatter (`format.dateTime`/`number`/`relativeTime`/`list`), unchanged. */
export function useFormatter() {
  return useNextIntlFormatter()
}

/** Locale-bound `Intl.DateTimeFormat` wrapper (Phase H) — never a hand-rolled date pattern. */
export function useLocalizedDate() {
  const locale = useLocale()
  return (value: Date | number | string, options?: Intl.DateTimeFormatOptions) =>
    formatDate(locale, value, options)
}

/** Locale-bound `Intl.NumberFormat`/`Intl.RelativeTimeFormat`/`Intl.ListFormat` wrappers (Phase H). */
export function useLocalizedNumber() {
  const locale = useLocale()
  return {
    format: (value: number, options?: Intl.NumberFormatOptions) => formatNumber(locale, value, options),
    formatPercent: (value: number, options?: Intl.NumberFormatOptions) => formatPercent(locale, value, options),
    formatRelativeTime: (value: number, unit: Intl.RelativeTimeFormatUnit) => formatRelativeTime(locale, value, unit),
    formatList: (items: string[], options?: Intl.ListFormatOptions) => formatList(locale, items, options),
  }
}

/** Locale-and-language-default-currency-bound `Intl.NumberFormat` currency wrapper (Phase H). */
export function useLocalizedCurrency() {
  const locale = useLocale()
  return (value: number, currency?: string) => formatCurrency(locale, value, currency)
}
