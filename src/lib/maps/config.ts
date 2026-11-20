/**
 * Runtime reader for the "Maps & Location" platform settings (Phase L1).
 * Values come from Platform Configuration (src/config/modules/maps.ts);
 * every read is defensive so a missing/invalid value falls back to the
 * module default rather than breaking a map.
 */
import { configurationService } from '@/config'
import type { GeoPoint } from '@/types/branch'
import { isValidGeoPoint } from '@/lib/geo'
import { DEFAULT_NAV_TEMPLATES } from '@/lib/navigation/deep-links'
import { resolveActiveMapProvider, type ActiveMapProvider, type RasterTileSource } from './providers'

export interface MapsSettings {
  provider: string
  fallbackProvider: string
  osmTileUrl: string
  keys: Record<string, string>
  defaultCenter: GeoPoint
  defaultZoom: number
  maxServiceRadiusKm: number
  /** Discover "near me" list radius once the customer is located. */
  nearbyRadiusKm: number
  geolocationEnabled: boolean
  minLocationAccuracyM: number
  /** Phase L4 */
  routingSource: 'estimate' | 'backend' | 'osrm'
  osrmUrl: string
  navTemplates: { neshan: string; balad: string }
}

const DEFAULTS: MapsSettings = {
  provider: 'osm',
  fallbackProvider: 'osm',
  osmTileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  keys: {},
  defaultCenter: { lat: 35.6892, lng: 51.389 },
  defaultZoom: 12,
  maxServiceRadiusKm: 50,
  nearbyRadiusKm: 20,
  geolocationEnabled: true,
  minLocationAccuracyM: 1000,
  routingSource: 'estimate',
  osrmUrl: '',
  navTemplates: { ...DEFAULT_NAV_TEMPLATES },
}

function read<T>(fieldId: string, guard: (v: unknown) => v is T, fallback: T): T {
  try {
    const value = configurationService.resolveField(fieldId, {}).value
    return guard(value) ? value : fallback
  } catch {
    return fallback
  }
}

const isString = (v: unknown): v is string => typeof v === 'string'
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'
const isRoutingSource = (v: unknown): v is MapsSettings['routingSource'] => v === 'estimate' || v === 'backend' || v === 'osrm'

const KEY_FIELDS = ['maps.neshan_web_key', 'maps.mapir_web_key', 'maps.google_web_key'] as const

export function readMapsSettings(): MapsSettings {
  const center = {
    lat: read('maps.default_center_lat', isFiniteNumber, DEFAULTS.defaultCenter.lat),
    lng: read('maps.default_center_lng', isFiniteNumber, DEFAULTS.defaultCenter.lng),
  }
  const keys: Record<string, string> = {}
  for (const id of KEY_FIELDS) keys[id] = read(id, isString, '')
  return {
    provider: read('maps.provider', isString, DEFAULTS.provider),
    fallbackProvider: read('maps.fallback_provider', isString, DEFAULTS.fallbackProvider),
    osmTileUrl: read('maps.osm_tile_url', isString, DEFAULTS.osmTileUrl),
    keys,
    defaultCenter: isValidGeoPoint(center) ? center : DEFAULTS.defaultCenter,
    defaultZoom: read('maps.default_zoom', isFiniteNumber, DEFAULTS.defaultZoom),
    maxServiceRadiusKm: read('maps.max_service_radius_km', isFiniteNumber, DEFAULTS.maxServiceRadiusKm),
    nearbyRadiusKm: read('maps.nearby_radius_km', isFiniteNumber, DEFAULTS.nearbyRadiusKm),
    geolocationEnabled: read('maps.geolocation_enabled', isBoolean, DEFAULTS.geolocationEnabled),
    minLocationAccuracyM: read('maps.min_location_accuracy_m', isFiniteNumber, DEFAULTS.minLocationAccuracyM),
    routingSource: read('maps.routing_source', isRoutingSource, DEFAULTS.routingSource),
    osrmUrl: read('maps.osrm_url', isString, DEFAULTS.osrmUrl).trim(),
    navTemplates: {
      neshan: read('maps.nav_neshan_url', isString, DEFAULTS.navTemplates.neshan),
      balad: read('maps.nav_balad_url', isString, DEFAULTS.navTemplates.balad),
    },
  }
}

export interface ResolvedMapRendering extends ActiveMapProvider {
  tiles: RasterTileSource
}

/** Provider + tile source to render with, honoring fallbacks. */
export function resolveMapRendering(settings: MapsSettings = readMapsSettings()): ResolvedMapRendering {
  const active = resolveActiveMapProvider(settings.provider, settings.fallbackProvider, settings.keys)
  const key = active.provider.keyFieldId ? settings.keys[active.provider.keyFieldId] ?? '' : ''
  // Every *available* provider defines tiles; OSM is the guaranteed floor.
  const tiles = active.provider.tiles!({ osmTileUrl: settings.osmTileUrl, key })
  return { ...active, tiles }
}
