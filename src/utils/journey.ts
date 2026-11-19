/**
 * P8.8.11.4 — Smart Customer Journey Engine
 *
 * Wraps the Public Context Engine (P8.8.11.3) to add business-type-aware
 * prioritization of CTAs, body section order, and navigation hints.
 *
 * Design contract:
 *   - PURE — no React, no hooks, no side effects.
 *   - DELEGATES — never re-resolves feature flags, CTAs, or section
 *     visibility.  Those remain owned by buildPublicCTAs / buildPublicSections.
 *   - WRAPS — receives already-resolved outputs and adds ordering/priority on
 *     top of them.
 *
 * Callers must:
 *   1. Resolve CTAs via buildPublicCTAs().
 *   2. Resolve section visibility via buildPublicSections().
 *   3. Call buildCustomerJourney() with both resolved outputs.
 *   4. Use sectionOrder to drive render order; gate each section with the
 *      visibility map from buildPublicSections().
 */

import type { SectionKey } from '@/types/website-builder'
import type { PublicCTALink, PublicCTASet } from './public-context'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PrimaryBusinessType =
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'food_court'
  | 'food_truck'
  | 'mobile_cafe'
  | 'hotel'
  | 'other'
  | 'beauty_salon'
  | 'clinic'

export interface CustomerJourney {
  /**
   * Body section keys in the recommended display order for this business type.
   * Excludes 'hero' — hero is always first.
   * Section visibility is still controlled by buildPublicSections(); a section
   * in this list is only rendered when sections[key] === true.
   */
  sectionOrder: SectionKey[]
  /** Highest-priority CTA for this business type + flag combination. */
  primaryCTA: PublicCTALink | null
  /** Remaining active CTAs in priority order (the primary is excluded). */
  secondaryCTAs: PublicCTALink[]
  /**
   * Nav item keys in recommended display order for this business type.
   * Consumed by buildTenantNavigation() as an optional hint; Website Builder
   * config still takes precedence when present.
   */
  navPriority: string[]
}

// ── Section order profiles ────────────────────────────────────────────────────

// Only the body sections that homepage clients render (hero excluded).
// 'events', 'faq', 'contact' are Website-Builder-only sections not yet
// rendered by homepage clients, so they're omitted from profiles.

const DEFAULT_SECTION_ORDER: SectionKey[] = [
  'featured_menu',
  'about',
  'reviews',
  'gallery',
  'branches',
  'promotions',
]

/**
 * Business-type section order profiles.
 *
 * Rationale per type:
 *   restaurant  — menu + reviews build trust before "About"; multi-location
 *                 context moves branches lower
 *   cafe        — menu + promotions (daily specials) are the pull; story is
 *                 less important than deals
 *   bar         — menu items (cocktails), ambience (About), then trust (reviews)
 *   food_truck  — location is the critical question first; then today's menu
 *   mobile_cafe — same as food_truck
 *   food_court  — choose-your-spot (branches) first; then menu overview
 *   hotel       — story matters; menu is secondary; bookings are via reservation
 *   other       — sensible default
 */
const SECTION_ORDER_BY_TYPE: Record<PrimaryBusinessType, SectionKey[]> = {
  restaurant: ['featured_menu', 'reviews',  'about',         'gallery', 'branches', 'promotions'],
  cafe:       ['featured_menu', 'promotions', 'about',       'reviews', 'gallery',  'branches'],
  bar:        ['featured_menu', 'about',    'reviews',       'gallery', 'promotions','branches'],
  food_truck: ['branches',     'featured_menu', 'promotions','about',   'reviews',  'gallery'],
  mobile_cafe:['branches',     'featured_menu', 'promotions','about',   'reviews',  'gallery'],
  food_court: ['branches',     'featured_menu', 'about',     'reviews', 'gallery',  'promotions'],
  hotel:      ['about',        'featured_menu', 'reviews',   'gallery', 'promotions','branches'],
  // Service verticals: the service list and social proof sell the booking.
  beauty_salon: ['featured_menu', 'gallery', 'reviews',      'promotions', 'about', 'branches'],
  clinic:       ['featured_menu', 'about',   'reviews',      'branches',   'gallery', 'promotions'],
  other:      DEFAULT_SECTION_ORDER,
}

// ── Nav priority profiles ─────────────────────────────────────────────────────

/**
 * Recommended nav item key order per business type.
 * Values must match the `key` fields produced by buildTenantNavigation().
 */
const NAV_PRIORITY_BY_TYPE: Record<PrimaryBusinessType, string[]> = {
  restaurant:  ['menu', 'reservation', 'gallery', 'reviews'],
  cafe:        ['menu', 'loyalty',     'order',   'gallery'],
  bar:         ['menu', 'reservation', 'events',  'gallery'],
  food_truck:  ['locations', 'menu',   'order'],
  mobile_cafe: ['locations', 'menu',   'loyalty', 'order'],
  food_court:  ['locations', 'menu',   'gallery'],
  hotel:       ['menu',      'reservation', 'gallery'],
  beauty_salon: ['menu',     'reservation', 'gallery', 'reviews'],
  clinic:       ['menu',     'reservation', 'reviews'],
  other:       ['menu',      'reservation'],
}

// ── CTA ordering ──────────────────────────────────────────────────────────────

/**
 * Orders already-resolved CTAs by business-type priority.
 *
 * Three priority groups:
 *   location-first  (food_truck, mobile_cafe) — find the truck before ordering
 *   reservation-first (restaurant, bar, hotel) — book then browse
 *   menu-first       (cafe, food_court, other) — browse then engage
 */
function orderCTAs(
  ctas: PublicCTASet,
  primaryType: PrimaryBusinessType,
): { primaryCTA: PublicCTALink | null; secondaryCTAs: PublicCTALink[] } {
  const locationFirst = primaryType === 'food_truck' || primaryType === 'mobile_cafe'
  const reservationFirst =
    primaryType === 'restaurant' || primaryType === 'bar' || primaryType === 'hotel' ||
    primaryType === 'beauty_salon' || primaryType === 'clinic'

  const priority: Array<PublicCTALink | null> = locationFirst
    ? [ctas.locations, ctas.menu, ctas.reservation, ctas.loyalty]
    : reservationFirst
      ? [ctas.reservation, ctas.menu, ctas.loyalty, ctas.locations]
      : /* menu-first */ [ctas.menu, ctas.loyalty, ctas.reservation, ctas.locations]

  const active = priority.filter((c): c is PublicCTALink => c !== null)
  return { primaryCTA: active[0] ?? null, secondaryCTAs: active.slice(1) }
}

// ── Main builder ──────────────────────────────────────────────────────────────

export interface BuildCustomerJourneyOptions {
  /**
   * Tenant.businessTypes array.
   * The first entry drives the journey profile; subsequent entries are ignored.
   */
  businessTypes: string[]
  /**
   * Resolved CTA set from buildPublicCTAs().
   * The journey engine orders these — it does NOT re-resolve them.
   */
  ctas: PublicCTASet
}

/**
 * Builds a business-type-aware customer journey.
 *
 * Returns section order, ordered CTAs, and nav priority hints based on the
 * primary business type.  All resolution of feature flags, section visibility,
 * and branch counts remains in the Public Context Engine (P8.8.11.3).
 */
export function buildCustomerJourney(opts: BuildCustomerJourneyOptions): CustomerJourney {
  const { businessTypes, ctas } = opts
  const primaryType = (businessTypes[0] ?? 'other') as PrimaryBusinessType

  const sectionOrder =
    SECTION_ORDER_BY_TYPE[primaryType] ?? DEFAULT_SECTION_ORDER
  const navPriority =
    NAV_PRIORITY_BY_TYPE[primaryType] ?? NAV_PRIORITY_BY_TYPE.other

  const { primaryCTA, secondaryCTAs } = orderCTAs(ctas, primaryType)

  return { sectionOrder, primaryCTA, secondaryCTAs, navPriority }
}
