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
  price: number
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
      price: options.price.toFixed(2),
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
 * dangerouslySetInnerHTML. Escapes </script> sequences.
 */
export function serializeJsonLd(ld: Record<string, unknown>): string {
  return JSON.stringify(ld).replace(/<\/script>/gi, '<\\/script>')
}

// ── Platform defaults ──────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.savor.com'

/** Default Restaurant JSON-LD using platform-level brand data. */
export const DEFAULT_RESTAURANT_JSON_LD = buildRestaurantJsonLd({
  name: 'Savor',
  description: 'Fine dining and delivery. Handcrafted dishes made with the finest ingredients.',
  url: BASE_URL,
  image: `${BASE_URL}/og-image.jpg`,
  servesCuisine: ['American', 'Italian', 'International'],
  priceRange: '$$',
})

/** Default Menu JSON-LD for the /menu route. */
export const DEFAULT_MENU_JSON_LD = buildMenuJsonLd({
  name: 'Savor Full Menu',
  description: 'Explore our complete selection of handcrafted dishes.',
  url: `${BASE_URL}/menu`,
  restaurantName: 'Savor',
})
