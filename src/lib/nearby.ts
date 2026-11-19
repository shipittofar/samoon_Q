/**
 * Nearby engine — Phase L3.
 *
 * Given the customer's location, works out for every business which of its
 * branches is nearest, whether that branch serves the customer (inside its
 * service area), the travel estimate, and — for item search ("pizza") —
 * which menu items matched. Then ranks businesses for a "near me" list.
 *
 * Pure and synchronous: runs on the already-loaded Discover payload. The
 * backend `GET /public/discover/nearby/` (L3 contract) does the same with
 * PostGIS when the catalogue outgrows the client.
 */
import type { GeoPoint, ServiceAreaMode, ServiceAreaZone } from '@/types/branch'
import type { PublicBranchInfo } from '@/types/marketplace'
import { checkServiceArea, isValidGeoPoint } from '@/lib/geo'
import { resolveVertical } from '@/verticals'
import { expandSearchTerms, normalizeSearchText, textMatchesTerms } from '@/lib/search-normalize'
import { estimateTravelMinutes, suggestTravelMode, type TravelMode } from '@/lib/travel'

export interface BranchProximity {
  branchId: string
  branchSlug: string
  branchName: string
  point: GeoPoint
  distanceKm: number
  /** Customer is inside the branch's effective service area. */
  inside: boolean
  mode: ServiceAreaMode
  radiusKm: number | null
  zone?: ServiceAreaZone
  openNow: boolean
  /** Owner confirmed the pin (L2); false = show an "approximate" hint. */
  verified: boolean
  travelMode: TravelMode
  etaMinutes: number
  /** Menu items (names) that matched the item query, if any. */
  menuMatches: string[]
}

export interface NearbyInput {
  tenant: { id: string; businessTypes?: readonly string[] | null }
  meta: { rating?: number; openNow?: boolean }
  branches: PublicBranchInfo[]
}

export interface NearbyResult<T extends NearbyInput = NearbyInput> {
  item: T
  /** All locatable branches, nearest first. */
  branches: BranchProximity[]
  /** Best branch for this customer: serving + open first, then nearest. */
  best: BranchProximity | null
  /** Any branch matched the item query through its menu. */
  menuMatch: boolean
}

export interface NearbyOptions {
  /** Platform cap — `maps.max_service_radius_km`. */
  maxRadiusKm?: number
  /** Item query (menu items / categories). Empty = no menu matching. */
  itemQuery?: string
  /** Force a travel mode; default picks walk/drive by distance. */
  travelMode?: TravelMode
}

export function menuMatchesFor(branch: PublicBranchInfo, terms: readonly string[]): string[] {
  if (!terms.length) return []
  const items = (branch.menuItemNames ?? []).filter((name) => textMatchesTerms(name, terms))
  if (items.length) return items
  // Category hit ("Pizza" section) without a name hit: report the category.
  return (branch.menuCategoryNames ?? []).filter((name) => textMatchesTerms(name, terms))
}

function proximityFor(
  branch: PublicBranchInfo,
  user: GeoPoint,
  vertical: ReturnType<typeof resolveVertical>,
  terms: readonly string[],
  options: NearbyOptions,
): BranchProximity | null {
  const check = checkServiceArea(
    {
      location: { latitude: branch.latitude, longitude: branch.longitude },
      serviceArea: branch.serviceArea ?? undefined,
      checkout: branch.checkout,
    } as Parameters<typeof checkServiceArea>[0],
    user,
    vertical,
    { maxRadiusKm: options.maxRadiusKm },
  )
  if (!check) return null
  const travelMode = options.travelMode ?? suggestTravelMode(check.distanceKm)
  return {
    branchId: branch.id,
    branchSlug: branch.slug,
    branchName: branch.name,
    point: { lat: Number(branch.latitude), lng: Number(branch.longitude) },
    distanceKm: check.distanceKm,
    inside: check.inside,
    mode: check.area.mode,
    radiusKm: check.area.shape.type === 'circle' ? check.area.shape.radiusKm : null,
    zone: check.zone,
    openNow: branch.openNow,
    verified: Boolean(branch.locationVerifiedAt),
    travelMode,
    etaMinutes: estimateTravelMinutes(check.distanceKm, travelMode),
    menuMatches: menuMatchesFor(branch, terms),
  }
}

/** Serving and open beat merely near; ties go to distance. */
function branchScore(b: BranchProximity, preferMenu: boolean): number {
  return (preferMenu && b.menuMatches.length ? 4 : 0) + (b.inside ? 2 : 0) + (b.openNow ? 1 : 0)
}

export function computeNearby<T extends NearbyInput>(
  items: readonly T[],
  user: GeoPoint | null | undefined,
  options: NearbyOptions = {},
): NearbyResult<T>[] {
  const terms = options.itemQuery ? expandSearchTerms(options.itemQuery) : []
  const located = isValidGeoPoint(user) ? user : null
  return items.map((item) => {
    const vertical = resolveVertical(item.tenant.businessTypes)
    const branches = located
      ? item.branches
          .map((b) => proximityFor(b, located, vertical, terms, options))
          .filter((b): b is BranchProximity => b !== null)
          .sort((a, b) => a.distanceKm - b.distanceKm)
      : []
    const preferMenu = terms.length > 0
    const best = branches.length
      ? [...branches].sort((a, b) => branchScore(b, preferMenu) - branchScore(a, preferMenu) || a.distanceKm - b.distanceKm)[0]
      : null
    const menuMatch = terms.length > 0 && item.branches.some((b) => menuMatchesFor(b, terms).length > 0)
    return { item, branches, best, menuMatch }
  })
}

/**
 * "Near me" order: serving businesses first, then by travel time of the best
 * branch; open-now and rating break near-ties (within ~10%). Businesses
 * without a locatable branch go last, in their original order.
 */
export function rankNearby<T extends NearbyInput>(results: readonly NearbyResult<T>[]): NearbyResult<T>[] {
  return results
    .map((r, index) => ({ r, index }))
    .sort((x, y) => {
      const a = x.r.best
      const b = y.r.best
      if (!a || !b) return a ? -1 : b ? 1 : x.index - y.index
      if (a.inside !== b.inside) return a.inside ? -1 : 1
      const near = Math.abs(a.distanceKm - b.distanceKm) <= Math.max(0.3, 0.1 * Math.min(a.distanceKm, b.distanceKm))
      if (near) {
        if (a.openNow !== b.openNow) return a.openNow ? -1 : 1
        const rating = (y.r.item.meta.rating ?? 0) - (x.r.item.meta.rating ?? 0)
        if (rating) return rating
      }
      return a.distanceKm - b.distanceKm || x.index - y.index
    })
    .map(({ r }) => r)
}

/** Whether a business matches a free-text query through its menus. */
export function matchesMenuQuery(branches: readonly PublicBranchInfo[], query: string): boolean {
  const terms = expandSearchTerms(query)
  return terms.length > 0 && branches.some((b) => menuMatchesFor(b, terms).length > 0)
}

export { normalizeSearchText }
