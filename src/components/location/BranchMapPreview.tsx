'use client'

/**
 * BranchMapPreview — a branch's exact pin on the shared map, with a
 * Directions button (in-app route + hand-off). Renders nothing when the
 * branch has no valid pin; callers show a plain address fallback then.
 */
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { MapViewLazy } from '@/components/maps'
import { isValidGeoPoint } from '@/lib/geo'
import { cn } from '@/utils'
import { DirectionsButton } from './DirectionsButton'

export function BranchMapPreview({
  latitude,
  longitude,
  name,
  address,
  emoji,
  className,
}: {
  latitude?: number | null
  longitude?: number | null
  name: string
  address?: string
  emoji?: string
  className?: string
}) {
  const t = useTranslations('branch')
  const point = useMemo(() => {
    const p = { lat: Number(latitude), lng: Number(longitude) }
    return latitude != null && longitude != null && isValidGeoPoint(p) ? p : null
  }, [latitude, longitude])
  if (!point) return null

  return (
    <div className={cn('space-y-2', className)} data-testid="branch-map-preview">
      <MapViewLazy
        center={point}
        zoom={15}
        markers={[{ id: 'branch', position: point, emoji: emoji ?? '📍', label: name }]}
        scrollWheelZoom={false}
        ariaLabel={t('mapAria', { name })}
        className="h-48 w-full overflow-hidden rounded-xl border border-[var(--border)]"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {address && <p className="min-w-0 text-xs text-[var(--fg-subtle)]">{address}</p>}
        <DirectionsButton latitude={point.lat} longitude={point.lng} name={name} address={address} emoji={emoji} />
      </div>
    </div>
  )
}

/** Whether a branch has a usable pin (callers decide between preview and fallback). */
export function hasBranchPin(latitude?: number | null, longitude?: number | null): boolean {
  const p = { lat: Number(latitude), lng: Number(longitude) }
  return latitude != null && longitude != null && isValidGeoPoint(p)
}
