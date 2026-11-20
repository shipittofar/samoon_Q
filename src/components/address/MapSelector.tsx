'use client'

/**
 * MapSelector — pick a place on the map. Built on the shared MapView (the
 * platform map provider and tile settings apply): tap the map to place the
 * pin, or use the device location. Used by the address form and the branch
 * form; the props are the contract both rely on.
 */
import { useCallback, useMemo, useState } from 'react'
import { Navigation } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { MapViewLazy } from '@/components/maps'
import { cn } from '@/utils'
import { parseMapCoordinates, type CoordinateInput } from '@/lib/coordinates'
import { isValidGeoPoint } from '@/lib/geo'
import { readMapsSettings } from '@/lib/maps/config'
import { describeAccuracy } from '@/lib/location/evaluate'
import { locateOnce } from '@/hooks/location'

export interface MapSelectorProps {
  latitude?: CoordinateInput
  longitude?: CoordinateInput
  onChange: (coords: { latitude: number; longitude: number }) => void
  className?: string
  disabled?: boolean
  /** Marker emoji (default 📍), e.g. the business vertical's icon. */
  emoji?: string
}

/** A reading worse than this is flagged as approximate (tap the map to correct). */
const APPROXIMATE_ABOVE_M = 1000

export function MapSelector({ latitude, longitude, onChange, className, disabled, emoji = '📍' }: MapSelectorProps) {
  const t = useTranslations('address.map')
  const tLoc = useTranslations('location')
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [accuracyM, setAccuracyM] = useState<number | null>(null)

  const coords = useMemo(() => {
    const parsed = parseMapCoordinates(latitude, longitude)
    // 0,0 is "unset", never a place.
    return parsed && isValidGeoPoint(parsed) ? parsed : null
  }, [latitude, longitude])

  const settings = useMemo(() => readMapsSettings(), [])

  const place = useCallback(
    (p: { lat: number; lng: number }, accuracy: number | null) => {
      setGeoError(null)
      setAccuracyM(accuracy)
      onChange({ latitude: p.lat, longitude: p.lng })
    },
    [onChange],
  )

  const handleCurrentLocation = async () => {
    setLocating(true)
    setGeoError(null)
    const result = await locateOnce()
    setLocating(false)
    if (result.ok) place(result.fix.point, result.fix.accuracyM)
    else setGeoError(tLoc(`locateError_${result.reason}`))
  }

  const acc = describeAccuracy(accuracyM)
  const approximate = accuracyM !== null && accuracyM > APPROXIMATE_ABOVE_M

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--fg)]">{t('locationLabel')}</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void handleCurrentLocation()}
          loading={locating}
          disabled={disabled}
          leftIcon={<Navigation className="h-4 w-4" />}
        >
          {t('useCurrentLocation')}
        </Button>
      </div>

      {geoError && (
        <p className="text-xs text-[var(--danger-text)]" role="alert">
          {geoError}
        </p>
      )}

      <div className="relative" data-testid="map-selector">
        <MapViewLazy
          center={coords ?? settings.defaultCenter}
          zoom={coords ? 16 : settings.defaultZoom}
          keepView
          markers={coords ? [{ id: 'pin', position: coords, emoji }] : []}
          circles={
            coords && accuracyM !== null && accuracyM > 50
              ? [{ id: 'accuracy', center: coords, radiusKm: accuracyM / 1000, color: '#0ea5e9' }]
              : []
          }
          onMapClick={disabled ? undefined : (p) => place(p, null)}
          ariaLabel={t('mapPreview')}
          className="aspect-[2/1] min-h-[220px] w-full overflow-hidden rounded-xl border border-[var(--border)]"
        />
        {coords ? (
          <div className="pointer-events-none absolute bottom-2 start-2 end-2 z-[500] rounded-lg border border-[var(--border)] bg-[var(--card)]/90 px-3 py-1.5 text-xs font-mono text-[var(--fg-muted)] backdrop-blur-sm">
            {`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
            {acc && <span className="ms-2 font-sans">{tLoc(`accuracy_${acc.unit}`, { value: acc.value })}</span>}
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-x-2 top-2 z-[500] rounded-lg border border-[var(--border)] bg-[var(--card)]/90 px-3 py-2 text-center backdrop-blur-sm">
            <p className="text-sm font-medium text-[var(--fg)]">{t('noCoordinatesTitle')}</p>
            <p className="text-xs text-[var(--fg-muted)]">{t('noCoordinatesHint')}</p>
          </div>
        )}
      </div>
      {approximate && <p className="text-xs text-[var(--warning-text)]">{t('approximate')}</p>}
    </div>
  )
}
