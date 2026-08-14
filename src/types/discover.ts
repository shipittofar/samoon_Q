/**
 * Wire contract for GET /api/public/discover/
 */

import type { TenantStatus, TenantBranding, TenantTheme } from '@/types'
import type { BranchCheckout, BranchBusinessHours } from '@/types/branch'
import type { MarketplaceMeta } from '@/types/marketplace'

/** Branch summary embedded in a discover tenant result. */
export interface DiscoverBranch {
  id: string
  slug: string
  name: string
  image?: string
  openNow: boolean
  todayHours?: string
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
}

/** Marketplace display fields on a discover tenant (no embedded branches). */
export type DiscoverMarketplace = Omit<MarketplaceMeta, 'branches'>

/** Single tenant entry in the discover response. */
export interface DiscoverTenant {
  id: string
  slug: string
  name: string
  /** Public visibility — prefer over `status` for catalog show/hide. */
  is_active?: boolean
  /** Operational state only — not used for discover visibility. */
  status: TenantStatus
  created_at: string
  businessTypes: string[]
  /** Tenant logo — canonical Discover image field. */
  image?: string
  featureFlags?: Record<string, boolean>
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
