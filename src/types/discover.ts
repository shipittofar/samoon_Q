/**
 * Wire contract for GET /api/public/discover/
 */

import type { TenantStatus, TenantBranding, TenantTheme } from '@/types'
import type { BranchCheckout, BranchBusinessHours } from '@/types/branch'
import type { TenantMarketplaceSettings } from '@/types/marketplace'

/** Branch summary embedded in a discover tenant result. */
export interface DiscoverBranch {
  id: string
  slug: string
  name: string
  description?: string
  /** Branch logo. */
  image?: string
  coverImage?: string
  heroImage?: string
  openNow: boolean
  todayHours?: string
  phone_number?: string
  email?: string
  location: {
    address: string
    city: string
    country?: string
  }
  checkout?: BranchCheckout
  businessHours?: BranchBusinessHours[]
  currency?: string
  marketplaceVisible?: boolean
  reservationsEnabled?: boolean
  maxCapacity?: number
  cuisines?: string[]
  amenities?: string[]
}

/**
 * Discover marketplace projection: tenant listing metadata plus optional
 * computed fields provided by the public Discover API (not Tenant.settings).
 */
export type DiscoverMarketplace = TenantMarketplaceSettings & {
  openNow?: boolean
  branchCount?: number
  primaryBranchSlug?: string
}

/** Single tenant entry in the discover response. */
export interface DiscoverTenant {
  id: string
  slug: string
  name: string
  /** Tenant-owned public description. Independent of Branch.description. */
  description?: string
  /** Public visibility — prefer over `status` for catalog show/hide. */
  is_active?: boolean
  /** Operational state only — not used for discover visibility. */
  status: TenantStatus
  created_at: string
  businessTypes: string[]
  /** Tenant logo. Not Discover avatar or cover. */
  image?: string
  discoverAvatar?: string
  discoverCover?: string
  heroImage?: string
  featureFlags?: Record<string, boolean>
  contactEmail?: string
  contactPhone?: string
  /** Canonical tenant branding (colors/fonts). Prefer over legacy `theme`. */
  branding?: TenantBranding
  /**
   * Legacy Discover branding mirror — compatibility only.
   * New frontend logic must prefer `branding`.
   */
  theme?: TenantTheme
  marketplace?: DiscoverMarketplace
  branches?: DiscoverBranch[]
}

export interface DiscoverResponse {
  count: number
  results: DiscoverTenant[]
}
