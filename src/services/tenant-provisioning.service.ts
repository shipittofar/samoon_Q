import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import type {
  ProvisionableBusinessType,
  TenantBrandingConfig,
  TenantCapabilityPreset,
  TenantProvisionRequest,
  TenantProvisionResult,
  TenantTemplate,
} from '@/types/provisioning'
import type { Tenant, TenantBranding } from '@/types'
import { sanitizeBrandingForWrite } from '@/lib/tenant-branding'
import { sanitizeTenantSettings } from '@/lib/tenant-settings'
import { mockImageUrlFromFile, multipartRequestConfig } from '@/lib/multipart'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 200) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Builds multipart FormData for tenant provision when a logo File is present.
 * Branding lives under `settings` JSON; logo is the top-level `image` file field.
 * Never includes logoUrl / theme.logo.
 */
export function buildTenantProvisionFormData(input: {
  name: string
  businessType: ProvisionableBusinessType
  settings: { featureFlags: Record<string, boolean>; theme: TenantBranding }
  image: File
}): FormData {
  const form = new FormData()
  form.append('name', input.name)
  form.append('businessTypes', JSON.stringify([input.businessType]))
  form.append('settings', JSON.stringify(input.settings))
  form.append('image', input.image)
  return form
}

// ── Seed data for clone source lookup in mock mode ────────────────────────────
// Mirrors the slugs/IDs registered in tenant.service.ts MOCK_TENANTS.
// Kept here so the provisioning service is self-contained for tests.
const SEED_MOCK_TENANTS: ReadonlyArray<Pick<Tenant, 'id' | 'slug' | 'businessTypes' | 'settings'>> = [
  { id: 'default', slug: 'default', businessTypes: ['restaurant'], settings: undefined },
  { id: 'tenant-samoon-01', slug: 'samoon', businessTypes: ['restaurant'], settings: { featureFlags: { 'menu.enabled': true, 'reservations.enabled': true, 'analytics.enabled': true }, theme: { primaryColor: '#e85d04' } } },
  { id: 'tenant-brew-cafe-01', slug: 'brew-cafe', businessTypes: ['cafe'], settings: { featureFlags: { 'menu.enabled': true, 'cafe.loyalty.enabled': true, 'analytics.enabled': true }, theme: { primaryColor: '#6f4e37' } } },
  { id: 'tenant-oak-bar-01', slug: 'the-oak-bar', businessTypes: ['bar'], settings: { featureFlags: { 'menu.enabled': true, 'promotions.enabled': true, 'analytics.enabled': true }, theme: { primaryColor: '#1a1a2e' } } },
  { id: 'tenant-central-fc-01', slug: 'central-food-court', businessTypes: ['food_court'], settings: { featureFlags: { 'menu.enabled': true, 'food_court.vendor_management.enabled': true, 'analytics.enabled': true }, theme: { primaryColor: '#2d6a4f' } } },
  { id: 'tenant-road-bites-01', slug: 'road-bites', businessTypes: ['food_truck'], settings: { featureFlags: { 'menu.enabled': true, 'food_truck.live_location.enabled': true, 'analytics.enabled': true }, theme: { primaryColor: '#f4a261' } } },
  { id: 'tenant-wheels-brews-01', slug: 'wheels-and-brews', businessTypes: ['mobile_cafe'], settings: { featureFlags: { 'menu.enabled': true, 'mobile_cafe.loyalty.enabled': true, 'analytics.enabled': true }, theme: { primaryColor: '#457b9d' } } },
]

function findSeedTenant(idOrSlug: string) {
  return SEED_MOCK_TENANTS.find((t) => t.id === idOrSlug || t.slug === idOrSlug)
}

// ── Slug validation ───────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9-]{2,63}$/

// ── In-memory mock tenant store (provisioning adds to this) ──────────────────

const MOCK_EXISTING_SLUGS = new Set<string>(['default', 'samoon'])

// ── Template definitions ──────────────────────────────────────────────────────

const TEMPLATES: Record<ProvisionableBusinessType, TenantTemplate> = {
  restaurant: {
    businessType: 'restaurant',
    name: 'Restaurant',
    description: 'Full-service restaurant with table ordering, reservations, and reviews.',
    enabledCapabilities: ['reservations', 'reviews', 'qr_table'],
    defaultFeatureFlags: {
      'menu.enabled': true,
      'ordering.enabled': true,
      'qr_table.enabled': true,
      'reservations.enabled': true,
      'reviews.enabled': true,
      'delivery.enabled': true,
      'table_ordering.enabled': true,
      'order_tracking.enabled': true,
      'analytics.enabled': true,
      'notifications.enabled': true,
    },
    brandingDefaults: { primaryColor: '#e85d04', fontBody: 'inter' },
  },
  cafe: {
    businessType: 'cafe',
    name: 'Cafe',
    description: 'Coffee shop with loyalty program, reservations, and reviews.',
    enabledCapabilities: ['reservations', 'reviews', 'loyalty'],
    defaultFeatureFlags: {
      'menu.enabled': true,
      'ordering.enabled': true,
      'qr_table.enabled': true,
      'reservations.enabled': true,
      'reviews.enabled': true,
      'cafe.loyalty.enabled': true,
      'loyalty.rewards.enabled': true,
      'loyalty.tiers.enabled': true,
      'delivery.enabled': true,
      'table_ordering.enabled': true,
      'order_tracking.enabled': true,
      'promotions.enabled': true,
      'analytics.enabled': true,
      'notifications.enabled': true,
    },
    brandingDefaults: { primaryColor: '#6f4e37', fontBody: 'inter' },
  },
  bar: {
    businessType: 'bar',
    name: 'Bar',
    description: 'Bar or pub with reservations and promotional offers.',
    enabledCapabilities: ['reservations', 'promotions'],
    defaultFeatureFlags: {
      'menu.enabled': true,
      'ordering.enabled': true,
      'qr_table.enabled': true,
      'reservations.enabled': true,
      'bar.events.enabled': false,
      'bar.happy_hour.enabled': false,
      'promotions.enabled': true,
      'table_ordering.enabled': true,
      'order_tracking.enabled': true,
      'analytics.enabled': true,
      'notifications.enabled': true,
    },
    brandingDefaults: { primaryColor: '#1a1a2e', fontBody: 'inter' },
  },
  food_court: {
    businessType: 'food_court',
    name: 'Food Court',
    description: 'Multi-vendor food court with vendor management and shared seating.',
    enabledCapabilities: ['vendor_management', 'shared_seating'],
    defaultFeatureFlags: {
      'menu.enabled': true,
      'ordering.enabled': true,
      'qr_table.enabled': true,
      'reservations.enabled': true,
      'food_court.multi_vendor.enabled': true,
      'food_court.vendor_management.enabled': true,
      'food_court.shared_seating.enabled': true,
      'food_court.cross_vendor_ordering.enabled': false,
      'table_ordering.enabled': true,
      'order_tracking.enabled': true,
      'analytics.enabled': true,
      'notifications.enabled': true,
    },
    brandingDefaults: { primaryColor: '#2d6a4f', fontBody: 'inter' },
  },
  food_truck: {
    businessType: 'food_truck',
    name: 'Food Truck',
    description: 'Mobile food truck with live location tracking and route management.',
    enabledCapabilities: ['live_location', 'route_tracking'],
    defaultFeatureFlags: {
      'menu.enabled': true,
      'ordering.enabled': true,
      'qr_table.enabled': true,
      'food_truck.live_location.enabled': true,
      'food_truck.route_tracking.enabled': true,
      'food_truck.scheduled_stops.enabled': false,
      'food_truck.pre_order.enabled': false,
      'pickup.enabled': true,
      'order_tracking.enabled': true,
      'analytics.enabled': true,
      'notifications.enabled': true,
    },
    brandingDefaults: { primaryColor: '#f4a261', fontBody: 'inter' },
  },
  mobile_cafe: {
    businessType: 'mobile_cafe',
    name: 'Mobile Cafe',
    description: 'Mobile coffee van with loyalty program and live location sharing.',
    enabledCapabilities: ['loyalty', 'live_location'],
    defaultFeatureFlags: {
      'menu.enabled': true,
      'ordering.enabled': true,
      'qr_table.enabled': true,
      'mobile_cafe.loyalty.enabled': true,
      'loyalty.rewards.enabled': true,
      'loyalty.tiers.enabled': true,
      'mobile_cafe.live_location.enabled': true,
      'mobile_cafe.route_tracking.enabled': true,
      'mobile_cafe.featured_coffee.enabled': false,
      'mobile_cafe.daily_specials.enabled': false,
      'pickup.enabled': true,
      'order_tracking.enabled': true,
      'analytics.enabled': true,
      'notifications.enabled': true,
    },
    brandingDefaults: { primaryColor: '#457b9d', fontBody: 'inter' },
  },
}

// ── Capability presets ────────────────────────────────────────────────────────

const SHARED_CORE_OPTIONAL: Record<string, boolean> = {
  'ordering.enabled': true,
  'qr_table.enabled': true,
  'notifications.enabled': true,
}

const CAPABILITY_PRESETS: Record<ProvisionableBusinessType, TenantCapabilityPreset> = {
  restaurant: {
    businessType: 'restaurant',
    required: ['menu.enabled'],
    optional: {
      ...SHARED_CORE_OPTIONAL,
      'reservations.enabled': true,
      'reviews.enabled': true,
      'delivery.enabled': true,
    },
  },
  cafe: {
    businessType: 'cafe',
    required: ['menu.enabled'],
    optional: {
      ...SHARED_CORE_OPTIONAL,
      'reservations.enabled': true,
      'reviews.enabled': true,
      'cafe.loyalty.enabled': true,
      'promotions.enabled': true,
    },
  },
  bar: {
    businessType: 'bar',
    required: ['menu.enabled'],
    optional: {
      ...SHARED_CORE_OPTIONAL,
      'reservations.enabled': true,
      'promotions.enabled': true,
      'bar.events.enabled': false,
      'bar.happy_hour.enabled': false,
    },
  },
  food_court: {
    businessType: 'food_court',
    required: ['menu.enabled'],
    optional: {
      ...SHARED_CORE_OPTIONAL,
      'reservations.enabled': true,
      'food_court.vendor_management.enabled': true,
      'food_court.shared_seating.enabled': true,
      'food_court.cross_vendor_ordering.enabled': false,
    },
  },
  food_truck: {
    businessType: 'food_truck',
    required: ['menu.enabled'],
    optional: {
      ...SHARED_CORE_OPTIONAL,
      'food_truck.live_location.enabled': true,
      'food_truck.route_tracking.enabled': true,
      'food_truck.scheduled_stops.enabled': false,
      'food_truck.pre_order.enabled': false,
    },
  },
  mobile_cafe: {
    businessType: 'mobile_cafe',
    required: ['menu.enabled'],
    optional: {
      ...SHARED_CORE_OPTIONAL,
      'mobile_cafe.loyalty.enabled': true,
      'mobile_cafe.live_location.enabled': true,
      'mobile_cafe.route_tracking.enabled': true,
      'mobile_cafe.daily_specials.enabled': false,
    },
  },
}

const VALID_BUSINESS_TYPES = new Set<string>([
  'restaurant', 'cafe', 'bar', 'food_court', 'food_truck', 'mobile_cafe',
])

// ── Service ───────────────────────────────────────────────────────────────────

export const tenantProvisioningService = {
  /**
   * Returns all built-in templates, one per supported business type.
   */
  getTemplates(): TenantTemplate[] {
    return Object.values(TEMPLATES).map((t) => ({ ...t, defaultFeatureFlags: { ...t.defaultFeatureFlags } }))
  },

  /**
   * Returns the template for a specific business type.
   */
  getTemplate(businessType: ProvisionableBusinessType): TenantTemplate {
    const t = TEMPLATES[businessType]
    return { ...t, defaultFeatureFlags: { ...t.defaultFeatureFlags } }
  },

  /**
   * Returns the capability preset for a specific business type.
   */
  getCapabilityPreset(businessType: ProvisionableBusinessType): TenantCapabilityPreset {
    const p = CAPABILITY_PRESETS[businessType]
    return { ...p, optional: { ...p.optional }, required: [...p.required] }
  },

  /**
   * Generates branding defaults for a business type.
   */
  generateBrandingDefaults(businessType: ProvisionableBusinessType): TenantBrandingConfig {
    return { ...TEMPLATES[businessType].brandingDefaults }
  },

  /**
   * Generates the merged feature flags for a business type with optional overrides.
   */
  generateFeatureFlags(
    businessType: ProvisionableBusinessType,
    overrides?: Record<string, boolean>,
  ): Record<string, boolean> {
    const base = { ...TEMPLATES[businessType].defaultFeatureFlags }
    return overrides ? { ...base, ...overrides } : base
  },

  /**
   * Returns module configuration (key, routes, navItems) for a business type.
   */
  generateModuleConfiguration(businessType: ProvisionableBusinessType) {
    const moduleKeyMap: Record<ProvisionableBusinessType, string> = {
      restaurant: 'restaurant',
      cafe: 'cafe',
      bar: 'bar',
      food_court: 'food_court',
      food_truck: 'food_truck',
      mobile_cafe: 'mobile_cafe',
    }
    return { moduleKey: moduleKeyMap[businessType] }
  },

  /**
   * Generates the full default configuration object for a tenant of the given type.
   */
  generateDefaultConfiguration(businessType: ProvisionableBusinessType): {
    businessTypes: string[]
    featureFlags: Record<string, boolean>
    branding: TenantBrandingConfig
    moduleKey: string
  } {
    return {
      businessTypes: [businessType],
      featureFlags: this.generateFeatureFlags(businessType),
      branding: this.generateBrandingDefaults(businessType),
      moduleKey: this.generateModuleConfiguration(businessType).moduleKey,
    }
  },

  /**
   * Validates a TenantProvisionRequest.
   * Returns { valid, errors } — errors is empty on success.
   */
  validateTenantConfiguration(req: TenantProvisionRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Name is optional on Create Tenant; empty values must not block provision.

    // Business type
    if (!VALID_BUSINESS_TYPES.has(req.businessType)) {
      errors.push(`invalid businessType "${req.businessType}"`)
    }

    // Missing required capability check — required flags must not be overridden to false
    if (req.capabilityOverrides && VALID_BUSINESS_TYPES.has(req.businessType)) {
      const preset = CAPABILITY_PRESETS[req.businessType as ProvisionableBusinessType]
      for (const reqFlag of preset.required) {
        if (req.capabilityOverrides[reqFlag] === false) {
          errors.push(`required capability "${reqFlag}" cannot be disabled`)
        }
      }
    }

    // Branding validation
    if (req.branding?.primaryColor != null) {
      if (!/^#[0-9a-fA-F]{3,8}$/.test(req.branding.primaryColor)) {
        errors.push('branding.primaryColor must be a valid hex color (e.g. "#ff0000")')
      }
    }
    if (req.branding?.accentHoverColor != null) {
      if (!/^#[0-9a-fA-F]{3,8}$/.test(req.branding.accentHoverColor)) {
        errors.push('branding.accentHoverColor must be a valid hex color')
      }
    }

    return { valid: errors.length === 0, errors }
  },

  /**
   * Provisions a new tenant from a validated request.
   */
  async provisionTenant(req: TenantProvisionRequest): Promise<TenantProvisionResult> {
    const validation = this.validateTenantConfiguration(req)
    if (!validation.valid) {
      return { success: false, errors: validation.errors }
    }

    if (USE_MOCK) {
      await delay()
      // const tenantId = `tenant-${req.slug}-${Date.now()}`
      const tenantId = `tenant-${Date.now()}`
      const featureFlags = this.generateFeatureFlags(
        req.businessType,
        { ...req.capabilityOverrides, ...req.featureFlagOverrides },
      )
      const branding = sanitizeBrandingForWrite({
        ...this.generateBrandingDefaults(req.businessType),
        ...req.branding,
      } as TenantBranding & Record<string, unknown>)

      const tenant: Tenant = {
        id: tenantId,
        name: req.name,
        // Mock stand-in for backend assign_unique_slug() — not used by Step 6 UI logic.
        slug: `provisioned-${tenantId}`,
        businessTypes: [req.businessType],
        // Backend: 0 branches → operational INACTIVE (may still be visible or not)
        is_active: true,
        status: 'INACTIVE',
        created_at: new Date().toISOString(),
        image:
          req.image instanceof File
            ? mockImageUrlFromFile(req.image) || `mock-image://${req.image.name}`
            : undefined,
        settings: { featureFlags, theme: branding },
      }

      // MOCK_EXISTING_SLUGS.add(req.slug)
      MOCK_EXISTING_SLUGS.add(req.name)
      return { success: true, tenantId, slug: tenant.slug, tenant }
    }

    try {
      const featureFlags = this.generateFeatureFlags(
        req.businessType,
        { ...req.capabilityOverrides, ...req.featureFlagOverrides },
      )
      const branding = sanitizeBrandingForWrite({
        ...this.generateBrandingDefaults(req.businessType),
        ...req.branding,
      } as TenantBranding & Record<string, unknown>)
      const settings = { featureFlags, theme: branding }

      // Logo via multipart `image`; branding stays under settings.theme (JSON).
      if (req.image instanceof File) {
        const form = buildTenantProvisionFormData({
          name: req.name,
          businessType: req.businessType,
          settings,
          image: req.image,
        })
        const { data } = await api.post<Tenant>(
          ENDPOINTS.TENANTS.PROVISION,
          form,
          multipartRequestConfig(),
        )
        return { success: true, tenantId: data.id, slug: data.slug, tenant: data }
      }

      const { data } = await api.post<Tenant>(ENDPOINTS.TENANTS.PROVISION, {
        name: req.name,
        // slug: req.slug,
        businessTypes: [req.businessType],
        settings,
      })
      return { success: true, tenantId: data.id, slug: data.slug, tenant: data }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Provisioning failed'
      return { success: false, errors: [msg] }
    }
  },

  /**
   * Clones an existing tenant with a new slug and name.
   */
  async cloneTenant(
    sourceTenantId: string,
    newSlug: string,
    newName: string,
  ): Promise<TenantProvisionResult> {
    const slugErrors: string[] = []
    // if (!newSlug || !SLUG_RE.test(newSlug)) {
    //   slugErrors.push('slug must be 2–63 lowercase alphanumeric characters or hyphens')
    // }
    // if (newSlug && MOCK_EXISTING_SLUGS.has(newSlug)) {
    //   slugErrors.push(`slug "${newSlug}" is already taken`)
    // }
    if (!newName || newName.trim().length < 2) {
      slugErrors.push('name must be at least 2 characters')
    }
    if (slugErrors.length) return { success: false, errors: slugErrors }

    if (USE_MOCK) {
      await delay()
      const source = findSeedTenant(sourceTenantId)
      const tenantId = `tenant-${newSlug}-${Date.now()}`
      const tenant: Tenant = {
        id: tenantId,
        name: newName,
        slug: newSlug,
        // Preserve source business type; fall back to restaurant when source unknown
        businessTypes: source?.businessTypes ? [...source.businessTypes] : ['restaurant'],
        is_active: true,
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        // Preserve source settings (feature flags + branding), override name
        settings: source?.settings
          ? sanitizeTenantSettings(source.settings as Record<string, unknown>)
          : undefined,
      }
      MOCK_EXISTING_SLUGS.add(newSlug)
      return { success: true, tenantId, slug: newSlug, tenant }
    }

    try {
      const { data } = await api.post<Tenant>(ENDPOINTS.TENANTS.CLONE, {
        source_tenant_id: sourceTenantId,
        slug: newSlug,
        name: newName,
      })
      return { success: true, tenantId: data.id, slug: data.slug, tenant: data }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Clone failed'
      return { success: false, errors: [msg] }
    }
  },

  /** Resets the mock slug registry — test isolation only. */
  _resetMockSlugs(): void {
    MOCK_EXISTING_SLUGS.clear()
    MOCK_EXISTING_SLUGS.add('default')
    MOCK_EXISTING_SLUGS.add('samoon')
  },
}
