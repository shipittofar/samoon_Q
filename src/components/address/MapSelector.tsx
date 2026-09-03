'use client'

import { useCallback, useMemo, useState } from 'react'
import Image from 'next/image'
import { MapPin, Navigation } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils'

export interface MapSelectorProps {
  latitude?: number | null
  longitude?: number | null
  onChange: (coords: { latitude: number; longitude: number }) => void
  className?: string
  disabled?: boolean
}

function isValidCoord(
  lat: number | null | undefined,
  lng: number | null | undefined,
): lat is number {
  return lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
}

function coordsOrNull(
  lat: number | null | undefined,
  lng: number | null | undefined,
): { lat: number; lng: number } | null {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null
  return { lat, lng }
}

/** Static OSM tile preview — avoids iframe/X-Frame blocking and works in modals. */
function buildStaticMapUrl(lat: number, lng: number, zoom = 15): string {
  const size = '640x320'
  const markers = `${lat},${lng},red-pushpin`
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${size}&markers=${markers}`
}

export function MapSelector({ latitude, longitude, onChange, className, disabled }: MapSelectorProps) {
  const t = useTranslations('address.map')
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [mapError, setMapError] = useState(false)

  const mapUrl = useMemo(() => {
    const coords = coordsOrNull(latitude, longitude)
    if (!coords) return null
    return buildStaticMapUrl(coords.lat, coords.lng)
  }, [latitude, longitude])

  const applyCoords = useCallback(
    (la: number, ln: number) => {
      setMapError(false)
      onChange({ latitude: la, longitude: ln })
    },
    [onChange],
  )

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError(t('geolocationUnsupported'))
      return
    }
    setLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyCoords(pos.coords.latitude, pos.coords.longitude)
        setLocating(false)
      },
      () => {
        setGeoError(t('geolocationDenied'))
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--fg)]">{t('locationLabel')}</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleCurrentLocation}
          loading={locating}
          disabled={disabled}
          leftIcon={<Navigation className="h-4 w-4"/>}
        >
          {t('useCurrentLocation')}
        </Button>
      </div>

      {geoError && (
        <p className="text-xs text-[var(--danger-text)]"role="alert">{geoError}</p>
      )}

      <div
        className="relative rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card-hover)] aspect-[2/1] min-h-[180px]"
        aria-label={t('mapPreview')}
      >
        {mapUrl && !mapError ? (
          <>
            <Image
              src={mapUrl}
              alt={t('mapPreview')}
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 640px"
              onError={() => setMapError(true)}
            />
            {/* Pin overlay — visible even if tile marker fails */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative -mt-8">
                <MapPin className="h-10 w-10 text-[var(--accent-text)] drop-shadow-lg"fill="currentColor"strokeWidth={1.5} />
              </div>
            </div>
            <div className="absolute bottom-2 start-2 end-2 rounded-lg bg-[var(--card)]/90 backdrop-blur-sm border border-[var(--border)] px-3 py-1.5 text-xs font-mono text-[var(--fg-muted)]">
              {coordsOrNull(latitude, longitude)?.lat.toFixed(5)}, {coordsOrNull(latitude, longitude)?.lng.toFixed(5)}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center px-6 gap-3">
            <div className="h-14 w-14 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-center">
              <MapPin className="h-7 w-7 text-[var(--fg-subtle)]"/>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--fg)]">{t('noCoordinatesTitle')}</p>
              <p className="text-xs text-[var(--fg-muted)] mt-1">{t('noCoordinatesHint')}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleCurrentLocation}
              loading={locating}
              disabled={disabled}
            >
              {t('useCurrentLocation')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
