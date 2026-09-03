/**
 * Phase 20 — post-implementation colour regression scan.
 * Re-inventories the tree and reports anything still bypassing the token system.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const PAL = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const SH = '950|900|800|700|600|500|400|300|200|100|50'

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e)
    if (statSync(f).isDirectory()) walk(f, out)
    else if (/\.(tsx|ts|css)$/.test(e)) out.push(f)
  }
  return out
}

const files = walk(join(ROOT, 'src'))
const app = files.filter((f) => !/\\test\\|\.test\.tsx?$/.test(relative(ROOT, f)))

// Intentional, documented exclusions.
const CURATED = [
  'src\\types\\website-builder.ts',    // Website Builder template themes
  'src\\config\\branding-defaults.ts', // curated tenant palette catalogue
  'src\\app\\globals.css',             // the token definitions themselves
  'src\\lib\\brand-color.ts',          // derivation reference colours
]
const isCurated = (rel) => CURATED.some((c) => rel.includes(c))

function scan(label, re, { skipCurated = true } = {}) {
  const hits = []
  for (const f of app) {
    const rel = relative(ROOT, f)
    if (skipCurated && isCurated(rel)) continue
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((l, i) => {
      for (const m of l.matchAll(re)) hits.push({ rel, line: i + 1, text: m[0], src: l.trim().slice(0, 110) })
    })
  }
  console.log(`\n### ${label}: ${hits.length}`)
  const byVal = {}
  for (const h of hits) byVal[h.text] = (byVal[h.text] || 0) + 1
  for (const [v, n] of Object.entries(byVal).sort((a, b) => b[1] - a[1]).slice(0, 14)) {
    console.log(`   ${String(n).padStart(4)}  ${v}`)
  }
  if (hits.length && hits.length <= 22) {
    console.log('   --- sites ---')
    for (const h of hits) console.log(`   ${h.rel}:${h.line}  ${h.src}`)
  }
  return hits.length
}

console.log('═══ PHASE 20 — POST-IMPLEMENTATION COLOUR REGRESSION SCAN ═══')

const tw = scan('Raw Tailwind palette utilities', new RegExp(`(?<![\\w-:])(?:bg|text|border|ring|fill|stroke|from|to|via|divide|shadow|outline|placeholder|accent|caret)-(?:${PAL})-(?:${SH})(?![\\w-])`, 'g'))
const white = scan('Opaque bg-white / bg-black', /(?<![\w-:])bg-(?:white|black)(?![\w\/-])/g)
const hex = scan('Hex literals in .tsx/.ts', /#[0-9a-fA-F]{6}\b/g)
const darkv = scan('dark: variants remaining', /(?<![\w-:])dark:[\w[\]()@#%.,\/-]+/g)
const overlay = scan('Overlay bypasses (bg-black/NN)', /bg-black\/\d+/g)
const undef = scan('Reference to undefined --primary', /var\(--primary\)/g)

// Token adoption
let tokenUses = 0
for (const f of app) tokenUses += (readFileSync(f, 'utf8').match(/var\(--/g) || []).length
console.log(`\n### Semantic token references (var(--…)): ${tokenUses}`)

console.log('\n═══ SUMMARY ═══')
console.log(`raw palette utilities : ${tw}`)
console.log(`opaque white/black    : ${white}`)
console.log(`hex literals          : ${hex}`)
console.log(`dark: variants        : ${darkv}`)
console.log(`overlay bypasses      : ${overlay}`)
console.log(`undefined --primary   : ${undef}`)
console.log(`token references      : ${tokenUses}`)
