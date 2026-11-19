/**
 * Map provider registry — Phase L1 (docs/BUSINESS_SERVICES_ROADMAP.md).
 *
 * Every map in the app renders through ONE abstraction so the platform can
 * switch provider from the Configuration Studio ("Maps & Location") without
 * touching screens. A provider describes how to render tiles and which
 * origins it needs (for CSP), and whether it needs a browser key.
 *
 * L1 ships the OpenStreetMap/Leaflet adapter. Neshan, Map.ir and Google are
 * registered (selectable in settings) but their adapters land in a later
 * step; until then resolveActiveMapProvider() falls back to a working
 * provider and reports why, instead of rendering a broken map.
 */

export type MapProviderId = 'osm' | 'neshan' | 'mapir' | 'google'

export interface RasterTileSource {
  /** XYZ template, e.g. https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png */
  url: string
  attribution: string
  subdomains?: string
  maxZoom: number
}

export interface MapProviderDescriptor {
  id: MapProviderId
  /** Configuration field holding this provider's browser key, if it needs one. */
  keyFieldId?: string
  /** Whether a renderer adapter exists in this build. */
  available: boolean
  /** Raster tiles for the Leaflet renderer (available providers only). */
  tiles?: (settings: { osmTileUrl: string; key: string }) => RasterTileSource
  /** Origins to allow in CSP img-src / connect-src when this provider is active. */
  cspOrigins: readonly string[]
}

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'

export const MAP_PROVIDERS: Readonly<Record<MapProviderId, MapProviderDescriptor>> = Object.freeze({
  osm: {
    id: 'osm',
    available: true,
    tiles: ({ osmTileUrl }) => ({
      url: osmTileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: OSM_ATTRIBUTION,
      subdomains: 'abc',
      maxZoom: 19,
    }),
    cspOrigins: ['https://*.tile.openstreetmap.org'],
  },
  neshan: { id: 'neshan', keyFieldId: 'maps.neshan_web_key', available: false, cspOrigins: [] },
  mapir: { id: 'mapir', keyFieldId: 'maps.mapir_web_key', available: false, cspOrigins: [] },
  google: { id: 'google', keyFieldId: 'maps.google_web_key', available: false, cspOrigins: [] },
})

export function isMapProviderId(value: unknown): value is MapProviderId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MAP_PROVIDERS, value)
}

export type MapProviderFallbackReason = 'adapter_unavailable' | 'missing_key' | 'unknown_provider'

export interface ActiveMapProvider {
  provider: MapProviderDescriptor
  /** The provider the platform asked for (may differ from `provider`). */
  requested: MapProviderId | string
  /** Set when `provider` is not the requested one. */
  fallbackReason?: MapProviderFallbackReason
}

function usable(id: MapProviderId, keys: Partial<Record<string, string>>): MapProviderFallbackReason | null {
  const p = MAP_PROVIDERS[id]
  if (!p.available) return 'adapter_unavailable'
  if (p.keyFieldId && !keys[p.keyFieldId]?.trim()) return 'missing_key'
  return null
}

/**
 * Picks the provider to render with: requested → configured fallback → OSM.
 * Never throws; always returns a renderable provider.
 */
export function resolveActiveMapProvider(
  requested: string,
  fallback: string,
  keys: Partial<Record<string, string>> = {},
): ActiveMapProvider {
  if (isMapProviderId(requested)) {
    const reason = usable(requested, keys)
    if (!reason) return { provider: MAP_PROVIDERS[requested], requested }
    if (isMapProviderId(fallback) && !usable(fallback, keys)) {
      return { provider: MAP_PROVIDERS[fallback], requested, fallbackReason: reason }
    }
    return { provider: MAP_PROVIDERS.osm, requested, fallbackReason: reason }
  }
  return { provider: MAP_PROVIDERS.osm, requested, fallbackReason: 'unknown_provider' }
}
