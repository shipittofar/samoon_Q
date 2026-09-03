import { deriveBrandTokens, contrastRatio, SURFACE_REFS } from '../src/lib/brand-color.ts'

const PALETTES: [string, string, string | null][] = [
  ['sunset-orange', '#ea580c', '#c2410c'],
  ['espresso', '#6f4e37', '#4a3424'],
  ['midnight', '#1e3a5f', '#0f2440'],
  ['forest', '#166534', '#14532d'],
  ['slate', '#334155', '#1e293b'],
  ['berry', '#9d174d', '#831843'],
  ['ocean', '#0369a1', '#075985'],
  ['charcoal-gold', '#b45309', '#92400e'],
  ['DEFAULT orange', '#f97316', '#ea580c'],
  ['type: restaurant', '#e85d04', null],
  ['type: bar (very dark)', '#1a1a2e', null],
  ['type: food_truck (pale)', '#f4a261', null],
  ['edge: pure white', '#ffffff', null],
  ['edge: pure black', '#000000', null],
  ['edge: neon yellow', '#ffff00', null],
  ['edge: neon lime', '#00ff00', null],
]

const f = (n: number) => n.toFixed(2).padStart(6)
const mark = (n: number, req: number) => (n >= req ? 'ok  ' : 'FAIL')
let failures = 0
const check = (n: number, req: number) => { if (n < req) failures++; return mark(n, req) }

for (const [name, primary, hover] of PALETTES) {
  const t = deriveBrandTokens(primary, hover)
  console.log(`\n### ${name}  (input ${primary})`)
  for (const theme of ['light', 'dark'] as const) {
    const s = t[theme]
    const surf = SURFACE_REFS[theme]
    const fgOnAccent = contrastRatio(s.accentFg, s.accent)
    const textOnSurf = contrastRatio(s.accentText, surf)
    const fillVsSurf = contrastRatio(s.accent, surf)
    const borderVsSurf = contrastRatio(s.accentBorder, surf)
    const hoverDelta = contrastRatio(s.accent, s.accentHover)
    const activeDelta = contrastRatio(s.accentHover, s.accentActive)
    console.log(
      `  ${theme.padEnd(5)} fill ${s.accent} vs surface ${f(fillVsSurf)} ${check(fillVsSurf, 3)} | ` +
      `label ${s.accentFg} on fill ${f(fgOnAccent)} ${check(fgOnAccent, 4.5)}`,
    )
    console.log(
      `        text ${s.accentText} on surface ${f(textOnSurf)} ${check(textOnSurf, 4.5)} | ` +
      `border ${s.accentBorder} ${f(borderVsSurf)} ${check(borderVsSurf, 3)}`,
    )
    console.log(
      `        hover ${s.accentHover} delta ${f(hoverDelta)} ${check(hoverDelta, 1.12)} | ` +
      `active ${s.accentActive} delta ${f(activeDelta)} ${check(activeDelta, 1.03)}`,
    )
  }
}

console.log(`\n\n${failures === 0 ? 'ALL DERIVED TOKENS PASS THEIR TARGET' : `${failures} FAILURES`}`)
