'use client'

/**
 * LocationPickerModal — Phase L2. Shows where we think the customer is (with
 * the accuracy circle), lets them correct it by tapping the map, use the
 * device location, or confirm a doubtful fix.
 */
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Crosshair, MapPin } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MapViewLazy } from '@/components/maps'
import type { GeoPoint } from '@/types/branch'
import type { UseUserLocationResult } from '@/hooks/location'

export function LocationPickerModal({
  open,
  onClose,
  loc,
}: {
  open: boolean
  onClose: () => void
  loc: UseUserLocationResult
}) {
  const t = useTranslations('location')
  const shown = loc.pending
    ? { point: loc.pending.fix.point, accuracyM: loc.pending.fix.accuracyM }
    : { point: loc.location.point, accuracyM: loc.location.accuracyM }
  const [picked, setPicked] = useState<GeoPoint | null>(null)

  useEffect(() => {
    if (open) setPicked(null)
  }, [open])

  const center = picked ?? shown.point
  const accuracyKm = !picked && shown.accuracyM ? shown.accuracyM / 1000 : 0

  return (
    <Modal open={open} onClose={onClose} title={t('pickerTitle')} size="lg">
      <div className="space-y-3">
        {loc.pending && !picked && (
          <p role="alert" className="rounded-lg bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning-text)]">
            {loc.pending.reason === 'implausible_jump' ? t('confirmJump') : t('confirmLowAccuracy')}
          </p>
        )}
        <p className="text-sm text-[var(--fg-muted)]">{t('pickerHint')}</p>
        <MapViewLazy
          center={center}
          zoom={15}
          markers={[{ id: 'me', position: center, emoji: '📍' }]}
          circles={accuracyKm > 0 ? [{ id: 'accuracy', center, radiusKm: accuracyKm, color: '#0ea5e9' }] : []}
          onMapClick={setPicked}
          ariaLabel={t('pickerMapAria')}
          className="h-80 w-full overflow-hidden rounded-xl border border-[var(--border)]"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            leftIcon={<Crosshair className="h-4 w-4" />}
            onClick={() => {
              loc.requestDeviceLocation()
              onClose()
            }}
          >
            {t('useMyLocation')}
          </Button>
          <Button
            type="button"
            className="flex-1"
            leftIcon={<MapPin className="h-4 w-4" />}
            onClick={() => {
              if (picked) loc.setManual(picked)
              else if (loc.pending) loc.confirmPending()
              else loc.setManual(shown.point)
              onClose()
            }}
          >
            {picked ? t('usePickedLocation') : t('confirmLocation')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
