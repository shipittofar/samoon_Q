/**
 * P8.7.7.1 — Public Marketplace Discovery Layer
 *
 * MarketplaceMeta is stored in Tenant.settings.marketplace and contains
 * display-only fields curated for the public /discover page.
 * These fields are never security-sensitive — they are what a business
 * owner explicitly chooses to show to the public.
 */

import type { Branch } from '@/types/branch'

/** Public-facing branch summary shown on the tenant homepage. */
export interface PublicBranchInfo {
  /** Canonical branch id from the backend (used for API calls). */
  id: string
  /** Branch route slug, used in /{tenantSlug}/{branchSlug} URLs. */
  slug: string
  /** Display name of the branch. */
  name: string
  /** Street address. */
  address: string
  /** City. */
  city: string
  /** Public phone_number number. */
  phone_number?: string
  /** Whether the branch is open right now. */
  openNow: boolean
  /** Today's opening hours string, e.g. "10:00–23:00" or "Closed today". */
  todayHours?: string
  /** Optional branch cover/thumbnail image URL. */
  image?: string
}

export interface MarketplaceMeta {
  /**
   * Phase Z.6.2 — every field below is optional: the backend contract
   * guarantees `settings.marketplace` may be present or absent as a
   * whole (see Tenant.settings on `TenantSettings`), but does not
   * guarantee every sub-field is populated the moment marketplace exists
   * (e.g. a newly onboarded tenant with zero reviews yet, or one that
   * hasn't set a cover image). Every consumer of this type must degrade
   * gracefully — see BusinessCard.tsx / DiscoverClientPage.tsx for the
   * fallback conventions (0 for numbers, [] for arrays, hidden UI
   * sections for absent optional content).
   */
  /** Short pitch shown on the business card (max ~120 chars). */
  description?: string
  /** URL of the cover/hero image for the card. */
  coverImage?: string
  /** Cuisine types or beverage styles (e.g. "Mediterranean", "Coffee"). */
  cuisines?: string[]
  /** Discovery tags (e.g. "Date Night", "Pet Friendly"). */
  tags?: string[]
  /** Average star rating (0–5, two decimal places). */
  rating?: number
  /** Number of reviews that contributed to the rating. */
  reviewCount?: number
  /** City where the business (or its primary branch) is located. */
  city?: string
  /** Total number of active branches. */
  branchCount?: number
  /** Whether the business is currently open. */
  openNow?: boolean
  /** Slug of the primary/default branch (used to build preview links). */
  primaryBranchSlug?: string
  /** Pin this business in the "Featured" section. */
  featured?: boolean
  /** Pin this business in the "Popular" section. */
  popular?: boolean
  /** Mark as newly onboarded in the "New" section. */
  isNew?: boolean
  /** Public branch summaries for display on the tenant homepage. */
  branches?: PublicBranchInfo[]
  /** Tagline displayed below the business name on the tenant homepage. */
  tagline?: string
  /** Price level indicator: 1 = $, 2 = $$, 3 = $$$, 4 = $$$$ */
  priceLevel?: 1 | 2 | 3 | 4
  /** Public contact phone_number. */
  phone_number?: string
  /** Public contact email. */
  email?: string
  /** Public website URL. */
  website?: string
  /** Gallery image URLs (in addition to coverImage). */
  gallery?: string[]
  /** Long-form about / story text shown on the public About page. */
  story?: string
  /** Amenities the business offers (e.g. "WiFi", "Parking", "Outdoor Seating"). */
  amenities?: string[]
  /** Public social media profile URLs. */
  socialLinks?: {
    instagram?: string
    twitter?: string
    facebook?: string
    youtube?: string
  }
  /** Hero / banner image URL (used on the full-page tenant hero; falls back to coverImage). */
  heroImage?: string
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

export const PRICE_LEVEL_LABELS: Record<number, string> = {
  1: '$ · Budget',
  2: '$$ · Moderate',
  3: '$$$ · Upscale',
  4: '$$$$ · Fine Dining',
}

// ── Sort & Filter types ───────────────────────────────────────────────────────

export type SortOption =
  | 'recommended'
  | 'highest_rated'
  | 'most_reviewed'
  | 'newest'
  | 'alphabetical'
  | 'price_asc'
  | 'open_now'

export interface FilterState {
  cuisines: string[]
  cities: string[]
  priceLevels: number[]
  openNow: boolean
  /** Feature flag keys: 'reservations.enabled', 'loyalty.enabled' */
  services: string[]
  amenities: string[]
}

export const DEFAULT_FILTERS: FilterState = {
  cuisines: [],
  cities: [],
  priceLevels: [],
  openNow: false,
  services: [],
  amenities: [],
}

export function countActiveFilters(f: FilterState): number {
  return (
    f.cuisines.length +
    f.cities.length +
    f.priceLevels.length +
    (f.openNow ? 1 : 0) +
    f.services.length +
    f.amenities.length
  )
}

export function hasActiveFilters(f: FilterState): boolean {
  return countActiveFilters(f) > 0
}

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the MarketplaceMeta stored in Tenant.settings.marketplace, or
 * undefined. Phase Z.6.2 — no longer a cast: `settings.marketplace` is
 * typed directly (src/types/index.ts's TenantSettings), since
 * `getMarketplaceMeta()`'s only real job left is the `undefined`
 * shorthand for "no settings object at all."
 */
export function getMarketplaceMeta(settings?: { marketplace?: MarketplaceMeta; [key: string]: unknown }): MarketplaceMeta | undefined {
  return settings?.marketplace
}

/** Maps a canonical branch detail response into the public display shape. */
export function publicBranchFromDetail(
  branch: Branch,
  marketplace?: PublicBranchInfo,
): PublicBranchInfo {
  return {
    id: branch.id,
    slug: branch.slug,
    name: branch.name,
    address: branch.location.address,
    city: branch.location.city,
    phone_number: branch.contact.phone_number ?? marketplace?.phone_number,
    openNow: marketplace?.openNow ?? branch.status === 'active',
    todayHours: marketplace?.todayHours,
    image: branch.image ?? branch.coverImage ?? marketplace?.image,
  }
}

/** Accent-strip + lowercase for accent-insensitive matching. */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

/**
 * Client-side search: returns true if the tenant matches the query string.
 * Searches name, city, description, tagline, cuisines, tags, amenities,
 * business type labels, and branch names (case + accent insensitive).
 */
export function matchesSearch(
  tenantName: string,
  meta: MarketplaceMeta,
  businessTypes: string[],
  query: string,
): boolean {
  if (!query.trim()) return true
  const q = normalize(query)
  return (
    normalize(tenantName).includes(q) ||
    normalize(meta.city ?? '').includes(q) ||
    normalize(meta.description ?? '').includes(q) ||
    (meta.tagline ? normalize(meta.tagline).includes(q) : false) ||
    (meta.cuisines ?? []).some((c) => normalize(c).includes(q)) ||
    (meta.tags ?? []).some((t) => normalize(t).includes(q)) ||
    (meta.amenities ?? []).some((a) => normalize(a).includes(q)) ||
    businessTypes.some((bt) => {
      const label = BUSINESS_TYPE_LABELS[bt]
      return label ? normalize(label).includes(q) : false
    }) ||
    (meta.branches ?? []).some((b) => normalize(b.name).includes(q))
  )
}

/** Returns true if the tenant has at least one of the given business types. */
export function matchesCategory(businessTypes: string[], category: string): boolean {
  if (!category) return true
  return businessTypes.includes(category)
}

/**
 * Apply advanced filters to a tenant.
 * featureFlags is Tenant.settings.featureFlags cast to Record<string, boolean>.
 */
export function matchesFilters(
  meta: MarketplaceMeta,
  featureFlags: Record<string, boolean | undefined>,
  filters: FilterState,
): boolean {
  if (filters.cuisines.length > 0 && !filters.cuisines.some((c) => (meta.cuisines ?? []).includes(c))) return false
  if (filters.cities.length > 0 && !filters.cities.includes(meta.city ?? '')) return false
  if (filters.priceLevels.length > 0 && (!meta.priceLevel || !filters.priceLevels.includes(meta.priceLevel))) return false
  if (filters.openNow && !meta.openNow) return false
  if (filters.amenities.length > 0 && !filters.amenities.every((a) => (meta.amenities ?? []).includes(a))) return false
  if (filters.services.length > 0) {
    const hasAll = filters.services.every((svc) => {
      if (svc === 'loyalty.enabled') {
        return Object.entries(featureFlags).some(([k, v]) => k.includes('loyalty') && v === true)
      }
      return featureFlags[svc] === true
    })
    if (!hasAll) return false
  }
  return true
}

/**
 * Sort a TenantWithMeta array by the given SortOption.
 * Uses duck typing to avoid importing the Tenant type (circular-dep safe).
 */
export function sortItems<T extends { tenant: { name: string; created_at: string }; meta: MarketplaceMeta }>(
  items: T[],
  sortBy: SortOption,
): T[] {
  const copy = [...items]
  switch (sortBy) {
    case 'highest_rated':
      return copy.sort((a, b) => (b.meta.rating ?? 0) - (a.meta.rating ?? 0))
    case 'most_reviewed':
      return copy.sort((a, b) => (b.meta.reviewCount ?? 0) - (a.meta.reviewCount ?? 0))
    case 'newest':
      return copy.sort((a, b) => new Date(b.tenant.created_at).getTime() - new Date(a.tenant.created_at).getTime())
    case 'alphabetical':
      return copy.sort((a, b) => a.tenant.name.localeCompare(b.tenant.name))
    case 'price_asc':
      return copy.sort((a, b) => (a.meta.priceLevel ?? 0) - (b.meta.priceLevel ?? 0))
    case 'open_now':
      return copy.sort((a, b) => (b.meta.openNow ? 1 : 0) - (a.meta.openNow ? 1 : 0))
    default:
      // recommended: featured first, then popular, then rest
      return copy.sort((a, b) => {
        const aScore = (a.meta.featured ? 2 : 0) + (a.meta.popular ? 1 : 0)
        const bScore = (b.meta.featured ? 2 : 0) + (b.meta.popular ? 1 : 0)
        return bScore - aScore
      })
  }
}
