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
  // Surfaces (elevation ladder: sunken < bg < card < raised)
  bg:            'var(--bg)',
  bgSecondary:   'var(--bg-secondary)',
  surfaceSunken: 'var(--surface-sunken)',
  surfaceRaised: 'var(--surface-raised)',
  card:          'var(--card)',
  cardHover:     'var(--card-hover)',
  inputBg:       'var(--input-bg)',

  // Foreground ramp
  fg:            'var(--fg)',
  fgSecondary:   'var(--fg-secondary)',
  fgMuted:       'var(--fg-muted)',
  fgSubtle:      'var(--fg-subtle)',
  fgDisabled:    'var(--fg-disabled)',
  fgInverse:     'var(--fg-inverse)',

  // Borders — decorative vs. control boundary are separate roles
  borderSubtle:  'var(--border-subtle)',
  border:        'var(--border)',
  borderStrong:  'var(--border-strong)',
  borderInput:   'var(--border-input)',

  // Brand, split by role so the raw tenant colour is never reused blindly
  accent:        'var(--accent)',
  accentHover:   'var(--accent-hover)',
  accentActive:  'var(--accent-active)',
  accentFg:      'var(--accent-fg)',
  accentText:    'var(--accent-text)',
  accentBorder:  'var(--accent-border)',
  accentSubtle:  'var(--accent-subtle)',

  // Feedback
  success:       'var(--success)',
  successFg:     'var(--success-fg)',
  successText:   'var(--success-text)',
  successSubtle: 'var(--success-subtle)',
  successBorder: 'var(--success-border)',
  warning:       'var(--warning)',
  warningFg:     'var(--warning-fg)',
  warningText:   'var(--warning-text)',
  warningSubtle: 'var(--warning-subtle)',
  warningBorder: 'var(--warning-border)',
  danger:        'var(--danger)',
  dangerFg:      'var(--danger-fg)',
  dangerText:    'var(--danger-text)',
  dangerSubtle:  'var(--danger-subtle)',
  dangerBorder:  'var(--danger-border)',
  info:          'var(--info)',
  infoFg:        'var(--info-fg)',
  infoText:      'var(--info-text)',
  infoSubtle:    'var(--info-subtle)',
  infoBorder:    'var(--info-border)',

  // Interaction / effects
  focusRing:     'var(--focus-ring)',
  overlay:       'var(--overlay)',
} as const

// ── Categorical data-visualisation ramp ───────────────────────────────────────
// Deliberately independent of the brand: charts must stay distinguishable no
// matter which colour a tenant picks.
export const CHART_TOKENS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
] as const

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
  md:    'var(--shadow-md)',
  lg:    'var(--shadow-lg)',
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
 * Semantic roles a tenant is permitted to influence (P2.2).
 * Brand and surface palettes are intentionally excluded — tenants control
 * the semantic accent and font, not the underlying colour scales.
 *
 * Note these are the *roles*, not the DOM variables written at runtime. A
 * tenant's single brand colour is expanded into the contrast-corrected,
 * per-theme set in TENANT_INJECTED_VARS below; the accent roles here are
 * derived from it rather than assigned from it directly.
 */
export const TENANT_OVERRIDABLE_VARS = [
  '--accent',
  '--accent-hover',
  '--font-body',
] as const

export type TenantOverridableVar = (typeof TENANT_OVERRIDABLE_VARS)[number]

/**
 * The CSS variables TenantThemeProvider actually writes to <html>.
 *
 * Light and dark variants are written as *separate* variables that the
 * stylesheet selects between, rather than assigning `--accent` directly. Two
 * reasons: an inline style on <html> would otherwise outrank the `.dark`
 * rules and freeze one brand colour across both themes, and letting CSS pick
 * means toggling the theme needs no JavaScript round-trip.
 */
export const TENANT_INJECTED_VARS = [
  '--tenant-accent-light',
  '--tenant-accent-dark',
  '--tenant-accent-hover-light',
  '--tenant-accent-hover-dark',
  '--tenant-accent-active-light',
  '--tenant-accent-active-dark',
  '--tenant-accent-fg-light',
  '--tenant-accent-fg-dark',
  '--tenant-accent-text-light',
  '--tenant-accent-text-dark',
  '--tenant-accent-border-light',
  '--tenant-accent-border-dark',
  '--font-body',
] as const
