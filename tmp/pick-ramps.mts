import { contrastRatio } from '../src/lib/brand-color.ts'

const LB = '#fafaf9' // light --bg
const LC = '#ffffff' // light --card
const DB = '#0c0a09' // dark --bg
const DC = '#1c1917' // dark --card (harder test for light-on-dark)

const f = (n: number) => n.toFixed(2).padStart(6)
const v = (n: number, req: number) => (n >= req ? 'PASS' : 'fail')

function row(label: string, c: string, bgs: [string, string][], req: number) {
  const parts = bgs.map(([n, bg]) => `${n} ${f(contrastRatio(c, bg))} ${v(contrastRatio(c, bg), req)}`)
  console.log(`  ${label.padEnd(30)} ${c}  ${parts.join('  |  ')}`)
}

console.log('=== LIGHT foreground ramp on bg #fafaf9 / card #ffffff (need 4.5) ===')
for (const [n, c] of [
  ['surface-900', '#1c1917'], ['surface-800', '#292524'], ['surface-700', '#44403c'],
  ['surface-600', '#57534e'], ['surface-500', '#78716c'], ['surface-400', '#a8a29e'],
] as const) row(n, c, [['bg', LB], ['card', LC]], 4.5)

console.log('\n=== DARK foreground ramp on bg #0c0a09 / card #1c1917 (need 4.5) ===')
for (const [n, c] of [
  ['surface-50', '#fafaf9'], ['surface-100', '#f5f5f4'], ['surface-200', '#e7e5e4'],
  ['surface-300', '#d6d3d1'], ['surface-400', '#a8a29e'], ['surface-500', '#78716c'],
  ['custom #8f8781', '#8f8781'], ['custom #948c86', '#948c86'], ['custom #9a918b', '#9a918b'],
] as const) row(n, c, [['bg', DB], ['card', DC]], 4.5)

console.log('\n=== BORDERS: need 3.0 for input/control boundaries ===')
console.log('  -- light, against card #ffffff and bg #fafaf9 --')
for (const [n, c] of [
  ['surface-200 #e7e5e4', '#e7e5e4'], ['surface-300 #d6d3d1', '#d6d3d1'],
  ['surface-400 #a8a29e', '#a8a29e'], ['custom #9c948e', '#9c948e'], ['surface-500 #78716c', '#78716c'],
] as const) row(n, c, [['card', LC], ['bg', LB]], 3)
console.log('  -- dark, against card #1c1917 and bg #0c0a09 --')
for (const [n, c] of [
  ['surface-800 #292524', '#292524'], ['surface-700 #44403c', '#44403c'],
  ['surface-600 #57534e', '#57534e'], ['custom #6b635d', '#6b635d'], ['surface-500 #78716c', '#78716c'],
] as const) row(n, c, [['card', DC], ['bg', DB]], 3)

console.log('\n=== FEEDBACK — text role, need 4.5 ===')
console.log('  -- LIGHT candidates on #fafaf9 --')
for (const [n, c] of [
  ['success emerald-700 #047857', '#047857'], ['success green-700 #15803d', '#15803d'],
  ['warning amber-700 #b45309', '#b45309'], ['warning amber-800 #92400e', '#92400e'],
  ['danger red-600 #dc2626', '#dc2626'], ['danger red-700 #b91c1c', '#b91c1c'],
  ['info blue-600 #2563eb', '#2563eb'], ['info blue-700 #1d4ed8', '#1d4ed8'],
] as const) row(n, c, [['bg', LB], ['card', LC]], 4.5)
console.log('  -- DARK candidates on #1c1917 --')
for (const [n, c] of [
  ['success emerald-400 #34d399', '#34d399'], ['success emerald-300 #6ee7b7', '#6ee7b7'],
  ['warning amber-400 #fbbf24', '#fbbf24'], ['warning amber-300 #fcd34d', '#fcd34d'],
  ['danger red-400 #f87171', '#f87171'], ['danger red-300 #fca5a5', '#fca5a5'],
  ['info blue-400 #60a5fa', '#60a5fa'], ['info sky-400 #38bdf8', '#38bdf8'],
] as const) row(n, c, [['card', DC], ['bg', DB]], 4.5)

console.log('\n=== FEEDBACK — solid fill role, need 3.0 vs surface + 4.5 for its label ===')
for (const [n, c] of [
  ['danger red-600 #dc2626', '#dc2626'], ['success emerald-600 #059669', '#059669'],
  ['warning amber-600 #d97706', '#d97706'], ['info blue-600 #2563eb', '#2563eb'],
  ['danger dark red-500 #ef4444', '#ef4444'], ['success dark emerald-500 #10b981', '#10b981'],
  ['warning dark amber-500 #f59e0b', '#f59e0b'], ['info dark blue-500 #3b82f6', '#3b82f6'],
] as const) {
  const w = contrastRatio('#ffffff', c), ink = contrastRatio('#1c1917', c)
  console.log(`  ${n.padEnd(30)} vs lightbg ${f(contrastRatio(c, LB))} vs darkcard ${f(contrastRatio(c, DC))}  | white-label ${f(w)} ${v(w, 4.5)} ink-label ${f(ink)} ${v(ink, 4.5)}`)
}

console.log('\n=== SUBTLE feedback surfaces (tinted bg) + their text ===')
const pairs: [string, string, string][] = [
  ['success light', '#ecfdf5', '#065f46'],
  ['warning light', '#fffbeb', '#92400e'],
  ['danger light', '#fef2f2', '#b91c1c'],
  ['info light', '#eff6ff', '#1d4ed8'],
  ['success dark', '#0b2e22', '#6ee7b7'],
  ['warning dark', '#33240a', '#fcd34d'],
  ['danger dark', '#3a1414', '#fca5a5'],
  ['info dark', '#111f3d', '#93c5fd'],
]
for (const [n, bg, fg] of pairs) {
  const c = contrastRatio(fg, bg)
  console.log(`  ${n.padEnd(16)} text ${fg} on ${bg}  ${f(c)}  ${v(c, 4.5)}`)
}
