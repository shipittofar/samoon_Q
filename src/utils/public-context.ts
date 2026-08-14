/**
 * P8.8.11.3 — Public Website Context Engine
 *
 * Single source of truth for all visibility, CTA, section, footer link,
 * SEO metadata, and structured-data decisions across the public website.
 *
 * All functions are pure (no React, no hooks, no side effects).
 * Server components and client components consume these identically.
 *
 * Five public function groups:
 *   buildPublicSections()    — Website Builder section enable/disable map
 *   buildPublicCTAs()        — Feature-flag-gated full CTA set
 *   buildFooterLinks()       — Feature-flag-aware quick links for TenantFooter
 *   buildTenantMetadata()    — Shared SEO metadata for [tenantSlug]/page.tsx
 *   buildBranchMetadata()    — Shared SEO metadata for [branchSlug]/page.tsx
 *   buildTenantJsonLd()      — JSON-LD for the tenant homepage
 *   buildBranchJsonLd()      — JSON-LD for a branch homepage
 */

import { DEFAULT_SECTIONS } from '@/types/website-builder'
import type { SectionConfig, SectionKey } from '@/types/website-builder'
import type { MarketplaceMeta } from '@/types/marketplace'
import { buildRestaurantJsonLd, serializeJsonLd } from '@/lib/json-ld'
import { canOrderFromTenant } from '@/lib/tenant-state'

// ── Shared constant ───────────────────────────────────────────────────────────

/** Single canonical base URL for all public pages. */
export const PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.samoon.com'

// ── Section visibility ────────────────────────────────────────────────────────

/**
 * Returns a section-key → enabled map for the public website.
 *
 * When layoutSections is absent (Website Builder not loaded or no config),
 * falls back to DEFAULT_SECTIONS from website-builder.ts (all major sections on).
 * Always fail-open: sections default to enabled when a key is unknown.
 */
export function buildPublicSections(
  layoutSections?: SectionConfig[],
): Record<SectionKey, boolean> {
  // Seed from defaults so every key has a value
  const result = {} as Record<SectionKey, boolean>
  for (const s of DEFAULT_SECTIONS) {
    result[s.key] = s.enabled
  }
  // Overlay with owner config if present
  if (layoutSections && layoutSections.length > 0) {
    for (const s of layoutSections) {
      result[s.key as SectionKey] = s.enabled
    }
  }
  return result
}

// ── CTA set ───────────────────────────────────────────────────────────────────

/** Branch-level capability — authoritative over tenant feature flags when provided. */
export interface BranchCapabilityInput {
  orderingEnabled?: boolean
  reservationsEnabled?: boolean
}

export interface PublicCTALink {
  label: string
  href: string
}

/**
 * Full set of feature-flag-gated page CTAs.
 *
 * Null means the feature is disabled — do not render the link.
 * Does NOT include branch-data CTAs (phone_number, directions) — those depend on
 * branch-specific data and are rendered directly by the calling component.
 *
 * Use getSmartCTA() from @/utils/navigation for the priority-ordered hero pair.
 * Use buildPublicCTAs() for the full secondary CTA set (QuickActions bars).
 */
export interface PublicCTASet {
  /** View Menu or Order Online depending on ordering flag. Null when menu disabled. */
  menu: PublicCTALink | null
  /** Reserve a Table. Null when reservations disabled. */
  reservation: PublicCTALink | null
  /** Loyalty Rewards. Null when loyalty disabled across all module variants. */
  loyalty: PublicCTALink | null
  /**
   * Choose a Location. Non-null only on the tenant homepage (branchSlug absent)
   * when branchCount > 1. Null on branch pages and single-branch tenants.
   */
  locations: PublicCTALink | null
}

interface BuildPublicCTAsOptions {
  tenantSlug: string
  /** Current branch slug. Undefined when on the tenant homepage. */
  branchSlug: string | undefined
  /** Fully resolved feature flags from useTenantStore((s) => s.featureFlags). */
  featureFlags: Record<string, boolean>
  /** Branch checkout/top-level flags — override tenant feature flags when set. */
  branch?: BranchCapabilityInput
  meta?: { branchCount?: number; primaryBranchSlug?: string } | null
  /** Tenant operational state — ordering requires status ACTIVE. */
  tenant?: { status?: string | null } | null
}

export function resolveOrderingEnabled(
  featureFlags: Record<string, boolean>,
  hasMenu: boolean,
  branch?: BranchCapabilityInput,
  tenant?: { status?: string | null } | null,
): boolean {
  if (tenant && !canOrderFromTenant(tenant)) return false
  if (!hasMenu) return false
  if (branch?.orderingEnabled !== undefined) return branch.orderingEnabled
  return featureFlags['ordering.enabled'] === true
}

export function resolveReservationsEnabled(
  featureFlags: Record<string, boolean>,
  branch?: BranchCapabilityInput,
): boolean {
  if (branch?.reservationsEnabled !== undefined) return branch.reservationsEnabled
  return featureFlags['reservations.enabled'] === true
}

/**
 * Builds the full set of feature-flag-gated CTAs for QuickActions bars.
 *
 * Key design decisions:
 * - Loyalty flag: resolved across all module-specific keys (loyalty.enabled,
 *   cafe.loyalty.enabled, mobile_cafe.loyalty.enabled) to eliminate the
 *   triple-OR pattern that was previously duplicated across files.
 * - Locations: only non-null on tenant homepage with branchCount > 1.
 * - Menu label: "Order Online" when ordering is enabled, "View Menu" otherwise.
 */
export function buildPublicCTAs(opts: BuildPublicCTAsOptions): PublicCTASet {
  const { tenantSlug, branchSlug, featureFlags, branch, meta, tenant } = opts
  const branchCount = meta?.branchCount ?? 1
  const primaryBranchSlug = meta?.primaryBranchSlug
  const resolvedBranchSlug = branchSlug ?? primaryBranchSlug
  const basePath = resolvedBranchSlug
    ? `/${tenantSlug}/${resolvedBranchSlug}`
    : `/${tenantSlug}`

  const hasMenu = featureFlags['menu.enabled'] === true
  const hasOrdering = resolveOrderingEnabled(featureFlags, hasMenu, branch, tenant)
  const hasReservations = resolveReservationsEnabled(featureFlags, branch)

  // Canonical loyalty check: resolves across all module flag key variants
  const loyaltyRaw =
    featureFlags['loyalty.enabled'] ??
    featureFlags['cafe.loyalty.enabled'] ??
    featureFlags['mobile_cafe.loyalty.enabled'] ??
    false
  const hasLoyalty = loyaltyRaw === true

  return {
    menu: hasMenu
      ? { label: hasOrdering ? 'Order Online' : 'View Menu', href: `${basePath}/menu` }
      : null,
    reservation: hasReservations
      ? { label: 'Reserve a Table', href: `${basePath}/reservation` }
      : null,
    loyalty: hasLoyalty
      ? { label: 'Loyalty', href: `${basePath}/loyalty` }
      : null,
    locations:
      branchCount > 1 && !branchSlug
        ? { label: 'Choose a Location', href: `/${tenantSlug}#branches` }
        : null,
  }
}

// ── Footer links ──────────────────────────────────────────────────────────────

export interface FooterQuickLink {
  label: string
  href: string
}

interface BuildFooterLinksOptions {
  tenantSlug: string
  /** Fully resolved feature flags from useTenantStore((s) => s.featureFlags). */
  featureFlags: Record<string, boolean>
  meta: Pick<MarketplaceMeta, 'primaryBranchSlug'>
  /** Primary branch capability — authoritative over tenant feature flags when set. */
  branch?: BranchCapabilityInput
}

/**
 * Builds the feature-flag-aware quick links list for TenantFooter.
 *
 * Previously TenantFooter had a hardcoded flat `/reservation` link that
 * was neither branch-aware nor flag-gated. This function fixes both issues:
 * Reservations appears only when `reservations.enabled` is true, and it
 * links to `/{tenantSlug}/{primaryBranchSlug}/reservation`.
 */
export function buildFooterLinks(opts: BuildFooterLinksOptions): FooterQuickLink[] {
  const { tenantSlug, featureFlags, meta, branch } = opts
  const primaryBranchSlug = meta.primaryBranchSlug
  const hasReservations = resolveReservationsEnabled(featureFlags, branch)

  const links: FooterQuickLink[] = [{ label: 'Home', href: `/${tenantSlug}` }]

  if (primaryBranchSlug) {
    links.push({ label: 'Menu', href: `/${tenantSlug}/${primaryBranchSlug}/menu` })
  }

  if (hasReservations && primaryBranchSlug) {
    links.push({
      label: 'Reservations',
      href: `/${tenantSlug}/${primaryBranchSlug}/reservation`,
    })
  }

  links.push({ label: 'Locations', href: `/${tenantSlug}#branches` })
  links.push({ label: 'Discover More', href: '/discover' })

  return links
}

// ── Metadata builders ─────────────────────────────────────────────────────────

interface PublicMetadataFields {
  title: string
  description: string
  url: string
  image: string
}

/**
 * Builds the canonical metadata fields for the tenant homepage.
 * Used by [tenantSlug]/page.tsx generateMetadata.
 */
export function buildTenantMetadata(opts: {
  tenantName: string
  tenantSlug: string
  meta?: Pick<MarketplaceMeta, 'description' | 'coverImage'> | null
}): PublicMetadataFields {
  const { tenantName, tenantSlug, meta } = opts
  return {
    title: `${tenantName} — Samoon Platform`,
    description: meta?.description ?? `Discover ${tenantName} on the Samoon platform.`,
    url: `${PUBLIC_BASE_URL}/${tenantSlug}`,
    image: meta?.coverImage ?? `${PUBLIC_BASE_URL}/og-image.jpg`,
  }
}

/**
 * Builds the canonical metadata fields for a branch homepage.
 * Used by [tenantSlug]/[branchSlug]/page.tsx generateMetadata.
 */
export function buildBranchMetadata(opts: {
  branchName: string
  tenantName: string
  tenantSlug: string
  branchSlug: string
  branchAddress?: string
  branchCity?: string
  branchImage?: string
  meta?: Pick<MarketplaceMeta, 'description' | 'coverImage'> | null
}): PublicMetadataFields {
  const {
    branchName,
    tenantSlug,
    branchSlug,
    branchAddress,
    branchCity,
    branchImage,
    meta,
  } = opts
  const locationStr =
    branchAddress && branchCity ? ` at ${branchAddress}, ${branchCity}.` : '.'
  return {
    title: `${branchName} — ${opts.tenantName}`,
    description: `Visit ${branchName}${locationStr} ${meta?.description ?? ''}`.trim(),
    url: `${PUBLIC_BASE_URL}/${tenantSlug}/${branchSlug}`,
    image: branchImage ?? meta?.coverImage ?? `${PUBLIC_BASE_URL}/og-image.jpg`,
  }
}

// ── JSON-LD builders ──────────────────────────────────────────────────────────

/**
 * Builds and serialises JSON-LD for the tenant homepage.
 *
 * Fixes two issues from the previous inline implementation:
 *   1. Uses buildRestaurantJsonLd (consistent @type: ['Restaurant','FoodEstablishment'])
 *   2. AggregateRating is omitted when reviews are disabled (Phase H compliance)
 *
 * Returns null when rating data is absent — caller skips the <script> tag.
 */
export function buildTenantJsonLd(opts: {
  tenantName: string
  tenantSlug: string
  meta?: Pick<MarketplaceMeta, 'rating' | 'reviewCount' | 'description' | 'phone_number' | 'coverImage'> | null
  /** Resolved feature flags. When absent, reviews default to enabled (safe for SEO). */
  featureFlags?: Record<string, boolean>
}): string | null {
  const { tenantName, tenantSlug, meta, featureFlags } = opts
  if (!meta?.rating || !meta.reviewCount) return null

  const reviewsEnabled = featureFlags ? featureFlags['reviews.enabled'] !== false : true

  const ld = buildRestaurantJsonLd({
    name: tenantName,
    url: `${PUBLIC_BASE_URL}/${tenantSlug}`,
    description: meta.description,
    telephone: meta.phone_number,
    image: meta.coverImage,
  })

  if (reviewsEnabled) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: meta.rating,
      reviewCount: meta.reviewCount,
      bestRating: 5,
      worstRating: 1,
    }
  }

  return serializeJsonLd(ld)
}

/**
 * Builds and serialises JSON-LD for a branch homepage.
 * Uses the same @type as buildTenantJsonLd for consistency.
 * Returns null when rating data is absent.
 */
export function buildBranchJsonLd(opts: {
  branchName: string
  tenantSlug: string
  branchSlug: string
  branchAddress?: string
  branchCity?: string
  branchPhone?: string
  branchImage?: string
  /** Branch-owned cuisine labels — never taken from tenant marketplace. */
  cuisines?: string[]
  meta?: Pick<MarketplaceMeta, 'rating' | 'reviewCount' | 'description'> | null
  featureFlags?: Record<string, boolean>
}): string | null {
  const {
    branchName,
    tenantSlug,
    branchSlug,
    branchAddress,
    branchCity,
    branchPhone,
    branchImage,
    cuisines,
    meta,
    featureFlags,
  } = opts

  if (!meta?.rating || !meta.reviewCount) return null

  const reviewsEnabled = featureFlags ? featureFlags['reviews.enabled'] !== false : true

  const ld = buildRestaurantJsonLd({
    name: branchName,
    url: `${PUBLIC_BASE_URL}/${tenantSlug}/${branchSlug}`,
    description: meta.description,
    telephone: branchPhone,
    image: branchImage,
    // Branch-only: omit when empty/absent — never inject defaults
    servesCuisine: cuisines?.length ? cuisines : undefined,
    address:
      branchAddress && branchCity
        ? { streetAddress: branchAddress, addressLocality: branchCity }
        : undefined,
  })

  if (reviewsEnabled) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: meta.rating,
      reviewCount: meta.reviewCount,
      bestRating: 5,
      worstRating: 1,
    }
  }

  return serializeJsonLd(ld)
}
