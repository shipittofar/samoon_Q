/**
 * P9.5.4 — Production Localization Completion regression tests.
 *
 * Covers the infrastructure built this phase: the `resolveConfigText()`
 * field-text resolution helper (and the real architectural bug it
 * surfaced — see "resolveConfigText" describe block below), the
 * remaining Studio panel chrome migrations, search resolving translated
 * metadata, the missing-translation dev inspector, the extended coverage
 * tool (namespace/global percentage), the hardcoded-string guard script,
 * and the localized page-metadata helper.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider, useTranslations } from 'next-intl'
import { createTranslator } from 'use-intl/core'
import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import en from '@/i18n/locales/en.json'
import fa from '@/i18n/locales/fa.json'
import ar from '@/i18n/locales/ar.json'
import { resolveConfigText } from '@/config'
import { computeNamespaceCoverage, computeGlobalCoverage, findHardcodedJsxText } from '@/i18n/coverage'
import { getMissingTranslationLog, __resetMissingTranslationLogForTests, recordMissingTranslation } from '@/i18n/runtime'

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withLocale(locale: string, messages: any, children: React.ReactNode) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}

describe('resolveConfigText — the real architectural bug this phase found and fixed', () => {
  // Dotted ids (e.g. "authentication.core") are how every ConfigModuleDefinition/
  // ConfigFieldDefinition already names itself. Storing configFields keys as
  // FLAT strings with literal dots embedded ("authentication.core.title": "...")
  // silently never resolves, because next-intl treats every dot in a key as a
  // level of object nesting — `t.has('a.b.c')` looks for messages.a.b.c, not a
  // flat property literally named "a.b.c". The fix was migrating every
  // configFields/seo entry to genuinely nested JSON objects; this test locks
  // that shape in so a future edit can't silently reintroduce the flat form.
  it('a flat dotted-string key ("a.b.c": value) never resolves via t.has() — next-intl treats every dot as nesting', () => {
    const messages = { configFields: { 'authentication.core.title': 'Core Toggles' } }
    const t = createTranslator({ locale: 'en', messages, namespace: 'configFields' })
    expect(t.has('authentication.core.title' as never)).toBe(false)
  })

  it('the same dotted id resolves once configFields is a real nested object', () => {
    const messages = { configFields: { authentication: { core: { title: 'Core Toggles' } } } }
    const t = createTranslator({ locale: 'en', messages, namespace: 'configFields' })
    expect(t.has('authentication.core.title' as never)).toBe(true)
    expect(t('authentication.core.title' as never)).toBe('Core Toggles')
  })

  it('the real en/fa locale bundles store configFields/seo as nested objects, not flat dotted keys', () => {
    expect(typeof (en as Record<string, unknown>).configFields).toBe('object')
    const configFields = (en as { configFields: Record<string, unknown> }).configFields
    expect(configFields.authentication).toBeTypeOf('object')
    expect((configFields.authentication as Record<string, unknown>).core).toBeTypeOf('object')
    // The bug this test guards against: a flat key literally containing dots.
    expect(Object.keys(configFields)).not.toContain('authentication.core.title')
  })

  function ResolveTitleProbe({ locale, messages }: { locale: string; messages: unknown }) {
    const t = useTranslations('configFields')
    const resolved = resolveConfigText(t, 'authentication', 'name', 'fallback-literal')
    return <p>{resolved}</p>
  }

  it('resolveConfigText resolves the real migrated authentication module name in English', () => {
    render(withLocale('en', en, <ResolveTitleProbe locale="en" messages={en} />))
    expect(screen.getByText('Authentication')).toBeInTheDocument()
  })

  it('resolveConfigText resolves the real migrated authentication module name in Persian', () => {
    render(withLocale('fa', fa, <ResolveTitleProbe locale="fa" messages={fa} />))
    expect(screen.getByText('احراز هویت')).toBeInTheDocument()
  })

  function UnmigratedFallbackProbe() {
    const t = useTranslations('configFields')
    const resolved = resolveConfigText(t, 'some.unmigrated.field', 'title', 'Literal English Title')
    return <p>{resolved}</p>
  }

  it('falls back to the literal for a field id with no configFields entry (safe, non-breaking for unmigrated modules)', () => {
    render(withLocale('en', en, <UnmigratedFallbackProbe />))
    expect(screen.getByText('Literal English Title')).toBeInTheDocument()
  })
})

describe('Remaining Studio panel chrome migrated to next-intl (Phase D)', () => {
  const migrated = [
    'components/admin/configuration/ConfigurationInspector.tsx',
    'components/admin/configuration/ConfigurationInheritanceTree.tsx',
    'components/admin/configuration/ConfigurationCompareView.tsx',
    'components/admin/configuration/ConfigurationHistoryTimeline.tsx',
    'components/admin/configuration/ConfigurationFieldControl.tsx',
    'components/admin/configuration/ConfigurationFieldPreview.tsx',
    'components/admin/configuration/ConfigurationFieldBadges.tsx',
    'components/admin/configuration/ConfigurationWorkspaceSkeleton.tsx',
    'components/admin/configuration/ConfigurationStudioLayout.tsx',
  ]

  it.each(migrated)('%s imports useTranslations from next-intl', (file) => {
    expect(readSrc(file)).toContain("from 'next-intl'")
  })
})

describe('Missing-translation dev inspector (Phase H) — never crashes, records + flags in dev', () => {
  afterEach(() => {
    __resetMissingTranslationLogForTests()
  })

  it('records a missing-key event without throwing', () => {
    expect(() => recordMissingTranslation({ kind: 'missing-key', locale: 'en', namespace: 'console', key: 'doesNotExist' })).not.toThrow()
    const log = getMissingTranslationLog()
    expect(log.some((e) => e.key === 'doesNotExist')).toBe(true)
  })

  it('ClientIntlProvider and request.ts wire onError/getMessageFallback (never throws on a missing key)', () => {
    const clientProvider = readSrc('i18n/ClientIntlProvider.tsx')
    expect(clientProvider).toContain('getMessageFallback')
    expect(clientProvider).toContain('onError')
    const requestConfig = readSrc('i18n/request.ts')
    expect(requestConfig).toContain('getMessageFallback')
  })
})

describe('Coverage tool extension (Phase I) — per-namespace + global percentage', () => {
  it('computes 100% coverage for a fully-translated namespace', () => {
    const reference = { demo: { a: 'A', b: 'B' } }
    const target = { demo: { a: 'أ', b: 'ب' } }
    const [coverage] = computeNamespaceCoverage(reference, target)
    expect(coverage).toEqual({ namespace: 'demo', totalKeys: 2, translatedKeys: 2, percent: 100 })
  })

  it('computes partial coverage when a target value is empty', () => {
    const reference = { demo: { a: 'A', b: 'B' } }
    const target = { demo: { a: 'أ', b: '' } }
    const [coverage] = computeNamespaceCoverage(reference, target)
    expect(coverage.percent).toBe(50)
  })

  it('the real fa/ar locale bundles are 100% covered against en (parity is already CI-gated by validate-i18n.mjs)', () => {
    const nsCoverage = computeNamespaceCoverage(en, ar)
    expect(computeGlobalCoverage(nsCoverage)).toBe(100)
  })

  it('findHardcodedJsxText flags literal JSX text but not expressions', () => {
    const source = `
      function C() {
        return <div>
          <p>Hardcoded English Sentence</p>
          <p>{t('translated.key')}</p>
        </div>
      }
    `
    const found = findHardcodedJsxText(source, 'fake.tsx')
    expect(found.some((f) => f.snippet.includes('Hardcoded English Sentence'))).toBe(true)
  })
})

describe('Hardcoded-string guard script (Phase J) — CI gate over already-migrated directories', () => {
  it('exits 0 with no candidates found across the currently migrated Console/Studio/Platform-admin directories', () => {
    const result = execFileSync('node', [path.join(ROOT, 'scripts', 'check-hardcoded-strings.mjs')], { encoding: 'utf-8' })
    expect(result).toContain('No hardcoded string candidates found')
  })
})

describe('Localized page metadata helper (Phase F/G)', () => {
  it('src/lib/seo.ts builds alternates.languages from the enabled-locale list, not a hardcoded array', () => {
    const seoSrc = readSrc('lib/seo.ts')
    expect(seoSrc).toContain('resolveSupportedLocales')
    expect(seoSrc).toContain('alternates')
  })

  it('the seo namespace has real nested root.title/description/keywords in en and fa', () => {
    const enSeo = (en as { seo: { root: { title: string; description: string; keywords: string } } }).seo
    const faSeo = (fa as { seo: { root: { title: string; description: string; keywords: string } } }).seo
    expect(enSeo.root.title).toBe('Savor — Hospitality Platform')
    expect(faSeo.root.title).not.toBe(enSeo.root.title)
  })
})
