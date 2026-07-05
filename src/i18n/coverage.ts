/**
 * Translation Coverage — P9.5.1B Phase J
 *
 * Pure, isomorphic functions implementing the four detection checks
 * `docs/P9.5.0_TRANSLATION_ARCHITECTURE.md` §7 designed (missing/unused/
 * duplicate/conflict) plus an "orphan namespace" check, operating over
 * already-loaded message data and a list of translation-key usages
 * extracted from source. No filesystem/Node APIs here — that's
 * `scripts/check-translation-coverage.mjs`'s job — so this module is safe
 * to import from anywhere, including tests, without dragging in `fs`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Messages = Record<string, any>

export interface TranslationUsage {
  /** Fully-qualified `namespace.key` (or `namespace.nested.key`) as called at the use site. */
  key: string
  /** Just the namespace part, when the call site only names a namespace (e.g. `useTranslations('checkout')`). */
  namespace?: string
  file?: string
}

/** Flattens a nested messages object to `{ "namespace.a.b": "value" }`. */
export function flattenMessages(messages: Messages, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(messages)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenMessages(v, key))
    } else {
      out[key] = String(v)
    }
  }
  return out
}

/** Extracts the set of top-level namespaces a messages object defines. */
export function getNamespaces(messages: Messages): string[] {
  return Object.keys(messages)
}

/**
 * A key used in source with no matching entity for the reference (default)
 * language — `docs/P9.5.0_TRANSLATION_ARCHITECTURE.md` §7's "Missing key" check.
 */
export function findMissingKeys(usages: TranslationUsage[], referenceMessages: Messages): TranslationUsage[] {
  const flat = flattenMessages(referenceMessages)
  return usages.filter((u) => u.key && !(u.key in flat))
}

/**
 * A `translation_keys` entity whose `(namespace, key)` is never referenced
 * by a static scan of the codebase — the "Unused key" check.
 */
export function findUnusedKeys(referenceMessages: Messages, usages: TranslationUsage[]): string[] {
  const used = new Set(usages.map((u) => u.key))
  const usedNamespaces = new Set(usages.map((u) => u.namespace).filter(Boolean) as string[])
  return Object.keys(flattenMessages(referenceMessages)).filter((flatKey) => {
    if (used.has(flatKey)) return false
    // A key is still "used" if the whole namespace is referenced generically
    // (e.g. `useTranslations('common')` then `t('save')` — the call-site
    // scan below reconstructs the full dotted key, but a namespace-only
    // reference with a dynamic key is intentionally treated as "in use").
    const namespace = flatKey.split('.')[0]
    return !usedNamespaces.has(namespace)
  })
}

/**
 * Two keys under the same namespace whose reference-language value is
 * byte-identical — a consolidation signal, not an error, per the
 * architecture doc. Grouped by (namespace, value).
 */
export interface DuplicateGroup {
  namespace: string
  value: string
  keys: string[]
}

export function findDuplicateValues(referenceMessages: Messages): DuplicateGroup[] {
  const groups: DuplicateGroup[] = []
  for (const namespace of getNamespaces(referenceMessages)) {
    const flat = flattenMessages(referenceMessages[namespace], namespace)
    const byValue = new Map<string, string[]>()
    for (const [key, value] of Object.entries(flat)) {
      const list = byValue.get(value) ?? []
      list.push(key)
      byValue.set(value, list)
    }
    for (const [value, keys] of byValue) {
      if (keys.length > 1) groups.push({ namespace, value, keys })
    }
  }
  return groups
}

/**
 * A namespace referenced in source (`useTranslations('foo')`) with no
 * matching top-level key in the reference messages object at all.
 */
export function findOrphanNamespaces(usages: TranslationUsage[], referenceMessages: Messages): string[] {
  const namespaces = getNamespaces(referenceMessages)
  const referenced = new Set(usages.map((u) => u.namespace).filter(Boolean) as string[])
  return [...referenced].filter((ns) => !namespaces.includes(ns))
}

/**
 * Two imports supplying different values for the same `(namespace, key,
 * language)` in the same batch — the "Conflict detection" check. Operates
 * over a list of candidate `{ key, value }` pairs from one import batch.
 */
export interface ConflictCandidate {
  key: string
  value: string
}

export function findImportConflicts(candidates: ConflictCandidate[]): Array<{ key: string; values: string[] }> {
  const byKey = new Map<string, Set<string>>()
  for (const { key, value } of candidates) {
    const set = byKey.get(key) ?? new Set<string>()
    set.add(value)
    byKey.set(key, set)
  }
  const conflicts: Array<{ key: string; values: string[] }> = []
  for (const [key, values] of byKey) {
    if (values.size > 1) conflicts.push({ key, values: [...values] })
  }
  return conflicts
}

/**
 * A best-effort static scan for `useTranslations('ns')`/`t('key')` call
 * sites in one file's source text. Tracks each hook binding's variable name
 * (`const tAuth = useTranslations('auth')`) so `tAuth('key')` resolves to
 * `auth.key` even when a file declares several scoped translators — a
 * single most-recently-declared-namespace heuristic would misattribute
 * calls in exactly that (common) multi-namespace-per-file shape.
 */
export function extractTranslationUsagesFromSource(sourceText: string, file?: string): TranslationUsage[] {
  const usages: TranslationUsage[] = []

  // Matches both the client hook (`useTranslations('ns')`) and the server
  // helper (`await getTranslations('ns')`, `next-intl/server`) — a server
  // component using only the latter must not be misreported as dead/orphan.
  const bindingRe = /const\s+(\w+)\s*=\s*(?:await\s+)?(?:use|get)Translations?\(\s*['"]([\w.-]+)['"]\s*\)/g
  const namespaceByVar = new Map<string, string>()
  for (const m of sourceText.matchAll(bindingRe)) {
    namespaceByVar.set(m[1], m[2])
    usages.push({ key: m[2], namespace: m[2], file })
  }
  // Fallback for the common unbound shape `useTranslations('ns')` with no
  // `const x =` (e.g. inline in JSX) — still records the namespace itself.
  const bareNsRe = /(?:use|get)Translations?\(\s*['"]([\w.-]+)['"]\s*\)/g
  for (const m of sourceText.matchAll(bareNsRe)) {
    usages.push({ key: m[1], namespace: m[1], file })
  }

  for (const [varName, namespace] of namespaceByVar) {
    const callRe = new RegExp(`(?<![\\w.])${varName}\\(\\s*['"]([\\w.-]+)['"]`, 'g')
    for (const m of sourceText.matchAll(callRe)) {
      // A dot in the key is a nested path *within* the hook's bound
      // namespace (e.g. `t('sortOptions.popular')` with `t =
      // useTranslations('menu')` resolves to `menu.sortOptions.popular`,
      // never a second top-level namespace) — always prefix with the
      // hook's own namespace, regardless of dots in the raw key.
      const key = `${namespace}.${m[1]}`
      usages.push({ key, namespace, file })
    }
  }

  return usages
}

export interface CoverageReport {
  missingKeys: TranslationUsage[]
  unusedKeys: string[]
  duplicateValues: DuplicateGroup[]
  orphanNamespaces: string[]
}

export function buildCoverageReport(usages: TranslationUsage[], referenceMessages: Messages): CoverageReport {
  return {
    missingKeys: findMissingKeys(usages, referenceMessages),
    unusedKeys: findUnusedKeys(referenceMessages, usages),
    duplicateValues: findDuplicateValues(referenceMessages),
    orphanNamespaces: findOrphanNamespaces(usages, referenceMessages),
  }
}
