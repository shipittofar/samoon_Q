/**
 * Travel-time estimates — Phase L3.
 *
 * Straight-line distance × a road detour factor ÷ a typical urban speed.
 * Good enough to rank and label ("~12 min by car"); the routing provider
 * (backend `/geo/travel-matrix/`, see the L3 contract) replaces it for the
 * top candidates when available.
 */

export type TravelMode = 'walk' | 'drive' | 'bike' | 'taxi'

export const TRAVEL_MODES: readonly TravelMode[] = ['drive', 'taxi', 'walk', 'bike']

/** Road distance ≈ straight line × factor (city grids are ~1.3–1.4). */
export const DETOUR_FACTOR = 1.35

/** Average door-to-door speed in km/h, including lights and parking. */
export const TRAVEL_SPEED_KMH: Record<TravelMode, number> = {
  walk: 4.8,
  bike: 13,
  drive: 22,
  // Phase L4 — same roads as driving; the wait for pickup is in the overhead.
  taxi: 22,
}

/** Fixed overhead in minutes (getting going, parking). */
const OVERHEAD_MIN: Record<TravelMode, number> = { walk: 0, bike: 1, drive: 4, taxi: 7 }

/** Walking beyond this is never suggested; the UI switches to driving. */
export const MAX_WALK_KM = 2.5

export function estimateTravelMinutes(straightLineKm: number, mode: TravelMode): number {
  if (!Number.isFinite(straightLineKm) || straightLineKm < 0) return NaN
  const roadKm = straightLineKm * DETOUR_FACTOR
  const minutes = (roadKm / TRAVEL_SPEED_KMH[mode]) * 60 + OVERHEAD_MIN[mode]
  return Math.max(1, Math.round(minutes))
}

/** Walk when it's close, otherwise drive. */
export function suggestTravelMode(straightLineKm: number): TravelMode {
  return straightLineKm <= MAX_WALK_KM ? 'walk' : 'drive'
}

/** "850 m" / "3.2 km" / "12 km" — value + unit for i18n. */
export function formatDistance(km: number): { value: number; unit: 'm' | 'km' } {
  if (km < 1) return { value: Math.max(10, Math.round((km * 1000) / 10) * 10), unit: 'm' }
  if (km < 10) return { value: Math.round(km * 10) / 10, unit: 'km' }
  return { value: Math.round(km), unit: 'km' }
}
