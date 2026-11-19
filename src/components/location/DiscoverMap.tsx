'use client'

/**
 * DiscoverMap — Phase L3. The map half of Discover's split view: one pin per
 * branch (vertical emoji), the customer's blue dot, card ↔ pin highlight,
 * and "Search this area" after the customer pans.
 */
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { MapViewLazy, type MapMarker } from '@/components/maps'
import type { GeoPoint } from '@/types/branch'
import { distanceKm } from '@/lib/geo'
import { resolveVertical } from '@/verticals'
import type { NearbyInput, NearbyResult } from '@/lib/nearby'
import { cn } from '@/utils'

/** Include the customer in the initial fit only when they're near the results. */
const FIT_USER_WITHIN_KM = 30

export interface DiscoverMapProps<T extends NearbyInput & { tenant: { name: string } }> {
  results: NearbyResult<T>[]
  user: GeoPoint | null
  userLabel?: string
  highlightedTenantId?: string | null
  onSelectTenant?: (tenantId: string) => void
  /** Called with the map centre when the customer taps "Search this area". */
  onSearchArea?: (center: GeoPoint) => void
  className?: string
}

export function DiscoverMap<T extends NearbyInput & { tenant: { name: string } }>({
  results,
  user,
  userLabel,
  highlightedTenantId,
  onSelectTenant,
  onSearchArea,
  className,
}: DiscoverMapProps<T>) {
  const t = useTranslations('nearby')
  const [panned, setPanned] = useState<GeoPoint | null>(null)

  const places = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = []
    for (const r of results) {
      const emoji = resolveVertical(r.item.tenant.businessTypes).emoji
      const many = r.item.branches.length > 1
      for (const b of r.branches) {
        out.push({
          id: `${r.item.tenant.id}::${b.branchId}`,
          position: b.point,
          emoji,
          label: many ? `${r.item.tenant.name} — ${b.branchName}` : r.item.tenant.name,
          highlighted: r.item.tenant.id === highlightedTenantId,
        })
      }
    }
    return out
  }, [results, highlightedTenantId])

  const markers = useMemo<MapMarker[]>(
    () => (user ? [...places, { id: 'me', position: user, variant: 'user', label: userLabel ?? t('youAreHere') }] : places),
    [places, user, userLabel, t],
  )

  // Refit only when the result set (not the highlight) changes.
  const placeKey = useMemo(() => places.map((p) => p.id).sort().join(','), [places])
  const fitPoints = useMemo(() => {
    const pts = places.map((p) => p.position)
    if (user && (pts.length === 0 || pts.some((p) => distanceKm(p, user) <= FIT_USER_WITHIN_KM))) pts.push(user)
    return pts
  }, [places, user])

  const center = user ?? places[0]?.position ?? { lat: 35.6892, lng: 51.389 }

  return (
    <div className={cn('relative', className)} data-testid="discover-map">
      <MapViewLazy
        center={center}
        zoom={13}
        markers={markers}
        cluster
        fitMarkersKey={`${placeKey}|${user ? `${user.lat.toFixed(3)},${user.lng.toFixed(3)}` : ''}`}
        fitPoints={fitPoints}
        onMarkerClick={(id) => {
          const tenantId = id.split('::')[0]
          if (tenantId && tenantId !== 'me') onSelectTenant?.(tenantId)
        }}
        onUserPan={(c) => setPanned(c)}
        className="h-full w-full overflow-hidden rounded-xl border border-[var(--border)]"
        ariaLabel={t('mapAria')}
      />
      {panned && onSearchArea && (
        <button
          type="button"
          onClick={() => {
            onSearchArea(panned)
            setPanned(null)
          }}
          className="absolute left-1/2 top-3 z-[1100] inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--fg)] shadow-lg ring-1 ring-[var(--border)] hover:bg-[var(--card-hover)]"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          {t('searchThisArea')}
        </button>
      )}
    </div>
  )
}
