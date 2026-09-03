/**
 * Removes the spurious space inserted after opening quotes by a prior
 * whitespace-cleanup regex. Preserves:
 *   - whitespace-only strings (' ', " ")
 *   - template interpolations that start with a space (` ${x})
 *   - strings whose first non-quote character is not code-like
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e)
    if (statSync(f).isDirectory()) walk(f, out)
    else if (/\.(tsx|ts|css|mjs|js)$/.test(e)) out.push(f)
  }
  return out
}

// Opening quote, one space, then a character that starts identifiers, class
// names, CSS vars, hex, or module specifiers — never `$` (template padding)
// and never another quote (the ' 'space string).
const SPURIOUS = /(['"`]) (?=[A-Za-z0-9_@#.[/%\\-])/g

let files = 0
let replacements = 0
for (const file of [...walk(SRC), ...walk(join(ROOT, 'tmp')).filter((f) => f.endsWith('.ts') || f.endsWith('.mts') || f.endsWith('.mjs'))]) {
  const original = readFileSync(file, 'utf8')
  let n = 0
  const next = original.replace(SPURIOUS, (m) => {
    n++
    return m[0]
  })
  if (next !== original) {
    writeFileSync(file, next, 'utf8')
    files++
    replacements += n
  }
}
console.log(`removed ${replacements} spurious quote-spaces across ${files} files`)
