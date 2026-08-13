/**
 * Shared Tenant Branding helpers — frontend contract alignment.
 *
 * Endpoint contracts:
 * - Tenant CRUD: branding lives in `settings.theme` (raw settings remain valid)
 * - Discover: prefer top-level `branding`; legacy `theme` is compatibility-only
 * - Public Website: `branding` = tenant colors/fonts; `theme` = layout theme (separate)
 * - Logo: always top-level `image` (never theme.logo / logoUrl)
 */

import type { TenantBranding } from '@/types'
import { BRANDING_FONTS_BY_LANGUAGE, getLanguageFontEntry } from '@/config/branding-defaults'

/** Prefer Discover/Public `branding`, then legacy Discover `theme`, then CRUD `settings.theme`. */
export function resolveTenantBranding(source: {
  branding?: TenantBranding | null
  /** Discover legacy field — not canonical for new code. */
  theme?: TenantBranding | null
  settings?: { theme?: TenantBranding | null } | null
} | null | undefined): TenantBranding | undefined {
  if (!source) return undefined
  if (source.branding && hasBrandingValues(source.branding)) return source.branding
  if (source.settings?.theme && hasBrandingValues(source.settings.theme)) return source.settings.theme
  if (source.theme && hasBrandingValues(source.theme)) return source.theme
  return source.branding ?? source.settings?.theme ?? source.theme ?? undefined
}

function hasBrandingValues(b: TenantBranding): boolean {
  return Boolean(
    b.primaryColor ||
      b.accentHoverColor ||
      b.fontBody ||
      (b.fontsByLocale && Object.keys(b.fontsByLocale).length > 0),
  )
}

/** Canonical tenant logo URL from top-level `image`. */
export function resolveTenantImage(source: {
  image?: string | null
} | null | undefined): string | undefined {
  const image = source?.image
  return image ? image : undefined
}

/**
 * Map a backend font id (e.g. "inter", "vazir") or a legacy CSS stack to a
 * CSS font-family string using the frontend-owned catalog.
 */
export function resolveFontCssFamily(
  fontIdOrCss: string | null | undefined,
  options?: { locale?: string; fontsByLocale?: Record<string, string> | null },
): string | undefined {
  const locale = options?.locale
  const fromLocale =
    locale && options?.fontsByLocale ? options.fontsByLocale[locale] : undefined
  const raw = fromLocale || fontIdOrCss
  if (!raw) return undefined

  // Already a CSS stack
  if (raw.includes(',') || raw.includes('"') || raw.includes("'")) return raw

  const id = raw.toLowerCase().trim()
  // Search all language catalogs + common aliases
  for (const entry of Object.values(BRANDING_FONTS_BY_LANGUAGE)) {
    const match = entry.fonts.find((f) => f.id === id || f.id === raw)
    if (match) return match.cssFamily
  }
  // Alias map for backend ids that differ slightly from catalog ids
  const aliases: Record<string, string> = {
    vazir: 'vazirmatn',
    inter: 'inter',
    'dm-sans': 'dm-sans',
    'noto-naskh': 'noto-naskh',
  }
  const aliased = aliases[id]
  if (aliased) {
    for (const entry of Object.values(BRANDING_FONTS_BY_LANGUAGE)) {
      const match = entry.fonts.find((f) => f.id === aliased)
      if (match) return match.cssFamily
    }
    if (locale) {
      const entry = getLanguageFontEntry(locale)
      const match = entry.fonts.find((f) => f.id === aliased)
      if (match) return match.cssFamily
    }
  }

  // Unknown id — pass through as a quoted family name
  return `"${raw}", sans-serif`
}

/** Strip logo-like keys from a branding/theme object before write. */
export function sanitizeBrandingForWrite(
  branding: TenantBranding & Record<string, unknown>,
): TenantBranding {
  const {
    logoUrl: _logoUrl,
    logo: _logo,
    primaryColor,
    accentHoverColor,
    fontBody,
    fontsByLocale,
  } = branding
  return {
    ...(primaryColor != null ? { primaryColor } : {}),
    ...(accentHoverColor != null ? { accentHoverColor } : {}),
    ...(fontBody != null ? { fontBody } : {}),
    ...(fontsByLocale != null ? { fontsByLocale } : {}),
  }
}
