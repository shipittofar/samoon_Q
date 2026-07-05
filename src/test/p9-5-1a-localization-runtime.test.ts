/**
 * P9.5.1A — Platform Localization Runtime Engine regression tests.
 *
 * Covers language resolution priority, the fallback chain, RTL detection,
 * dynamic-loading-with-fallback, Intl-based formatter correctness, and the
 * missing-translation handler — the six areas the phase spec calls out for
 * regression coverage. Pure unit tests over `src/i18n/runtime.ts` and
 * `src/i18n/language-registry.ts`; no React rendering needed since the
 * runtime service itself has no React dependency.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import '@/config' // registers all Configuration modules, including languages.ts
import { configurationService } from '@/config/service'
import {
  resolveSupportedLocales,
  resolveDefaultLocale,
  resolveRTLLocales,
  isRTLLocale,
  getDirection,
  resolveFallbackChain,
  resolveRequestLocale,
  loadMessages,
  recordMissingTranslation,
  getMissingTranslationLog,
  __resetMissingTranslationLogForTests,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatDate,
  formatRelativeTime,
  formatList,
  getPluralCategory,
  getLanguageInfo,
} from '@/i18n/runtime'
import { ALL_LANGUAGE_CODES, isKnownLanguageCode } from '@/i18n/language-registry'

const ACTOR = { id: 'platform-admin-1', name: 'Platform Admin' }

beforeEach(() => {
  configurationService.__resetForTests()
  __resetMissingTranslationLogForTests()
})

describe('Language Registry (single source of truth, Phase C)', () => {
  it('lists exactly the 6 initially-enabled languages', () => {
    expect(ALL_LANGUAGE_CODES.sort()).toEqual(['ar', 'en', 'fa', 'it', 'tr', 'zh'].sort())
  })

  it('flags en/fa/ar as having real message files and zh/it/tr as not yet translated', () => {
    expect(getLanguageInfo('en')?.hasMessages).toBe(true)
    expect(getLanguageInfo('fa')?.hasMessages).toBe(true)
    expect(getLanguageInfo('ar')?.hasMessages).toBe(true)
    expect(getLanguageInfo('zh')?.hasMessages).toBe(false)
    expect(getLanguageInfo('it')?.hasMessages).toBe(false)
    expect(getLanguageInfo('tr')?.hasMessages).toBe(false)
  })

  it('rejects unknown codes', () => {
    expect(isKnownLanguageCode('xx')).toBe(false)
    expect(isKnownLanguageCode('en')).toBe(true)
  })
})

describe('Configuration-driven resolution (Phase B/C)', () => {
  it('resolveSupportedLocales reflects the languages.supported config field default', () => {
    const supported = resolveSupportedLocales()
    expect(supported.sort()).toEqual(['ar', 'en', 'fa', 'it', 'tr', 'zh'].sort())
  })

  it('resolveDefaultLocale reflects languages.default (en by default)', () => {
    expect(resolveDefaultLocale()).toBe('en')
  })

  it('a platform override of languages.supported narrows what resolveSupportedLocales returns', () => {
    configurationService.updateField({
      fieldId: 'languages.supported',
      value: ['en', 'fa'],
      level: 'platform',
      scope: {},
      actor: ACTOR,
    })
    expect(resolveSupportedLocales().sort()).toEqual(['en', 'fa'])
  })

  it('resolveRTLLocales reflects languages.rtl_locales (fa, ar by default)', () => {
    expect(resolveRTLLocales().sort()).toEqual(['ar', 'fa'])
  })
})

describe('RTL runtime (Phase G)', () => {
  it('fa and ar are RTL; en/zh/it/tr are LTR', () => {
    expect(isRTLLocale('fa')).toBe(true)
    expect(isRTLLocale('ar')).toBe(true)
    expect(isRTLLocale('en')).toBe(false)
    expect(isRTLLocale('zh')).toBe(false)
    expect(isRTLLocale('it')).toBe(false)
    expect(isRTLLocale('tr')).toBe(false)
  })

  it('getDirection maps directly off isRTLLocale', () => {
    expect(getDirection('ar')).toBe('rtl')
    expect(getDirection('en')).toBe('ltr')
  })

  it('falls back to the registry direction fact when languages.rtl_locales resolves empty', () => {
    configurationService.updateField({
      fieldId: 'languages.rtl_locales',
      value: [],
      level: 'platform',
      scope: {},
      actor: ACTOR,
    })
    // Empty override still uses the registry per-language fact rather than
    // silently treating everything as LTR.
    expect(isRTLLocale('ar')).toBe(true)
  })
})

describe('Fallback chain (Phase E)', () => {
  it('an enabled-with-messages language falls back to itself with no chain hops needed to resolve', () => {
    expect(resolveFallbackChain('en')).toEqual(['en'])
  })

  it('a non-English language chains to en (its registry fallbackLocale)', () => {
    expect(resolveFallbackChain('fa')).toEqual(['fa', 'en'])
    expect(resolveFallbackChain('zh')).toEqual(['zh', 'en'])
  })

  it('an unknown/invalid locale resolves straight to the platform default + en', () => {
    const chain = resolveFallbackChain('xx-invalid')
    expect(chain).toContain('en')
    expect(chain).not.toContain('xx-invalid')
  })

  it('never produces a cycle or infinite loop even if called repeatedly', () => {
    expect(() => resolveFallbackChain('ar')).not.toThrow()
    expect(new Set(resolveFallbackChain('ar')).size).toBe(resolveFallbackChain('ar').length)
  })
})

describe('Language resolution priority chain (Phase I)', () => {
  it('explicit locale wins over cookie and browser language', () => {
    expect(
      resolveRequestLocale({ explicitLocale: 'ar', cookieLocale: 'fa', acceptLanguage: 'en-US,en;q=0.9' }),
    ).toBe('ar')
  })

  it('cookie preference wins over browser language when no explicit override', () => {
    expect(resolveRequestLocale({ cookieLocale: 'fa', acceptLanguage: 'en-US,en;q=0.9' })).toBe('fa')
  })

  it('falls back to the parsed Accept-Language primary tag when no cookie', () => {
    expect(resolveRequestLocale({ acceptLanguage: 'ar-SA,ar;q=0.9' })).toBe('ar')
  })

  it('falls back to the platform default, then en, when nothing else matches', () => {
    expect(resolveRequestLocale({})).toBe('en')
  })

  it('skips a candidate that is not in the enabled/supported list', () => {
    configurationService.updateField({
      fieldId: 'languages.supported',
      value: ['en', 'ar'],
      level: 'platform',
      scope: {},
      actor: ACTOR,
    })
    expect(resolveRequestLocale({ cookieLocale: 'fa' })).toBe('en')
  })
})

describe('Dynamic message loading + fallback (Phase D/F)', () => {
  it('loads a real locale file directly for en/fa/ar', async () => {
    const { locale, messages, resolvedFrom } = await loadMessages('en')
    expect(locale).toBe('en')
    expect(resolvedFrom).toBeUndefined()
    expect(messages.common?.appName).toBeDefined()
  })

  it('falls back to English messages for a language with no translation file yet (zh)', async () => {
    const { locale, messages, resolvedFrom } = await loadMessages('zh')
    expect(locale).toBe('zh')
    expect(resolvedFrom).toBe('en')
    expect(messages.common?.appName).toBeDefined()
    expect(getMissingTranslationLog().some((e) => e.locale === 'zh' && e.kind === 'missing-namespace')).toBe(true)
  })

  it('handles an entirely invalid locale by falling back to en without throwing', async () => {
    const { messages } = await loadMessages('not-a-real-locale')
    expect(messages.common?.appName).toBeDefined()
    expect(getMissingTranslationLog().some((e) => e.kind === 'invalid-locale')).toBe(true)
  })
})

describe('Missing translation handler (Phase F)', () => {
  it('records and reports missing-key events', () => {
    recordMissingTranslation({ kind: 'missing-key', locale: 'fa', namespace: 'checkout', key: 'new_field' })
    expect(getMissingTranslationLog()).toHaveLength(1)
    expect(getMissingTranslationLog()[0]).toMatchObject({ kind: 'missing-key', locale: 'fa' })
  })

  it('__resetMissingTranslationLogForTests clears the log', () => {
    recordMissingTranslation({ kind: 'missing-key', locale: 'fa' })
    __resetMissingTranslationLogForTests()
    expect(getMissingTranslationLog()).toHaveLength(0)
  })
})

describe('Formatting runtime — Intl.*-backed, never hand-rolled (Phase H)', () => {
  it('formatNumber delegates to Intl.NumberFormat per locale', () => {
    expect(formatNumber('en', 1234.5)).toBe(new Intl.NumberFormat('en').format(1234.5))
    expect(formatNumber('fa', 1234.5)).toBe(new Intl.NumberFormat('fa').format(1234.5))
  })

  it('formatCurrency uses the language registry default currency when none given', () => {
    expect(formatCurrency('en', 10)).toBe(new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' }).format(10))
    expect(formatCurrency('ar', 10)).toBe(new Intl.NumberFormat('ar', { style: 'currency', currency: 'SAR' }).format(10))
  })

  it('formatCurrency honors an explicit currency override', () => {
    expect(formatCurrency('en', 10, 'EUR')).toBe(new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' }).format(10))
  })

  it('formatPercent delegates to Intl.NumberFormat percent style', () => {
    expect(formatPercent('en', 0.5)).toBe(new Intl.NumberFormat('en', { style: 'percent' }).format(0.5))
  })

  it('formatDate delegates to Intl.DateTimeFormat', () => {
    const d = new Date('2026-07-05T00:00:00Z')
    expect(formatDate('en', d)).toBe(new Intl.DateTimeFormat('en').format(d))
  })

  it('formatRelativeTime delegates to Intl.RelativeTimeFormat', () => {
    expect(formatRelativeTime('en', -1, 'day')).toBe(new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-1, 'day'))
  })

  it('formatList delegates to Intl.ListFormat', () => {
    expect(formatList('en', ['a', 'b', 'c'])).toBe(new Intl.ListFormat('en').format(['a', 'b', 'c']))
  })

  it('getPluralCategory uses the registry pluralRuleLocale and matches Intl.PluralRules directly', () => {
    expect(getPluralCategory('en', 1)).toBe('one')
    expect(getPluralCategory('en', 2)).toBe('other')
    expect(getPluralCategory('ar', 0)).toBe(new Intl.PluralRules('ar').select(0))
  })
})
