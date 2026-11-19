/**
 * Customer location — Phase L2 (docs/BUSINESS_SERVICES_ROADMAP.md).
 *
 * Pure decision logic for live device positions. Nearby results are only as
 * good as the position they start from, so every GPS fix is judged before it
 * is used:
 *   - poor accuracy (worse than maps.min_location_accuracy_m) → ask the user
 *     to confirm on the map instead of silently using it;
 *   - an implausible jump between fixes (faster than any road vehicle — GPS
 *     jamming/spoofing, Wi-Fi geolocation glitches) → ask to confirm;
 *   - tiny movements (< MIN_MOVE_M) → ignore, so results don't re-rank and the
 *     battery isn't spent on noise;
 *   - a location the user chose by hand always wins over GPS until they
 *     explicitly switch back to "use my location".
 */
import type { GeoPoint } from '@/types/branch'
import { distanceKm, isValidGeoPoint } from '@/lib/geo'

export type LocationSource = 'gps' | 'manual' | 'address' | 'ip' | 'default'

export interface LocationFix {
  point: GeoPoint
  /** Device-reported 95% radius in metres; null when unknown. */
  accuracyM: number | null
  /** Epoch ms when the fix was taken. */
  timestamp: number
}

export interface UserLocation extends LocationFix {
  source: LocationSource
  /** The user confirmed this exact point on the map (manual or after a prompt). */
  confirmed: boolean
  city?: string
  area?: string
}

/** Ignore movements smaller than this (metres). */
export const MIN_MOVE_M = 200
/** Faster than this between two fixes is not a real movement (m/s ≈ 250 km/h). */
export const MAX_PLAUSIBLE_SPEED_MPS = 70
/** Jumps shorter than this are never treated as implausible (GPS settling). */
const MIN_JUMP_CHECK_M = 1000

export type FixDecision =
  | { action: 'update'; distanceM: number | null }
  | { action: 'ignore'; reason: 'invalid' | 'small_move' | 'manual_preferred'; distanceM: number | null }
  | { action: 'confirm'; reason: 'low_accuracy' | 'implausible_jump'; distanceM: number | null }

export function evaluateFix(
  previous: UserLocation | null,
  fix: LocationFix,
  options: { minAccuracyM: number },
): FixDecision {
  if (!isValidGeoPoint(fix.point)) return { action: 'ignore', reason: 'invalid', distanceM: null }

  const distanceM = previous ? distanceKm(previous.point, fix.point) * 1000 : null

  // A hand-picked location stays until the user asks for the device again.
  if (previous?.source === 'manual') return { action: 'ignore', reason: 'manual_preferred', distanceM }

  const accuracyOk = fix.accuracyM !== null && fix.accuracyM <= options.minAccuracyM
  if (!accuracyOk) {
    // Already showing a good GPS fix nearby? Keep it rather than nag.
    if (previous?.source === 'gps' && distanceM !== null && distanceM < MIN_MOVE_M) {
      return { action: 'ignore', reason: 'small_move', distanceM }
    }
    return { action: 'confirm', reason: 'low_accuracy', distanceM }
  }

  if (previous?.source === 'gps' && distanceM !== null) {
    const seconds = (fix.timestamp - previous.timestamp) / 1000
    if (distanceM > MIN_JUMP_CHECK_M && seconds > 0 && distanceM / seconds > MAX_PLAUSIBLE_SPEED_MPS) {
      return { action: 'confirm', reason: 'implausible_jump', distanceM }
    }
    const accuracyImproved =
      previous.accuracyM !== null && fix.accuracyM !== null && fix.accuracyM < previous.accuracyM / 2
    if (distanceM < MIN_MOVE_M && !accuracyImproved) {
      return { action: 'ignore', reason: 'small_move', distanceM }
    }
  }

  return { action: 'update', distanceM }
}

/**
 * The location to use when there is no live fix, in priority order:
 * a confirmed manual choice → the customer's default saved address →
 * the platform default centre. (`ip` is reserved for a backend lookup.)
 */
export function resolveFallbackLocation(input: {
  manual?: UserLocation | null
  defaultAddress?: { latitude?: number | null; longitude?: number | null; city?: string | null } | null
  platformCenter: GeoPoint
  now?: number
}): UserLocation {
  const now = input.now ?? Date.now()
  if (input.manual && isValidGeoPoint(input.manual.point)) return input.manual
  const a = input.defaultAddress
  const addressPoint = a ? { lat: Number(a.latitude), lng: Number(a.longitude) } : null
  if (addressPoint && isValidGeoPoint(addressPoint)) {
    return {
      point: addressPoint, accuracyM: null, timestamp: now, source: 'address', confirmed: true,
      ...(a?.city ? { city: a.city } : {}),
    }
  }
  return { point: input.platformCenter, accuracyM: null, timestamp: now, source: 'default', confirmed: false }
}

/** ~110 m precision — what we keep for analytics; never the raw position. */
export function roundForAnalytics(point: GeoPoint, decimals = 3): GeoPoint {
  const f = 10 ** decimals
  return { lat: Math.round(point.lat * f) / f, lng: Math.round(point.lng * f) / f }
}

/** Human-friendly accuracy: "±30 m" / "±1.2 km" style value + unit key. */
export function describeAccuracy(accuracyM: number | null): { value: number; unit: 'm' | 'km' } | null {
  if (accuracyM === null || !Number.isFinite(accuracyM)) return null
  return accuracyM < 1000
    ? { value: Math.max(1, Math.round(accuracyM / 5) * 5), unit: 'm' }
    : { value: Math.round(accuracyM / 100) / 10, unit: 'km' }
}
