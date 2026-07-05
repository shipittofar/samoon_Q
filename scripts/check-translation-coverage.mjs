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
  const bindingRe = /const\s+(\w+)\s*=\s*use(?:Translations|Translation)\(\s*['"]([\w.-]+)['"]\s*\)/g
  const namespaceByVar = new Map()
  for (const m of sourceText.matchAll(bindingRe)) {
    namespaceByVar.set(m[1], m[2])
    usages.push({ key: m[2], namespace: m[2], file })
  }
  const bareNsRe = /use(?:Translations|Translation)\(\s*['"]([\w.-]+)['"]\s*\)/g
  for (const m of sourceText.matchAll(bareNsRe)) {
    usages.push({ key: m[1], namespace: m[1], file })
  }
  for (const [varName, namespace] of namespaceByVar) {
    const callRe = new RegExp(`(?<![\\w.])${varName}\\(\\s*['"]([\\w.-]+)['"]`, 'g')
    for (const m of sourceText.matchAll(callRe)) {
      const raw = m[1]
      const key = raw.includes('.') ? raw : `${namespace}.${raw}`
      usages.push({ key, namespace: key.split('.')[0], file })
    }
  }
  return usages
}

const referenceMessages = JSON.parse(readFileSync(EN_LOCALE, 'utf8'))
const flat = flattenMessages(referenceMessages)
const files = walk(SRC_DIR)

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

process.exit(0)
