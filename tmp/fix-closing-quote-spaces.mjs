/**
 * Restore spaces eaten after closing quotes/backticks:
 *   'all'as const  → 'all' as const
 *   `tenant`is     → `tenant` is   (comment lines only)
 */
import { readFileSync, writeFileSync } from 'node:fs'

const files = readFileSync('tmp/keep-list.txt', 'utf8').split(/\r?\n/).filter(Boolean)
files.push('src/lib/brand-color.ts', 'src/app/globals.css', 'src/test/brand-color-system.test.ts')

let nFiles = 0
let nHits = 0

function isCommentLine(line) {
  const t = line.trim()
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('*/')
}

for (const file of files) {
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  const next = src
    .split('\n')
    .map((line) => {
      let out = line.replace(/'as const/g, "' as const").replace(/"as const/g, '" as const')
      if (isCommentLine(out)) {
        out = out.replace(/(`[^`\n]+`)([A-Za-z])/g, '$1 $2')
        out = out.replace(/('[A-Za-z][^'\n]*')([A-Za-z])/g, '$1 $2')
        out = out.replace(/("[A-Za-z][^"\n]*")([A-Za-z])/g, '$1 $2')
      }
      if (out !== line) nHits++
      return out
    })
    .join('\n')
  if (next !== src) {
    writeFileSync(file, next, 'utf8')
    nFiles++
  }
}
console.log(`restored closing-quote spaces in ${nHits} lines across ${nFiles} files`)
