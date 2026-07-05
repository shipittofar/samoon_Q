/**
 * Language Registry — P9.5.1A
 *
 * Static per-language metadata (native name, direction, currency, timezone,
 * plural-rule locale, fallback locale, whether real translation messages
 * exist yet) for the platform's initial 6-language rollout. This is the same
 * "curated metadata table backing a config-driven list" pattern
 * `countries-registry-data.ts` established for Countries (P9.2) — the
 * *enabled/default/rtl* lists remain Configuration-driven
 * (`src/config/modules/languages.ts`), this table only supplies the facts
 * that don't need per-tenant override.
 *
 * Per `docs/P9.5.0_LANGUAGE_LIFECYCLE.md` §4, these 6 ship enabled; the
 * other 144+ of the eventual 150+-language roster are P9.5.1B's
 * `localization.languages` collection, not this phase's concern.
 *
 * `hasMessages: false` means no `src/i18n/locales/{code}.json` exists yet —
 * the runtime falls back to `fallbackLocale`'s messages for that language
 * (see `src/i18n/runtime.ts`'s `loadMessages`), never a build error.
 */

export type LanguageCode = 'en' | 'fa' | 'ar' | 'zh' | 'it' | 'tr'

export interface LanguageMetadata {
  code: LanguageCode
  /** BCP 47 id — bare ISO 639-1 today; ready for a locale-variant suffix later without a shape change. */
  bcp47: string
  englishName: string
  nativeName: string
  direction: 'ltr' | 'rtl'
  /** Resolution root when this language has no value for a key (Fallback Chain, Phase E). */
  fallbackLocale: LanguageCode | null
  pluralRuleLocale: string
  defaultCurrency: string
  defaultTimezone: string
  /** False until `src/i18n/locales/{code}.json` is populated with real translations. */
  hasMessages: boolean
}

export const LANGUAGE_REGISTRY: LanguageMetadata[] = [
  {
    code: 'en',
    bcp47: 'en',
    englishName: 'English',
    nativeName: 'English',
    direction: 'ltr',
    fallbackLocale: null,
    pluralRuleLocale: 'en',
    defaultCurrency: 'USD',
    defaultTimezone: 'UTC',
    hasMessages: true,
  },
  {
    code: 'fa',
    bcp47: 'fa',
    englishName: 'Persian',
    nativeName: 'فارسی',
    direction: 'rtl',
    fallbackLocale: 'en',
    pluralRuleLocale: 'fa',
    defaultCurrency: 'IRR',
    defaultTimezone: 'Asia/Tehran',
    hasMessages: true,
  },
  {
    code: 'ar',
    bcp47: 'ar',
    englishName: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
    fallbackLocale: 'en',
    pluralRuleLocale: 'ar',
    defaultCurrency: 'SAR',
    defaultTimezone: 'Asia/Riyadh',
    hasMessages: true,
  },
  {
    code: 'zh',
    bcp47: 'zh-Hans',
    englishName: 'Chinese (Simplified)',
    nativeName: '简体中文',
    direction: 'ltr',
    fallbackLocale: 'en',
    pluralRuleLocale: 'zh',
    defaultCurrency: 'CNY',
    defaultTimezone: 'Asia/Shanghai',
    hasMessages: false,
  },
  {
    code: 'it',
    bcp47: 'it',
    englishName: 'Italian',
    nativeName: 'Italiano',
    direction: 'ltr',
    fallbackLocale: 'en',
    pluralRuleLocale: 'it',
    defaultCurrency: 'EUR',
    defaultTimezone: 'Europe/Rome',
    hasMessages: false,
  },
  {
    code: 'tr',
    bcp47: 'tr',
    englishName: 'Turkish',
    nativeName: 'Türkçe',
    direction: 'ltr',
    fallbackLocale: 'en',
    pluralRuleLocale: 'tr',
    defaultCurrency: 'TRY',
    defaultTimezone: 'Europe/Istanbul',
    hasMessages: false,
  },
]

export const ALL_LANGUAGE_CODES: LanguageCode[] = LANGUAGE_REGISTRY.map((l) => l.code)

const REGISTRY_BY_CODE = new Map(LANGUAGE_REGISTRY.map((l) => [l.code, l]))

export function getLanguageMetadata(code: string): LanguageMetadata | undefined {
  return REGISTRY_BY_CODE.get(code as LanguageCode)
}

export function isKnownLanguageCode(code: string): code is LanguageCode {
  return REGISTRY_BY_CODE.has(code as LanguageCode)
}
