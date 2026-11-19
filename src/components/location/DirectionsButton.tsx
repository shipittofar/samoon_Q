'use client'

/**
 * DirectionsButton — Phase L4. Drop-in "Directions" button for any place with
 * coordinates (branch page, info panels). Renders nothing without a valid pin.
 */
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Route } from 'lucide-react'
import { isValidGeoPoint } from '@/lib/geo'
import { cn } from '@/utils'
import { DirectionsSheet, type DirectionsDestination } from './DirectionsSheet'

export function DirectionsButton({
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
  const t = useTranslations('nearby')
  const [open, setOpen] = useState(false)
  const point = { lat: Number(latitude), lng: Number(longitude) }
  if (latitude == null || longitude == null || !isValidGeoPoint(point)) return null
  const destination: DirectionsDestination = { point, name, address, emoji }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--accent-text)] hover:bg-[var(--card-hover)]',
          className,
        )}
        data-testid="directions-button"
      >
        <Route className="h-4 w-4" aria-hidden="true" />
        {t('directions')}
      </button>
      {open && <DirectionsSheet open onClose={() => setOpen(false)} destination={destination} />}
    </>
  )
}
