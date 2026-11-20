'use client'

/**
 * useUserLocation — Phase L2. The single place that talks to the browser
 * Geolocation API.
 *
 * - Never prompts on page load: watching starts automatically only when the
 *   permission is already 'granted'; otherwise the customer taps
 *   "use my location" (requestDeviceLocation).
 * - High-accuracy `watchPosition`; each fix goes through evaluateFix()
 *   (accuracy / jump / min-move rules) via the store.
 * - Resolves the city/area with reverse geocoding when the position moves
 *   more than ~1 km or the city is unknown.
 * - Falls back to: manual choice → default saved address → platform centre.
 *
 * Mount the watcher once (`watch: true`, e.g. in LocationChip); other
 * components read the same state with `watch: false`.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores'
import { useLocationStore } from '@/stores/location-store'
import { readMapsSettings } from '@/lib/maps/config'
import { resolveFallbackLocation, type LocationFix, type UserLocation } from '@/lib/location/evaluate'
import { distanceKm } from '@/lib/geo'
import { addressService } from '@/services/address.service'
import { STALE_TIME } from '@/constants'
import type { GeoPoint } from '@/types/branch'

const REGEOCODE_AFTER_KM = 1

function geolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

export type LocateResult =
  | { ok: true; fix: LocationFix }
  | { ok: false; reason: 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'disabled' }

function getPosition(options: PositionOptions): Promise<LocateResult> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          fix: {
            point: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
            timestamp: pos.timestamp || Date.now(),
          },
        }),
      (err) =>
        resolve({
          ok: false,
          reason: err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable',
        }),
      options,
    )
  })
}

/** Stage timeouts (ms): precise first, then the quicker network estimate. */
export const LOCATE_PRECISE_TIMEOUT_MS = 8_000
export const LOCATE_COARSE_TIMEOUT_MS = 12_000
/** A cached position up to this old is fine for the second stage. */
export const LOCATE_COARSE_MAX_AGE_MS = 5 * 60_000

/**
 * A fresh reading on demand ("Use my location"); works while a watch is
 * already running and is how the customer retries.
 *
 * 1. precise (GPS / high-accuracy) with no cache;
 * 2. if that times out or is unavailable — common on computers, which have
 *    no GPS and rely on the browser's network location service — a normal-
 *    accuracy reading that may use a position cached in the last 5 minutes.
 * A denial is final (asking again can't succeed until the customer allows it).
 */
export async function locateOnce(): Promise<LocateResult> {
  if (!readMapsSettings().geolocationEnabled) return { ok: false, reason: 'disabled' }
  if (!geolocationSupported()) return { ok: false, reason: 'unsupported' }
  const precise = await getPosition({ enableHighAccuracy: true, maximumAge: 0, timeout: LOCATE_PRECISE_TIMEOUT_MS })
  if (precise.ok || precise.reason === 'denied') return precise
  const coarse = await getPosition({ enableHighAccuracy: false, maximumAge: LOCATE_COARSE_MAX_AGE_MS, timeout: LOCATE_COARSE_TIMEOUT_MS })
  return coarse.ok || coarse.reason === 'denied' ? coarse : precise.reason === 'unavailable' ? precise : coarse
}

/** Readings the page already received this long ago still beat "not found". */
const RECENT_READING_MS = 10 * 60_000

export interface UseUserLocationResult {
  /** Best location to use right now (live → manual → address → default). */
  location: UserLocation
  status: ReturnType<typeof useLocationStore.getState>['status']
  mode: 'auto' | 'manual'
  pending: ReturnType<typeof useLocationStore.getState>['pending']
  /** Starts device location (shows the browser permission prompt if needed). */
  requestDeviceLocation: () => void
  /** Fresh one-shot reading; does not change the location until accepted. */
  locate: () => Promise<LocateResult>
  /** Use a reading the customer accepted, then keep following the device. */
  acceptDeviceFix: (fix: LocationFix) => void
  setManual: (point: GeoPoint) => void
  confirmPending: () => void
  dismissPending: () => void
}

export function useUserLocation({ watch = false }: { watch?: boolean } = {}): UseUserLocationResult {
  const settings = useMemo(() => readMapsSettings(), [])
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { mode, live, manual, pending, status, applyFix, setManual: storeSetManual, confirmPending, dismissPending, followDevice, setStatus, setPlace } =
    useLocationStore()
  const watchIdRef = useRef<number | null>(null)

  // Default saved address — only for signed-in customers.
  const { data: defaultAddress } = useQuery({
    queryKey: ['addresses', 'default-for-location'],
    queryFn: async () => {
      const page = await addressService.list({ page_size: 20 })
      return page.results.find((a) => a.is_default && !a.is_deleted) ?? null
    },
    enabled: watch && isAuthenticated,
    staleTime: STALE_TIME,
  })

  const startWatching = useCallback(() => {
    if (!geolocationSupported()) {
      setStatus('unsupported')
      return
    }
    if (watchIdRef.current !== null) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        applyFix(
          {
            point: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
            timestamp: pos.timestamp || Date.now(),
          },
          { minAccuracyM: settings.minLocationAccuracyM },
        )
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')
        if (err.code === err.PERMISSION_DENIED && watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current)
          watchIdRef.current = null
        }
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    )
    setStatus('watching')
  }, [applyFix, setStatus, settings.minLocationAccuracyM])

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null && geolocationSupported()) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }
    watchIdRef.current = null
  }, [])

  // Auto-start only when permission is already granted (never prompt on load).
  useEffect(() => {
    if (!watch) return
    if (!settings.geolocationEnabled) {
      setStatus('disabled')
      return
    }
    if (!geolocationSupported()) {
      setStatus('unsupported')
      return
    }
    if (mode !== 'auto') return
    let cancelled = false
    const permissions = (navigator as Navigator & { permissions?: Permissions }).permissions
    if (!permissions?.query) {
      setStatus('prompt')
      return
    }
    permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((result) => {
        if (cancelled) return
        if (result.state === 'granted') startWatching()
        else setStatus(result.state === 'denied' ? 'denied' : 'prompt')
      })
      .catch(() => {
        if (!cancelled) setStatus('prompt')
      })
    return () => {
      cancelled = true
    }
  }, [watch, mode, settings.geolocationEnabled, startWatching, setStatus])

  useEffect(() => (watch ? stopWatching : undefined), [watch, stopWatching])

  // Stop following the device while a manual location is in use.
  useEffect(() => {
    if (watch && mode === 'manual') stopWatching()
  }, [watch, mode, stopWatching])

  const location = useMemo<UserLocation>(() => {
    if (mode === 'auto' && live) return live
    return resolveFallbackLocation({
      manual: mode === 'manual' ? manual : null,
      defaultAddress,
      platformCenter: settings.defaultCenter,
    })
  }, [mode, live, manual, defaultAddress, settings.defaultCenter])

  // Reverse-geocode the city/area when it is unknown or we moved > 1 km.
  const lastGeocodedRef = useRef<GeoPoint | null>(null)
  useEffect(() => {
    if (!watch) return
    if (location.source === 'default' || location.source === 'address') return
    const last = lastGeocodedRef.current
    if (location.city && last && distanceKm(last, location.point) < REGEOCODE_AFTER_KM) return
    let cancelled = false
    lastGeocodedRef.current = location.point
    addressService
      .reverseGeocode(location.point.lat, location.point.lng)
      .then((r) => {
        if (!cancelled) setPlace({ city: r.city || undefined, area: r.district || undefined })
      })
      .catch(() => {
        /* city label is optional */
      })
    return () => {
      cancelled = true
    }
  }, [watch, location.point, location.city, location.source, setPlace])

  const requestDeviceLocation = useCallback(() => {
    if (!settings.geolocationEnabled) return
    followDevice()
    startWatching()
  }, [settings.geolocationEnabled, followDevice, startWatching])

  const setManual = useCallback((point: GeoPoint) => storeSetManual(point), [storeSetManual])

  const locate = useCallback(async (): Promise<LocateResult> => {
    const result = await locateOnce()
    if (!result.ok && result.reason !== 'denied') {
      // Last resort: a reading the watcher received recently (even a rough one).
      const { live, pending } = useLocationStore.getState()
      const recent = [pending?.fix, live].filter(
        (f): f is LocationFix => !!f && Date.now() - f.timestamp < RECENT_READING_MS,
      )
      if (recent.length) return { ok: true, fix: recent.sort((a, b) => b.timestamp - a.timestamp)[0] }
    }
    if (!result.ok) setStatus(result.reason === 'denied' ? 'denied' : result.reason === 'disabled' ? 'disabled' : result.reason === 'unsupported' ? 'unsupported' : 'unavailable')
    return result
  }, [setStatus])

  const storeAcceptDeviceFix = useLocationStore((s) => s.acceptDeviceFix)
  const acceptDeviceFix = useCallback(
    (fix: LocationFix) => {
      storeAcceptDeviceFix(fix)
      startWatching()
    },
    [storeAcceptDeviceFix, startWatching],
  )

  return { location, status, mode, pending, requestDeviceLocation, locate, acceptDeviceFix, setManual, confirmPending, dismissPending }
}
