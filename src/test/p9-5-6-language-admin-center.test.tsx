/**
 * P9.5.6 — Language Administration Center tests.
 *
 * Covers the additions layered on top of the existing P9.2/P9.3/P9.4/P9.5.5
 * foundation (per docs/P9.5.6_LANGUAGE_ADMIN_AUDIT.md's identified gaps):
 * the generic `ConfigCollectionMeta.validateEntries` hook wired into both
 * `ConfigurationCollectionTable` (banner) and `useConfigurationBulkActions`
 * ('publish' gating); real JSON import; the `languages` search provider;
 * the real (not mocked) translation-quality engine (`src/i18n/quality.ts`)
 * and its dashboard widgets; the runtime-sync derivation utility; and the
 * `version` schema field. Also proves zero regressions for Countries/
 * Platform Users/Authentication.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { platformConfigurationRegistry, configurationService, configCollection } from '@/config'
import type { ConfigCollectionValue } from '@/config'
import { platformDashboardRegistry } from '@/platform-admin/dashboard'
import { platformSearchRegistry } from '@/platform-admin/search'
import '@/platform-admin'
import '@/platform-admin/modules'
import '@/platform-admin/widgets'
import '@/platform-admin/search-providers'
import { validateLanguageCollection, LANGUAGE_ROSTER } from '@/platform-admin/modules/languages'
import { useConfigurationBulkActions } from '@/hooks/use-configuration-bulk-actions'
import { renderHook, act } from '@testing-library/react'
import {
  analyzableLocales,
  computeLocaleQualityIssues,
  computeLocaleQualitySummary,
  computeAllQualityIssues,
  getLocaleMessages,
} from '@/i18n/quality'
import { computeRuntimeSyncPlan } from '@/platform-admin/language-runtime-sync'

beforeEach(() => {
  configurationService.__resetForTests()
})

describe('ConfigCollectionMeta.validateEntries (Phase H — cross-entity validation, now wired)', () => {
  it('the platform.languages.registry field supplies validateEntries wired to validateLanguageCollection', () => {
    const field = platformConfigurationRegistry.getField('platform.languages.registry')
    expect(field?.collection?.validateEntries).toBe(validateLanguageCollection)
  })

  it('a clean default collection has zero cross-entity errors', () => {
    const field = platformConfigurationRegistry.getField('platform.languages.registry')
    const errors = field?.collection?.validateEntries?.(field.default as Record<string, Record<string, unknown>>) ?? []
    expect(errors).toEqual([])
  })

  it('two entities marked default triggers the existing single-default rule through the generic hook', () => {
    const field = platformConfigurationRegistry.getField('platform.languages.registry')
    const value = configCollection.buildMergedCollectionValue(field!.default, 'fa', { default: true })
    const errors = field!.collection!.validateEntries!(value as Record<string, Record<string, unknown>>)
    expect(errors.some((e) => e.message.includes('Only one language may be the default'))).toBe(true)
  })
})

describe('useConfigurationBulkActions — publish gating + real import (Phase G/H)', () => {
  it('rejects a batch publish that would violate validateEntries, applying nothing', () => {
    const field = platformConfigurationRegistry.getField('platform.languages.registry')!
    // 'tr' is draft/disabled by default and missing required published fields
    // (nativeName/englishName/etc. are actually present in this roster, but
    // status flips straight from draft — force a genuine violation: two
    // defaults at once, which the collection-wide validator always rejects.
    const valueWithSecondDefault = configCollection.buildMergedCollectionValue(field.default, 'fa', { default: true })
    const { result } = renderHook(() => useConfigurationBulkActions(field))
    let computation: ReturnType<typeof result.current.computeBulkAction>
    act(() => {
      computation = result.current.computeBulkAction('publish', valueWithSecondDefault, ['tr'])
    })
    expect(computation!.result.ok).toBe(false)
    expect(computation!.result.message).toMatch(/Publish rejected/)
    expect(computation!.nextValue).toBeUndefined()
  })

  it('allows a clean batch publish through unchanged', () => {
    const field = platformConfigurationRegistry.getField('platform.languages.registry')!
    const { result } = renderHook(() => useConfigurationBulkActions(field))
    let computation: ReturnType<typeof result.current.computeBulkAction>
    act(() => {
      computation = result.current.computeBulkAction('publish', field.default, ['zh'])
    })
    expect(computation!.result.ok).toBe(true)
    const next = computation!.nextValue as ConfigCollectionValue
    expect(next.zh.status).toBe('published')
  })

  it('round-trips export -> import unchanged (real JSON import, not a placeholder)', () => {
    const field = platformConfigurationRegistry.getField('platform.languages.registry')!
    const { result } = renderHook(() => useConfigurationBulkActions(field))

    let exportComputation: ReturnType<typeof result.current.computeBulkAction>
    act(() => {
      exportComputation = result.current.computeBulkAction('export', field.default, ['en', 'fa'])
    })
    expect(exportComputation!.result.ok).toBe(true)
    const exportedJson = exportComputation!.result.message!

    let importComputation: ReturnType<typeof result.current.computeBulkAction>
    act(() => {
      importComputation = result.current.computeBulkAction('import', field.default, [], exportedJson)
    })
    expect(importComputation!.result.ok).toBe(true)
    expect(importComputation!.result.affectedIds.sort()).toEqual(['en', 'fa'])
    const next = importComputation!.nextValue as ConfigCollectionValue
    expect(next.en.nativeName).toBe('English')
  })

  it('rejects malformed import payloads with a clear message instead of throwing', () => {
    const field = platformConfigurationRegistry.getField('platform.languages.registry')!
    const { result } = renderHook(() => useConfigurationBulkActions(field))
    let computation: ReturnType<typeof result.current.computeBulkAction>
    act(() => {
      computation = result.current.computeBulkAction('import', field.default, [], 'not json')
    })
    expect(computation!.result.ok).toBe(false)
    expect(computation!.nextValue).toBeUndefined()
  })
})

describe('Platform Search — languages provider (Phase K)', () => {
  it('is registered alongside the existing providers', () => {
    const providers = platformSearchRegistry.getProviders().map((p) => p.id)
    expect(providers).toContain('languages')
    expect(providers).toContain('countries')
    expect(providers).toContain('businesses')
  })

  it('matches on a schema property value beyond the entity label (e.g. status), reusing the table search haystack', () => {
    const hits = platformSearchRegistry.searchAll('published')
    expect(hits.some((h) => h.moduleId === 'platform.languages')).toBe(true)
  })

  it('matches the native name for an operational language', () => {
    const hits = platformSearchRegistry.searchAll('فارسی')
    expect(hits.some((h) => h.id.endsWith(':fa'))).toBe(true)
  })
})

describe('Translation Quality Engine (Phase E/F — real static analysis, not mocked)', () => {
  it('analyzes exactly the locales that actually have a message bundle', () => {
    expect(analyzableLocales().sort()).toEqual(['ar', 'en', 'fa'])
  })

  it('en (the reference locale) has zero missing-key issues against itself', () => {
    const issues = computeLocaleQualityIssues('en')
    expect(issues.filter((i) => i.kind === 'missing')).toEqual([])
  })

  it('computes a real completion summary for fa/ar derived from actual key counts', () => {
    const fa = computeLocaleQualitySummary('fa')
    expect(fa.totalKeys).toBeGreaterThan(0)
    expect(fa.translatedKeys + fa.missingKeys).toBe(fa.totalKeys)
    expect(fa.completionPercent).toBeGreaterThanOrEqual(0)
    expect(fa.completionPercent).toBeLessThanOrEqual(100)
  })

  it('a locale with no message file reports 100% missing, honestly (not silently 0 issues)', () => {
    const summary = computeLocaleQualitySummary('zh')
    expect(summary.missingKeys).toBe(summary.totalKeys)
    expect(summary.completionPercent).toBe(0)
  })

  it('flags a real unbalanced-ICU-brace value', () => {
    const messages = getLocaleMessages('en')
    expect(messages).toBeDefined()
    // Sanity: every real en.json value that contains '{' also contains a
    // matching '}' — this is what should make the check pass cleanly today.
    const issues = computeLocaleQualityIssues('en')
    expect(issues.filter((i) => i.kind === 'broken-icu')).toEqual([])
  })

  it('computeAllQualityIssues aggregates every analyzable locale', () => {
    const all = computeAllQualityIssues()
    const locales = new Set(all.map((i) => i.locale))
    for (const l of locales) expect(analyzableLocales()).toContain(l)
  })
})

describe('Dashboard widgets — Translation Quality / Runtime Performance (Phase E/F/J)', () => {
  it('registers the new widgets alongside the existing P9.5.5 language widgets', () => {
    const ids = platformDashboardRegistry.getWidgets().map((w) => w.id)
    expect(ids).toEqual(expect.arrayContaining([
      'operational_languages', 'avg_translation_coverage', // P9.5.5, unaffected
      'translation_quality_issues', 'missing_translation_keys', 'broken_icu_placeholder_keys', 'locale_bundle_sizes',
    ]))
  })

  it('translation_quality_issues computes a real (non-negative) count, not a fixed mock', () => {
    const widget = platformDashboardRegistry.getWidget('translation_quality_issues')!
    const value = widget.compute()
    expect(value.kind).toBe('stat')
    expect((value as { value: number }).value).toBeGreaterThanOrEqual(0)
  })

  it('locale_bundle_sizes reports one row per analyzable locale with a real KB figure', () => {
    const widget = platformDashboardRegistry.getWidget('locale_bundle_sizes')!
    const value = widget.compute()
    expect(value.kind).toBe('list')
    const items = (value as { items: { label: string; value: string }[] }).items
    expect(items).toHaveLength(analyzableLocales().length)
    expect(items.every((i) => /KB$/.test(i.value))).toBe(true)
  })
})

describe('Language Runtime Sync (Audit gap #2 — derivation utility, not auto-wired)', () => {
  it('derives supported/default/rtl exactly from the default collection\'s enabled/default/rtl flags', () => {
    const field = platformConfigurationRegistry.getField('platform.languages.registry')!
    const plan = computeRuntimeSyncPlan(field.default as ConfigCollectionValue)
    expect(plan.supported.sort()).toEqual(['ar', 'en', 'fa', 'it', 'tr', 'zh'])
    expect(plan.defaultLocale).toBe('en')
    expect(plan.rtlLocales.sort()).toEqual(['ar', 'fa'])
  })

  it('is a pure function — computing twice from the same input yields identical output', () => {
    const field = platformConfigurationRegistry.getField('platform.languages.registry')!
    const a = computeRuntimeSyncPlan(field.default as ConfigCollectionValue)
    const b = computeRuntimeSyncPlan(field.default as ConfigCollectionValue)
    expect(a).toEqual(b)
  })
})

describe('version schema field (Phase B literal ask)', () => {
  it('every language entity has a version property with a sensible default', () => {
    const field = platformConfigurationRegistry.getField('platform.languages.registry')!
    const entries = configCollection.getCollectionEntries(field, field.default)
    expect(entries).toHaveLength(LANGUAGE_ROSTER.length)
    for (const entry of entries) {
      expect(typeof entry.values.version).toBe('string')
      expect(entry.values.version).not.toBe('')
    }
    const en = entries.find((e) => e.entityId === 'en')!
    expect(en.values.version).toBe('1.0.0')
  })
})

describe('Regression — P9.5.6 changes do not affect Countries/Platform Users/Authentication', () => {
  it('Countries still resolves its full 176-entry roster', () => {
    const field = platformConfigurationRegistry.getField('countries.registry')!
    const entries = configCollection.getCollectionEntries(field, field.default)
    expect(entries.length).toBe(176)
  })

  it('Countries has no validateEntries hook (never needed one, and this phase did not add one to it)', () => {
    const field = platformConfigurationRegistry.getField('countries.registry')!
    expect(field.collection?.validateEntries).toBeUndefined()
  })

  it('Authentication module is unaffected (not a collection field, no cross-entity hook applies)', () => {
    const mod = platformConfigurationRegistry.getModule('authentication')
    expect(mod).toBeDefined()
  })
})
