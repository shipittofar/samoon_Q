export type CoordinateInput = unknown

export type MapCoordinates = {
  lat: number
  lng: number
}

/** Parse a single lat/lng value. Invalid, empty, and non-finite values become null — never 0. */
export function toCoordinateNumber(value: CoordinateInput): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Both coordinates must be finite numbers; otherwise null. */
export function parseMapCoordinates(
  latitude: CoordinateInput,
  longitude: CoordinateInput,
): MapCoordinates | null {
  const lat = toCoordinateNumber(latitude)
  const lng = toCoordinateNumber(longitude)
  if (lat == null || lng == null) return null
  return { lat, lng }
}
