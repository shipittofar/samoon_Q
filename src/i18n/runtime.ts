/**
 * Localization Runtime Service — P9.5.1A
 *
 * The single module every locale-aware call site (server request config,
 * client hooks, stores) resolves through. Implements the strategy fixed by
 * `docs/P9.5.0_PERFORMANCE_STRATEGY.md` (never load more than one language's
 * messages) and `docs/P9.5.0_TRANSLATION_ARCHITECTURE.md` §6 (fallback
 * chain), against the *current* config-driven `languages.*` fields — not
 * the full `localization.languages` collection designed in P9.5.0, which is
 * P9.5.1B scope.
 *
 * Pure TypeScript, no React, no 'use client' — safe to import from both
 * server (`src/i18n/request.ts`) and client (`src/i18n/hooks.ts`) code.
 *
 * P9.5.5.1 — `configurationService` is imported from the `'@/config'`
 * barrel, not `'@/config/service'` directly. This file is reached from
 * `src/app/layout.tsx` (via `getDirection`), which every single route
 * imports first — so this was, in practice, the most likely place in the
 * whole app for `platformConfigurationRegistry.getField()` to run before
 * the barrel's `import './modules/languages'` (and every other core
 * module) had registered. `getField()` seals the registry as its first
 * action (`src/config/registry.ts`), so once that happened here, (a)
 * `languages.supported`/`languages.default`/`languages.rtl_locales` would
 * report "unknown field" — because `./modules/languages` never ran — and
 * (b) any later `import '@/config'` (e.g. loading `/platform-admin`) would
 * throw `register("countries") called after the registry was sealed`,
 * since `./modules/countries` runs first in the barrel and the registry
 * was already sealed. Importing the barrel here forces every core module
 * to register before this file's functions can ever call
 * `resolveField()`. See docs/P9.5.5.1_RUNTIME_RECOVERY.md.
 */
import { configurationService } from '@/config'
import { parseDecimal } from '@/utils/decimal'
import {
  ALL_LANGUAGE_CODES,
  getLanguageMetadata,
  isKnownLanguageCode,
  type LanguageMetadata,
} from './language-registry'

// ── Phase C: single source of truth for the enabled/default/rtl lists ────────
// Reads through ConfigurationService so a platform/tenant override of
// `languages.supported`/`languages.default`/`languages.rtl_locales` is
// honored everywhere, instead of each call site re-reading the constant.

export function resolveSupportedLocales(): string[] {
  const resolved = configurationService.resolveField('languages.supported').value
  const list = Array.isArray(resolved) ? (resolved as string[]) : ALL_LANGUAGE_CODES
  return list.filter(isKnownLanguageCode)
}

export function resolveDefaultLocale(): string {
  const resolved = configurationService.resolveField('languages.default').value
  return typeof resolved === 'string' && isKnownLanguageCode(resolved) ? resolved : 'en'
}

export function resolveRTLLocales(): string[] {
  const resolved = configurationService.resolveField('languages.rtl_locales').value
  return Array.isArray(resolved) ? (resolved as string[]) : []
}

// ── Phase G: RTL runtime ──────────────────────────────────────────────────────

export function isRTLLocale(locale: string): boolean {
  const rtlList = resolveRTLLocales()
  if (rtlList.length > 0) return rtlList.includes(locale)
  // Falls back to the registry's own per-language direction fact if the
  // config field has never been read (e.g. a unit test importing this
  // module directly) so isRTLLocale never depends on resolveRTLLocales
  // having been called first.
  return getLanguageMetadata(locale)?.direction === 'rtl'
}

export function getDirection(locale: string): 'ltr' | 'rtl' {
  return isRTLLocale(locale) ? 'rtl' : 'ltr'
}

// ── Phase E: fallback chain ───────────────────────────────────────────────────
// requestedLocale -> its registry fallbackLocale (repeated until null) ->
// platform default -> 'en', matching P9.5.0_TRANSLATION_ARCHITECTURE.md §6,
// generalized here from "namespace key value" resolution to "which locale's
// message bundle do we load" resolution (Phase D's concrete use of it).

export function resolveFallbackChain(locale: string): string[] {
  const chain: string[] = []
  const seen = new Set<string>()
  let current: string | null = isKnownLanguageCode(locale) ? locale : null

  while (current && !seen.has(current)) {
    chain.push(current)
    seen.add(current)
    current = getLanguageMetadata(current)?.fallbackLocale ?? null
  }

  const platformDefault = resolveDefaultLocale()
  if (!seen.has(platformDefault)) chain.push(platformDefault)
  if (!seen.has('en')) chain.push('en')

  return chain
}

// ── Phase I: language resolution priority ─────────────────────────────────────
// explicit override (e.g. a future `?locale=` param or SSR prop) -> saved
// cookie preference -> browser Accept-Language -> platform default -> 'en'.
// No URL-routing change is made in this phase (per the phase's own
// constraint) — `explicitLocale` exists so a P9.5.1B path-prefixed router
// can plug straight in without touching this function's shape.

export interface LanguageResolutionInput {
  explicitLocale?: string | null
  cookieLocale?: string | null
  acceptLanguage?: string | null
}

export function resolveRequestLocale(input: LanguageResolutionInput): string {
  const supported = resolveSupportedLocales()
  const candidates = [
    input.explicitLocale,
    input.cookieLocale,
    input.acceptLanguage?.split(',')[0]?.split('-')[0],
  ]
  for (const candidate of candidates) {
    if (candidate && supported.includes(candidate)) return candidate
  }
  const platformDefault = resolveDefaultLocale()
  return supported.includes(platformDefault) ? platformDefault : 'en'
}

// ── Phase F: missing translation handler ──────────────────────────────────────

export type MissingTranslationKind = 'missing-key' | 'invalid-locale' | 'missing-namespace'

export interface MissingTranslationEvent {
  kind: MissingTranslationKind
  locale: string
  namespace?: string
  key?: string
  fallbackUsed?: string
}

let missingTranslationLog: MissingTranslationEvent[] = []

export function recordMissingTranslation(event: MissingTranslationEvent): void {
  missingTranslationLog.push(event)
  if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
    console.warn(`[i18n] ${event.kind}: locale="${event.locale}"${event.key ? ` key="${event.namespace ?? ''}.${event.key}"` : ''}${event.fallbackUsed ? ` -> fallback "${event.fallbackUsed}"` : ''}`)
  }
}

export function getMissingTranslationLog(): readonly MissingTranslationEvent[] {
  return missingTranslationLog
}

export function __resetMissingTranslationLogForTests(): void {
  missingTranslationLog = []
}

// ── Phase D: dynamic per-locale message loading (never bundle every language) ─
// One dynamic `import(`./locales/${locale}.json`)` template, exactly as
// `src/i18n/request.ts` already did — Next.js code-splits each locale file
// into its own chunk, so only the requested locale is ever fetched. The
// only change here is walking the fallback chain (Phase E) when a locale
// has no message file yet (`hasMessages: false` languages — zh/it/tr today)
// instead of throwing.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Messages = Record<string, any>

async function importLocaleMessages(locale: string): Promise<Messages | undefined> {
  try {
    const mod = (await import(`./locales/${locale}.json`)) as { default: Messages }
    return mod.default
  } catch {
    return undefined
  }
}

export interface LoadedMessages {
  locale: string
  messages: Messages
  /** The locale whose JSON file actually supplied the messages, if different from `locale`. */
  resolvedFrom?: string
}

export async function loadMessages(locale: string): Promise<LoadedMessages> {
  if (!isKnownLanguageCode(locale)) {
    recordMissingTranslation({ kind: 'invalid-locale', locale, fallbackUsed: 'en' })
    const messages = await importLocaleMessages('en')
    return { locale, messages: messages ?? {}, resolvedFrom: 'en' }
  }

  const chain = resolveFallbackChain(locale)
  for (const candidate of chain) {
    const messages = await importLocaleMessages(candidate)
    if (messages) {
      if (candidate !== locale) {
        recordMissingTranslation({ kind: 'missing-namespace', locale, fallbackUsed: candidate })
      }
      return { locale, messages, resolvedFrom: candidate !== locale ? candidate : undefined }
    }
  }

  recordMissingTranslation({ kind: 'missing-namespace', locale, fallbackUsed: undefined })
  return { locale, messages: {} }
}

// ── Phase H: formatting runtime — always Intl.*, never hand-rolled patterns ──

export function formatNumber(locale: string, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value)
}

export function formatCurrency(locale: string, value: number | string, currency?: string): string {
  const resolvedCurrency = currency ?? getLanguageMetadata(locale)?.defaultCurrency ?? 'USD'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: resolvedCurrency }).format(parseDecimal(value))
}

export function formatPercent(locale: string, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, { style: 'percent', ...options }).format(value)
}

export function formatDate(locale: string, value: Date | number | string, options?: Intl.DateTimeFormatOptions): string {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat(locale, options).format(date)
}

export function formatRelativeTime(locale: string, value: number, unit: Intl.RelativeTimeFormatUnit): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit)
}

export function formatList(locale: string, items: string[], options?: Intl.ListFormatOptions): string {
  return new Intl.ListFormat(locale, options).format(items)
}

export function getPluralCategory(locale: string, count: number): Intl.LDMLPluralRule {
  const pluralLocale = getLanguageMetadata(locale)?.pluralRuleLocale ?? locale
  return new Intl.PluralRules(pluralLocale).select(count)
}

export function getLanguageInfo(locale: string): LanguageMetadata | undefined {
  return getLanguageMetadata(locale)
}
