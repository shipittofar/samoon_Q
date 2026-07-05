/**
 * Hardcoded String Guard — P9.5.4 Phase J
 *
 * A CI gate (unlike scripts/check-translation-coverage.mjs's informational
 * report of the same heuristic): fails the build if new literal JSX text
 * appears in a directory that has already been migrated to next-intl.
 * Scoped to already-migrated directories only — the ~120 still-English
 * module-data files documented as remaining work in
 * docs/P9.5.4_LOCALIZATION_AUDIT.md are NOT scanned here, since gating on
 * them would fail CI for work this phase explicitly deferred, not for a
 * regression. As more directories are migrated, add them to MIGRATED_DIRS.
 *
 * This does not duplicate the coverage tool's detection logic as a second
 * "engine" — it reuses the exact same regex heuristic
 * (`findHardcodedJsxText`, mirrored from src/i18n/coverage.ts the same way
 * scripts/check-translation-coverage.mjs already mirrors
 * `extractTranslationUsagesFromSource`) and only differs in exit-code
 * behavior (gate vs. report).
 *
 * Usage:
 *   node scripts/check-hardcoded-strings.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = join(__dirname, '..', 'src')

const MIGRATED_DIRS = [
  join(SRC_DIR, 'components', 'admin', 'configuration'),
  join(SRC_DIR, 'components', 'admin', 'platform-admin'),
]

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, files)
    else if (['.ts', '.tsx'].includes(extname(full))) files.push(full)
  }
  return files
}

// Mirrors src/i18n/coverage.ts's findHardcodedJsxText.
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

const candidates = []
for (const dir of MIGRATED_DIRS) {
  for (const file of walk(dir)) {
    candidates.push(...findHardcodedJsxText(readFileSync(file, 'utf8'), file))
  }
}

if (candidates.length > 0) {
  console.error(`✗ ${candidates.length} hardcoded string candidate(s) found in migrated directories:`)
  for (const c of candidates) console.error(`  - ${c.file}:${c.line} "${c.snippet}"`)
  console.error('\nEither wrap the literal in useTranslations()/t(\'key\') (adding the key to en/fa/ar.json), or if this is a legitimate non-translatable literal (a proper noun, a code/id value), adjust the surrounding line so the heuristic no longer matches it (e.g. by keeping it inside a `{...}` expression).')
  process.exit(1)
}

console.log(`✓ No hardcoded string candidates found across ${MIGRATED_DIRS.length} migrated director${MIGRATED_DIRS.length === 1 ? 'y' : 'ies'}.`)
process.exit(0)
