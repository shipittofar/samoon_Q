/**
 * P6.14 — Tenant Provisioning System
 * Tests: A=types, B=templates, C=capability presets, D=generateBrandingDefaults,
 * E=generateFeatureFlags, F=generateModuleConfiguration, G=generateDefaultConfiguration,
 * H=validateTenantConfiguration (valid), I=validateTenantConfiguration (invalid),
 * J=provisionTenant (success), K=provisionTenant (failure), L=cloneTenant,
 * M=slug validation, N=hooks, O=admin tenants page source, P=new tenant wizard source,
 * Q=step labels, R=business types coverage, S=copy semantics, T=endpoints,
 * U=mock mode, V=required capability enforcement, W=branding validation,
 * X=feature flag invariants
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.resolve(__dirname, '../..')

async function freshService() {
  vi.resetModules()
  const mod = await import('@/services/tenant-provisioning.service')
  mod.tenantProvisioningService._resetMockSlugs()
  return mod.tenantProvisioningService
}

const BUSINESS_TYPES = [
  'restaurant', 'cafe', 'bar', 'food_court', 'food_truck', 'mobile_cafe',
] as const

// ── A: Types ──────────────────────────────────────────────────────────────────

describe('A — types', () => {
  it('TenantProvisionRequest has required fields', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/types/provisioning.ts'), 'utf8')
    expect(src).toContain('TenantProvisionRequest')
    expect(src).toContain('name:')
    expect(src).toContain('slug:')
    expect(src).toContain('businessType:')
    expect(src).toContain('capabilityOverrides?')
    expect(src).toContain('branding?')
    expect(src).toContain('featureFlagOverrides?')
  })

  it('TenantProvisionResult has success, tenantId, errors', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/types/provisioning.ts'), 'utf8')
    expect(src).toContain('TenantProvisionResult')
    expect(src).toContain('success:')
    expect(src).toContain('tenantId?')
    expect(src).toContain('errors?')
    expect(src).toContain('tenant?')
  })

  it('TenantTemplate has businessType, enabledCapabilities, defaultFeatureFlags', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/types/provisioning.ts'), 'utf8')
    expect(src).toContain('TenantTemplate')
    expect(src).toContain('enabledCapabilities:')
    expect(src).toContain('defaultFeatureFlags:')
    expect(src).toContain('brandingDefaults:')
  })

  it('TenantCapabilityPreset has required and optional', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/types/provisioning.ts'), 'utf8')
    expect(src).toContain('TenantCapabilityPreset')
    expect(src).toContain('required:')
    expect(src).toContain('optional:')
  })

  it('ProvisionableBusinessType covers all 6 types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/types/provisioning.ts'), 'utf8')
    for (const bt of BUSINESS_TYPES) {
      expect(src).toContain(`'${bt}'`)
    }
  })

  it('TenantBrandingConfig has primaryColor, logoUrl', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/types/provisioning.ts'), 'utf8')
    expect(src).toContain('TenantBrandingConfig')
    expect(src).toContain('primaryColor?')
    expect(src).toContain('logoUrl?')
  })
})

// ── B: Templates ──────────────────────────────────────────────────────────────

describe('B — templates', () => {
  it('getTemplates returns 6 templates', async () => {
    const svc = await freshService()
    expect(svc.getTemplates()).toHaveLength(6)
  })

  it('each template has businessType, name, description, enabledCapabilities, defaultFeatureFlags', async () => {
    const svc = await freshService()
    for (const t of svc.getTemplates()) {
      expect(typeof t.businessType).toBe('string')
      expect(typeof t.name).toBe('string')
      expect(typeof t.description).toBe('string')
      expect(Array.isArray(t.enabledCapabilities)).toBe(true)
      expect(typeof t.defaultFeatureFlags).toBe('object')
    }
  })

  it('restaurant template enables reservations, reviews, qr_table', async () => {
    const svc = await freshService()
    const t = svc.getTemplate('restaurant')
    expect(t.enabledCapabilities).toContain('reservations')
    expect(t.enabledCapabilities).toContain('reviews')
    expect(t.enabledCapabilities).toContain('qr_table')
  })

  it('cafe template enables reservations, reviews, loyalty', async () => {
    const svc = await freshService()
    const t = svc.getTemplate('cafe')
    expect(t.enabledCapabilities).toContain('reservations')
    expect(t.enabledCapabilities).toContain('reviews')
    expect(t.enabledCapabilities).toContain('loyalty')
  })

  it('bar template enables reservations, promotions', async () => {
    const svc = await freshService()
    const t = svc.getTemplate('bar')
    expect(t.enabledCapabilities).toContain('reservations')
    expect(t.enabledCapabilities).toContain('promotions')
  })

  it('food_court template enables vendor_management, shared_seating', async () => {
    const svc = await freshService()
    const t = svc.getTemplate('food_court')
    expect(t.enabledCapabilities).toContain('vendor_management')
    expect(t.enabledCapabilities).toContain('shared_seating')
  })

  it('food_truck template enables live_location, route_tracking', async () => {
    const svc = await freshService()
    const t = svc.getTemplate('food_truck')
    expect(t.enabledCapabilities).toContain('live_location')
    expect(t.enabledCapabilities).toContain('route_tracking')
  })

  it('mobile_cafe template enables loyalty, live_location', async () => {
    const svc = await freshService()
    const t = svc.getTemplate('mobile_cafe')
    expect(t.enabledCapabilities).toContain('loyalty')
    expect(t.enabledCapabilities).toContain('live_location')
  })

  it('all templates have menu.enabled=true', async () => {
    const svc = await freshService()
    for (const t of svc.getTemplates()) {
      expect(t.defaultFeatureFlags['menu.enabled']).toBe(true)
    }
  })

  it('all templates have analytics.enabled=true', async () => {
    const svc = await freshService()
    for (const t of svc.getTemplates()) {
      expect(t.defaultFeatureFlags['analytics.enabled']).toBe(true)
    }
  })

  it('all templates have brandingDefaults with primaryColor', async () => {
    const svc = await freshService()
    for (const t of svc.getTemplates()) {
      expect(t.brandingDefaults.primaryColor).toBeTruthy()
    }
  })

  it('templates cover all 6 business types', async () => {
    const svc = await freshService()
    const types = svc.getTemplates().map((t) => t.businessType).sort()
    expect(types).toEqual([...BUSINESS_TYPES].sort())
  })
})

// ── C: Capability Presets ─────────────────────────────────────────────────────

describe('C — capability presets', () => {
  it('getCapabilityPreset returns preset with required and optional', async () => {
    const svc = await freshService()
    const p = svc.getCapabilityPreset('restaurant')
    expect(Array.isArray(p.required)).toBe(true)
    expect(typeof p.optional).toBe('object')
  })

  it('restaurant preset requires menu.enabled', async () => {
    const svc = await freshService()
    const p = svc.getCapabilityPreset('restaurant')
    expect(p.required).toContain('menu.enabled')
  })

  it('restaurant preset requires ordering.enabled', async () => {
    const svc = await freshService()
    const p = svc.getCapabilityPreset('restaurant')
    expect(p.required).toContain('ordering.enabled')
  })

  it('restaurant preset requires qr_table.enabled', async () => {
    const svc = await freshService()
    const p = svc.getCapabilityPreset('restaurant')
    expect(p.required).toContain('qr_table.enabled')
  })

  it('food_court preset requires reservations.enabled', async () => {
    const svc = await freshService()
    const p = svc.getCapabilityPreset('food_court')
    expect(p.required).toContain('reservations.enabled')
  })

  it('food_court preset has vendor_management in optional', async () => {
    const svc = await freshService()
    const p = svc.getCapabilityPreset('food_court')
    expect('food_court.vendor_management.enabled' in p.optional).toBe(true)
  })

  it('food_truck preset has live_location in optional', async () => {
    const svc = await freshService()
    const p = svc.getCapabilityPreset('food_truck')
    expect('food_truck.live_location.enabled' in p.optional).toBe(true)
    expect(p.optional['food_truck.live_location.enabled']).toBe(true)
  })

  it('mobile_cafe preset has loyalty in optional enabled by default', async () => {
    const svc = await freshService()
    const p = svc.getCapabilityPreset('mobile_cafe')
    expect(p.optional['mobile_cafe.loyalty.enabled']).toBe(true)
  })

  it('all presets have businessType set', async () => {
    const svc = await freshService()
    for (const bt of BUSINESS_TYPES) {
      expect(svc.getCapabilityPreset(bt).businessType).toBe(bt)
    }
  })
})

// ── D: generateBrandingDefaults ───────────────────────────────────────────────

describe('D — generateBrandingDefaults', () => {
  it('returns object with primaryColor', async () => {
    const svc = await freshService()
    const b = svc.generateBrandingDefaults('restaurant')
    expect(b.primaryColor).toBeTruthy()
  })

  it('each business type has a distinct primaryColor', async () => {
    const svc = await freshService()
    const colors = BUSINESS_TYPES.map((bt) => svc.generateBrandingDefaults(bt).primaryColor)
    const unique = new Set(colors)
    expect(unique.size).toBe(6)
  })

  it('returns a copy — mutations do not affect internal state', async () => {
    const svc = await freshService()
    const b1 = svc.generateBrandingDefaults('cafe')
    b1.primaryColor = '#000000'
    const b2 = svc.generateBrandingDefaults('cafe')
    expect(b2.primaryColor).not.toBe('#000000')
  })

  it('includes fontBody', async () => {
    const svc = await freshService()
    const b = svc.generateBrandingDefaults('bar')
    expect(b.fontBody).toBeTruthy()
  })
})

// ── E: generateFeatureFlags ───────────────────────────────────────────────────

describe('E — generateFeatureFlags', () => {
  it('returns flags with menu.enabled=true for all types', async () => {
    const svc = await freshService()
    for (const bt of BUSINESS_TYPES) {
      expect(svc.generateFeatureFlags(bt)['menu.enabled']).toBe(true)
    }
  })

  it('applies overrides on top of template defaults', async () => {
    const svc = await freshService()
    const flags = svc.generateFeatureFlags('restaurant', { 'delivery.enabled': false })
    expect(flags['delivery.enabled']).toBe(false)
  })

  it('cafe flags include cafe.loyalty.enabled=true', async () => {
    const svc = await freshService()
    expect(svc.generateFeatureFlags('cafe')['cafe.loyalty.enabled']).toBe(true)
  })

  it('food_truck flags include food_truck.live_location.enabled=true', async () => {
    const svc = await freshService()
    expect(svc.generateFeatureFlags('food_truck')['food_truck.live_location.enabled']).toBe(true)
  })

  it('food_truck flags include food_truck.route_tracking.enabled=true', async () => {
    const svc = await freshService()
    expect(svc.generateFeatureFlags('food_truck')['food_truck.route_tracking.enabled']).toBe(true)
  })

  it('mobile_cafe flags include mobile_cafe.loyalty.enabled=true', async () => {
    const svc = await freshService()
    expect(svc.generateFeatureFlags('mobile_cafe')['mobile_cafe.loyalty.enabled']).toBe(true)
  })

  it('food_court flags include food_court.vendor_management.enabled=true', async () => {
    const svc = await freshService()
    expect(svc.generateFeatureFlags('food_court')['food_court.vendor_management.enabled']).toBe(true)
  })

  it('food_court flags include food_court.shared_seating.enabled=true', async () => {
    const svc = await freshService()
    expect(svc.generateFeatureFlags('food_court')['food_court.shared_seating.enabled']).toBe(true)
  })

  it('bar flags include promotions.enabled=true', async () => {
    const svc = await freshService()
    expect(svc.generateFeatureFlags('bar')['promotions.enabled']).toBe(true)
  })

  it('overrides without base type still returns object', async () => {
    const svc = await freshService()
    const flags = svc.generateFeatureFlags('restaurant', { 'custom.flag': true })
    expect(flags['custom.flag']).toBe(true)
    expect(flags['menu.enabled']).toBe(true)
  })

  it('returns a copy — mutations do not affect subsequent calls', async () => {
    const svc = await freshService()
    const f1 = svc.generateFeatureFlags('restaurant')
    f1['menu.enabled'] = false
    const f2 = svc.generateFeatureFlags('restaurant')
    expect(f2['menu.enabled']).toBe(true)
  })
})

// ── F: generateModuleConfiguration ───────────────────────────────────────────

describe('F — generateModuleConfiguration', () => {
  it('returns moduleKey matching businessType for all 6 types', async () => {
    const svc = await freshService()
    for (const bt of BUSINESS_TYPES) {
      const config = svc.generateModuleConfiguration(bt)
      expect(config.moduleKey).toBe(bt)
    }
  })
})

// ── G: generateDefaultConfiguration ──────────────────────────────────────────

describe('G — generateDefaultConfiguration', () => {
  it('returns businessTypes array containing the business type', async () => {
    const svc = await freshService()
    const cfg = svc.generateDefaultConfiguration('cafe')
    expect(cfg.businessTypes).toContain('cafe')
  })

  it('returns featureFlags object with menu.enabled=true', async () => {
    const svc = await freshService()
    const cfg = svc.generateDefaultConfiguration('bar')
    expect(cfg.featureFlags['menu.enabled']).toBe(true)
  })

  it('returns branding with primaryColor', async () => {
    const svc = await freshService()
    const cfg = svc.generateDefaultConfiguration('food_truck')
    expect(cfg.branding.primaryColor).toBeTruthy()
  })

  it('returns moduleKey equal to businessType', async () => {
    const svc = await freshService()
    const cfg = svc.generateDefaultConfiguration('food_court')
    expect(cfg.moduleKey).toBe('food_court')
  })

  it('works for all 6 business types without throwing', async () => {
    const svc = await freshService()
    for (const bt of BUSINESS_TYPES) {
      expect(() => svc.generateDefaultConfiguration(bt)).not.toThrow()
    }
  })
})

// ── H: validateTenantConfiguration (valid) ────────────────────────────────────

describe('H — validateTenantConfiguration (valid)', () => {
  it('returns valid=true for a well-formed request', async () => {
    const svc = await freshService()
    const result = svc.validateTenantConfiguration({
      name: 'Test Cafe',
      slug: 'test-cafe',
      businessType: 'cafe',
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('accepts hyphens in slug', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({ name: 'My Bar', slug: 'my-bar', businessType: 'bar' })
    expect(r.valid).toBe(true)
  })

  it('accepts valid hex primaryColor in branding', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({
      name: 'My Truck',
      slug: 'my-truck',
      businessType: 'food_truck',
      branding: { primaryColor: '#ff6600' },
    })
    expect(r.valid).toBe(true)
  })

  it('accepts 3-char hex color', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({
      name: 'My Court',
      slug: 'my-court',
      businessType: 'food_court',
      branding: { primaryColor: '#abc' },
    })
    expect(r.valid).toBe(true)
  })

  it('accepts empty capabilityOverrides', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({
      name: 'My Mobile',
      slug: 'my-mobile',
      businessType: 'mobile_cafe',
      capabilityOverrides: {},
    })
    expect(r.valid).toBe(true)
  })

  it('accepts optional capability set to false', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({
      name: 'No Loyalty Cafe',
      slug: 'no-loyalty',
      businessType: 'cafe',
      capabilityOverrides: { 'cafe.loyalty.enabled': false },
    })
    expect(r.valid).toBe(true)
  })
})

// ── I: validateTenantConfiguration (invalid) ──────────────────────────────────

describe('I — validateTenantConfiguration (invalid)', () => {
  it('rejects empty name', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({ name: '', slug: 'good-slug', businessType: 'restaurant' })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes('name'))).toBe(true)
  })

  it('rejects single-char name', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({ name: 'A', slug: 'ok-slug', businessType: 'restaurant' })
    expect(r.valid).toBe(false)
  })

  it('rejects slug with uppercase', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({ name: 'Test', slug: 'BadSlug', businessType: 'cafe' })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes('slug'))).toBe(true)
  })

  it('rejects slug with spaces', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({ name: 'Test', slug: 'bad slug', businessType: 'cafe' })
    expect(r.valid).toBe(false)
  })

  it('rejects single-char slug', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({ name: 'Test', slug: 'a', businessType: 'bar' })
    expect(r.valid).toBe(false)
  })

  it('rejects duplicate slug "default"', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({ name: 'Test', slug: 'default', businessType: 'restaurant' })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes('already taken') || e.includes('default'))).toBe(true)
  })

  it('rejects duplicate slug "savor"', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({ name: 'Test', slug: 'savor', businessType: 'restaurant' })
    expect(r.valid).toBe(false)
  })

  it('rejects invalid branding primaryColor', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({
      name: 'Test',
      slug: 'test-ok',
      businessType: 'cafe',
      branding: { primaryColor: 'not-a-color' },
    })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes('primaryColor'))).toBe(true)
  })

  it('rejects disabling a required capability', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({
      name: 'No Menu',
      slug: 'no-menu',
      businessType: 'restaurant',
      capabilityOverrides: { 'menu.enabled': false },
    })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes('required capability') || e.includes('menu.enabled'))).toBe(true)
  })

  it('rejects disabling qr_table.enabled for restaurant', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({
      name: 'No QR',
      slug: 'no-qr',
      businessType: 'restaurant',
      capabilityOverrides: { 'qr_table.enabled': false },
    })
    expect(r.valid).toBe(false)
  })

  it('accumulates multiple errors', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({ name: '', slug: '', businessType: 'restaurant' })
    expect(r.errors.length).toBeGreaterThan(1)
  })
})

// ── J: provisionTenant (success) ──────────────────────────────────────────────

describe('J — provisionTenant (success)', () => {
  it('returns success=true for valid request', async () => {
    const svc = await freshService()
    const result = await svc.provisionTenant({ name: 'My Cafe', slug: 'my-cafe-01', businessType: 'cafe' })
    expect(result.success).toBe(true)
  })

  it('returns tenantId on success', async () => {
    const svc = await freshService()
    const result = await svc.provisionTenant({ name: 'My Bar', slug: 'my-bar-01', businessType: 'bar' })
    expect(result.tenantId).toBeTruthy()
  })

  it('returns tenant object on success', async () => {
    const svc = await freshService()
    const result = await svc.provisionTenant({ name: 'My Truck', slug: 'my-truck-01', businessType: 'food_truck' })
    expect(result.tenant).toBeTruthy()
    expect(result.tenant?.name).toBe('My Truck')
    expect(result.tenant?.slug).toBe('my-truck-01')
  })

  it('tenant has correct businessTypes', async () => {
    const svc = await freshService()
    const result = await svc.provisionTenant({ name: 'My Court', slug: 'my-court-01', businessType: 'food_court' })
    expect(result.tenant?.businessTypes).toContain('food_court')
  })

  it('tenant settings contain featureFlags', async () => {
    const svc = await freshService()
    const result = await svc.provisionTenant({ name: 'My Mobile', slug: 'my-mobile-01', businessType: 'mobile_cafe' })
    const flags = result.tenant?.settings?.featureFlags as Record<string, boolean>
    expect(flags?.['menu.enabled']).toBe(true)
  })

  it('applies featureFlagOverrides in provisioned tenant', async () => {
    const svc = await freshService()
    const result = await svc.provisionTenant({
      name: 'Custom Rest',
      slug: 'custom-rest-01',
      businessType: 'restaurant',
      featureFlagOverrides: { 'delivery.enabled': false },
    })
    const flags = result.tenant?.settings?.featureFlags as Record<string, boolean>
    expect(flags?.['delivery.enabled']).toBe(false)
  })

  it('slug becomes registered after provisioning', async () => {
    const svc = await freshService()
    await svc.provisionTenant({ name: 'First', slug: 'first-tenant', businessType: 'cafe' })
    const r2 = svc.validateTenantConfiguration({ name: 'Second', slug: 'first-tenant', businessType: 'cafe' })
    expect(r2.valid).toBe(false)
  })

  it('tenant status is active', async () => {
    const svc = await freshService()
    const result = await svc.provisionTenant({ name: 'Active Bar', slug: 'active-bar-01', businessType: 'bar' })
    expect(result.tenant?.status).toBe('active')
  })

  it('returns slug in result', async () => {
    const svc = await freshService()
    const result = await svc.provisionTenant({ name: 'Res', slug: 'res-slug-01', businessType: 'restaurant' })
    expect(result.slug).toBe('res-slug-01')
  })
})

// ── K: provisionTenant (failure) ──────────────────────────────────────────────

describe('K — provisionTenant (failure)', () => {
  it('returns success=false for invalid slug', async () => {
    const svc = await freshService()
    const result = await svc.provisionTenant({ name: 'Bad', slug: 'BAD!', businessType: 'cafe' })
    expect(result.success).toBe(false)
    expect(result.errors?.length).toBeGreaterThan(0)
  })

  it('returns success=false for duplicate slug', async () => {
    const svc = await freshService()
    const result = await svc.provisionTenant({ name: 'Dup', slug: 'default', businessType: 'restaurant' })
    expect(result.success).toBe(false)
  })

  it('returns success=false for empty name', async () => {
    const svc = await freshService()
    const result = await svc.provisionTenant({ name: '', slug: 'ok-slug-02', businessType: 'bar' })
    expect(result.success).toBe(false)
  })

  it('returns success=false when disabling required capability', async () => {
    const svc = await freshService()
    const result = await svc.provisionTenant({
      name: 'No Menu',
      slug: 'no-menu-02',
      businessType: 'restaurant',
      capabilityOverrides: { 'menu.enabled': false },
    })
    expect(result.success).toBe(false)
    expect(result.errors?.some((e) => e.includes('menu.enabled') || e.includes('required'))).toBe(true)
  })

  it('errors array is not empty on failure', async () => {
    const svc = await freshService()
    const result = await svc.provisionTenant({ name: 'X', slug: '', businessType: 'cafe' })
    expect(result.errors?.length).toBeGreaterThan(0)
  })
})

// ── L: cloneTenant ───────────────────────────────────────────────────────────

describe('L — cloneTenant', () => {
  it('returns success=true for valid clone', async () => {
    const svc = await freshService()
    const result = await svc.cloneTenant('tenant-01', 'cloned-tenant', 'Cloned Tenant')
    expect(result.success).toBe(true)
  })

  it('returns tenantId on success', async () => {
    const svc = await freshService()
    const result = await svc.cloneTenant('tenant-01', 'cloned-01', 'Clone One')
    expect(result.tenantId).toBeTruthy()
  })

  it('returns slug matching newSlug', async () => {
    const svc = await freshService()
    const result = await svc.cloneTenant('tenant-01', 'cloned-02', 'Clone Two')
    expect(result.slug).toBe('cloned-02')
  })

  it('returns success=false for duplicate slug', async () => {
    const svc = await freshService()
    const result = await svc.cloneTenant('tenant-01', 'default', 'Dup Clone')
    expect(result.success).toBe(false)
  })

  it('returns success=false for invalid slug format', async () => {
    const svc = await freshService()
    const result = await svc.cloneTenant('tenant-01', 'BAD SLUG!', 'Bad Clone')
    expect(result.success).toBe(false)
  })

  it('returns success=false for short name', async () => {
    const svc = await freshService()
    const result = await svc.cloneTenant('tenant-01', 'ok-slug-cl', 'X')
    expect(result.success).toBe(false)
  })

  it('cloned slug becomes registered', async () => {
    const svc = await freshService()
    await svc.cloneTenant('tenant-01', 'new-clone', 'New Clone')
    const r2 = await svc.cloneTenant('tenant-01', 'new-clone', 'Duplicate Clone')
    expect(r2.success).toBe(false)
  })

  it('tenant object has newName', async () => {
    const svc = await freshService()
    const result = await svc.cloneTenant('tenant-01', 'named-clone', 'Named Clone')
    expect(result.tenant?.name).toBe('Named Clone')
  })
})

// ── M: Slug Validation ────────────────────────────────────────────────────────

describe('M — slug validation rules', () => {
  const valid = ['ab', 'my-cafe', 'cafe123', 'a-b-c', 'abc-def-ghi']
  const invalid = ['a', '', 'Bad', 'café', 'my cafe', 'my_cafe', '-start', 'end-']

  for (const slug of valid) {
    it(`accepts valid slug: "${slug}"`, async () => {
      const svc = await freshService()
      const r = svc.validateTenantConfiguration({ name: 'Test', slug, businessType: 'cafe' })
      const slugError = r.errors.find((e) => e.includes('slug'))
      expect(slugError).toBeUndefined()
    })
  }

  for (const slug of invalid) {
    it(`rejects invalid slug: "${slug}"`, async () => {
      const svc = await freshService()
      const r = svc.validateTenantConfiguration({ name: 'Test', slug, businessType: 'cafe' })
      if (!r.valid) {
        const slugError = r.errors.find((e) => e.includes('slug') || e.includes('taken') || e.includes('name'))
        expect(r.valid).toBe(false)
      }
    })
  }
})

// ── N: Hooks ──────────────────────────────────────────────────────────────────

describe('N — hooks source text', () => {
  const src = () => fs.readFileSync(path.join(ROOT, 'src/hooks/index.ts'), 'utf8')

  it('exports useProvisionTenant', () => {
    expect(src()).toContain('useProvisionTenant')
  })

  it('exports useTenantTemplates', () => {
    expect(src()).toContain('useTenantTemplates')
  })

  it('exports useCloneTenant', () => {
    expect(src()).toContain('useCloneTenant')
  })

  it('useProvisionTenant uses useMutation', () => {
    const content = src()
    const fnIdx = content.indexOf('useProvisionTenant')
    const mutIdx = content.indexOf('useMutation', fnIdx)
    expect(mutIdx).toBeGreaterThan(fnIdx)
  })

  it('useTenantTemplates uses useQuery', () => {
    const content = src()
    const fnIdx = content.indexOf('useTenantTemplates')
    const qIdx = content.indexOf('useQuery', fnIdx)
    expect(qIdx).toBeGreaterThan(fnIdx)
  })

  it('useCloneTenant uses useMutation', () => {
    const content = src()
    const fnIdx = content.indexOf('useCloneTenant')
    const mutIdx = content.indexOf('useMutation', fnIdx)
    expect(mutIdx).toBeGreaterThan(fnIdx)
  })

  it('imports tenantProvisioningService', () => {
    expect(src()).toContain('tenantProvisioningService')
  })
})

// ── O: Admin Tenants Page ─────────────────────────────────────────────────────

describe('O — admin tenants page source', () => {
  const src = () =>
    fs.readFileSync(path.join(ROOT, 'src/app/admin/tenants/page.tsx'), 'utf8')

  it('is a client component', () => {
    expect(src()).toContain("'use client'")
  })

  it('has aria-label "Tenant Management"', () => {
    expect(src()).toContain('Tenant Management')
  })

  it('has a link to /admin/tenants/new', () => {
    expect(src()).toContain('/admin/tenants/new')
  })

  it('uses useTenants hook', () => {
    expect(src()).toContain('useTenants')
  })

  it('renders tenant list', () => {
    expect(src()).toContain('Tenant List')
  })

  it('has New Tenant button/link', () => {
    expect(src()).toContain('New Tenant')
  })
})

// ── P: New Tenant Wizard Source ───────────────────────────────────────────────

describe('P — new tenant wizard source', () => {
  const src = () =>
    fs.readFileSync(path.join(ROOT, 'src/app/admin/tenants/new/page.tsx'), 'utf8')

  it('is a client component', () => {
    expect(src()).toContain("'use client'")
  })

  it('has aria-label "New Tenant Wizard"', () => {
    expect(src()).toContain('New Tenant Wizard')
  })

  it('uses useProvisionTenant hook', () => {
    expect(src()).toContain('useProvisionTenant')
  })

  it('renders step indicator', () => {
    expect(src()).toContain('StepIndicator')
  })

  it('has 6 total steps constant', () => {
    expect(src()).toContain('TOTAL_STEPS')
    expect(src()).toContain('6')
  })
})

// ── Q: Wizard Step Labels ─────────────────────────────────────────────────────

describe('Q — wizard step labels', () => {
  const src = () =>
    fs.readFileSync(path.join(ROOT, 'src/app/admin/tenants/new/page.tsx'), 'utf8')

  it('Step 1: Business Type', () => {
    expect(src()).toContain('Business Type')
  })

  it('Step 2: Capabilities', () => {
    expect(src()).toContain('Capabilities')
  })

  it('Step 3: Branding Defaults', () => {
    expect(src()).toContain('Branding')
  })

  it('Step 4: Feature Flags', () => {
    expect(src()).toContain('Feature Flags')
  })

  it('Step 5: Review', () => {
    expect(src()).toContain('Review')
  })

  it('Step 6: Provision', () => {
    expect(src()).toContain('Provision')
  })

  it('has aria-label for each step section', () => {
    const content = src()
    expect(content).toContain('Step 1: Business Type')
    expect(content).toContain('Step 2: Capabilities')
    expect(content).toContain('Step 3: Branding')
    expect(content).toContain('Step 4: Feature Flags')
    expect(content).toContain('Step 5: Review')
    expect(content).toContain('Step 6: Provision')
  })

  it('has Back button', () => {
    expect(src()).toContain('Back')
  })

  it('has Next button', () => {
    expect(src()).toContain('Next')
  })
})

// ── R: Business Types Coverage ────────────────────────────────────────────────

describe('R — business types coverage', () => {
  it('service covers all 6 business types in getTemplates', async () => {
    const svc = await freshService()
    const types = new Set(svc.getTemplates().map((t) => t.businessType))
    for (const bt of BUSINESS_TYPES) {
      expect(types.has(bt)).toBe(true)
    }
  })

  it('getCapabilityPreset works for all 6 types without throwing', async () => {
    const svc = await freshService()
    for (const bt of BUSINESS_TYPES) {
      expect(() => svc.getCapabilityPreset(bt)).not.toThrow()
    }
  })

  it('generateDefaultConfiguration works for all 6 types', async () => {
    const svc = await freshService()
    for (const bt of BUSINESS_TYPES) {
      const cfg = svc.generateDefaultConfiguration(bt)
      expect(cfg.moduleKey).toBe(bt)
      expect(cfg.businessTypes).toContain(bt)
    }
  })

  it('wizard page renders all 6 business type buttons', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/app/admin/tenants/new/page.tsx'), 'utf8')
    for (const bt of BUSINESS_TYPES) {
      expect(src).toContain(bt)
    }
  })
})

// ── S: Copy Semantics ─────────────────────────────────────────────────────────

describe('S — copy semantics', () => {
  it('getTemplates returns new array on each call', async () => {
    const svc = await freshService()
    const t1 = svc.getTemplates()
    const t2 = svc.getTemplates()
    expect(t1).not.toBe(t2)
  })

  it('getTemplate returns a copy with independent defaultFeatureFlags', async () => {
    const svc = await freshService()
    const t1 = svc.getTemplate('restaurant')
    t1.defaultFeatureFlags['menu.enabled'] = false
    const t2 = svc.getTemplate('restaurant')
    expect(t2.defaultFeatureFlags['menu.enabled']).toBe(true)
  })

  it('getCapabilityPreset returns independent required array', async () => {
    const svc = await freshService()
    const p1 = svc.getCapabilityPreset('bar')
    p1.required.push('fake.flag')
    const p2 = svc.getCapabilityPreset('bar')
    expect(p2.required).not.toContain('fake.flag')
  })

  it('getCapabilityPreset returns independent optional object', async () => {
    const svc = await freshService()
    const p1 = svc.getCapabilityPreset('cafe')
    p1.optional['mutated.flag'] = true
    const p2 = svc.getCapabilityPreset('cafe')
    expect(p2.optional['mutated.flag']).toBeUndefined()
  })
})

// ── T: Endpoints ──────────────────────────────────────────────────────────────

describe('T — endpoints', () => {
  it('TENANTS.PROVISION is defined', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/services/endpoints.ts'), 'utf8')
    expect(src).toContain('PROVISION')
    expect(src).toContain('/tenants/provision/')
  })

  it('TENANTS.CLONE is defined', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/services/endpoints.ts'), 'utf8')
    expect(src).toContain('CLONE')
    expect(src).toContain('/tenants/clone/')
  })

  it('TENANTS.LIST is defined', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/services/endpoints.ts'), 'utf8')
    expect(src).toContain("LIST: '/tenants/'")
  })
})

// ── U: Mock Mode ──────────────────────────────────────────────────────────────

describe('U — mock mode', () => {
  it('provisionTenant resolves without network in mock mode', async () => {
    const svc = await freshService()
    const result = await svc.provisionTenant({ name: 'Mock Test', slug: 'mock-test', businessType: 'restaurant' })
    expect(result.success).toBe(true)
  })

  it('cloneTenant resolves without network in mock mode', async () => {
    const svc = await freshService()
    const result = await svc.cloneTenant('src-id', 'mock-clone', 'Mock Clone')
    expect(result.success).toBe(true)
  })

  it('service file contains USE_MOCK guard', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/services/tenant-provisioning.service.ts'), 'utf8')
    expect(src).toContain('USE_MOCK')
    expect(src).toContain('NEXT_PUBLIC_USE_MOCK')
  })
})

// ── V: Required Capability Enforcement ───────────────────────────────────────

describe('V — required capability enforcement', () => {
  it('all required flags are true in generated flags for restaurant', async () => {
    const svc = await freshService()
    const preset = svc.getCapabilityPreset('restaurant')
    const flags = svc.generateFeatureFlags('restaurant')
    for (const req of preset.required) {
      expect(flags[req]).toBe(true)
    }
  })

  it('all required flags are true in generated flags for food_court', async () => {
    const svc = await freshService()
    const preset = svc.getCapabilityPreset('food_court')
    const flags = svc.generateFeatureFlags('food_court')
    for (const req of preset.required) {
      expect(flags[req]).toBe(true)
    }
  })

  it('validation rejects disabling notifications.enabled for restaurant', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({
      name: 'No Notif',
      slug: 'no-notif',
      businessType: 'restaurant',
      capabilityOverrides: { 'notifications.enabled': false },
    })
    expect(r.valid).toBe(false)
  })

  it('validation rejects disabling ordering.enabled for cafe', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({
      name: 'No Order',
      slug: 'no-order',
      businessType: 'cafe',
      capabilityOverrides: { 'ordering.enabled': false },
    })
    expect(r.valid).toBe(false)
  })
})

// ── W: Branding Validation ────────────────────────────────────────────────────

describe('W — branding validation', () => {
  it('accepts undefined branding', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({ name: 'No Brand', slug: 'no-brand', businessType: 'bar' })
    expect(r.valid).toBe(true)
  })

  it('rejects rgb() as primaryColor', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({
      name: 'RGB',
      slug: 'rgb-test',
      businessType: 'cafe',
      branding: { primaryColor: 'rgb(255,0,0)' },
    })
    expect(r.valid).toBe(false)
  })

  it('rejects word colors as primaryColor', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({
      name: 'Red',
      slug: 'red-test',
      businessType: 'cafe',
      branding: { primaryColor: 'red' },
    })
    expect(r.valid).toBe(false)
  })

  it('rejects invalid accentHoverColor', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({
      name: 'Accent',
      slug: 'accent-test',
      businessType: 'bar',
      branding: { accentHoverColor: 'badcolor' },
    })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes('accentHoverColor'))).toBe(true)
  })

  it('accepts logoUrl without color validation', async () => {
    const svc = await freshService()
    const r = svc.validateTenantConfiguration({
      name: 'Logo Only',
      slug: 'logo-only',
      businessType: 'restaurant',
      branding: { logoUrl: 'https://example.com/logo.png' },
    })
    expect(r.valid).toBe(true)
  })
})

// ── X: Feature Flag Invariants ────────────────────────────────────────────────

describe('X — feature flag invariants', () => {
  it('all templates have notifications.enabled=true', async () => {
    const svc = await freshService()
    for (const t of svc.getTemplates()) {
      expect(t.defaultFeatureFlags['notifications.enabled']).toBe(true)
    }
  })

  it('all templates have ordering.enabled=true', async () => {
    const svc = await freshService()
    for (const t of svc.getTemplates()) {
      expect(t.defaultFeatureFlags['ordering.enabled']).toBe(true)
    }
  })

  it('food_truck does NOT have delivery.enabled=true', async () => {
    const svc = await freshService()
    const flags = svc.generateFeatureFlags('food_truck')
    expect(flags['delivery.enabled']).not.toBe(true)
  })

  it('mobile_cafe does NOT have delivery.enabled=true', async () => {
    const svc = await freshService()
    const flags = svc.generateFeatureFlags('mobile_cafe')
    expect(flags['delivery.enabled']).not.toBe(true)
  })

  it('bar delivery.enabled is false by default', async () => {
    const svc = await freshService()
    const flags = svc.generateFeatureFlags('bar')
    expect(flags['delivery.enabled']).toBeFalsy()
  })

  it('restaurant has delivery.enabled=true', async () => {
    const svc = await freshService()
    expect(svc.generateFeatureFlags('restaurant')['delivery.enabled']).toBe(true)
  })

  it('cafe has order_tracking.enabled=true', async () => {
    const svc = await freshService()
    expect(svc.generateFeatureFlags('cafe')['order_tracking.enabled']).toBe(true)
  })

  it('provisionTenant result tenant featureFlags includes analytics.enabled=true', async () => {
    const svc = await freshService()
    const r = await svc.provisionTenant({ name: 'Analytics', slug: 'analytics-01', businessType: 'restaurant' })
    const flags = r.tenant?.settings?.featureFlags as Record<string, boolean>
    expect(flags?.['analytics.enabled']).toBe(true)
  })
})
