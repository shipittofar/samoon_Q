/**
 * Day planner — task specs → branch candidates (Phase L5).
 *
 * A task the customer types is one of:
 *   - category: a business type ("beauty_salon", "clinic");
 *   - query:    free text matched against names, tags and menus ("pizza", "آش");
 *   - business: one specific business (any of its branches).
 * Candidates are the business branches nearest to the start point.
 */
import type { GeoPoint } from '@/types/branch'
import type { PublicBranchInfo, MarketplaceMeta } from '@/types/marketplace'
import { matchesSearch } from '@/types/marketplace'
import { distanceKm, isValidGeoPoint } from '@/lib/geo'
import { matchesMenuQuery } from '@/lib/nearby'
import { resolveVertical } from '@/verticals'
import { MAX_CANDIDATES_PER_TASK, parseClock, type PlanCandidate, type PlanTask } from './plan'

export type PlanTaskKind = 'category' | 'query' | 'business'

/** What the customer entered — persisted on the device (no positions). */
export interface PlanTaskSpec {
  id: string
  kind: PlanTaskKind
  label: string
  businessType?: string
  query?: string
  tenantId?: string
  /** Customer override; null = the default for the kind of place. */
  durationMin?: number | null
  /** "HH:MM" fixed start (appointment); null = any time. */
  at?: string | null
}

export interface PlannerItem {
  tenant: { id: string; name: string; businessTypes: string[] }
  meta: MarketplaceMeta
  branches: PublicBranchInfo[]
}

/** A day route stays in town: farther branches are never candidates. */
export const MAX_CANDIDATE_KM = 40

/** Typical visit length by vertical (minutes). */
export const DEFAULT_VISIT_MINUTES: Record<string, number> = {
  restaurant: 45,
  food_court: 40,
  bar: 60,
  cafe: 30,
  food_truck: 20,
  mobile_cafe: 15,
  hotel: 30,
  beauty_salon: 60,
  clinic: 40,
  other: 30,
}

export function defaultVisitMinutes(businessType: string | undefined): number {
  return (businessType && DEFAULT_VISIT_MINUTES[businessType]) || 30
}

export function itemMatchesTask(item: PlannerItem, spec: PlanTaskSpec): boolean {
  switch (spec.kind) {
    case 'business':
      return item.tenant.id === spec.tenantId
    case 'category':
      return !!spec.businessType && item.tenant.businessTypes.includes(spec.businessType)
    case 'query': {
      const q = spec.query ?? spec.label
      return !!q.trim() && (matchesSearch(item.tenant.name, item.meta, item.tenant.businessTypes, q) || matchesMenuQuery(item.branches, q))
    }
  }
}

export function candidatesForTask(
  items: readonly PlannerItem[],
  spec: PlanTaskSpec,
  start: GeoPoint,
  limit = MAX_CANDIDATES_PER_TASK,
  maxKm = MAX_CANDIDATE_KM,
): PlanCandidate[] {
  const out: (PlanCandidate & { km: number })[] = []
  for (const item of items) {
    if (!itemMatchesTask(item, spec)) continue
    const emoji = resolveVertical(item.tenant.businessTypes).emoji
    for (const b of item.branches) {
      if (b.marketplaceVisible === false) continue
      const point = { lat: Number(b.latitude), lng: Number(b.longitude) }
      if (b.latitude == null || b.longitude == null || !isValidGeoPoint(point)) continue
      out.push({
        id: `${item.tenant.id}::${b.id}`,
        tenantId: item.tenant.id,
        tenantName: item.tenant.name,
        branchId: b.id,
        branchName: b.name,
        point,
        emoji,
        address: [b.address, b.city].filter(Boolean).join(', '),
        businessHours: b.businessHours,
        km: distanceKm(start, point),
      })
    }
  }
  return out
    .filter((c) => c.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
    .map(({ km: _km, ...c }) => c)
}

/** Builds engine tasks from the customer's specs. */
export function buildPlanTasks(items: readonly PlannerItem[], specs: readonly PlanTaskSpec[], start: GeoPoint): PlanTask[] {
  return specs.map((spec) => {
    const candidates = candidatesForTask(items, spec, start)
    const type =
      spec.kind === 'category'
        ? spec.businessType
        : items.find((i) => i.tenant.id === candidates[0]?.tenantId)?.tenant.businessTypes[0]
    return {
      id: spec.id,
      label: spec.label,
      durationMin: spec.durationMin && spec.durationMin > 0 ? spec.durationMin : defaultVisitMinutes(type),
      at: parseClock(spec.at),
      candidates,
    }
  })
}
