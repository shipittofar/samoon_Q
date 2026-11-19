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
import { resolveFallbackLocation, type UserLocation } from '@/lib/location/evaluate'
import { distanceKm } from '@/lib/geo'
import { addressService } from '@/services/address.service'
import { STALE_TIME } from '@/constants'
import type { GeoPoint } from '@/types/branch'

const REGEOCODE_AFTER_KM = 1

function geolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

export interface UseUserLocationResult {
  /** Best location to use right now (live → manual → address → default). */
  location: UserLocation
  status: ReturnType<typeof useLocationStore.getState>['status']
  mode: 'auto' | 'manual'
  pending: ReturnType<typeof useLocationStore.getState>['pending']
  /** Starts device location (shows the browser permission prompt if needed). */
  requestDeviceLocation: () => void
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

  return { location, status, mode, pending, requestDeviceLocation, setManual, confirmPending, dismissPending }
}
