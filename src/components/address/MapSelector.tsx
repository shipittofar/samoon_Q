'use client'

import { useCallback, useEffect, useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/utils'

export interface MapSelectorProps {
  latitude?: number | null
  longitude?: number | null
  onChange: (coords: { latitude: number; longitude: number }) => void
  className?: string
  disabled?: boolean
}

export function MapSelector({ latitude, longitude, onChange, className, disabled }: MapSelectorProps) {
  const t = useTranslations('address.map')
  const [latInput, setLatInput] = useState(latitude?.toString() ?? '')
  const [lngInput, setLngInput] = useState(longitude?.toString() ?? '')
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  useEffect(() => {
    setLatInput(latitude?.toString() ?? '')
    setLngInput(longitude?.toString() ?? '')
  }, [latitude, longitude])

  const lat = latitude ?? (latInput ? parseFloat(latInput) : null)
  const lng = longitude ?? (lngInput ? parseFloat(lngInput) : null)
  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)

  const applyCoords = useCallback(
    (la: number, ln: number) => {
      setLatInput(la.toFixed(6))
      setLngInput(ln.toFixed(6))
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

  const mapUrl = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng! - 0.01}%2C${lat! - 0.01}%2C${lng! + 0.01}%2C${lat! + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`
    : null

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleCurrentLocation}
          loading={locating}
          disabled={disabled}
          leftIcon={<Navigation className="h-4 w-4" />}
        >
          {t('useCurrentLocation')}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t('latitude')}
          type="number"
          step="any"
          value={latInput}
          onChange={(e) => {
            setLatInput(e.target.value)
            const v = parseFloat(e.target.value)
            const ln = parseFloat(lngInput)
            if (!Number.isNaN(v) && !Number.isNaN(ln)) onChange({ latitude: v, longitude: ln })
          }}
          disabled={disabled}
        />
        <Input
          label={t('longitude')}
          type="number"
          step="any"
          value={lngInput}
          onChange={(e) => {
            setLngInput(e.target.value)
            const v = parseFloat(e.target.value)
            const la = parseFloat(latInput)
            if (!Number.isNaN(v) && !Number.isNaN(la)) onChange({ latitude: la, longitude: v })
          }}
          disabled={disabled}
        />
      </div>

      {geoError && <p className="text-xs text-red-500" role="alert">{geoError}</p>}

      <div
        className="relative rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--card-hover)] aspect-video"
        aria-label={t('mapPreview')}
      >
        {mapUrl ? (
          <iframe
            title={t('mapPreview')}
            src={mapUrl}
            className="w-full h-full min-h-[200px] border-0"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-[var(--fg-muted)] gap-2">
            <MapPin className="h-8 w-8 text-[var(--fg-subtle)]" />
            <p className="text-sm">{t('noCoordinates')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
