/**
 * I18N key validator — Phase 3 (P3.7)
 *
 * Verifies that all locale files share an identical set of flattened keys.
 * Exits 1 if any locale is missing keys or carries extra keys relative to
 * the reference locale (en.json). Designed to run in CI as a quality gate.
 *
 * Usage:
 *   node scripts/validate-i18n.mjs
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales')

/** Recursively flatten a nested object to dot-notation keys. */
function flattenKeys(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, key))
    } else {
      keys.push(key)
    }
  }
  return keys
}

const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'))
if (files.length === 0) {
  console.error('[i18n] No locale files found in', LOCALES_DIR)
  process.exit(1)
}

const locales = {}
for (const file of files) {
  const locale = file.replace('.json', '')
  const raw = readFileSync(join(LOCALES_DIR, file), 'utf8')
  locales[locale] = flattenKeys(JSON.parse(raw))
}

const REFERENCE = 'en'
if (!locales[REFERENCE]) {
  console.error(`[i18n] Reference locale '${REFERENCE}' not found.`)
  process.exit(1)
}

const refKeys = new Set(locales[REFERENCE])
let valid = true

for (const [locale, keys] of Object.entries(locales)) {
  if (locale === REFERENCE) continue
  const localeKeys = new Set(keys)

  const missing = [...refKeys].filter((k) => !localeKeys.has(k))
  const extra   = [...localeKeys].filter((k) => !refKeys.has(k))

  if (missing.length > 0) {
    console.error(`[i18n] '${locale}' is missing ${missing.length} key(s):`)
    missing.forEach((k) => console.error(`  - ${k}`))
    valid = false
  }
  if (extra.length > 0) {
    console.error(`[i18n] '${locale}' has ${extra.length} extra key(s) not in '${REFERENCE}':`)
    extra.forEach((k) => console.error(`  + ${k}`))
    valid = false
  }
}

if (valid) {
  console.log(`[i18n] ✓ All ${Object.keys(locales).length} locales share identical keys (${refKeys.size} keys each).`)
  process.exit(0)
} else {
  process.exit(1)
}
