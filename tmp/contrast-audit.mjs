// Throwaway WCAG contrast audit for the Samoon tenant brand palettes.
const hex = (h) => {
  h = h.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
const lum = (h) => {
  const [r, g, b] = hex(h).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const cr = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}
const f = (n) => n.toFixed(2)
const verdict = (n, req) => (n >= req ? 'PASS' : 'FAIL')

// Global neutral surfaces from globals.css
const LIGHT_BG = '#fafaf9'   // surface-50
const LIGHT_CARD = '#ffffff'
const DARK_BG = '#0c0a09'    // surface-950
const DARK_CARD = '#1c1917'  // surface-900

const PALETTES = [
  ['sunset-orange', '#ea580c', '#c2410c'],
  ['espresso', '#6f4e37', '#4a3424'],
  ['midnight', '#1e3a5f', '#0f2440'],
  ['forest', '#166534', '#14532d'],
  ['slate', '#334155', '#1e293b'],
  ['berry', '#9d174d', '#831843'],
  ['ocean', '#0369a1', '#075985'],
  ['charcoal-gold', '#b45309', '#92400e'],
  ['DEFAULT brand-500', '#f97316', '#ea580c'],
]

console.log('\n=== A. WHITE TEXT ON BRAND (button label, --accent-fg is hardcoded white) — need 4.5 ===')
for (const [n, p] of PALETTES) {
  const v = cr('#ffffff', p)
  console.log(`${n.padEnd(18)} white on ${p}  ${f(v).padStart(6)}  ${verdict(v, 4.5)}${v < 3 ? '  <-- SEVERE' : ''}`)
}

console.log('\n=== B. BRAND AS TEXT/LINK/ICON ON LIGHT BG (#fafaf9) — need 4.5 ===')
for (const [n, p] of PALETTES) {
  const v = cr(p, LIGHT_BG)
  console.log(`${n.padEnd(18)} ${p} on light  ${f(v).padStart(6)}  ${verdict(v, 4.5)}`)
}

console.log('\n=== C. BRAND AS TEXT/LINK/ICON ON DARK BG (#0c0a09) — need 4.5 ===')
for (const [n, p] of PALETTES) {
  const v = cr(p, DARK_BG)
  console.log(`${n.padEnd(18)} ${p} on dark   ${f(v).padStart(6)}  ${verdict(v, 4.5)}${v < 3 ? '  <-- SEVERE / near-invisible' : ''}`)
}

console.log('\n=== D. BRAND AS TEXT ON DARK CARD (#1c1917) — need 4.5 ===')
for (const [n, p] of PALETTES) {
  const v = cr(p, DARK_CARD)
  console.log(`${n.padEnd(18)} ${p} on card   ${f(v).padStart(6)}  ${verdict(v, 4.5)}`)
}

console.log('\n=== E. BRAND SURFACE (button fill) vs DARK BG — non-text UI contrast, need 3.0 ===')
for (const [n, p] of PALETTES) {
  const v = cr(p, DARK_BG)
  console.log(`${n.padEnd(18)} ${p} vs dark bg ${f(v).padStart(6)}  ${verdict(v, 3.0)}`)
}

console.log('\n=== F. HOVER DELTA (is hover perceptible?) — brand vs accentHover ===')
for (const [n, p, h] of PALETTES) {
  const v = cr(p, h)
  console.log(`${n.padEnd(18)} ${p} -> ${h}  ratio ${f(v)}  ${v < 1.15 ? 'TOO SUBTLE' : 'ok'}`)
}

console.log('\n=== G. HARDCODED TAILWIND NEUTRALS (the 2284 utility usages) ===')
const NEUTRALS = [
  ['text-gray-400 #9ca3af', '#9ca3af'],
  ['text-gray-500 #6b7280', '#6b7280'],
  ['text-gray-600 #4b5563', '#4b5563'],
  ['text-gray-700 #374151', '#374151'],
  ['text-gray-900 #111827', '#111827'],
  ['--fg-muted surface-500 #78716c', '#78716c'],
  ['--fg-subtle surface-400 #a8a29e', '#a8a29e'],
]
console.log('-- on LIGHT bg #fafaf9 (need 4.5 body / 3.0 large) --')
for (const [n, c] of NEUTRALS) {
  const v = cr(c, LIGHT_BG)
  console.log(`${n.padEnd(32)} ${f(v).padStart(6)}  ${verdict(v, 4.5)}`)
}
console.log('-- on DARK bg #0c0a09 --')
for (const [n, c] of NEUTRALS) {
  const v = cr(c, DARK_BG)
  console.log(`${n.padEnd(32)} ${f(v).padStart(6)}  ${verdict(v, 4.5)}`)
}

console.log('\n=== H. FEEDBACK COLORS as text, both themes (need 4.5) ===')
const FEEDBACK = [
  ['red-500 #ef4444', '#ef4444'], ['red-600 #dc2626', '#dc2626'],
  ['emerald-500 #10b981', '#10b981'], ['emerald-600 #059669', '#059669'],
  ['green-600 #16a34a', '#16a34a'],
  ['amber-500 #f59e0b', '#f59e0b'], ['amber-600 #d97706', '#d97706'],
  ['blue-600 #2563eb', '#2563eb'], ['blue-500 #3b82f6', '#3b82f6'],
]
for (const [n, c] of FEEDBACK) {
  const l = cr(c, LIGHT_BG), d = cr(c, DARK_BG)
  console.log(`${n.padEnd(20)} light ${f(l).padStart(6)} ${verdict(l, 4.5).padEnd(4)} | dark ${f(d).padStart(6)} ${verdict(d, 4.5)}`)
}

console.log('\n=== I. BORDERS — need 3.0 to be a visible UI boundary ===')
const BORDERS = [
  ['--border light surface-200 #e7e5e4 on #fafaf9', '#e7e5e4', LIGHT_BG],
  ['border-gray-200 #e5e7eb on white', '#e5e7eb', '#ffffff'],
  ['--border dark surface-800 #292524 on #0c0a09', '#292524', DARK_BG],
  ['--border-strong dark surface-700 #44403c on #0c0a09', '#44403c', DARK_BG],
]
for (const [n, a, b] of BORDERS) {
  const v = cr(a, b)
  console.log(`${n.padEnd(48)} ${f(v).padStart(5)}  ${verdict(v, 3.0)}`)
}
