/**
 * Geo helpers — Phase L1 (docs/BUSINESS_SERVICES_ROADMAP.md).
 *
 * Pure functions, no map SDK: distances, point-in-shape, and the single
 * place that decides a branch's effective service area. Straight-line
 * distance is used for fast filtering; real travel time (routing) comes
 * from the map provider in L3/L4 and only for the top candidates.
 */
import type {
  Branch,
  BranchServiceArea,
  GeoPoint,
  ServiceAreaZone,
} from '@/types/branch'
import { DEFAULT_VERTICAL, type VerticalDefinition } from '@/verticals'

const EARTH_RADIUS_KM = 6371.0088

const toRad = (deg: number) => (deg * Math.PI) / 180

export function isValidGeoPoint(p: Partial<GeoPoint> | null | undefined): p is GeoPoint {
  return (
    !!p &&
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180 &&
    // (0, 0) is "Null Island" — in practice an unset coordinate, never a real branch.
    !(p.lat === 0 && p.lng === 0)
  )
}

/** Great-circle (haversine) distance in kilometres. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Ray-casting point-in-polygon. Fine for city-scale polygons (the
 * equirectangular approximation error is negligible below ~100 km).
 */
export function isPointInPolygon(point: GeoPoint, polygon: readonly GeoPoint[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!
    const b = polygon[j]!
    const crosses =
      a.lat > point.lat !== b.lat > point.lat &&
      point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng
    if (crosses) inside = !inside
  }
  return inside
}

export function branchPoint(branch: Pick<Branch, 'location'>): GeoPoint | null {
  const p = { lat: Number(branch.location?.latitude), lng: Number(branch.location?.longitude) }
  return isValidGeoPoint(p) ? p : null
}

export interface ServiceAreaOptions {
  /** Platform cap (maps.max_service_radius_km); radii above it are clamped. */
  maxRadiusKm?: number
}

/**
 * The effective service area of a branch, in priority order:
 *   1. the branch's own `serviceArea`
 *   2. a delivery area from its checkout config (delivery enabled + radius)
 *   3. the vertical's default (e.g. salon: visit-only, 5 km)
 * Circle radii are clamped to `maxRadiusKm` when given.
 */
export function resolveBranchServiceArea(
  branch: Pick<Branch, 'serviceArea' | 'checkout'>,
  vertical: VerticalDefinition = DEFAULT_VERTICAL,
  options: ServiceAreaOptions = {},
): BranchServiceArea {
  const clamp = (km: number) =>
    options.maxRadiusKm && options.maxRadiusKm > 0 ? Math.min(km, options.maxRadiusKm) : km

  const own = branch.serviceArea
  if (own) {
    return own.shape.type === 'circle'
      ? { ...own, shape: { type: 'circle', radiusKm: clamp(own.shape.radiusKm) } }
      : own
  }

  const delivery = branch.checkout?.delivery
  const deliveryRadius = typeof delivery?.radius === 'number' && delivery.radius > 0 ? delivery.radius : null
  if (deliveryRadius && branch.checkout?.orderTypes?.delivery) {
    return { mode: 'delivery', shape: { type: 'circle', radiusKm: clamp(deliveryRadius) } }
  }

  const fallback = vertical.defaultServiceArea
  return { mode: fallback.mode, shape: { type: 'circle', radiusKm: clamp(fallback.radiusKm) } }
}

/** Whether `user` lies inside `area`, centred on `center` (the branch). */
export function isInServiceArea(area: BranchServiceArea, center: GeoPoint, user: GeoPoint): boolean {
  if (area.shape.type === 'circle') return distanceKm(center, user) <= area.shape.radiusKm
  return isPointInPolygon(user, area.shape.points)
}

/** The zone (fee/ETA band) that applies at `km`, if the area defines zones. */
export function zoneForDistance(area: BranchServiceArea, km: number): ServiceAreaZone | undefined {
  return [...(area.zones ?? [])].sort((a, b) => a.upToKm - b.upToKm).find((z) => km <= z.upToKm)
}

export interface ServiceAreaCheck {
  distanceKm: number
  inside: boolean
  area: BranchServiceArea
  zone?: ServiceAreaZone
}

/**
 * One call for UI and ranking: distance to the branch, whether the user is
 * inside its effective area, and the matching zone. Null when either point
 * is missing/invalid (never pretend a branch is near when we can't tell).
 */
export function checkServiceArea(
  branch: Pick<Branch, 'serviceArea' | 'checkout' | 'location'>,
  user: GeoPoint | null | undefined,
  vertical: VerticalDefinition = DEFAULT_VERTICAL,
  options: ServiceAreaOptions = {},
): ServiceAreaCheck | null {
  const center = branchPoint(branch)
  if (!center || !isValidGeoPoint(user)) return null
  const area = resolveBranchServiceArea(branch, vertical, options)
  const km = distanceKm(center, user)
  return { distanceKm: km, inside: isInServiceArea(area, center, user), area, zone: zoneForDistance(area, km) }
}

/** [south, west, north, east] */
export type GeoBounds = [number, number, number, number]

export function isInBounds(p: GeoPoint, [s, w, n, e]: GeoBounds): boolean {
  return p.lat >= s && p.lat <= n && (w <= e ? p.lng >= w && p.lng <= e : p.lng >= w || p.lng <= e)
}

/** Bounding box [south, west, north, east] covering a circle — for map fitting and bbox queries. */
export function circleBounds(center: GeoPoint, radiusKm: number): [number, number, number, number] {
  const dLat = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI)
  const dLng = dLat / Math.max(Math.cos(toRad(center.lat)), 1e-6)
  return [center.lat - dLat, center.lng - dLng, center.lat + dLat, center.lng + dLng]
}
