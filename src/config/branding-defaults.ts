/**
 * Curated branding catalog for tenant provision Step 3.
 *
 * Backend contract for provision (`settings.theme` / TenantBranding):
 *   primaryColor, accentHoverColor, fontBody, fontsByLocale
 * Logo is NOT part of theme — uploaded as multipart `image` (Tenant.image).
 *
 * Font catalog is frontend-owned. Backend stores selected font IDs
 * (e.g. "inter", "vazirmatn"); the frontend maps IDs → CSS stacks at render.
 */

export interface BrandingPalettePreset {
  id: string
  /** console.* i18n key for display name */
  labelKey: string
  primaryColor: string
  accentHoverColor: string
  backgroundColor: string
  textColor: string
}

export interface BrandingFontOption {
  id: string
  name: string
  /** CSS font-family value for preview / CSS var resolution */
  cssFamily: string
}

export interface BrandingLanguageFontEntry {
  code: string
  fonts: readonly [BrandingFontOption, BrandingFontOption]
  defaultFontId: string
}

/** WCAG-oriented presets (contrast verified at catalog authoring time). */
export const BRANDING_PALETTE_PRESETS: readonly BrandingPalettePreset[] = [
  {
    id: 'sunset-orange',
    labelKey: 'paletteSunsetOrange',
    primaryColor: '#ea580c',
    accentHoverColor: '#c2410c',
    backgroundColor: '#fff7ed',
    textColor: '#431407',
  },
  {
    id: 'espresso',
    labelKey: 'paletteEspresso',
    primaryColor: '#6f4e37',
    accentHoverColor: '#4a3424',
    backgroundColor: '#fdf6ec',
    textColor: '#2d1b0e',
  },
  {
    id: 'midnight',
    labelKey: 'paletteMidnight',
    primaryColor: '#1e3a5f',
    accentHoverColor: '#0f2440',
    backgroundColor: '#f8fafc',
    textColor: '#0f172a',
  },
  {
    id: 'forest',
    labelKey: 'paletteForest',
    primaryColor: '#166534',
    accentHoverColor: '#14532d',
    backgroundColor: '#f0fdf4',
    textColor: '#14532d',
  },
  {
    id: 'slate',
    labelKey: 'paletteSlate',
    primaryColor: '#334155',
    accentHoverColor: '#1e293b',
    backgroundColor: '#f8fafc',
    textColor: '#0f172a',
  },
  {
    id: 'berry',
    labelKey: 'paletteBerry',
    primaryColor: '#9d174d',
    accentHoverColor: '#831843',
    backgroundColor: '#fdf2f8',
    textColor: '#500724',
  },
  {
    id: 'ocean',
    labelKey: 'paletteOcean',
    primaryColor: '#0369a1',
    accentHoverColor: '#075985',
    backgroundColor: '#f0f9ff',
    textColor: '#0c4a6e',
  },
  {
    id: 'charcoal-gold',
    labelKey: 'paletteCharcoalGold',
    primaryColor: '#b45309',
    accentHoverColor: '#92400e',
    backgroundColor: '#fafaf9',
    textColor: '#1c1917',
  },
] as const

const DM_SANS: BrandingFontOption = {
  id: 'dm-sans',
  name: 'DM Sans',
  cssFamily: '"DM Sans", sans-serif',
}

const INTER: BrandingFontOption = {
  id: 'inter',
  name: 'Inter',
  cssFamily: '"Inter", sans-serif',
}

const SOURCE_SERIF: BrandingFontOption = {
  id: 'source-serif',
  name: 'Source Serif 4',
  cssFamily: '"Source Serif 4", Georgia, serif',
}

const VAZIRMATN: BrandingFontOption = {
  id: 'vazirmatn',
  name: 'Vazirmatn',
  cssFamily: '"Vazirmatn", sans-serif',
}

/** Backend alias id "vazir" resolves to this catalog entry via resolveFontCssFamily. */
const NOTO_NASKH: BrandingFontOption = {
  id: 'noto-naskh',
  name: 'Noto Naskh Arabic',
  cssFamily: '"Noto Naskh Arabic", "Vazirmatn", sans-serif',
}

const NOTO_SANS_SC: BrandingFontOption = {
  id: 'noto-sans-sc',
  name: 'Noto Sans SC',
  cssFamily: '"Noto Sans SC", "Inter", sans-serif',
}

const NOTO_SERIF_SC: BrandingFontOption = {
  id: 'noto-serif-sc',
  name: 'Noto Serif SC',
  cssFamily: '"Noto Serif SC", serif',
}

/**
 * Exactly two curated fonts per language code.
 * Adding a language = add an entry here; Step 3 UI stays unchanged.
 */
export const BRANDING_FONTS_BY_LANGUAGE: Readonly<
  Record<string, BrandingLanguageFontEntry>
> = {
  en: { code: 'en', fonts: [DM_SANS, INTER], defaultFontId: DM_SANS.id },
  fa: { code: 'fa', fonts: [VAZIRMATN, NOTO_NASKH], defaultFontId: VAZIRMATN.id },
  ar: { code: 'ar', fonts: [NOTO_NASKH, VAZIRMATN], defaultFontId: NOTO_NASKH.id },
  zh: { code: 'zh', fonts: [NOTO_SANS_SC, NOTO_SERIF_SC], defaultFontId: NOTO_SANS_SC.id },
  it: { code: 'it', fonts: [DM_SANS, SOURCE_SERIF], defaultFontId: DM_SANS.id },
  tr: { code: 'tr', fonts: [INTER, DM_SANS], defaultFontId: INTER.id },
}

const FALLBACK_LANGUAGE_FONTS: BrandingLanguageFontEntry = {
  code: '_',
  fonts: [DM_SANS, INTER],
  defaultFontId: DM_SANS.id,
}

export function getPaletteById(id: string | undefined): BrandingPalettePreset | undefined {
  if (!id) return undefined
  return BRANDING_PALETTE_PRESETS.find((p) => p.id === id)
}

export function findPaletteForPrimary(primaryColor: string | undefined): BrandingPalettePreset {
  if (primaryColor) {
    const match = BRANDING_PALETTE_PRESETS.find(
      (p) => p.primaryColor.toLowerCase() === primaryColor.toLowerCase(),
    )
    if (match) return match
  }
  return BRANDING_PALETTE_PRESETS[0]
}

export function getLanguageFontEntry(code: string): BrandingLanguageFontEntry {
  return BRANDING_FONTS_BY_LANGUAGE[code] ?? { ...FALLBACK_LANGUAGE_FONTS, code }
}

/** Build language font rows from the platform supported-locale list. */
export function buildLanguageFontCatalog(
  supportedLocales: readonly string[],
): BrandingLanguageFontEntry[] {
  return supportedLocales.map((code) => getLanguageFontEntry(code))
}

export function resolveFontCss(
  entry: BrandingLanguageFontEntry,
  fontId: string | undefined,
): string {
  const match = entry.fonts.find((f) => f.id === fontId)
  if (match) return match.cssFamily
  return entry.fonts.find((f) => f.id === entry.defaultFontId)?.cssFamily ?? entry.fonts[0].cssFamily
}

/** Default font IDs per locale (backend contract values — not CSS stacks). */
export function defaultFontsByLocale(
  supportedLocales: readonly string[],
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const code of supportedLocales) {
    const entry = getLanguageFontEntry(code)
    map[code] = entry.defaultFontId
  }
  return map
}

/** Resolve a stored font id (or legacy CSS stack) to a catalog font id. */
export function fontIdFromStored(
  entry: BrandingLanguageFontEntry,
  stored: string | undefined,
): string {
  if (!stored) return entry.defaultFontId
  const byId = entry.fonts.find((f) => f.id === stored)
  if (byId) return byId.id
  const byCss = entry.fonts.find((f) => f.cssFamily === stored)
  if (byCss) return byCss.id
  // Backend alias
  if (stored === 'vazir') {
    const vazir = entry.fonts.find((f) => f.id === 'vazirmatn')
    if (vazir) return vazir.id
  }
  return entry.defaultFontId
}

/** @deprecated Use fontIdFromStored — kept for call sites that still pass CSS. */
export function fontIdFromCss(
  entry: BrandingLanguageFontEntry,
  cssFamily: string | undefined,
): string {
  return fontIdFromStored(entry, cssFamily)
}
