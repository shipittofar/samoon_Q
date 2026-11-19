'use client'

/**
 * LocationChip — Phase L2. "📍 Near you: Tehran · ±30 m" with one tap to fix
 * it. Mounts the single live-location watcher (useUserLocation({ watch: true })).
 */
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, ChevronDown, Crosshair, MapPin } from 'lucide-react'
import { cn } from '@/utils'
import { useUserLocation } from '@/hooks/location'
import { describeAccuracy } from '@/lib/location/evaluate'
import { LocationPickerModal } from './LocationPickerModal'

export function LocationChip({ className }: { className?: string }) {
  const t = useTranslations('location')
  const loc = useUserLocation({ watch: true })
  const [open, setOpen] = useState(false)
  const { location, status, pending } = loc

  // A doubtful fix opens the confirmation map once, automatically.
  const [promptedFor, setPromptedFor] = useState<number | null>(null)
  useEffect(() => {
    if (pending && promptedFor !== pending.fix.timestamp) {
      setPromptedFor(pending.fix.timestamp)
      setOpen(true)
    }
  }, [pending, promptedFor])

  const accuracy = describeAccuracy(location.source === 'gps' ? location.accuracyM : null)
  const place = location.area && location.city
    ? t('placeWithArea', { area: location.area, city: location.city })
    : location.city

  let label: string
  if (location.source === 'gps') label = place ? t('nearYouIn', { place }) : t('nearYou')
  else if (location.source === 'manual') label = place ? t('chosenIn', { place }) : t('chosenLocation')
  else if (location.source === 'address') label = place ? t('fromAddressIn', { place }) : t('fromAddress')
  else label = t('defaultArea')

  const canUseDevice = status === 'prompt' || status === 'idle' || status === 'unavailable'

  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-sm', className)} data-testid="location-chip" data-location-source={location.source}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors',
          pending
            ? 'border-[var(--warning-border,var(--border))] bg-[var(--warning-subtle)] text-[var(--warning-text)]'
            : 'border-[var(--border)] bg-[var(--card)] text-[var(--fg)] hover:bg-[var(--card-hover)]',
        )}
        aria-label={t('changeLocationAria')}
      >
        {pending ? <AlertTriangle className="h-4 w-4" aria-hidden="true" /> : <MapPin className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />}
        <span className="max-w-[60vw] truncate">{pending ? t('confirmNeeded') : label}</span>
        {accuracy && !pending && (
          <span className="text-xs text-[var(--fg-muted)]">{t(`accuracy_${accuracy.unit}`, { value: accuracy.value })}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
      </button>

      {location.source !== 'gps' && canUseDevice && (
        <button
          type="button"
          onClick={loc.requestDeviceLocation}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full px-2 py-1.5 text-[var(--accent-text)] hover:underline"
        >
          <Crosshair className="h-4 w-4" aria-hidden="true" />
          {t('useMyLocation')}
        </button>
      )}
      {status === 'denied' && location.source !== 'manual' && (
        <span className="text-xs text-[var(--fg-muted)]">{t('permissionDenied')}</span>
      )}

      <LocationPickerModal open={open} onClose={() => setOpen(false)} loc={loc} />
    </div>
  )
}
