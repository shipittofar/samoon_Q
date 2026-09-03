/**
 * Repoints two CSS variables that were referenced app-wide but never defined:
 *   var(--primary) -> the brand role appropriate to each usage
 *   var(--surface) -> --card (the panel surface these call sites meant)
 *
 * Because neither variable existed, `bg-[var(--primary)]`resolved to nothing:
 * those buttons and badges rendered with no fill, leaving white label text on
 * the page background.
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e)
    if (statSync(f).isDirectory()) walk(f, out)
    else if (/\.tsx?$/.test(e)) out.push(f)
  }
  return out
}

const RULES = [
  // Surface panels.
  [/\bbg-\[var\(--surface\)\]/g, 'bg-[var(--card)]'],

  // Brand fill (opacity-suffixed form first so it is not eaten by the plain one).
  [/\bbg-\[var\(--primary\)\]\/(\d+)/g, 'bg-[var(--accent)]/$1'],
  [/\bbg-\[var\(--primary\)\]/g, 'bg-[var(--accent)]'],
  [/\bhover:bg-\[var\(--primary\)\]/g, 'hover:bg-[var(--accent-hover)]'],
  // Brand as text/border on the page -> the contrast-corrected roles.
  [/\btext-\[var\(--primary\)\]/g, 'text-[var(--accent-text)]'],
  [/\bhover:border-\[var\(--primary\)\]/g, 'hover:border-[var(--accent-border)]'],
  [/\bborder-\[var\(--primary\)\]/g, 'border-[var(--accent-border)]'],
  [/\bring-\[var\(--primary\)\]/g, 'ring-[var(--focus-ring)]'],
]

// After the fill becomes a token, its white label must become the derived one.
function fixLabel(str) {
  if (str.includes('bg-[var(--accent)]') && /\btext-white\b/.test(str)) {
    return str.replace(/\btext-white\b/g, 'text-[var(--accent-fg)]')
  }
  return str
}

const STRING_RE = /'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g

let files = 0
let sites = 0
for (const file of walk(join(ROOT, 'src'))) {
  const rel = relative(ROOT, file)
  if (/\\test\\|\.test\.tsx?$/.test(rel)) continue
  const original = readFileSync(file, 'utf8')
  let out = original
  for (const [re, rep] of RULES) out = out.replace(re, rep)
  // Label fix is applied per quoted string so a ternary's other branch is
  // judged on its own contents.
  out = out.replace(STRING_RE, (m, a, b, c) => {
    const body = a ?? b ?? c ?? ''
    const fixed = fixLabel(body)
    if (fixed === body) return m
    const q = m[0]
    return `${q}${fixed}${q}`
  })
  if (out !== original) {
    files++
    sites += (original.match(/var\(--primary\)|var\(--surface\)/g) || []).length
    writeFileSync(file, out, 'utf8')
    console.log(`  ${rel}`)
  }
}
console.log(`\nfixed ${sites} undefined-variable references across ${files} files`)
