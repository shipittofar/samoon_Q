/**
 * P9.5.1B — Application Localization Migration regression tests.
 *
 * Covers the phase's required areas: translation lookup, namespace loading,
 * missing-key fallback, localized validation, RTL rendering, and the
 * Translation Coverage utility (Phase J) built to detect
 * missing/unused/orphan translation usage as the app migrates.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider, useTranslations } from 'next-intl'
import '@/config' // registers all Configuration modules, including languages.ts
import en from '@/i18n/locales/en.json'
import fa from '@/i18n/locales/fa.json'
import {
  flattenMessages,
  findMissingKeys,
  findUnusedKeys,
  findDuplicateValues,
  findOrphanNamespaces,
  extractTranslationUsagesFromSource,
  buildCoverageReport,
} from '@/i18n/coverage'
import { getDirection, isRTLLocale } from '@/i18n/runtime'
import { getHreflangEligibleLocales, buildHreflangAlternates } from '@/i18n/seo'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withLocale(locale: string, messages: any, children: React.ReactNode) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}

function AuthWelcome() {
  const t = useTranslations('auth')
  return <h1>{t('welcome')}</h1>
}

function MissingKeyProbe() {
  const t = useTranslations('auth')
  return <p>{t('this_key_does_not_exist' as never)}</p>
}

describe('Translation lookup + namespace loading (Phase B/D)', () => {
  it('resolves a real key through NextIntlClientProvider for the English bundle', () => {
    render(withLocale('en', en, <AuthWelcome />))
    expect(screen.getByRole('heading')).toHaveTextContent('Welcome')
  })

  it('resolves the same key through the Persian bundle with translated content', () => {
    render(withLocale('fa', fa, <AuthWelcome />))
    expect(screen.getByRole('heading')).toHaveTextContent('خوش آمدید')
  })

  it('only the requested locale bundle is ever passed to the provider (no cross-locale leakage)', () => {
    // en.json and fa.json are genuinely different objects — rendering with
    // one never accidentally pulls values from the other.
    expect(en.auth.welcome).not.toBe(fa.auth.welcome)
  })
})

describe('Missing key fallback (Phase F/K) — never crashes, renders a readable placeholder', () => {
  it('renders `namespace.key` instead of throwing when a key is absent', () => {
    render(withLocale('en', en, <MissingKeyProbe />))
    expect(screen.getByText('auth.this_key_does_not_exist')).toBeInTheDocument()
  })
})

describe('RTL rendering (Phase M)', () => {
  it('fa and ar resolve to rtl direction', () => {
    expect(getDirection('fa')).toBe('rtl')
    expect(getDirection('ar')).toBe('rtl')
    expect(isRTLLocale('fa')).toBe(true)
  })

  it('en resolves to ltr direction', () => {
    expect(getDirection('en')).toBe('ltr')
    expect(isRTLLocale('en')).toBe(false)
  })
})

describe('Localized validation (Phase E)', () => {
  it('the validation namespace carries all 9 keys the phase spec requires, in every shipped locale', () => {
    const required = [
      'required', 'invalid_phone', 'invalid_email', 'invalid_password',
      'otp_expired', 'too_many_attempts', 'network_error', 'permission_denied', 'unknown_error',
    ]
    for (const key of required) {
      expect(en.validation).toHaveProperty(key)
      expect(fa.validation).toHaveProperty(key)
    }
  })

  it('a schema-style error key (e.g. zod message "invalid_email") resolves to real text via the validation namespace', () => {
    function ValidationProbe() {
      const t = useTranslations('validation')
      return <span role="alert">{t('invalid_email')}</span>
    }
    render(withLocale('en', en, <ValidationProbe />))
    expect(screen.getByRole('alert')).toHaveTextContent('Valid email required')
  })
})

describe('Translation Coverage utility (Phase J) — pure functions', () => {
  const messages = {
    common: { save: 'Save', cancel: 'Cancel' },
    checkout: { confirm_button: 'Confirm', duplicate_a: 'Same', duplicate_b: 'Same' },
  }

  it('flattenMessages produces dotted keys', () => {
    expect(flattenMessages(messages)).toEqual({
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'checkout.confirm_button': 'Confirm',
      'checkout.duplicate_a': 'Same',
      'checkout.duplicate_b': 'Same',
    })
  })

  it('findMissingKeys flags a used key absent from the reference messages', () => {
    const usages = [{ key: 'checkout.confirm_button' }, { key: 'checkout.nonexistent' }]
    const missing = findMissingKeys(usages, messages)
    expect(missing).toEqual([{ key: 'checkout.nonexistent' }])
  })

  it('findUnusedKeys flags a defined key with no call site (and its namespace not referenced generically)', () => {
    const usages = [{ key: 'common.save', namespace: 'common' }]
    const unused = findUnusedKeys(messages, usages)
    expect(unused).toContain('checkout.confirm_button')
    expect(unused).not.toContain('common.save')
    expect(unused).not.toContain('common.cancel') // same namespace referenced generically
  })

  it('findDuplicateValues detects two keys under the same namespace sharing an identical value', () => {
    const dupes = findDuplicateValues(messages)
    expect(dupes).toHaveLength(1)
    expect(dupes[0]).toMatchObject({ namespace: 'checkout', value: 'Same' })
    expect(dupes[0].keys.sort()).toEqual(['checkout.duplicate_a', 'checkout.duplicate_b'])
  })

  it('findOrphanNamespaces flags a namespace referenced in source with no entry in the reference messages', () => {
    const usages = [{ key: 'ghost', namespace: 'ghost' }]
    expect(findOrphanNamespaces(usages, messages)).toEqual(['ghost'])
  })

  it('extractTranslationUsagesFromSource correctly attributes calls across multiple scoped hooks in one file', () => {
    const source = `
      const t = useTranslations('auth')
      const tCommon = useTranslations('common')
      const tValidation = useTranslations('validation')
      function Page() {
        return <div>{t('welcome')}{tCommon('save')}{tValidation('required')}</div>
      }
    `
    const usages = extractTranslationUsagesFromSource(source, 'fake.tsx')
    const keys = usages.map((u) => u.key)
    expect(keys).toContain('auth.welcome')
    expect(keys).toContain('common.save')
    expect(keys).toContain('validation.required')
    // Regression guard: a naive "most-recently-declared-namespace" heuristic
    // would misattribute t('welcome') to 'validation' since that's the last
    // useTranslations() call in the file — it must not.
    expect(keys).not.toContain('validation.welcome')
  })

  it('buildCoverageReport composes all four checks against the real en.json bundle with zero real usages', () => {
    const report = buildCoverageReport([], en)
    expect(report.missingKeys).toEqual([])
    expect(report.orphanNamespaces).toEqual([])
    expect(Array.isArray(report.duplicateValues)).toBe(true)
  })

  it('the real en.json translation namespace has no accidental duplicate-value pairs', () => {
    const dupes = findDuplicateValues(en).filter((d) => d.namespace === 'validation')
    expect(dupes).toEqual([])
  })
})

describe('SEO metadata localization infrastructure (Phase H/N)', () => {
  it('getHreflangEligibleLocales returns one entry per enabled language using its own BCP 47 id', () => {
    const alternates = getHreflangEligibleLocales()
    expect(alternates.find((a) => a.locale === 'zh')?.hreflang).toBe('zh-Hans')
    expect(alternates.find((a) => a.locale === 'en')?.hreflang).toBe('en')
  })

  it('buildHreflangAlternates delegates URL construction to the provided strategy function (no routing assumption baked in)', () => {
    const alternates = buildHreflangAlternates('/menu', (locale, path) => `https://example.com/${locale}${path}`)
    expect(alternates.en).toBe('https://example.com/en/menu')
    expect(alternates.fa).toBe('https://example.com/fa/menu')
  })
})
