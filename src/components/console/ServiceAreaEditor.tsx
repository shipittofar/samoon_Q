'use client'

/**
 * ServiceAreaEditor — Phase L1. Lets an owner keep the vertical default or set
 * a custom service area (mode + radius) for a branch, previewed on a live map.
 * Clicking the map moves the branch pin, so owners can correct an inaccurate
 * location (nearby search is only as accurate as this pin).
 *
 * Circle only in L1; polygons and fee/ETA zones are modelled already
 * (BranchServiceArea) and get an editor in a later step.
 */
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { MapViewLazy } from '@/components/maps'
import { useTenantVertical } from '@/hooks/verticals'
import { readMapsSettings } from '@/lib/maps/config'
import { isValidGeoPoint, resolveBranchServiceArea } from '@/lib/geo'
import type { BranchCheckout, BranchServiceArea, GeoPoint, ServiceAreaMode } from '@/types/branch'

const MODES: ServiceAreaMode[] = ['delivery', 'on_site', 'visit_only']

const SELECT_CLASS =
  'w-full border rounded-lg px-3 py-2 text-sm bg-[var(--card)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]'

export function ServiceAreaEditor({
  value,
  checkout,
  latitude,
  longitude,
  onChange,
  onPinMove,
  locationVerifiedAt,
  onVerifyPin,
}: {
  /** null/undefined → use the default (delivery radius or vertical default). */
  value: BranchServiceArea | null | undefined
  checkout: BranchCheckout
  latitude: number | null
  longitude: number | null
  onChange: (next: BranchServiceArea | null) => void
  onPinMove?: (point: GeoPoint) => void
  /** Phase L2 — when the pin was confirmed exact (null/undefined = unverified). */
  locationVerifiedAt?: string | null
  onVerifyPin?: () => void
}) {
  const t = useTranslations('console')
  const tVerticals = useTranslations('verticals')
  const vertical = useTenantVertical()
  const settings = useMemo(() => readMapsSettings(), [])
  const maxKm = settings.maxServiceRadiusKm

  const center = useMemo(() => {
    const p = { lat: Number(latitude), lng: Number(longitude) }
    return isValidGeoPoint(p) ? p : null
  }, [latitude, longitude])

  const effective = resolveBranchServiceArea({ serviceArea: value ?? undefined, checkout }, vertical, { maxRadiusKm: maxKm })
  const source: 'custom' | 'delivery' | 'default' = value
    ? 'custom'
    : effective.mode === 'delivery'
      ? 'delivery'
      : 'default'
  const radiusKm = effective.shape.type === 'circle' ? effective.shape.radiusKm : 0

  const setCustom = (patch: Partial<{ mode: ServiceAreaMode; radiusKm: number }>) => {
    const base = value ?? effective
    const currentRadius = base.shape.type === 'circle' ? base.shape.radiusKm : radiusKm
    const nextRadius = Math.min(Math.max(patch.radiusKm ?? currentRadius, 0.1), maxKm)
    onChange({ ...base, mode: patch.mode ?? base.mode, shape: { type: 'circle', radiusKm: nextRadius } })
  }

  return (
    <fieldset className="space-y-4 rounded-lg border border-[var(--border)] p-4" data-testid="service-area-editor">
      <legend className="text-sm font-semibold text-[var(--fg-secondary)] px-1">{t('serviceArea.title')}</legend>
      <p className="text-xs text-[var(--fg-muted)]">{t('serviceArea.hint')}</p>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="service-area-source" checked={!value} onChange={() => onChange(null)} />
          {t('serviceArea.useDefault', { vertical: tVerticals(`labels.${vertical.key}`) })}
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="service-area-source" checked={!!value} onChange={() => setCustom({})} />
          {t('serviceArea.custom')}
        </label>
      </div>

      {value && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="service-area-mode" className="block text-sm font-medium mb-1">{t('serviceArea.mode')}</label>
            <select
              id="service-area-mode"
              className={SELECT_CLASS}
              value={value.mode}
              onChange={(e) => setCustom({ mode: e.target.value as ServiceAreaMode })}
            >
              {MODES.map((m) => (
                <option key={m} value={m}>{t(`serviceArea.modes.${m}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="service-area-radius" className="block text-sm font-medium mb-1">{t('serviceArea.radiusKm')}</label>
            <input
              id="service-area-radius"
              type="number"
              min={0.1}
              max={maxKm}
              step={0.5}
              className={SELECT_CLASS}
              value={value.shape.type === 'circle' ? value.shape.radiusKm : ''}
              onChange={(e) => {
                const n = parseFloat(e.target.value)
                if (Number.isFinite(n)) setCustom({ radiusKm: n })
              }}
            />
            <p className="mt-1 text-xs text-[var(--fg-muted)]">{t('serviceArea.maxRadiusHint', { max: maxKm })}</p>
          </div>
        </div>
      )}

      <p className="text-sm" data-testid="service-area-summary">
        {t('serviceArea.effective', {
          mode: t(`serviceArea.modes.${effective.mode}`),
          radius: radiusKm,
          source: t(`serviceArea.sources.${source}`),
        })}
      </p>

      {center ? (
        <>
          <MapViewLazy
            center={center}
            markers={[{ id: 'branch', position: center, emoji: vertical.emoji }]}
            circles={[{ id: 'area', center, radiusKm, mode: effective.mode }]}
            fitToCircle
            onMapClick={onPinMove}
            ariaLabel={t('serviceArea.mapAria')}
            className="h-72 w-full overflow-hidden rounded-xl border border-[var(--border)]"
          />
          <p className="text-xs text-[var(--fg-muted)]">{t(onPinMove ? 'serviceArea.clickToMovePin' : 'serviceArea.pinFromAddress')}</p>
          {onVerifyPin && (
            <div className="flex flex-wrap items-center gap-3" data-testid="pin-verification">
              {locationVerifiedAt ? (
                <span className="text-sm text-[var(--success-text)]">✓ {t('serviceArea.pinVerified')}</span>
              ) : (
                <>
                  <span className="text-sm text-[var(--warning-text)]">{t('serviceArea.pinUnverified')}</span>
                  <button
                    type="button"
                    onClick={onVerifyPin}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--card-hover)]"
                  >
                    {t('serviceArea.confirmPin')}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-[var(--fg-muted)]">{t('serviceArea.noLocation')}</p>
      )}
    </fieldset>
  )
}
