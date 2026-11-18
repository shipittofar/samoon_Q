/**
 * JSON-LD Structured Data — Phase 4 (P4.4.6)
 *
 * Generates schema.org JSON-LD objects for entities present in the platform.
 * Only uses fields that exist in the platform data model — nothing fabricated.
 *
 * Supported types:
 *   - Restaurant / FoodEstablishment (homepage)
 *   - Menu (menu page)
 *   - MenuItem (individual dishes)
 *
 * Usage in a Server Component:
 *   <script
 *     type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: JSON.stringify(buildRestaurantJsonLd()) }}
 *   />
 */

import { parseDecimal } from '@/utils/decimal'

export interface JsonLdRestaurantOptions {
  name: string
  description?: string
  url: string
  telephone?: string
  address?: {
    streetAddress: string
    addressLocality: string
    addressCountry?: string
  }
  image?: string
  servesCuisine?: string[]
  priceRange?: string
}

/** Builds a Restaurant / FoodEstablishment JSON-LD object. */
export function buildRestaurantJsonLd(options: JsonLdRestaurantOptions): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['Restaurant', 'FoodEstablishment'],
    name: options.name,
    url: options.url,
  }

  if (options.description) ld.description = options.description
  if (options.telephone) ld.telephone = options.telephone
  if (options.image) ld.image = options.image
  if (options.servesCuisine?.length) ld.servesCuisine = options.servesCuisine
  if (options.priceRange) ld.priceRange = options.priceRange

  if (options.address) {
    ld.address = {
      '@type': 'PostalAddress',
      streetAddress: options.address.streetAddress,
      addressLocality: options.address.addressLocality,
      addressCountry: options.address.addressCountry ?? 'US',
    }
  }

  return ld
}

export interface JsonLdMenuOptions {
  name: string
  description?: string
  url: string
  restaurantName: string
}

/** Builds a Menu JSON-LD object. */
export function buildMenuJsonLd(options: JsonLdMenuOptions): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: options.name,
    url: options.url,
    ...(options.description ? { description: options.description } : {}),
    hasMenuSection: [],
    mainEntityOfPage: {
      '@type': 'FoodEstablishment',
      name: options.restaurantName,
    },
  }
}

export interface JsonLdMenuItemOptions {
  name: string
  description?: string
  image?: string
  price: number | string
  currency?: string
  category?: string
}

/** Builds a MenuItem JSON-LD object. */
export function buildMenuItemJsonLd(options: JsonLdMenuItemOptions): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MenuItem',
    name: options.name,
    offers: {
      '@type': 'Offer',
      price: parseDecimal(options.price).toFixed(2),
      priceCurrency: options.currency ?? 'USD',
    },
  }

  if (options.description) ld.description = options.description
  if (options.image) ld.image = options.image
  if (options.category) ld.suitableForDiet = options.category

  return ld
}

/**
 * Serialises a JSON-LD object to a string safe for use in
 * dangerouslySetInnerHTML inside <script type="application/ld+json">.
 *
 * Escapes every `<`, `>` and `&` (not just `</script>`) so tenant-supplied
 * text cannot close the script element, open an HTML comment (`<!--`), or
 * otherwise break out. U+2028/U+2029 are escaped for older JS parsers.
 * The output is still valid JSON and parses back to the same value.
 */
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g')
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g')

export function serializeJsonLd(ld: Record<string, unknown>): string {
  return JSON.stringify(ld)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEPARATOR, '\\u2028')
    .replace(PARAGRAPH_SEPARATOR, '\\u2029')
}

// ── Platform defaults ──────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.samoon.com'

export interface JsonLdWebSiteOptions {
  name: string
  description?: string
  url: string
  image?: string
  searchUrl?: string
}

/** Builds a WebSite JSON-LD object suitable for the platform homepage. */
export function buildWebSiteJsonLd(options: JsonLdWebSiteOptions): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: options.name,
    url: options.url,
  }
  if (options.description) ld.description = options.description
  if (options.image) ld.image = options.image
  if (options.searchUrl) {
    ld.potentialAction = {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: options.searchUrl },
      'query-input': 'required name=search_term_string',
    }
  }
  return ld
}

/**
 * Platform-level JSON-LD for the root homepage.
 * Uses WebSite schema — the platform is a marketplace, not a restaurant.
 */
export const DEFAULT_PLATFORM_JSON_LD = buildWebSiteJsonLd({
  name: 'Samoon',
  description: 'Discover restaurants, cafés, bars, food trucks, and more. Browse menus, book tables, and order from local businesses.',
  url: BASE_URL,
  image: `${BASE_URL}/og-image.jpg`,
  searchUrl: `${BASE_URL}/discover?q={search_term_string}`,
})

/**
 * Legacy Restaurant JSON-LD sample for tests / platform demos.
 * Do NOT use on platform-level pages — use DEFAULT_PLATFORM_JSON_LD instead.
 * Do NOT inject servesCuisine here — cuisine data is Branch-owned and must
 * come from branch.cuisines via buildBranchJsonLd (omit when absent).
 */
export const DEFAULT_RESTAURANT_JSON_LD = buildRestaurantJsonLd({
  name: 'Samoon',
  description: 'Fine dining and delivery. Handcrafted dishes made with the finest ingredients.',
  url: BASE_URL,
  image: `${BASE_URL}/og-image.jpg`,
  priceRange: '$$',
})

/** Default Menu JSON-LD for the /menu route. */
export const DEFAULT_MENU_JSON_LD = buildMenuJsonLd({
  name: 'Menu — Samoon',
  description: 'Explore menus from restaurants, cafés, and bars on Samoon.',
  url: `${BASE_URL}/menu`,
  restaurantName: 'Samoon',
})
