/**
 * Finds places where a semantic foreground token was applied to a class string
 * that does NOT carry the matching fill — the per-line (rather than
 * per-string) foreground rewrite could do this inside ternaries.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const PAIRS = [
  ['accent', '--accent'],
  ['danger', '--danger'],
  ['success', '--success'],
  ['warning', '--warning'],
  ['info', '--info'],
]

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e)
    if (statSync(f).isDirectory()) walk(f, out)
    else if (/\.tsx?$/.test(e)) out.push(f)
  }
  return out
}

// Pull out individual quoted class strings so each ternary branch is judged
// on its own, the way the browser sees it.
const STRING_RE = /'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`/g

let bad = 0
for (const file of walk(join(ROOT, 'src'))) {
  const rel = relative(ROOT, file)
  if (/\.test\.tsx?$/.test(rel)) continue
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(STRING_RE)) {
      const s = m[1] ?? m[2] ?? m[3] ?? ''
      if (!s.includes('text-[var(--')) continue
      for (const [name, fill] of PAIRS) {
        if (!s.includes(`text-[var(--${name}-fg)]`)) continue
        if (s.includes(`bg-[var(${fill})]`) || s.includes(`bg-[var(${fill}-hover)]`)) continue
        bad++
        console.log(`${rel}:${i + 1}\n    ${s.trim().slice(0, 150)}`)
      }
    }
  })
}
console.log(`\nmismatched foreground tokens: ${bad}`)
