/**
 * Phase L4 — navigation: deep links to navigation apps, taxi mode, routing
 * sources with fallback, remembered preferences, and platform settings.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  buildNavigationUrl,
  appsForPlatform,
  detectPlatform,
  DEFAULT_NAV_TEMPLATES,
} from '@/lib/navigation/deep-links'
import { estimateTravelMinutes } from '@/lib/travel'
import { estimateRoute, routingService } from '@/services/routing.service'
import { useNavigationStore } from '@/stores/navigation-store'
import { splitDuration } from '@/components/location/DirectionsSheet'
import { platformConfigurationRegistry } from '@/config'
import { readMapsSettings } from '@/lib/maps/config'
import api from '@/services/axios.instance'

const DEST = { point: { lat: 35.7575, lng: 51.41 }, label: 'Café Mehr' }
const ORIGIN = { lat: 35.7, lng: 51.4 }

describe('buildNavigationUrl', () => {
  it('Google Maps: destination only + travel mode', () => {
    expect(buildNavigationUrl('google', DEST, 'walk')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=35.7575,51.41&travelmode=walking',
    )
    expect(buildNavigationUrl('google', DEST, 'taxi')).toContain('travelmode=driving')
  })

  it('Waze, Apple Maps and geo:', () => {
    expect(buildNavigationUrl('waze', DEST)).toBe('https://waze.com/ul?ll=35.7575,51.41&navigate=yes')
    expect(buildNavigationUrl('apple', DEST, 'walk')).toBe('https://maps.apple.com/?daddr=35.7575,51.41&dirflg=w')
    expect(buildNavigationUrl('apple', DEST, 'bike')).toBe('https://maps.apple.com/?daddr=35.7575,51.41')
    expect(buildNavigationUrl('geo', DEST)).toBe('geo:35.7575,51.41?q=35.7575,51.41(Caf%C3%A9%20Mehr)')
  })

  it('Neshan / Balad use templates, configurable but https-only', () => {
    expect(buildNavigationUrl('neshan', DEST)).toBe('https://neshan.org/maps/@35.7575,51.41,17z')
    expect(buildNavigationUrl('balad', DEST)).toContain('latitude=35.7575&longitude=51.41')
    expect(buildNavigationUrl('neshan', DEST, 'drive', { neshan: 'https://nshn.example/?p={lat},{lng}&n={label}' })).toBe(
      'https://nshn.example/?p=35.7575,51.41&n=Caf%C3%A9%20Mehr',
    )
    // javascript:/http templates are rejected → default
    expect(buildNavigationUrl('balad', DEST, 'drive', { balad: 'javascript:alert(1)//{lat}' })).toBe(
      buildNavigationUrl('balad', DEST),
    )
  })

  it('never includes the customer origin', () => {
    for (const app of ['google', 'waze', 'apple', 'geo', 'neshan', 'balad'] as const) {
      expect(buildNavigationUrl(app, DEST)).not.toContain('origin')
      expect(buildNavigationUrl(app, DEST)).not.toContain('saddr')
    }
  })
})

describe('platform + app list', () => {
  it('detects the platform from the user agent', () => {
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14)')).toBe('android')
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0)')).toBe('desktop')
  })

  it('offers platform apps with the remembered one first', () => {
    expect(appsForPlatform('desktop').map((a) => a.id)).not.toContain('apple')
    expect(appsForPlatform('ios').map((a) => a.id)).toContain('apple')
    expect(appsForPlatform('android').map((a) => a.id)).toContain('geo')
    expect(appsForPlatform('android', 'waze')[0].id).toBe('waze')
    expect(appsForPlatform('desktop', 'apple')[0].id).toBe('neshan') // not on desktop → ignored
  })
})

describe('taxi mode', () => {
  it('drives the same roads but adds pickup wait', () => {
    expect(estimateTravelMinutes(5, 'taxi')).toBeGreaterThan(estimateTravelMinutes(5, 'drive'))
  })
})

describe('routingService', () => {
  afterEach(() => vi.restoreAllMocks())

  it('estimate: straight guide line, detoured distance, estimated time', async () => {
    const r = await routingService.getRoute(ORIGIN, DEST.point, 'drive', { settings: { routingSource: 'estimate', osrmUrl: '' } })
    expect(r).toMatchObject({ source: 'estimate', fallback: false })
    expect(r.points).toEqual([ORIGIN, DEST.point])
    expect(r.distanceM).toBeGreaterThan(6300) // ~6.4 km straight × 1.35
    expect(r.durationSec).toBe(estimateTravelMinutes(6.4, 'drive') * 60)
  })

  it('osrm: parses the GeoJSON route and adds taxi pickup time', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [{ distance: 8123.4, duration: 900.2, geometry: { coordinates: [[51.4, 35.7], [51.405, 35.73], [51.41, 35.7575]] } }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const settings = { routingSource: 'osrm' as const, osrmUrl: 'https://osrm.example.com/' }
    const r = await routingService.getRoute(ORIGIN, DEST.point, 'taxi', { settings })
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://osrm.example.com/route/v1/driving/51.4,35.7;51.41,35.7575?overview=full&geometries=geojson',
    )
    expect(r).toMatchObject({ source: 'osrm', fallback: false, distanceM: 8123, durationSec: 900 + 300 })
    expect(r.points[1]).toEqual({ lat: 35.73, lng: 51.405 })
    vi.unstubAllGlobals()
  })

  it('osrm failure or missing URL falls back to the estimate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))
    const bad = await routingService.getRoute(ORIGIN, DEST.point, 'walk', { settings: { routingSource: 'osrm', osrmUrl: 'https://osrm.example.com' } })
    expect(bad).toMatchObject({ source: 'estimate', fallback: true })
    const missing = await routingService.getRoute(ORIGIN, DEST.point, 'walk', { settings: { routingSource: 'osrm', osrmUrl: '' } })
    expect(missing).toMatchObject({ source: 'estimate', fallback: true })
    vi.unstubAllGlobals()
  })

  it('backend: uses POST /geo/route/ ([lng,lat] geometry), falls back on error', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValueOnce({
      data: { distanceM: 7000, durationSec: 840, geometry: [[51.4, 35.7], [51.41, 35.7575]] },
    } as never)
    const settings = { routingSource: 'backend' as const, osrmUrl: '' }
    // In mock mode the backend source is served by the estimate.
    if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') {
      expect((await routingService.getRoute(ORIGIN, DEST.point, 'drive', { settings })).source).toBe('estimate')
      return
    }
    const ok = await routingService.getRoute(ORIGIN, DEST.point, 'drive', { settings })
    expect(post).toHaveBeenCalledWith('/geo/route/', { origin: ORIGIN, destination: DEST.point, mode: 'drive' }, expect.anything())
    expect(ok).toMatchObject({ source: 'backend', distanceM: 7000, durationSec: 840 })
    post.mockRejectedValueOnce(new Error('500'))
    expect(await routingService.getRoute(ORIGIN, DEST.point, 'drive', { settings })).toMatchObject({ fallback: true })
  })

  it('rejects invalid endpoints', async () => {
    await expect(routingService.getRoute({ lat: 0, lng: 0 }, DEST.point, 'drive')).rejects.toThrow()
  })

  it('estimateRoute marks fallbacks', () => {
    expect(estimateRoute(ORIGIN, DEST.point, 'bike', true).fallback).toBe(true)
  })
})

describe('navigation preferences', () => {
  beforeEach(() => useNavigationStore.getState()._reset())

  it('remembers the app and travel mode (no positions)', () => {
    useNavigationStore.getState().setPreferredApp('balad')
    useNavigationStore.getState().setTravelMode('taxi')
    const persisted = JSON.parse(localStorage.getItem('samoon-navigation') ?? '{}').state
    expect(persisted).toEqual({ preferredApp: 'balad', travelMode: 'taxi' })
  })
})

describe('helpers + settings', () => {
  it('splitDuration', () => {
    expect(splitDuration(30)).toEqual({ hours: 0, minutes: 1 })
    expect(splitDuration(25 * 60)).toEqual({ hours: 0, minutes: 25 })
    expect(splitDuration(95 * 60)).toEqual({ hours: 1, minutes: 35 })
  })

  it('the maps module has the navigation fields with safe defaults', () => {
    for (const id of ['maps.routing_source', 'maps.osrm_url', 'maps.nav_neshan_url', 'maps.nav_balad_url']) {
      expect(platformConfigurationRegistry.getField(id)).toBeDefined()
    }
    const s = readMapsSettings()
    expect(s.routingSource).toBe('estimate')
    expect(s.osrmUrl).toBe('')
    expect(s.navTemplates).toEqual(DEFAULT_NAV_TEMPLATES)
  })
})
