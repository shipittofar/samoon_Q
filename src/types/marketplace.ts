/**
 * P8.7.7.1 — Public Marketplace Discovery Layer
 *
 * MarketplaceMeta is stored in Tenant.settings.marketplace and contains
 * display-only fields curated for the public /discover page.
 * These fields are never security-sensitive — they are what a business
 * owner explicitly chooses to show to the public.
 */

export interface MarketplaceMeta {
  /** Short pitch shown on the business card (max ~120 chars). */
  description: string
  /** URL of the cover/hero image for the card. */
  coverImage: string
  /** Cuisine types or beverage styles (e.g. "Mediterranean", "Coffee"). */
  cuisines: string[]
  /** Discovery tags (e.g. "Date Night", "Pet Friendly"). */
  tags: string[]
  /** Average star rating (0–5, two decimal places). */
  rating: number
  /** Number of reviews that contributed to the rating. */
  reviewCount: number
  /** City where the business (or its primary branch) is located. */
  city: string
  /** Total number of active branches. */
  branchCount: number
  /** Whether the business is currently open. */
  openNow: boolean
  /** Slug of the primary/default branch (used to build preview links). */
  primaryBranchSlug: string
  /** Pin this business in the "Featured" section. */
  featured?: boolean
  /** Pin this business in the "Popular" section. */
  popular?: boolean
  /** Mark as newly onboarded in the "New" section. */
  isNew?: boolean
}

export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  restaurant:  'Restaurant',
  cafe:        'Café',
  bar:         'Bar',
  food_court:  'Food Court',
  food_truck:  'Food Truck',
  mobile_cafe: 'Mobile Café',
  hotel:       'Hotel',
  other:       'Other',
}

/** Returns the MarketplaceMeta stored in Tenant.settings.marketplace, or undefined. */
export function getMarketplaceMeta(settings?: Record<string, unknown>): MarketplaceMeta | undefined {
  return settings?.marketplace as MarketplaceMeta | undefined
}

/** Client-side search: returns true if the tenant matches the query string. */
export function matchesSearch(
  tenantName: string,
  meta: MarketplaceMeta,
  businessTypes: string[],
  query: string,
): boolean {
  if (!query.trim()) return true
  const q = query.toLowerCase()
  return (
    tenantName.toLowerCase().includes(q) ||
    meta.city.toLowerCase().includes(q) ||
    meta.description.toLowerCase().includes(q) ||
    meta.cuisines.some((c) => c.toLowerCase().includes(q)) ||
    meta.tags.some((t) => t.toLowerCase().includes(q)) ||
    businessTypes.some((bt) => BUSINESS_TYPE_LABELS[bt]?.toLowerCase().includes(q))
  )
}

/** Returns true if the tenant has at least one of the given business types. */
export function matchesCategory(businessTypes: string[], category: string): boolean {
  if (!category) return true
  return businessTypes.includes(category)
}
