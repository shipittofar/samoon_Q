/**
 * Brand Colour Derivation — Phase 21 (P21.1)
 *
 * A tenant supplies ONE brand colour. That single value is not safe to reuse
 * for every semantic role: a colour that reads well as a button fill can be
 * illegible as body text, invisible as a border, or vanish entirely against a
 * dark background. This module turns the raw brand colour into a set of
 * per-theme tokens that each satisfy their own contrast requirement while
 * keeping the brand hue intact.
 *
 * Derivation preserves hue and saturation and only moves lightness, so the
 * result still reads as "the tenant's colour" rather than a different colour.
 *
 * Contrast targets follow WCAG 2.2:
 *   1.4.3 Contrast (Minimum)      — 4.5:1 for body text
 *   1.4.11 Non-text Contrast      — 3:1 for UI components and their boundaries
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Hsl {
  h: number
  s: number
  l: number
}

/** Reference surfaces the derived tokens are guaranteed to work against. */
export const SURFACE_REFS = {
  /** Lightest page background in light mode (--bg). */
  light: '#fafaf9',
  /**
   * Elevated surface in dark mode (--card). Deliberately the *lighter* of the
   * two dark surfaces: it is the harder test for light-on-dark content, so a
   * token that passes here also passes on the darker page background.
   */
  dark: '#1c1917',
} as const

/** Ink used when dark text on a brand fill beats white text. */
export const INK = '#1c1917'
export const PAPER = '#ffffff'

const CONTRAST_TEXT = 4.5
const CONTRAST_UI = 3

// ── Parsing / formatting ──────────────────────────────────────────────────────

/** Parses #rgb, #rrggbb and #rrggbbaa (alpha ignored). Returns null if invalid. */
export function parseColor(input: string | null | undefined): Rgb | null {
  if (typeof input !== 'string') return null
  const raw = input.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]+$/.test(raw)) return null
  let hex: string
  if (raw.length === 3 || raw.length === 4) {
    hex = raw
      .slice(0, 3)
      .split('')
      .map((c) => c + c)
      .join('')
  } else if (raw.length === 6 || raw.length === 8) {
    hex = raw.slice(0, 6)
  } else {
    return null
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function toHex({ r, g, b }: Rgb): string {
  const part = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/** True when the string is a hex colour this module can safely derive from. */
export function isValidHexColor(input: string | null | undefined): boolean {
  return parseColor(input) !== null
}

// ── Contrast ──────────────────────────────────────────────────────────────────

/** WCAG relative luminance. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two colours, 1..21. Accepts hex or Rgb. */
export function contrastRatio(a: string | Rgb, b: string | Rgb): number {
  const ca = typeof a === 'string' ? parseColor(a) : a
  const cb = typeof b === 'string' ? parseColor(b) : b
  if (!ca || !cb) return 1
  const la = relativeLuminance(ca)
  const lb = relativeLuminance(cb)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

// ── HSL conversion ────────────────────────────────────────────────────────────

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return { h, s, l }
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const v = l * 255
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const toChannel = (t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  return {
    r: toChannel(h + 1 / 3) * 255,
    g: toChannel(h) * 255,
    b: toChannel(h - 1 / 3) * 255,
  }
}

/** Returns a copy of `color` with lightness shifted by `delta` (-1..1). */
export function shiftLightness(color: string, delta: number): string {
  const rgb = parseColor(color)
  if (!rgb) return color
  const hsl = rgbToHsl(rgb)
  return toHex(hslToRgb({ ...hsl, l: clamp(hsl.l + delta, 0, 1) }))
}

// ── Contrast-targeted derivation ──────────────────────────────────────────────

/**
 * Moves `color` along the lightness axis — keeping hue and saturation — until it
 * reaches `target` contrast against `background`. Direction is chosen from the
 * background's own luminance: darken against light backgrounds, lighten against
 * dark ones. Returns the original colour when it already passes.
 *
 * Uses a binary search over lightness; if even pure black/white cannot hit the
 * target (impossible for real backgrounds, but guarded anyway) the closest
 * achievable value is returned.
 */
export function adjustToContrast(color: string, background: string, target: number): string {
  const rgb = parseColor(color)
  const bg = parseColor(background)
  if (!rgb || !bg) return color
  if (contrastRatio(rgb, bg) >= target) return color

  const hsl = rgbToHsl(rgb)
  // Against a light background we must go darker, and vice versa.
  const goDarker = relativeLuminance(bg) > 0.5
  const bound = goDarker ? 0 : 1

  // Verify the extreme can actually reach the target before searching.
  const extreme = hslToRgb({ ...hsl, l: bound })
  if (contrastRatio(extreme, bg) < target) return toHex(extreme)

  let lo = goDarker ? bound : hsl.l
  let hi = goDarker ? hsl.l : bound
  // 12 iterations resolves lightness to ~0.02% — well below 8-bit precision.
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2
    const candidate = hslToRgb({ ...hsl, l: mid })
    if (contrastRatio(candidate, bg) >= target) {
      // Keep the value closest to the original lightness that still passes.
      if (goDarker) lo = mid
      else hi = mid
    } else if (goDarker) {
      hi = mid
    } else {
      lo = mid
    }
  }

  // The search runs in continuous space, but the result has to survive rounding
  // to 8-bit hex — which can drop it a hair under the target. Step the quantised
  // value until it genuinely passes.
  let l = goDarker ? lo : hi
  const step = (goDarker ? -1 : 1) / 255
  for (let i = 0; i <= 255; i++) {
    const hex = toHex(hslToRgb({ ...hsl, l }))
    if (contrastRatio(hex, bg) >= target) return hex
    const next = l + step
    if (next < 0 || next > 1) return hex
    l = next
  }
  return toHex(hslToRgb({ ...hsl, l }))
}

/**
 * Picks the more readable of white / ink for text placed on `background`.
 * This is what keeps a light brand fill (amber, gold, lime) from shipping
 * unreadable white labels.
 */
export function readableForeground(background: string): string {
  return contrastRatio(PAPER, background) >= contrastRatio(INK, background) ? PAPER : INK
}

// ── Token set ─────────────────────────────────────────────────────────────────

/** Brand tokens resolved for a single theme. */
export interface BrandThemeTokenSet {
  /** Solid brand fill — buttons, active pills, progress. >= 3:1 vs the page. */
  accent: string
  /** Fill under pointer hover. Guaranteed to differ perceptibly from `accent`. */
  accentHover: string
  /** Fill while pressed. */
  accentActive: string
  /** Text/icon colour placed ON `accent`. >= 4.5:1 against it. */
  accentFg: string
  /**
   * Brand-flavoured colour for text, links and icons drawn on the PAGE
   * (not on the brand fill). >= 4.5:1 against the theme's surface.
   */
  accentText: string
  /** Brand-flavoured border/ring. >= 3:1 against the theme's surface. */
  accentBorder: string
}

export interface DerivedBrandTokens {
  light: BrandThemeTokenSet
  dark: BrandThemeTokenSet
}

/** Fallback used when a tenant supplies no colour or an unparseable one. */
export const DEFAULT_BRAND_PRIMARY = '#f97316'

/** Minimum contrast ratio between a fill and its hover state to read as a change. */
const HOVER_MIN_DELTA = 1.12

function deriveHover(base: string, provided: string | null | undefined, darken: boolean): string {
  const step = darken ? -0.08 : 0.09
  const candidate = parseColor(provided)
  if (candidate) {
    const hex = toHex(candidate)
    if (contrastRatio(hex, base) >= HOVER_MIN_DELTA) return hex
  }
  let next = shiftLightness(base, step)
  // Near the ends of the lightness axis a fixed step can be swallowed; if the
  // change is imperceptible, reverse direction so hover is always visible.
  if (contrastRatio(next, base) < HOVER_MIN_DELTA) {
    next = shiftLightness(base, -step * 1.5)
  }
  return next
}

/**
 * Derives the full per-theme brand token set from a tenant's single brand colour.
 *
 * @param primary          Tenant brand colour (hex). Invalid input falls back to the platform brand.
 * @param accentHoverColor Optional explicit hover colour from a curated palette preset.
 */
export function deriveBrandTokens(
  primary: string | null | undefined,
  accentHoverColor?: string | null,
): DerivedBrandTokens {
  const base = parseColor(primary) ? toHex(parseColor(primary)!) : DEFAULT_BRAND_PRIMARY

  // ── Light theme ─────────────────────────────────────────────────────────────
  // The fill keeps the raw brand colour unless it is so pale it would dissolve
  // into the page; only then is it darkened to stay a distinguishable control.
  const lightAccent = adjustToContrast(base, SURFACE_REFS.light, CONTRAST_UI)
  const lightHover = deriveHover(lightAccent, accentHoverColor, true)
  const light: BrandThemeTokenSet = {
    accent: lightAccent,
    accentHover: lightHover,
    accentActive: shiftLightness(lightHover, -0.06),
    accentFg: readableForeground(lightAccent),
    accentText: adjustToContrast(base, SURFACE_REFS.light, CONTRAST_TEXT),
    accentBorder: adjustToContrast(base, SURFACE_REFS.light, CONTRAST_UI),
  }

  // ── Dark theme ──────────────────────────────────────────────────────────────
  // Most brand colours are chosen against white and are far too dark to survive
  // on a dark surface, so the fill is lifted until it separates from the page.
  const darkAccent = adjustToContrast(base, SURFACE_REFS.dark, CONTRAST_UI)
  const darkHover = deriveHover(darkAccent, null, false)
  const dark: BrandThemeTokenSet = {
    accent: darkAccent,
    accentHover: darkHover,
    accentActive: shiftLightness(darkHover, 0.05),
    accentFg: readableForeground(darkAccent),
    accentText: adjustToContrast(base, SURFACE_REFS.dark, CONTRAST_TEXT),
    accentBorder: adjustToContrast(base, SURFACE_REFS.dark, CONTRAST_UI),
  }

  return { light, dark }
}

/**
 * Maps derived tokens onto the CSS custom properties consumed by globals.css.
 * Light and dark are written as separate variables so the stylesheet — not
 * JavaScript — decides which set applies. That keeps theme switching instant
 * and stops an inline style on <html> from outranking the `.dark` rules.
 */
export function brandTokensToCssVars(tokens: DerivedBrandTokens): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const theme of ['light', 'dark'] as const) {
    const set = tokens[theme]
    vars[`--tenant-accent-${theme}`] = set.accent
    vars[`--tenant-accent-hover-${theme}`] = set.accentHover
    vars[`--tenant-accent-active-${theme}`] = set.accentActive
    vars[`--tenant-accent-fg-${theme}`] = set.accentFg
    vars[`--tenant-accent-text-${theme}`] = set.accentText
    vars[`--tenant-accent-border-${theme}`] = set.accentBorder
  }
  return vars
}

/** Every CSS variable `brandTokensToCssVars` can write — used for teardown. */
export const TENANT_BRAND_CSS_VARS: readonly string[] = Object.keys(
  brandTokensToCssVars(deriveBrandTokens(DEFAULT_BRAND_PRIMARY)),
)
