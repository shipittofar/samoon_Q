/**
 * Phase L1 — service areas, geo helpers, map provider resolution, maps settings.
 */
import { describe, it, expect } from 'vitest'
import {
  distanceKm,
  isPointInPolygon,
  isValidGeoPoint,
  resolveBranchServiceArea,
  isInServiceArea,
  zoneForDistance,
  checkServiceArea,
  circleBounds,
} from '@/lib/geo'
import { VERTICALS } from '@/verticals'
import { resolveActiveMapProvider } from '@/lib/maps/providers'
import { readMapsSettings, resolveMapRendering } from '@/lib/maps/config'
import { platformConfigurationRegistry } from '@/config'
import { branchFormToWriteRequest, branchToFormInput } from '@/types/branch-form'
import type { Branch, BranchCheckout } from '@/types/branch'
import { buildBranchCheckout } from '@/lib/branch-checkout'

const TEHRAN = { lat: 35.6892, lng: 51.389 }
const ISFAHAN = { lat: 32.6539, lng: 51.666 }

const noDelivery: BranchCheckout = buildBranchCheckout({ delivery: false, radius: null })
const withDelivery: BranchCheckout = buildBranchCheckout({ delivery: true, radius: 8 })

describe('geo helpers', () => {
  it('distanceKm matches a known city distance (Tehran → Isfahan ≈ 338 km)', () => {
    expect(distanceKm(TEHRAN, ISFAHAN)).toBeGreaterThan(330)
    expect(distanceKm(TEHRAN, ISFAHAN)).toBeLessThan(345)
    expect(distanceKm(TEHRAN, TEHRAN)).toBe(0)
  })

  it('isValidGeoPoint rejects NaN, out-of-range and (0,0)', () => {
    expect(isValidGeoPoint(TEHRAN)).toBe(true)
    expect(isValidGeoPoint({ lat: 0, lng: 0 })).toBe(false)
    expect(isValidGeoPoint({ lat: 95, lng: 10 })).toBe(false)
    expect(isValidGeoPoint({ lat: Number.NaN, lng: 10 })).toBe(false)
    expect(isValidGeoPoint(null)).toBe(false)
  })

  it('isPointInPolygon handles inside / outside / degenerate polygons', () => {
    const square = [
      { lat: 35.6, lng: 51.3 },
      { lat: 35.6, lng: 51.5 },
      { lat: 35.8, lng: 51.5 },
      { lat: 35.8, lng: 51.3 },
    ]
    expect(isPointInPolygon(TEHRAN, square)).toBe(true)
    expect(isPointInPolygon(ISFAHAN, square)).toBe(false)
    expect(isPointInPolygon(TEHRAN, square.slice(0, 2))).toBe(false)
  })

  it('circleBounds encloses the circle', () => {
    const [s, w, n, e] = circleBounds(TEHRAN, 10)
    expect(distanceKm(TEHRAN, { lat: n, lng: TEHRAN.lng })).toBeCloseTo(10, 0)
    expect(s).toBeLessThan(TEHRAN.lat)
    expect(w).toBeLessThan(TEHRAN.lng)
    expect(e).toBeGreaterThan(TEHRAN.lng)
  })
})

describe('resolveBranchServiceArea — fallback chain', () => {
  it('1. a custom area wins (and is clamped to the platform max)', () => {
    const area = resolveBranchServiceArea(
      { serviceArea: { mode: 'on_site', shape: { type: 'circle', radiusKm: 80 } }, checkout: withDelivery },
      VERTICALS.beauty_salon,
      { maxRadiusKm: 50 },
    )
    expect(area).toEqual({ mode: 'on_site', shape: { type: 'circle', radiusKm: 50 } })
  })

  it('2. else the delivery radius when delivery is enabled', () => {
    expect(resolveBranchServiceArea({ checkout: withDelivery }, VERTICALS.restaurant)).toEqual({
      mode: 'delivery', shape: { type: 'circle', radiusKm: 8 },
    })
  })

  it('3. else the vertical default (visit-only)', () => {
    expect(resolveBranchServiceArea({ checkout: noDelivery }, VERTICALS.clinic)).toEqual({
      mode: 'visit_only', shape: { type: 'circle', radiusKm: 15 },
    })
    expect(resolveBranchServiceArea({ checkout: noDelivery }, VERTICALS.cafe).shape).toEqual({ type: 'circle', radiusKm: 3 })
  })

  it('every vertical defines a positive default radius', () => {
    for (const v of Object.values(VERTICALS)) {
      expect(v.defaultServiceArea.radiusKm).toBeGreaterThan(0)
    }
  })
})

describe('isInServiceArea / zones / checkServiceArea', () => {
  const branch = {
    location: { address: 'x', city: 'Tehran', country: 'IR', latitude: TEHRAN.lat, longitude: TEHRAN.lng },
    checkout: noDelivery,
    serviceArea: {
      mode: 'delivery' as const,
      shape: { type: 'circle' as const, radiusKm: 6 },
      zones: [{ upToKm: 6, fee: 3 }, { upToKm: 3, fee: 0 }],
    },
  }
  const near = { lat: 35.7, lng: 51.4 } // ~1.5 km
  const far = { lat: 35.8, lng: 51.6 } // ~23 km

  it('circle containment', () => {
    expect(isInServiceArea(branch.serviceArea, TEHRAN, near)).toBe(true)
    expect(isInServiceArea(branch.serviceArea, TEHRAN, far)).toBe(false)
  })

  it('picks the nearest zone band regardless of input order', () => {
    expect(zoneForDistance(branch.serviceArea, 1.5)?.fee).toBe(0)
    expect(zoneForDistance(branch.serviceArea, 4)?.fee).toBe(3)
    expect(zoneForDistance(branch.serviceArea, 10)).toBeUndefined()
  })

  it('checkServiceArea returns distance, inside flag and zone', () => {
    const r = checkServiceArea(branch as never, near)!
    expect(r.inside).toBe(true)
    expect(r.distanceKm).toBeGreaterThan(1)
    expect(r.distanceKm).toBeLessThan(2)
    expect(r.zone?.fee).toBe(0)
  })

  it('returns null when the branch or user location is unknown', () => {
    expect(checkServiceArea({ ...branch, location: { ...branch.location, latitude: undefined, longitude: undefined } } as never, near)).toBeNull()
    expect(checkServiceArea(branch as never, null)).toBeNull()
  })
})

describe('map provider resolution', () => {
  it('OSM is used as-is', () => {
    const r = resolveActiveMapProvider('osm', 'osm')
    expect(r.provider.id).toBe('osm')
    expect(r.fallbackReason).toBeUndefined()
  })

  it('a provider without an adapter yet falls back (reason reported)', () => {
    const r = resolveActiveMapProvider('neshan', 'osm', { 'maps.neshan_web_key': 'k' })
    expect(r.provider.id).toBe('osm')
    expect(r.requested).toBe('neshan')
    expect(r.fallbackReason).toBe('adapter_unavailable')
  })

  it('an unknown provider falls back to OSM', () => {
    expect(resolveActiveMapProvider('bing', 'neshan').provider.id).toBe('osm')
    expect(resolveActiveMapProvider('bing', 'neshan').fallbackReason).toBe('unknown_provider')
  })
})

describe('maps platform settings', () => {
  it('the maps module is registered with its fields', () => {
    const mod = platformConfigurationRegistry.getModule('maps')
    expect(mod?.name).toBe('Maps & Location')
    for (const id of ['maps.provider', 'maps.max_service_radius_km', 'maps.geolocation_enabled', 'maps.default_center_lat']) {
      expect(platformConfigurationRegistry.getField(id)).toBeDefined()
    }
  })

  it('readMapsSettings returns the defaults and a renderable tile source', () => {
    const s = readMapsSettings()
    expect(s.provider).toBe('osm')
    expect(s.maxServiceRadiusKm).toBe(50)
    expect(s.defaultCenter).toEqual({ lat: 35.6892, lng: 51.389 })
    const rendering = resolveMapRendering(s)
    expect(rendering.tiles.url).toContain('{z}/{x}/{y}')
    expect(rendering.tiles.attribution).toContain('OpenStreetMap')
  })
})

describe('branch form ↔ payload', () => {
  const base = {
    id: 'b1', tenantId: 't1', name: 'Main', slug: 'main', status: 'active', type: 'physical',
    location: { address: 'a', city: 'c', country: 'IR', latitude: TEHRAN.lat, longitude: TEHRAN.lng },
    contact: {}, businessHours: [], checkout: noDelivery, marketplaceVisible: true, reservationsEnabled: false,
    created_at: '', updated_at: '',
  } as unknown as Branch

  it('a custom area round-trips through the form', () => {
    const branch = { ...base, serviceArea: { mode: 'on_site', shape: { type: 'circle', radiusKm: 6 } } } as Branch
    const form = branchToFormInput(branch)
    expect(form.serviceArea).toEqual(branch.serviceArea)
    expect(branchFormToWriteRequest(form).serviceArea).toEqual(branch.serviceArea)
  })

  it('no custom area → form null → update sends null (clears)', () => {
    const form = branchToFormInput(base)
    expect(form.serviceArea).toBeNull()
    expect(branchFormToWriteRequest(form).serviceArea).toBeNull()
  })
})
