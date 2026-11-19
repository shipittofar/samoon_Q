'use client'

/**
 * ProximityLine — Phase L3. Card-level answer to "how far, how long, and
 * does it serve me?", plus which menu items matched an item search.
 */
import { useLocale, useTranslations } from 'next-intl'
import { Navigation, Truck, UtensilsCrossed, CircleSlash, Home, MapPin, Route } from 'lucide-react'
import { cn } from '@/utils'
import type { BranchProximity } from '@/lib/nearby'
import { formatDistance } from '@/lib/travel'

export function ProximityLine({
  proximity,
  showBranchName,
  className,
  onDirections,
}: {
  proximity: BranchProximity
  showBranchName?: boolean
  className?: string
  /** Phase L4 — opens the directions sheet. */
  onDirections?: () => void
}) {
  const t = useTranslations('nearby')
  const locale = useLocale()
  const d = formatDistance(proximity.distanceKm)

  let badge: { label: string; tone: 'ok' | 'muted'; Icon: typeof Truck } | null = null
  if (proximity.inside) {
    if (proximity.mode === 'delivery') badge = { label: t('deliversToYou'), tone: 'ok', Icon: Truck }
    else if (proximity.mode === 'on_site') badge = { label: t('comesToYou'), tone: 'ok', Icon: Home }
    else badge = { label: t('inYourArea'), tone: 'ok', Icon: MapPin }
  } else if (proximity.mode === 'delivery') {
    badge = { label: t('outsideDelivery'), tone: 'muted', Icon: CircleSlash }
  } else if (proximity.mode === 'on_site') {
    badge = { label: t('outsideService'), tone: 'muted', Icon: CircleSlash }
  }

  const matches = proximity.menuMatches
  return (
    <div className={cn('space-y-1.5 text-xs', className)} data-testid="proximity-line" data-inside={proximity.inside}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--fg-muted)]">
        <span className="inline-flex items-center gap-1 font-medium text-[var(--fg)]">
          <Navigation className="h-3.5 w-3.5 text-[var(--accent-text)]" aria-hidden="true" />
          {t(`distance_${d.unit}`, { value: d.value })}
        </span>
        <span aria-hidden="true">·</span>
        <span>{t(`eta_${proximity.travelMode}`, { minutes: proximity.etaMinutes })}</span>
        {showBranchName && (
          <>
            <span aria-hidden="true">·</span>
            <span className="truncate">{proximity.branchName}</span>
          </>
        )}
        {!proximity.verified && <span className="text-[var(--fg-subtle)]">({t('approxLocation')})</span>}
        {onDirections && (
          <button
            type="button"
            onClick={onDirections}
            className="ms-auto inline-flex min-h-[28px] items-center gap-1 rounded-full px-2 font-medium text-[var(--accent-text)] hover:bg-[var(--accent-subtle)]"
            data-testid="directions-button"
          >
            <Route className="h-3.5 w-3.5" aria-hidden="true" />
            {t('directions')}
          </button>
        )}
      </div>
      {(badge || matches.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {badge && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
                badge.tone === 'ok'
                  ? 'border-[var(--success-border,var(--border))] bg-[var(--success-subtle)] text-[var(--success-text)]'
                  : 'border-[var(--border)] text-[var(--fg-subtle)]',
              )}
            >
              <badge.Icon className="h-3 w-3" aria-hidden="true" />
              {badge.label}
            </span>
          )}
          {matches.length > 0 && (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-[var(--accent-subtle)] px-2 py-0.5 text-[var(--accent-text)]">
              <UtensilsCrossed className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {t('menuMatches', { items: new Intl.ListFormat(locale, { style: 'narrow', type: 'unit' }).format(matches.slice(0, 2)) })}
                {matches.length > 2 && ` ${t('moreItems', { count: matches.length - 2 })}`}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
