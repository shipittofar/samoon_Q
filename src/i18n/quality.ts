/**
 * Translation Quality Engine — P9.5.6 Phase E/F
 *
 * Real (not mocked) static analysis over the actual locale message bundles
 * in `src/i18n/locales/*.json`, using `en` as the reference locale — the
 * same "reference (en) locale bundle" `scripts/check-translation-
 * coverage.mjs` already uses for its own missing/unused-key report. This
 * module ports that script's flatten-and-compare approach into an
 * importable TS function so Platform Administration can surface the same
 * kind of finding as ordinary dashboard widgets/search results, instead of
 * only as a CI report nobody in Platform Admin ever sees.
 *
 * Scope, stated honestly: this checks MISSING keys, BROKEN ICU (unbalanced
 * `{`/`}`), BROKEN PLACEHOLDERS (a locale's placeholder tokens must match
 * `en`'s for the same key), and a crude BROKEN HTML heuristic (unbalanced
 * `<`/`>` — a real signal, not a full HTML parser). It deliberately does
 * NOT attempt duplicate-key detection (JSON.parse silently collapses
 * duplicate keys before this module ever sees the data — detecting them
 * needs a raw-text parser, not a flattened-object comparison) or
 * unused/deprecated-key detection (that requires scanning every `.ts`/
 * `.tsx` source file for `t()` call sites, which `scripts/check-
 * translation-coverage.mjs` already does at CI time — re-running that scan
 * on every dashboard render would be slow and duplicate, not reuse, that
 * script). Both are real, identified gaps — see docs/P9.5.6_LANGUAGE_ADMIN_AUDIT.md.
 */
import enMessages from './locales/en.json'
import faMessages from './locales/fa.json'
import arMessages from './locales/ar.json'

/** Every locale with an actual message bundle today — mirrors `hasMessages: true` in language-registry.ts. */
const LOCALE_MESSAGES: Record<string, Record<string, unknown>> = {
  en: enMessages,
  fa: faMessages,
  ar: arMessages,
}

export const REFERENCE_LOCALE = 'en'

export interface TranslationQualityIssue {
  locale: string
  key: string
  kind: 'missing' | 'broken-icu' | 'broken-placeholder' | 'broken-html'
  detail: string
}

export interface LocaleQualitySummary {
  locale: string
  totalKeys: number
  translatedKeys: number
  missingKeys: number
  brokenIcuKeys: number
  brokenPlaceholderKeys: number
  brokenHtmlKeys: number
  completionPercent: number
}

function flattenMessages(messages: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(messages)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenMessages(v as Record<string, unknown>, key))
    } else {
      out[key] = String(v)
    }
  }
  return out
}

function countChar(text: string, char: string): number {
  let count = 0
  for (const c of text) if (c === char) count += 1
  return count
}

/** ICU placeholder tokens, e.g. "{count}" or "{count, plural, ...}" -> "count". */
function extractPlaceholderNames(text: string): Set<string> {
  const names = new Set<string>()
  const re = /\{\s*([a-zA-Z0-9_]+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) names.add(match[1])
  return names
}

/** Reference-locale flattened messages, computed once per module load. */
const REFERENCE_FLAT = flattenMessages(LOCALE_MESSAGES[REFERENCE_LOCALE])

/**
 * Every locale this module can actually analyze (has a real message bundle).
 * A roster language with no message file (e.g. zh/it/tr today) simply isn't
 * in this list — callers should treat "not analyzable" and "100% missing"
 * as different, honest states.
 */
export function analyzableLocales(): string[] {
  return Object.keys(LOCALE_MESSAGES)
}

/** The raw (unflattened) message bundle for one analyzable locale, or undefined. */
export function getLocaleMessages(locale: string): Record<string, unknown> | undefined {
  return LOCALE_MESSAGES[locale]
}

/** All quality issues for one locale against the reference (en) locale. */
export function computeLocaleQualityIssues(locale: string): TranslationQualityIssue[] {
  const messages = LOCALE_MESSAGES[locale]
  if (!messages) return []
  const flat = flattenMessages(messages)
  const issues: TranslationQualityIssue[] = []

  for (const key of Object.keys(REFERENCE_FLAT)) {
    const value = flat[key]
    if (value === undefined || value === '') {
      if (locale !== REFERENCE_LOCALE) {
        issues.push({ locale, key, kind: 'missing', detail: `Key "${key}" has no value in ${locale} (reference: "${REFERENCE_FLAT[key]}").` })
      }
      continue
    }

    const openBraces = countChar(value, '{')
    const closeBraces = countChar(value, '}')
    if (openBraces !== closeBraces) {
      issues.push({ locale, key, kind: 'broken-icu', detail: `Key "${key}" has unbalanced ICU braces (${openBraces} "{" vs ${closeBraces} "}").` })
    }

    if (locale !== REFERENCE_LOCALE) {
      const referencePlaceholders = extractPlaceholderNames(REFERENCE_FLAT[key])
      const localePlaceholders = extractPlaceholderNames(value)
      const missing = [...referencePlaceholders].filter((p) => !localePlaceholders.has(p))
      const extra = [...localePlaceholders].filter((p) => !referencePlaceholders.has(p))
      if (missing.length > 0 || extra.length > 0) {
        const parts: string[] = []
        if (missing.length > 0) parts.push(`missing: ${missing.join(', ')}`)
        if (extra.length > 0) parts.push(`unexpected: ${extra.join(', ')}`)
        issues.push({ locale, key, kind: 'broken-placeholder', detail: `Key "${key}" placeholder mismatch (${parts.join('; ')}).` })
      }
    }

    const openTags = countChar(value, '<')
    const closeTags = countChar(value, '>')
    if (openTags !== closeTags) {
      issues.push({ locale, key, kind: 'broken-html', detail: `Key "${key}" has unbalanced angle brackets (${openTags} "<" vs ${closeTags} ">") — possible broken embedded markup.` })
    }
  }

  return issues
}

/** All quality issues across every analyzable locale. */
export function computeAllQualityIssues(): TranslationQualityIssue[] {
  return analyzableLocales().flatMap((locale) => computeLocaleQualityIssues(locale))
}

/** Aggregate per-locale summary — the numbers Phase E's dashboard asks for. */
export function computeLocaleQualitySummary(locale: string): LocaleQualitySummary {
  const totalKeys = Object.keys(REFERENCE_FLAT).length
  const messages = LOCALE_MESSAGES[locale]
  if (!messages) {
    return { locale, totalKeys, translatedKeys: 0, missingKeys: totalKeys, brokenIcuKeys: 0, brokenPlaceholderKeys: 0, brokenHtmlKeys: 0, completionPercent: 0 }
  }
  const issues = computeLocaleQualityIssues(locale)
  const missingKeys = issues.filter((i) => i.kind === 'missing').length
  const brokenIcuKeys = issues.filter((i) => i.kind === 'broken-icu').length
  const brokenPlaceholderKeys = issues.filter((i) => i.kind === 'broken-placeholder').length
  const brokenHtmlKeys = issues.filter((i) => i.kind === 'broken-html').length
  const translatedKeys = totalKeys - missingKeys
  return {
    locale,
    totalKeys,
    translatedKeys,
    missingKeys,
    brokenIcuKeys,
    brokenPlaceholderKeys,
    brokenHtmlKeys,
    completionPercent: totalKeys === 0 ? 0 : Math.round((translatedKeys / totalKeys) * 100),
  }
}
