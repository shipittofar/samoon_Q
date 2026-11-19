/**
 * Routing — Phase L4. One call, three sources (platform setting
 * `maps.routing_source`):
 *   - estimate: straight guide line + estimated time (no external call);
 *   - backend:  POST /geo/route/ — the backend proxies the paid provider;
 *   - osrm:     a self-hosted OSRM server (`maps.osrm_url`).
 * Any failure falls back to the estimate, flagged so the UI can say so.
 */
import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import type { GeoPoint } from '@/types/branch'
import { distanceKm, isValidGeoPoint } from '@/lib/geo'
import { DETOUR_FACTOR, estimateTravelMinutes, type TravelMode } from '@/lib/travel'
import { readMapsSettings, type MapsSettings } from '@/lib/maps/config'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

export type RouteSource = 'estimate' | 'backend' | 'osrm'

export interface RouteResult {
  points: GeoPoint[]
  distanceM: number
  durationSec: number
  source: RouteSource
  /** True when the configured source failed and this is the estimate. */
  fallback: boolean
}

/** Wire format of POST /geo/route/ (see the L4 contract). */
interface BackendRouteResponse {
  distanceM: number
  durationSec: number
  /** GeoJSON order: [lng, lat]. */
  geometry: [number, number][]
}

const OSRM_PROFILE: Record<TravelMode, string> = { drive: 'driving', taxi: 'driving', walk: 'foot', bike: 'cycling' }
/** Waiting for a taxi isn't part of the road time. */
const TAXI_PICKUP_SEC = 5 * 60

export function estimateRoute(origin: GeoPoint, destination: GeoPoint, mode: TravelMode, fallback = false): RouteResult {
  const km = distanceKm(origin, destination)
  return {
    points: [origin, destination],
    distanceM: Math.round(km * DETOUR_FACTOR * 1000),
    durationSec: estimateTravelMinutes(km, mode) * 60,
    source: 'estimate',
    fallback,
  }
}

function fromGeometry(geometry: [number, number][]): GeoPoint[] {
  return geometry.map(([lng, lat]) => ({ lat, lng })).filter(isValidGeoPoint)
}

async function osrmRoute(base: string, origin: GeoPoint, destination: GeoPoint, mode: TravelMode, signal?: AbortSignal): Promise<RouteResult> {
  if (!/^https:\/\//i.test(base)) throw new Error('OSRM URL must be https')
  const url = `${base.replace(/\/+$/, '')}/route/v1/${OSRM_PROFILE[mode]}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`OSRM ${res.status}`)
  const body = (await res.json()) as { code?: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] }
  const route = body.routes?.[0]
  if (body.code !== 'Ok' || !route) throw new Error(`OSRM ${body.code ?? 'no route'}`)
  return {
    points: fromGeometry(route.geometry.coordinates),
    distanceM: Math.round(route.distance),
    durationSec: Math.round(route.duration) + (mode === 'taxi' ? TAXI_PICKUP_SEC : 0),
    source: 'osrm',
    fallback: false,
  }
}

export const routingService = {
  async getRoute(
    origin: GeoPoint,
    destination: GeoPoint,
    mode: TravelMode,
    options: { signal?: AbortSignal; settings?: Pick<MapsSettings, 'routingSource' | 'osrmUrl'> } = {},
  ): Promise<RouteResult> {
    if (!isValidGeoPoint(origin) || !isValidGeoPoint(destination)) throw new Error('Invalid route endpoints')
    const settings = options.settings ?? readMapsSettings()
    const source = USE_MOCK && settings.routingSource === 'backend' ? 'estimate' : settings.routingSource
    if (source === 'estimate') return estimateRoute(origin, destination, mode)
    try {
      if (source === 'osrm') {
        if (!settings.osrmUrl) return estimateRoute(origin, destination, mode, true)
        return await osrmRoute(settings.osrmUrl, origin, destination, mode, options.signal)
      }
      const { data } = await api.post<BackendRouteResponse>(
        ENDPOINTS.GEO.ROUTE,
        { origin, destination, mode },
        { signal: options.signal },
      )
      const points = fromGeometry(data.geometry ?? [])
      if (points.length < 2) throw new Error('Empty route')
      return { points, distanceM: data.distanceM, durationSec: data.durationSec, source: 'backend', fallback: false }
    } catch (err) {
      if (options.signal?.aborted) throw err
      return estimateRoute(origin, destination, mode, true)
    }
  },
}
