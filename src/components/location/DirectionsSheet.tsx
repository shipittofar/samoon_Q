'use client'

/**
 * DirectionsSheet — Phase L4. Route preview inside the app (line on the map,
 * time and distance for the chosen travel mode) plus a hand-off to the
 * customer's navigation app, remembered for next time.
 */
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Car, Bike, Footprints, CarTaxiFront, ExternalLink, Crosshair, Loader2, type LucideIcon } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { MapViewLazy, type MapMarker } from '@/components/maps'
import type { GeoPoint } from '@/types/branch'
import { useUserLocation } from '@/hooks/location'
import { useNavigationStore } from '@/stores/navigation-store'
import { routingService } from '@/services/routing.service'
import { readMapsSettings } from '@/lib/maps/config'
import { distanceKm } from '@/lib/geo'
import { formatDistance, suggestTravelMode, TRAVEL_MODES, type TravelMode } from '@/lib/travel'
import {
  appsForPlatform,
  buildNavigationUrl,
  detectPlatform,
  type NavigationAppId,
} from '@/lib/navigation/deep-links'
import { cn } from '@/utils'

export interface DirectionsDestination {
  point: GeoPoint
  name: string
  address?: string
  emoji?: string
}

const MODE_ICONS: Record<TravelMode, LucideIcon> = { drive: Car, taxi: CarTaxiFront, walk: Footprints, bike: Bike }

/** Route queries are keyed on ~11 m rounding so tiny GPS jitter doesn't refetch. */
const key = (p: GeoPoint) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`

export function splitDuration(totalSec: number): { hours: number; minutes: number } {
  const minutes = Math.max(1, Math.round(totalSec / 60))
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 }
}

export function DirectionsSheet({
  open,
  onClose,
  destination,
}: {
  open: boolean
  onClose: () => void
  destination: DirectionsDestination
}) {
  const t = useTranslations('directions')
  const tNear = useTranslations('nearby')
  // Mounted only while open: watching here also covers pages without the location chip.
  const loc = useUserLocation({ watch: open })
  const { preferredApp, travelMode: modePref, setPreferredApp, setTravelMode } = useNavigationStore()
  const settings = useMemo(() => readMapsSettings(), [])
  const [remember, setRemember] = useState(true)
  const [platform, setPlatform] = useState<ReturnType<typeof detectPlatform>>('desktop')
  useEffect(() => setPlatform(detectPlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent)), [])

  const origin = loc.location.source === 'default' ? null : loc.location.point
  const straightKm = origin ? distanceKm(origin, destination.point) : null
  const mode: TravelMode = modePref === 'auto' ? suggestTravelMode(straightKm ?? 0) : modePref

  const route = useQuery({
    queryKey: ['route', origin ? key(origin) : null, key(destination.point), mode, settings.routingSource],
    queryFn: ({ signal }) => routingService.getRoute(origin!, destination.point, mode, { signal, settings }),
    enabled: open && origin !== null,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const markers: MapMarker[] = [
    { id: 'dest', position: destination.point, emoji: destination.emoji ?? '📍', label: destination.name, highlighted: true },
    ...(origin ? [{ id: 'me', position: origin, variant: 'user' as const, label: tNear('youAreHere') }] : []),
  ]
  const points = route.data?.points ?? (origin ? [origin, destination.point] : [destination.point])
  const apps = appsForPlatform(platform, preferredApp)
  const preferred = preferredApp ? apps.find((a) => a.id === preferredApp) : undefined
  const urlFor = (id: NavigationAppId) =>
    buildNavigationUrl(id, { point: destination.point, label: destination.name }, mode, settings.navTemplates)
  const onOpenApp = (id: NavigationAppId) => {
    if (remember) setPreferredApp(id)
  }

  const duration = route.data ? splitDuration(route.data.durationSec) : null
  const dist = route.data ? formatDistance(route.data.distanceM / 1000) : null

  return (
    <Modal open={open} onClose={onClose} title={t('title', { name: destination.name })} description={destination.address} size="lg">
      <div className="space-y-4" data-testid="directions-sheet">
        <div role="radiogroup" aria-label={t('travelModeAria')} className="flex flex-wrap gap-2">
          {TRAVEL_MODES.map((m) => {
            const Icon = MODE_ICONS[m]
            const active = m === mode
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTravelMode(m)}
                className={cn(
                  'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                    : 'border-[var(--border)] text-[var(--fg)] hover:bg-[var(--card-hover)]',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t(`mode_${m}`)}
              </button>
            )
          })}
          {modePref !== 'auto' && (
            <button type="button" onClick={() => setTravelMode('auto')} className="px-2 text-xs text-[var(--accent-text)] hover:underline">
              {t('modeAuto')}
            </button>
          )}
        </div>

        <MapViewLazy
          center={destination.point}
          zoom={15}
          markers={markers}
          routes={origin ? [{ id: 'route', points, dashed: route.data?.source !== 'osrm' && route.data?.source !== 'backend' }] : []}
          fitMarkersKey={`${points.map(key).join('|')}`}
          fitPoints={origin ? [...points, origin] : [destination.point]}
          ariaLabel={t('mapAria')}
          className="h-72 w-full overflow-hidden rounded-xl border border-[var(--border)]"
        />

        <div aria-live="polite" className="min-h-[2.5rem]" data-testid="route-summary">
          {!origin ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--fg-muted)]">
              <span>{t('needLocation')}</span>
              <button
                type="button"
                onClick={loc.requestDeviceLocation}
                className="inline-flex items-center gap-1 text-[var(--accent-text)] hover:underline"
              >
                <Crosshair className="h-4 w-4" aria-hidden="true" />
                {t('useMyLocation')}
              </button>
            </div>
          ) : route.isLoading ? (
            <span className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t('loadingRoute')}
            </span>
          ) : route.data && duration && dist ? (
            <div>
              <p className="text-lg font-semibold text-[var(--fg)]">
                {duration.hours > 0 ? t('durationHours', duration) : t('durationMinutes', { minutes: duration.minutes })}
                <span className="ms-2 text-sm font-normal text-[var(--fg-muted)]">{tNear(`distance_${dist.unit}`, { value: dist.value })}</span>
              </p>
              <p className="text-xs text-[var(--fg-subtle)]">
                {route.data.fallback ? t('routeFallback') : route.data.source === 'estimate' ? t('routeEstimate') : t('routeLive')}
              </p>
            </div>
          ) : (
            <span className="text-sm text-[var(--fg-muted)]">{t('routeError')}</span>
          )}
        </div>

        <div className="space-y-2">
          {preferred ? (
            <a
              href={urlFor(preferred.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
              data-testid="open-preferred-app"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t('openIn', { app: preferred.name === 'geo:' ? t('otherApp') : preferred.name })}
            </a>
          ) : (
            <p className="text-sm font-medium text-[var(--fg)]">{t('openWith')}</p>
          )}
          <ul className="flex flex-wrap gap-2" aria-label={t('appsAria')}>
            {apps
              .filter((a) => a.id !== preferred?.id)
              .map((a) => (
                <li key={a.id}>
                  <a
                    href={urlFor(a.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onOpenApp(a.id)}
                    data-nav-app={a.id}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--card-hover)]"
                  >
                    {a.id === 'geo' ? t('otherApp') : a.name}
                  </a>
                </li>
              ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--fg-muted)]">
            {preferred ? (
              <button type="button" onClick={() => setPreferredApp(null)} className="text-[var(--accent-text)] hover:underline">
                {t('forgetApp')}
              </button>
            ) : (
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                {t('rememberApp')}
              </label>
            )}
            <span>{t('privacyNote')}</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
