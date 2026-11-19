/**
 * Public marketplace display types.
 *
 * Tenant.settings.marketplace holds only tenant listing metadata
 * (`TenantMarketplaceSettings`). Branch-owned fields (city, contact,
 * cover, description, cuisines, amenities, hours) come from Branch APIs.
 * Computed fields (openNow, branchCount, primaryBranchSlug) come from
 * the Discover/public projection or a local presentation compose step.
 */

import type { Branch, BranchCheckout, BranchBusinessHours, BranchServiceArea } from '@/types/branch'
import { resolveBranchHoursStatus } from '@/lib/branch-hours'
import { normalizeSearchText } from '@/lib/search-normalize'

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
  /** Public email for this location. */
  email?: string
  /** Short description of this location (branch-owned). */
  description?: string
  /** Whether the branch is open right now. */
  openNow: boolean
  /** Today's opening hours string, e.g. "10:00–23:00" or "Closed today". */
  todayHours?: string
  /** Branch logo (`Branch.image`). */
  logo?: string
  /** Branch page cover and branch page avatar (`Branch.coverImage`). */
  coverImage?: string
  /** Branch homepage hero (`Branch.heroImage`). */
  heroImage?: string
  /** Checkout configuration — preserved for storefront/checkout flows. */
  checkout?: BranchCheckout
  /** Branch operating hours from backend businessHours. */
  businessHours?: BranchBusinessHours[]
  currency?: string
  marketplaceVisible?: boolean
  reservationsEnabled?: boolean
  maxCapacity?: number
  /** Cuisine / specialty labels for this location (branch-owned). */
  cuisines?: string[]
  /** Amenity labels for this location (branch-owned). */
  amenities?: string[]
  /** Phase L3 — branch map pin (WGS84). Absent when the owner never placed it. */
  latitude?: number
  longitude?: number
  /** Phase L1 — custom service area (absent = fallback chain in src/lib/geo.ts). */
  serviceArea?: BranchServiceArea | null
  /** Phase L2 — when the owner confirmed the pin; null = unverified. */
  locationVerifiedAt?: string | null
  /** Phase L3 — menu item names for "pizza near me" item search. */
  menuItemNames?: string[]
  /** Phase L3 — menu category names for item search. */
  menuCategoryNames?: string[]
}

/** Persisted Tenant.settings.marketplace — tenant listing metadata only. */
export interface TenantMarketplaceSettings {
  tagline?: string
  featured?: boolean
  popular?: boolean
  isNew?: boolean
  priceLevel?: 1 | 2 | 3 | 4
  tags?: string[]
  gallery?: Array<string | { asset_id?: string; src?: string }>
  rating?: number
  reviewCount?: number
  story?: string
  website?: string
  socialLinks?: {
    instagram?: string
    twitter?: string
    facebook?: string
    youtube?: string
  }
  heroImage?: string
}

/**
 * Presentation shape for marketplace cards and tenant homepage.
 * Listing fields come from Tenant.settings.marketplace.
 * city / description / contact / branches come from Branch (or compose).
 * Tenant visual assets (logo, discover avatar/cover, hero) are never composed from Branch.
 * openNow / branchCount / primaryBranchSlug are computed or API-provided.
 */
export interface MarketplaceMeta extends TenantMarketplaceSettings {
  description?: string
  city?: string
  branchCount?: number
  openNow?: boolean
  primaryBranchSlug?: string
  branches?: PublicBranchInfo[]
  phone_number?: string
  email?: string
}

export const TENANT_MARKETPLACE_KEYS = [
  'tagline',
  'featured',
  'popular',
  'isNew',
  'priceLevel',
  'tags',
  'gallery',
  'rating',
  'reviewCount',
  'story',
  'website',
  'socialLinks',
  'heroImage',
] as const

function galleryItemSrc(item: unknown): string {
  if (typeof item === 'string') {
    if (item.startsWith('blob:') || item.startsWith('data:')) return ''
    return item
  }
  if (item && typeof item === 'object' && 'src' in item && typeof (item as { src?: unknown }).src === 'string') {
    const src = (item as { src: string }).src
    if (src.startsWith('blob:') || src.startsWith('data:')) return ''
    return src
  }
  return ''
}

export function gallerySrcList(items?: TenantMarketplaceSettings['gallery']): string[] {
  return (items ?? []).map(galleryItemSrc).filter(Boolean)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** One-way: keep only tenant-owned listing keys from a marketplace bag. */
export function pickTenantMarketplace(raw?: unknown): TenantMarketplaceSettings | undefined {
  if (!isPlainObject(raw)) return undefined
  const listing: TenantMarketplaceSettings = {}

  if (typeof raw.tagline === 'string') listing.tagline = raw.tagline
  if (typeof raw.featured === 'boolean') listing.featured = raw.featured
  if (typeof raw.popular === 'boolean') listing.popular = raw.popular
  if (typeof raw.isNew === 'boolean') listing.isNew = raw.isNew
  if (raw.priceLevel === 1 || raw.priceLevel === 2 || raw.priceLevel === 3 || raw.priceLevel === 4) {
    listing.priceLevel = raw.priceLevel
  }
  if (Array.isArray(raw.tags)) listing.tags = raw.tags.filter((t): t is string => typeof t === 'string')
  if (Array.isArray(raw.gallery)) {
    listing.gallery = raw.gallery
      .map((item) => {
        if (typeof item === 'string') return galleryItemSrc(item) ? item : null
        if (item && typeof item === 'object') {
          const rec = item as { asset_id?: unknown; src?: unknown; assetId?: unknown }
          const src = typeof rec.src === 'string' ? galleryItemSrc(rec.src) : ''
          const assetId = typeof rec.asset_id === 'string' ? rec.asset_id : typeof rec.assetId === 'string' ? rec.assetId : undefined
          if (assetId || src) return { asset_id: assetId, src: src || undefined }
        }
        return null
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
  }
  if (typeof raw.rating === 'number') listing.rating = raw.rating
  if (typeof raw.reviewCount === 'number') listing.reviewCount = raw.reviewCount
  if (typeof raw.story === 'string') listing.story = raw.story
  if (typeof raw.website === 'string') listing.website = raw.website
  if (typeof raw.heroImage === 'string') listing.heroImage = raw.heroImage

  if (isPlainObject(raw.socialLinks)) {
    const social: NonNullable<TenantMarketplaceSettings['socialLinks']> = {}
    if (typeof raw.socialLinks.instagram === 'string') social.instagram = raw.socialLinks.instagram
    if (typeof raw.socialLinks.twitter === 'string') social.twitter = raw.socialLinks.twitter
    if (typeof raw.socialLinks.facebook === 'string') social.facebook = raw.socialLinks.facebook
    if (typeof raw.socialLinks.youtube === 'string') social.youtube = raw.socialLinks.youtube
    if (Object.keys(social).length > 0) listing.socialLinks = social
  }

  return Object.keys(listing).length > 0 ? listing : undefined
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
  beauty_salon: 'Beauty Salon',
  clinic:      'Clinic',
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
  /** Phase L3 — nearest first (needs the customer's location; ranked in Discover). */
  | 'nearest'

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
  return countAdvancedFilters(f) + (f.openNow ? 1 : 0)
}

/** Advanced-drawer filters only — excludes standalone Open now. */
export function countAdvancedFilters(f: FilterState): number {
  return (
    f.cuisines.length +
    f.cities.length +
    f.priceLevels.length +
    f.services.length +
    f.amenities.length
  )
}

export function hasActiveFilters(f: FilterState): boolean {
  return countActiveFilters(f) > 0
}

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Tenant listing metadata from Tenant.settings.marketplace.
 * Does not return Branch-owned or computed fields even if a stale payload still contains them.
 */
export function getMarketplaceMeta(
  settings?: { marketplace?: TenantMarketplaceSettings | MarketplaceMeta },
): MarketplaceMeta | undefined {
  return pickTenantMarketplace(settings?.marketplace)
}

/** Maps a canonical branch detail response into the public display shape. */
export function publicBranchFromDetail(branch: Branch): PublicBranchInfo {
  const hoursStatus = branch.businessHours?.length
    ? resolveBranchHoursStatus(branch.businessHours)
    : null

  return {
    id: branch.id,
    slug: branch.slug,
    name: branch.name,
    address: branch.location.address,
    city: branch.location.city,
    phone_number: branch.contact.phone_number,
    email: branch.contact.email,
    description: branch.description,
    openNow: hoursStatus?.openNow ?? false,
    todayHours: hoursStatus?.todayHours,
    logo: branch.image,
    coverImage: branch.coverImage ?? (branch as Branch & { cover_image?: string }).cover_image,
    heroImage: branch.heroImage ?? (branch as Branch & { hero_image?: string }).hero_image,
    checkout: branch.checkout,
    businessHours: branch.businessHours,
    currency: branch.currency,
    marketplaceVisible: branch.marketplaceVisible,
    reservationsEnabled: branch.reservationsEnabled,
    maxCapacity: branch.maxCapacity,
    cuisines: branch.cuisines,
    amenities: branch.amenities,
    latitude: branch.location.latitude,
    longitude: branch.location.longitude,
    serviceArea: branch.serviceArea,
    locationVerifiedAt: branch.locationVerifiedAt,
  }
}

/**
 * Compose public marketplace presentation from tenant listing + branches + contact fallback.
 * Computed values prefer an API projection when provided.
 */
export function composeMarketplacePresentation(input: {
  listing?: TenantMarketplaceSettings
  branches: PublicBranchInfo[]
  tenantContact?: { contactEmail?: string; contactPhone?: string }
  computed?: { openNow?: boolean; branchCount?: number; primaryBranchSlug?: string }
}): MarketplaceMeta {
  const branches = input.branches.filter((b) => b.marketplaceVisible !== false)
  const listing = pickTenantMarketplace(input.listing) ?? {}
  const primarySlug = input.computed?.primaryBranchSlug ?? branches[0]?.slug
  const primary = branches.find((b) => b.slug === primarySlug) ?? branches[0]
  const openNow =
    input.computed?.openNow !== undefined
      ? input.computed.openNow
      : branches.length > 0
        ? branches.some((b) => b.openNow)
        : undefined

  return {
    ...listing,
    branches,
    city: primary?.city,
    description: primary?.description,
    phone_number: primary?.phone_number || input.tenantContact?.contactPhone,
    email: primary?.email || input.tenantContact?.contactEmail,
    branchCount: input.computed?.branchCount ?? branches.length,
    openNow,
    primaryBranchSlug: primarySlug,
  }
}

/** Union of cuisine labels across public branch summaries. */
export function collectBranchCuisines(branches?: PublicBranchInfo[]): string[] {
  const seen = new Set<string>()
  for (const b of branches ?? []) {
    for (const c of b.cuisines ?? []) seen.add(c)
  }
  return Array.from(seen)
}

/** Union of amenity labels across public branch summaries. */
export function collectBranchAmenities(branches?: PublicBranchInfo[]): string[] {
  const seen = new Set<string>()
  for (const b of branches ?? []) {
    for (const a of b.amenities ?? []) seen.add(a)
  }
  return Array.from(seen)
}

/** Accent-strip + lowercase for accent-insensitive matching. */
function normalize(s: string): string {
  // Phase L3 — also folds Arabic/Persian letter variants, ZWNJ and digits.
  return normalizeSearchText(s)
}

/**
 * Client-side search: returns true if the tenant matches the query string.
 * Searches name, city, description, tagline, tags, business type labels,
 * branch names, and branch-owned cuisines/amenities (case + accent insensitive).
 */
export function matchesSearch(
  tenantName: string,
  meta: MarketplaceMeta,
  businessTypes: string[],
  query: string,
): boolean {
  if (!query.trim()) return true
  const q = normalize(query)
  const branches = meta.branches ?? []
  return (
    normalize(tenantName).includes(q) ||
    normalize(meta.city ?? '').includes(q) ||
    normalize(meta.description ?? '').includes(q) ||
    (meta.tagline ? normalize(meta.tagline).includes(q) : false) ||
    (meta.tags ?? []).some((t) => normalize(t).includes(q)) ||
    collectBranchCuisines(branches).some((c) => normalize(c).includes(q)) ||
    collectBranchAmenities(branches).some((a) => normalize(a).includes(q)) ||
    businessTypes.some((bt) => {
      const label = BUSINESS_TYPE_LABELS[bt]
      return label ? normalize(label).includes(q) : false
    }) ||
    branches.some((b) => normalize(b.name).includes(q))
  )
}

/** Returns true if the tenant has at least one of the given business types. */
export function matchesCategory(businessTypes: string[], category: string): boolean {
  if (!category) return true
  return businessTypes.includes(category)
}

/**
 * Apply advanced filters to a tenant.
 * Cuisine/amenity filters operate on branch-owned values only.
 * featureFlags is Tenant.settings.featureFlags cast to Record<string, boolean>.
 */
export function matchesFilters(
  meta: MarketplaceMeta,
  featureFlags: Record<string, boolean | undefined>,
  filters: FilterState,
): boolean {
  const branchCuisines = collectBranchCuisines(meta.branches)
  const branchAmenities = collectBranchAmenities(meta.branches)

  if (filters.cuisines.length > 0 && !filters.cuisines.some((c) => branchCuisines.includes(c))) return false
  if (filters.cities.length > 0 && !filters.cities.includes(meta.city ?? '')) return false
  if (filters.priceLevels.length > 0 && (!meta.priceLevel || !filters.priceLevels.includes(meta.priceLevel))) return false
  if (filters.openNow && !meta.openNow) return false
  if (filters.amenities.length > 0 && !filters.amenities.every((a) => branchAmenities.includes(a))) return false
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
