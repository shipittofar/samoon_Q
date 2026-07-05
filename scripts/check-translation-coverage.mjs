/**
 * Translation Coverage Report — P9.5.1B Phase J
 *
 * Scans src/ for `useTranslations()`/`t()` call sites, loads the reference
 * (en) locale bundle, and reports missing keys, unused keys, duplicate
 * values, and orphan namespaces — the four checks
 * `docs/P9.5.0_TRANSLATION_ARCHITECTURE.md` §7 designed. Complements (does
 * not replace) `scripts/validate-i18n.mjs`'s cross-locale key-parity check.
 *
 * This is a report, not a gate (per the phase's "No UI required" /
 * report-only instruction) — always exits 0. Run it manually or wire it
 * into CI as an informational step once coverage stabilizes.
 *
 * Usage:
 *   node scripts/check-translation-coverage.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = join(__dirname, '..', 'src')
const EN_LOCALE = join(SRC_DIR, 'i18n', 'locales', 'en.json')

function flattenMessages(messages, prefix = '') {
  const out = {}
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

// coverage.ts documents illustrative t()/useTranslations() call shapes in
// its own comments — excluded so the scan only sees real application usage.
const EXCLUDED_FILES = new Set(['coverage.ts'])

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'test' || EXCLUDED_FILES.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, files)
    else if (['.ts', '.tsx'].includes(extname(full))) files.push(full)
  }
  return files
}

// Mirrors src/i18n/coverage.ts's extractTranslationUsagesFromSource — kept
// in sync manually since this script runs standalone via plain Node (no
// TS build step) and can't import the .ts module directly.
function extractUsages(sourceText, file) {
  const usages = []
  // Matches both the client hook (`useTranslations`) and the server helper
  // (`await getTranslations`, `next-intl/server`).
  const bindingRe = /const\s+(\w+)\s*=\s*(?:await\s+)?(?:use|get)Translations?\(\s*['"]([\w.-]+)['"]\s*\)/g
  const namespaceByVar = new Map()
  for (const m of sourceText.matchAll(bindingRe)) {
    namespaceByVar.set(m[1], m[2])
    usages.push({ key: m[2], namespace: m[2], file })
  }
  const bareNsRe = /(?:use|get)Translations?\(\s*['"]([\w.-]+)['"]\s*\)/g
  for (const m of sourceText.matchAll(bareNsRe)) {
    usages.push({ key: m[1], namespace: m[1], file })
  }
  for (const [varName, namespace] of namespaceByVar) {
    const callRe = new RegExp(`(?<![\\w.])${varName}\\(\\s*['"]([\\w.-]+)['"]`, 'g')
    for (const m of sourceText.matchAll(callRe)) {
      // A dot in the key is a nested path within the hook's bound
      // namespace, not a second top-level namespace — always prefix.
      const key = `${namespace}.${m[1]}`
      usages.push({ key, namespace, file })
    }
  }
  return usages
}

const referenceMessages = JSON.parse(readFileSync(EN_LOCALE, 'utf8'))
const flat = flattenMessages(referenceMessages)
const files = walk(SRC_DIR)

// P9.5.4 Phase I — per-namespace + global cross-locale coverage percentage.
function computeNamespaceCoverage(refMessages, targetMessages) {
  return Object.keys(refMessages).map((namespace) => {
    const refFlat = flattenMessages(refMessages[namespace], namespace)
    const targetFlat = flattenMessages(targetMessages[namespace] ?? {}, namespace)
    const totalKeys = Object.keys(refFlat).length
    const translatedKeys = Object.keys(refFlat).filter((k) => Boolean(targetFlat[k]?.trim())).length
    return { namespace, totalKeys, translatedKeys, percent: totalKeys === 0 ? 100 : Math.round((translatedKeys / totalKeys) * 100) }
  })
}

// P9.5.4 Phase I/J — best-effort hardcoded-JSX-text heuristic (mirrors
// src/i18n/coverage.ts's findHardcodedJsxText; kept in sync manually for
// the same reason extractUsages() above is — this script runs standalone
// via plain Node, no TS build step).
const JSX_TEXT_RE = />\s*([A-Z][A-Za-z][a-zA-Z0-9 ,.'!?-]{3,80}[a-zA-Z.!?])\s*</g
function findHardcodedJsxText(sourceText, file) {
  const found = []
  const lines = sourceText.split('\n')
  lines.forEach((lineText, i) => {
    if (lineText.includes('{') || lineText.trim().startsWith('//') || lineText.trim().startsWith('*')) return
    for (const m of lineText.matchAll(JSX_TEXT_RE)) {
      found.push({ file, line: i + 1, snippet: m[1].trim() })
    }
  })
  return found
}

const allUsages = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  allUsages.push(...extractUsages(text, file))
}

const usedKeys = new Set(allUsages.map((u) => u.key))
const usedNamespaces = new Set(allUsages.map((u) => u.namespace).filter(Boolean))
const definedNamespaces = new Set(Object.keys(referenceMessages))

const missingKeys = allUsages.filter((u) => u.key.includes('.') && !(u.key in flat))
const unusedKeys = Object.keys(flat).filter((k) => {
  if (usedKeys.has(k)) return false
  return !usedNamespaces.has(k.split('.')[0])
})
const orphanNamespaces = [...usedNamespaces].filter((ns) => !definedNamespaces.has(ns))

// P9.5.2 Phase P — dead namespaces (defined, zero detected call sites at
// all — a stronger signal than "some unused keys") and duplicate values
// (two keys under the same namespace sharing byte-identical English text,
// a consolidation candidate per docs/P9.5.0_TRANSLATION_ARCHITECTURE.md §7).
const deadNamespaces = [...definedNamespaces].filter((ns) => !usedNamespaces.has(ns))

const duplicateGroups = []
for (const ns of definedNamespaces) {
  const nsFlat = flattenMessages(referenceMessages[ns], ns)
  const byValue = new Map()
  for (const [key, value] of Object.entries(nsFlat)) {
    const list = byValue.get(value) ?? []
    list.push(key)
    byValue.set(value, list)
  }
  for (const [value, keys] of byValue) {
    if (keys.length > 1) duplicateGroups.push({ namespace: ns, value, keys })
  }
}

console.log(`[i18n coverage] scanned ${files.length} files, found ${allUsages.length} translation call sites.`)
console.log(`[i18n coverage] reference (en) has ${Object.keys(flat).length} keys across ${definedNamespaces.size} namespaces.`)
console.log()

if (missingKeys.length > 0) {
  console.log(`✗ ${missingKeys.length} key(s) used in source with no matching en.json entry:`)
  for (const u of missingKeys) console.log(`  - ${u.key}  (${u.file})`)
} else {
  console.log('✓ No missing keys — every t() call resolves to a real en.json entry.')
}
console.log()

console.log(`ℹ ${unusedKeys.length} key(s) defined in en.json with no detected call site (informational — a static regex scan cannot see dynamic keys):`)
if (unusedKeys.length > 0 && unusedKeys.length <= 40) {
  for (const k of unusedKeys) console.log(`  - ${k}`)
} else if (unusedKeys.length > 40) {
  console.log(`  (${unusedKeys.length} keys — run with a narrower namespace filter to inspect)`)
}
console.log()

if (orphanNamespaces.length > 0) {
  console.log(`✗ ${orphanNamespaces.length} namespace(s) referenced via useTranslations() with no entry in en.json:`)
  for (const ns of orphanNamespaces) console.log(`  - ${ns}`)
} else {
  console.log('✓ No orphan namespaces.')
}
console.log()

if (deadNamespaces.length > 0) {
  console.log(`ℹ ${deadNamespaces.length} namespace(s) defined in en.json with zero detected call sites (dead — not yet consumed by any migrated UI):`)
  for (const ns of deadNamespaces) console.log(`  - ${ns}`)
} else {
  console.log('✓ No dead namespaces — every defined namespace has at least one call site.')
}
console.log()

if (duplicateGroups.length > 0) {
  console.log(`ℹ ${duplicateGroups.length} duplicate-value group(s) — same English text under two+ keys in one namespace (consolidation candidates, not errors):`)
  for (const g of duplicateGroups) console.log(`  - [${g.namespace}] "${g.value}" used by: ${g.keys.join(', ')}`)
} else {
  console.log('✓ No duplicate values within any namespace.')
}
console.log()

// P9.5.4 Phase I — cross-locale coverage percentage, per namespace and global.
const otherLocaleFiles = ['fa', 'ar']
console.log('── Cross-locale coverage (Phase I) ──')
for (const locale of otherLocaleFiles) {
  const localePath = join(SRC_DIR, 'i18n', 'locales', `${locale}.json`)
  const targetMessages = JSON.parse(readFileSync(localePath, 'utf8'))
  const nsCoverage = computeNamespaceCoverage(referenceMessages, targetMessages)
  const totalKeys = nsCoverage.reduce((sum, n) => sum + n.totalKeys, 0)
  const translatedKeys = nsCoverage.reduce((sum, n) => sum + n.translatedKeys, 0)
  const globalPercent = totalKeys === 0 ? 100 : Math.round((translatedKeys / totalKeys) * 100)
  console.log(`  ${locale}: ${globalPercent}% global (${translatedKeys}/${totalKeys} keys)`)
  const incomplete = nsCoverage.filter((n) => n.percent < 100)
  if (incomplete.length > 0) {
    for (const n of incomplete) console.log(`    - ${n.namespace}: ${n.percent}% (${n.translatedKeys}/${n.totalKeys})`)
  }
}
console.log()

// P9.5.4 Phase I/J — best-effort hardcoded-JSX-text heuristic, scoped to
// already-migrated Console/Studio/Platform-admin directories so it
// catches regressions there without drowning in the ~120 still-English
// module-data files documented as remaining work in the audit doc.
const MIGRATED_DIRS = [
  join(SRC_DIR, 'components', 'admin', 'configuration'),
  join(SRC_DIR, 'components', 'admin', 'platform-admin'),
]
const hardcodedCandidates = []
for (const dir of MIGRATED_DIRS) {
  for (const file of walk(dir)) {
    hardcodedCandidates.push(...findHardcodedJsxText(readFileSync(file, 'utf8'), file))
  }
}
console.log(`── Hardcoded-string heuristic scan (Phase I/J, migrated Console/Studio/Platform-admin dirs only) ──`)
if (hardcodedCandidates.length > 0) {
  console.log(`⚠ ${hardcodedCandidates.length} candidate(s) of literal JSX text found (heuristic — verify manually, may include false positives):`)
  for (const c of hardcodedCandidates.slice(0, 40)) console.log(`  - ${c.file}:${c.line} "${c.snippet}"`)
} else {
  console.log('✓ No literal JSX text candidates found in migrated Console/Studio/Platform-admin directories.')
}

process.exit(0)
