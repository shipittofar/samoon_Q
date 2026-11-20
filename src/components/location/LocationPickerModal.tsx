'use client'

/**
 * LocationPickerModal — Phase L2. Shows where we think the customer is (with
 * the accuracy circle), lets them correct it by tapping the map, ask the
 * device for a fresh position (retry as often as needed), or confirm a
 * doubtful reading.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Crosshair, Loader2, MapPin, RotateCw } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MapViewLazy } from '@/components/maps'
import type { GeoPoint } from '@/types/branch'
import type { LocateResult, UseUserLocationResult } from '@/hooks/location'
import type { LocationFix } from '@/lib/location/evaluate'
import { describeAccuracy } from '@/lib/location/evaluate'

type LocateError = Extract<LocateResult, { ok: false }>['reason']

export function LocationPickerModal({
  open,
  onClose,
  loc,
  autoLocate = false,
}: {
  open: boolean
  onClose: () => void
  loc: UseUserLocationResult
  /** Ask the device right away when the modal opens (chip's "Use my location"). */
  autoLocate?: boolean
}) {
  const t = useTranslations('location')
  const [picked, setPicked] = useState<GeoPoint | null>(null)
  const [deviceFix, setDeviceFix] = useState<LocationFix | null>(null)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<LocateError | null>(null)

  const { locate } = loc
  const runLocate = useCallback(async () => {
    setLocating(true)
    setError(null)
    setPicked(null)
    // A retry replaces the previous reading (never show an old result next to a new error).
    setDeviceFix(null)
    const result = await locate()
    setLocating(false)
    if (result.ok) setDeviceFix(result.fix)
    else setError(result.reason)
  }, [locate])

  useEffect(() => {
    if (!open) return
    setPicked(null)
    setDeviceFix(null)
    setError(null)
    if (autoLocate) void runLocate()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // What the map shows: a tapped point → a fresh device reading → the
  // pending (doubtful) reading → the current location.
  const base = loc.pending
    ? { point: loc.pending.fix.point, accuracyM: loc.pending.fix.accuracyM }
    : { point: loc.location.point, accuracyM: loc.location.accuracyM }
  const shown = picked
    ? { point: picked, accuracyM: null }
    : deviceFix
      ? { point: deviceFix.point, accuracyM: deviceFix.accuracyM }
      : base
  const accuracyKm = shown.accuracyM ? shown.accuracyM / 1000 : 0
  const acc = describeAccuracy(deviceFix && !picked ? deviceFix.accuracyM : null)

  const confirm = () => {
    if (picked) loc.setManual(picked)
    else if (deviceFix) loc.acceptDeviceFix(deviceFix)
    else if (loc.pending) loc.confirmPending()
    else loc.setManual(shown.point)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('pickerTitle')} size="lg">
      <div className="space-y-3" data-testid="location-picker">
        {loc.pending && !picked && !deviceFix && (
          <p role="alert" className="rounded-lg bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning-text)]">
            {loc.pending.reason === 'implausible_jump' ? t('confirmJump') : t('confirmLowAccuracy')}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-[var(--warning-subtle)] px-3 py-2 text-sm text-[var(--warning-text)]" data-testid="locate-error">
            {t(`locateError_${error}`)}
          </p>
        )}
        {deviceFix && !picked && (
          <p className="text-sm text-[var(--fg)]" role="status" data-testid="locate-result">
            {t('foundYou')}
            {acc && <span className="ms-1 text-[var(--fg-muted)]">{t(`accuracy_${acc.unit}`, { value: acc.value })}</span>}
          </p>
        )}
        <p className="text-sm text-[var(--fg-muted)]">{t('pickerHint')}</p>
        <MapViewLazy
          center={shown.point}
          zoom={15}
          markers={[{ id: 'me', position: shown.point, emoji: '📍' }]}
          circles={accuracyKm > 0 ? [{ id: 'accuracy', center: shown.point, radiusKm: accuracyKm, color: '#0ea5e9' }] : []}
          fitToCircle={accuracyKm > 0.3}
          onMapClick={setPicked}
          ariaLabel={t('pickerMapAria')}
          className="h-80 w-full overflow-hidden rounded-xl border border-[var(--border)]"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            disabled={locating}
            leftIcon={
              locating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : deviceFix || error ? (
                <RotateCw className="h-4 w-4" />
              ) : (
                <Crosshair className="h-4 w-4" />
              )
            }
            onClick={() => void runLocate()}
            data-testid="locate-button"
          >
            {locating ? t('locating') : deviceFix || error ? t('locateAgain') : t('useMyLocation')}
          </Button>
          <Button type="button" className="flex-1" leftIcon={<MapPin className="h-4 w-4" />} onClick={confirm} disabled={locating}>
            {picked || deviceFix ? t('usePickedLocation') : t('confirmLocation')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
