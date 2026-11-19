import type { Tenant, TenantBranding } from '@/types'

export type ProvisionableBusinessType =
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'food_court'
  | 'food_truck'
  | 'mobile_cafe'
  | 'beauty_salon'
  | 'clinic'

/** Step 3 branding — maps to Tenant CRUD `settings.theme` (no logo fields). */
export type TenantBrandingConfig = TenantBranding

export interface TenantProvisionRequest {
  /** Display name for the new tenant. */
  name: string
  /** URL-safe slug — must be unique and match /^[a-z0-9-]{2,63}$/. */
  // slug: string
  businessType: ProvisionableBusinessType
  /** Optional per-flag overrides applied on top of the template defaults. */
  capabilityOverrides?: Record<string, boolean>
  branding?: TenantBrandingConfig
  /**
   * Tenant logo file — uploaded first; provision JSON receives `image_asset_id`.
   * Never nested under settings.theme / branding.
   */
  image?: File | null
  /** Reused for retries of the same provision attempt. */
  imageIdempotencyKey?: string
  signal?: AbortSignal
  /** Optional public Tenant.description (Discover). */
  description?: string
  /** Additional feature flag overrides (highest priority). */
  featureFlagOverrides?: Record<string, boolean>
}

export interface TenantProvisionResult {
  success: boolean
  tenantId?: string
  slug?: string
  errors?: string[]
  warnings?: string[]
  tenant?: Tenant
}

export interface TenantTemplate {
  businessType: ProvisionableBusinessType
  name: string
  description: string
  /** Human-readable list of what this template enables. */
  enabledCapabilities: string[]
  /** Merged feature flag defaults for the template (before tenant overrides). */
  defaultFeatureFlags: Record<string, boolean>
  brandingDefaults: TenantBrandingConfig
}

export interface TenantCapabilityPreset {
  businessType: ProvisionableBusinessType
  /** Flag keys that are always true and cannot be disabled. */
  required: string[]
  /** Optional flag keys and their default enabled state. */
  optional: Record<string, boolean>
}
