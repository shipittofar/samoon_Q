/**
 * Design Token Registry — Phase 2 (P2.1)
 *
 * Typed constants that map to the CSS variable system defined in globals.css.
 * Components reference tokens via CSS vars at render time — these constants
 * serve as the authoritative typed reference so callers never hard-code raw
 * CSS variable strings.
 *
 * Token layers (bottom → top):
 *   Brand   — primary brand palette (orange, tenant-overridable via P2.2)
 *   Surface — neutral palette
 *   Semantic — role-mapped vars (bg, fg, accent, card, border, etc.)
 *   Radius  — border radius scale
 *   Shadow  — elevation scale
 *   Font    — typeface vars
 *
 * Tenant theming operates at the Semantic layer: a tenant overrides --accent
 * and --font-body without touching the Brand or Surface palettes.
 */

// ── Brand palette ─────────────────────────────────────────────────────────────
export const BRAND_TOKENS = {
  50:  'var(--color-brand-50)',
  100: 'var(--color-brand-100)',
  200: 'var(--color-brand-200)',
  300: 'var(--color-brand-300)',
  400: 'var(--color-brand-400)',
  500: 'var(--color-brand-500)',
  600: 'var(--color-brand-600)',
  700: 'var(--color-brand-700)',
  800: 'var(--color-brand-800)',
  900: 'var(--color-brand-900)',
  950: 'var(--color-brand-950)',
} as const

// ── Surface / neutral palette ─────────────────────────────────────────────────
export const SURFACE_TOKENS = {
  50:  'var(--color-surface-50)',
  100: 'var(--color-surface-100)',
  200: 'var(--color-surface-200)',
  300: 'var(--color-surface-300)',
  400: 'var(--color-surface-400)',
  500: 'var(--color-surface-500)',
  600: 'var(--color-surface-600)',
  700: 'var(--color-surface-700)',
  800: 'var(--color-surface-800)',
  900: 'var(--color-surface-900)',
  950: 'var(--color-surface-950)',
} as const

// ── Semantic tokens — the only layer UI components should reference ────────────
export const SEMANTIC_TOKENS = {
  bg:           'var(--bg)',
  bgSecondary:  'var(--bg-secondary)',
  fg:           'var(--fg)',
  fgMuted:      'var(--fg-muted)',
  fgSubtle:     'var(--fg-subtle)',
  border:       'var(--border)',
  borderStrong: 'var(--border-strong)',
  accent:       'var(--accent)',
  accentHover:  'var(--accent-hover)',
  accentFg:     'var(--accent-fg)',
  card:         'var(--card)',
  cardHover:    'var(--card-hover)',
  inputBg:      'var(--input-bg)',
  overlay:      'var(--overlay)',
} as const

// ── Radius scale ──────────────────────────────────────────────────────────────
export const RADIUS_TOKENS = {
  sm:   'var(--radius-sm)',
  md:   'var(--radius-md)',
  lg:   'var(--radius-lg)',
  xl:   'var(--radius-xl)',
  '2xl': 'var(--radius-2xl)',
  full: 'var(--radius-full)',
} as const

// ── Shadow / elevation scale ──────────────────────────────────────────────────
export const SHADOW_TOKENS = {
  soft:  'var(--shadow-soft)',
  brand: 'var(--shadow-brand)',
  glow:  'var(--shadow-glow)',
} as const

// ── Font vars ──────────────────────────────────────────────────────────────────
export const FONT_TOKENS = {
  display: 'var(--font-display)',
  body:    'var(--font-body)',
  mono:    'var(--font-mono)',
} as const

/**
 * CSS variable names that per-tenant theme overrides are permitted to target.
 * TenantThemeProvider applies overrides ONLY to these vars (P2.2).
 * Brand and surface palettes are intentionally excluded — tenants control
 * the semantic accent and font, not the underlying colour scales.
 */
export const TENANT_OVERRIDABLE_VARS = [
  '--accent',
  '--accent-hover',
  '--font-body',
] as const

export type TenantOverridableVar = (typeof TENANT_OVERRIDABLE_VARS)[number]
