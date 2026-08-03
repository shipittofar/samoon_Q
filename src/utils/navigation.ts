/**
 * P8.8.11.2 — Centralized tenant navigation builder
 *
 * All business logic for constructing tenant/branch navigation lives here.
 * TenantHeader renders the output — it contains no nav business logic itself.
 *
 * Three public functions:
 *   buildTenantNavigation() — ordered, feature-aware, branch-aware nav links
 *   getSmartCTA()           — priority-ordered hero/header CTAs
 *   getBusinessTypeBadge()  — emoji + label for business type identity
 */

import { getMarketplaceMeta } from '@/types/marketplace'
import type { TenantNavItemConfig } from '@/types/website-builder'
import type { NavItem, Tenant } from '@/types'
import type { BranchCapabilityInput } from './public-context'
import { resolveOrderingEnabled, resolveReservationsEnabled } from './public-context'

// ── Types ────────────────────────────────────────────────────────────────────

/** A fully-resolved nav link ready for rendering. */
export interface TenantNavLink {
  /** Stable key for React list rendering and Website Builder config matching. */
  key: string
  /** Full, branch-aware URL (e.g. /brew-cafe/midtown/menu). */
  href: string
  /** Display label. */
  label: string
  /** True for the marketplace re-entry item ("Explore Businesses"). */
  isMarketplace?: boolean
  /** True for the multi-branch Locations item. */
  isLocations?: boolean
}

/** Primary and optional secondary action CTAs for hero sections. */
export interface SmartCTA {
  primary: { label: string; href: string }
  secondary?: { label: string; href: string }
}

// ── Business type badge ──────────────────────────────────────────────────────

const BUSINESS_TYPE_EMOJIS: Record<string, string> = {
  restaurant:  '🍽️',
  cafe:        '☕',
  bar:         '🍺',
  food_truck:  '🚚',
  food_court:  '🏪',
  mobile_cafe: '☕',
  bakery:      '🥐',
  pizzeria:    '🍕',
  hotel:       '🏨',
}

const BUSINESS_TYPE_DISPLAY: Record<string, string> = {
  restaurant:  'Restaurant',
  cafe:        'Cafe',
  bar:         'Bar',
  food_truck:  'Food Truck',
  food_court:  'Food Court',
  mobile_cafe: 'Mobile Cafe',
  bakery:      'Bakery',
  pizzeria:    'Pizzeria',
  hotel:       'Hotel',
}

/**
 * Returns a short emoji + label badge for the primary business type,
 * or null if the type is unknown. Never hardcodes per-tenant values.
 *
 * Example: getBusinessTypeBadge(['cafe', 'bakery']) → '☕ Cafe'
 */
export function getBusinessTypeBadge(businessTypes: string[]): string | null {
  if (!businessTypes || businessTypes.length === 0) return null
  const primary = businessTypes[0]
  const emoji = BUSINESS_TYPE_EMOJIS[primary]
  const label = BUSINESS_TYPE_DISPLAY[primary]
  if (!emoji || !label) return null
  return `${emoji} ${label}`
}

// ── Navigation builder ────────────────────────────────────────────────────────

interface BuildTenantNavOptions {
  /** Active tenant (provides slug, settings, businessTypes). */
  tenant: Tenant
  /** Active branch slug, or undefined when on the tenant homepage. */
  branchSlug: string | undefined
  /** Feature-flag-filtered nav items from useModuleNav(). */
  moduleNavItems: NavItem[]
  /**
   * Optional Website Builder nav config from HomepageLayout.navItems.
   * When present, controls item visibility, ordering, and custom labels.
   * Website Builder config takes precedence over journeyNavPriority.
   */
  layoutNavConfig?: TenantNavItemConfig[]
  /**
   * Optional business-type-driven nav key order from buildCustomerJourney().
   * Applied only when layoutNavConfig is absent or has no ordering config.
   * Example: ['locations', 'menu', 'order'] for food_truck.
   */
  journeyNavPriority?: string[]
}

/**
 * Builds the complete, ordered tenant navigation link list.
 *
 * Layer order (highest priority last wins):
 *   1. Module registry navItems (feature-flag filtered by useModuleNav)
 *   2. Multi-branch Locations injection
 *   3. Website Builder config (visibility, order, custom labels)
 *
 * The returned array is always led by the marketplace re-entry item.
 */
export function buildTenantNavigation(opts: BuildTenantNavOptions): TenantNavLink[] {
  const { tenant, branchSlug, moduleNavItems, layoutNavConfig, journeyNavPriority } = opts
  const tenantSlug = tenant.slug
  const meta = getMarketplaceMeta(tenant.settings)
  const branchCount = meta?.branchCount ?? 1
  const isMultiBranch = branchCount > 1

  const basePath = branchSlug
    ? `/${tenantSlug}/${branchSlug}`
    : `/${tenantSlug}`

  // Step 1: marketplace re-entry — always first (Phase E)
  const marketplaceItem: TenantNavLink = {
    key: 'marketplace',
    href: '/discover',
    label: 'Explore Businesses',
    isMarketplace: true,
  }

  // Step 2: business nav items — module navItems with branch-aware hrefs
  let businessItems: TenantNavLink[] = moduleNavItems.map((item) => ({
    key: item.href.replace(/^\//, ''),   // '/menu' → 'menu'
    href: `${basePath}${item.href}`,
    label: item.label,
  }))

  // Step 3: multi-branch Locations injection (Phase D)
  // Only shown when there are multiple branches. Injected after the first
  // business item (Menu) so it appears second in the business nav.
  if (isMultiBranch) {
    const locationsItem: TenantNavLink = {
      key: 'locations',
      href: `/${tenantSlug}#branches`,
      label: 'Locations',
      isLocations: true,
    }
    businessItems = [
      ...businessItems.slice(0, 1),
      locationsItem,
      ...businessItems.slice(1),
    ]
  }

  // Step 4: apply journey nav priority (Phase E — P8.8.11.4)
  // Only applied when Website Builder does not already define ordering.
  // Reorders business items by the journey profile's preferred key order;
  // items not in the priority list are appended at the end.
  const hasWBOrdering =
    layoutNavConfig && layoutNavConfig.some((c) => c.enabled && c.order != null)
  if (!hasWBOrdering && journeyNavPriority && journeyNavPriority.length > 0) {
    const byKey = new Map(businessItems.map((i) => [i.key, i]))
    const ordered = journeyNavPriority.flatMap((k) => (byKey.has(k) ? [byKey.get(k)!] : []))
    const unordered = businessItems.filter((i) => !journeyNavPriority.includes(i.key))
    businessItems = [...ordered, ...unordered]
  }

  // Step 5: apply Website Builder configuration (Phase I)
  if (layoutNavConfig && layoutNavConfig.length > 0) {
    // 4a. Remove items disabled by the owner
    const disabledKeys = new Set(
      layoutNavConfig.filter((c) => !c.enabled).map((c) => c.key),
    )
    businessItems = businessItems.filter((item) => !disabledKeys.has(item.key))

    // 4b. Apply custom labels (owner renames "Menu" → "Our Menu" etc.)
    businessItems = businessItems.map((item) => {
      const cfg = layoutNavConfig.find((c) => c.key === item.key)
      return cfg?.label ? { ...item, label: cfg.label } : item
    })

    // 4c. Apply owner-defined ordering
    const configuredOrder = layoutNavConfig
      .filter((c) => c.enabled)
      .sort((a, b) => a.order - b.order)
      .map((c) => c.key)

    if (configuredOrder.length > 0) {
      const byKey = new Map(businessItems.map((i) => [i.key, i]))
      const ordered = configuredOrder.flatMap((k) => (byKey.has(k) ? [byKey.get(k)!] : []))
      const unordered = businessItems.filter((i) => !configuredOrder.includes(i.key))
      businessItems = [...ordered, ...unordered]
    }
  }

  return [marketplaceItem, ...businessItems]
}


// ── Smart CTA ─────────────────────────────────────────────────────────────────

interface SmartCTAOptions {
  /** Tenant slug. */
  tenantSlug: string
  /**
   * Active branch slug. When undefined (tenant homepage), the primary branch
   * slug from marketplace meta is used as the CTA destination.
   */
  branchSlug: string | undefined
  /**
   * Fully-resolved feature flag map from useTenantStore().featureFlags.
   * Must be the resolved map, NOT tenant.settings.featureFlags (which is
   * the raw override only and misses module defaults + capability flags).
   */
  featureFlags: Record<string, boolean>
  /** Branch checkout/top-level flags — override tenant feature flags when set. */
  branch?: BranchCapabilityInput
  /**
   * Marketplace meta for branchCount and primaryBranchSlug.
   * Pass null/undefined when meta is unavailable — falls back to single-branch behavior.
   */
  meta?: { branchCount?: number; primaryBranchSlug?: string } | null
}

/**
 * Returns the priority-ordered primary and secondary CTAs for a hero section.
 *
 * Priority rules (Phase G):
 *   Ordering enabled + Reservations enabled → Order Online | Reserve a Table
 *   Reservations only                       → Reserve a Table | View Menu
 *   Ordering only                           → Order Online
 *   Menu only                               → View Menu
 *   Nothing                                 → (no CTA)
 *
 * Multi-branch on tenant homepage:
 *   → Choose a Location | View Menu (on primary branch)
 *
 * Single authoritative implementation — never duplicated across pages.
 */
export function getSmartCTA(opts: SmartCTAOptions): SmartCTA | null {
  const { tenantSlug, branchSlug, featureFlags, branch, meta } = opts
  const branchCount = meta?.branchCount ?? 1
  const primaryBranchSlug = meta?.primaryBranchSlug

  // On the tenant homepage with no active branchSlug, use the primary branch
  const resolvedBranchSlug = branchSlug ?? primaryBranchSlug
  const basePath = resolvedBranchSlug
    ? `/${tenantSlug}/${resolvedBranchSlug}`
    : `/${tenantSlug}`

  const hasMenu = featureFlags['menu.enabled'] === true
  const hasOrdering = resolveOrderingEnabled(featureFlags, hasMenu, branch)
  const hasReservations = resolveReservationsEnabled(featureFlags, branch)

  // Multi-branch tenant homepage: navigate to the locations section first
  if (branchCount > 1 && !branchSlug) {
    return {
      primary: { label: 'Choose a Location', href: `/${tenantSlug}#branches` },
      secondary: hasMenu ? { label: 'View Menu', href: `${basePath}/menu` } : undefined,
    }
  }

  if (hasOrdering && hasReservations) {
    return {
      primary:   { label: 'Order Online',     href: `${basePath}/menu` },
      secondary: { label: 'Reserve a Table',  href: `${basePath}/reservation` },
    }
  }

  if (hasReservations && !hasOrdering) {
    return {
      primary:   { label: 'Reserve a Table',  href: `${basePath}/reservation` },
      secondary: hasMenu ? { label: 'View Menu', href: `${basePath}/menu` } : undefined,
    }
  }

  if (hasOrdering) {
    return {
      primary: { label: 'Order Online', href: `${basePath}/menu` },
    }
  }

  if (hasMenu) {
    return {
      primary: { label: 'View Menu', href: `${basePath}/menu` },
    }
  }

  return null
}
