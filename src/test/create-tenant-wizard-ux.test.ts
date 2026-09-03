import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { findScrollableAncestor, scrollWizardToTop } from '@/lib/wizard-scroll'
import { tenantProvisioningService } from '@/services/tenant-provisioning.service'

const ROOT = join(__dirname, '..')

const VALID_PROVISION_BASE = {
  name: 'Test Cafe',
  description: 'A test tenant description',
  businessType: 'cafe' as const,
  branding: { primaryColor: '#2563eb' },
}

describe('Create Tenant wizard — required fields', () => {
  it('Menu is the only required capability across presets', () => {
    for (const bt of ['restaurant', 'cafe', 'bar', 'food_court', 'food_truck', 'mobile_cafe'] as const) {
      expect(tenantProvisioningService.getCapabilityPreset(bt).required).toEqual(['menu.enabled'])
    }
  })

  it('empty name fails validation', () => {
    const r = tenantProvisioningService.validateTenantConfiguration({
      ...VALID_PROVISION_BASE,
      name: '',
    })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes('name'))).toBe(true)
  })

  it('empty description fails validation', () => {
    const r = tenantProvisioningService.validateTenantConfiguration({
      ...VALID_PROVISION_BASE,
      description: '',
    })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes('description'))).toBe(true)
  })

  it('missing primary color fails validation', () => {
    const r = tenantProvisioningService.validateTenantConfiguration({
      ...VALID_PROVISION_BASE,
      branding: {},
    })
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes('primaryColor'))).toBe(true)
  })

  it('empty optional capabilities do not fail; disabling menu still fails', () => {
    expect(
      tenantProvisioningService.validateTenantConfiguration({
        ...VALID_PROVISION_BASE,
        capabilityOverrides: { 'ordering.enabled': false, 'reservations.enabled': false },
      }).valid,
    ).toBe(true)
    expect(
      tenantProvisioningService.validateTenantConfiguration({
        ...VALID_PROVISION_BASE,
        capabilityOverrides: { 'menu.enabled': false },
      }).valid,
    ).toBe(false)
  })

  it('wizard marks tenant name as HTML required', () => {
    const src = readFileSync(join(ROOT, 'app', 'console', 'tenants', 'new', 'page.tsx'), 'utf8')
    expect(src).toContain('id="tenant-name"')
    expect(src).toMatch(/id="tenant-name"[\s\S]{0,200}required/)
    expect(src).toContain("t('menuCapabilityLabel')")
    expect(src).toContain('aria-required="true"')
  })

  it('tenant description is required in the provision payload', () => {
    const src = readFileSync(join(ROOT, 'app', 'console', 'tenants', 'new', 'page.tsx'), 'utf8')
    expect(src).toContain('id="tenant-description"')
    expect(src).toContain("t('tenantDescriptionLabel')")
    expect(src).toContain("t('requiredLabel')")
    expect(src).toMatch(/id="tenant-description"[\s\S]{0,250}required/)
    expect(src).toContain('description: description.trim()')
    const valid = tenantProvisioningService.validateTenantConfiguration(VALID_PROVISION_BASE)
    expect(valid.valid).toBe(true)
  })
})

describe('Create Tenant wizard — fonts', () => {
  it('font selector uses radio cards, selected state, and stored font ids', () => {
    const src = readFileSync(
      join(ROOT, 'components', 'admin', 'tenant-provisioning', 'BrandingDefaultsStep.tsx'),
      'utf8',
    )
    expect(src).toContain("role=\"radiogroup\"")
    expect(src).toContain('aria-checked={selected}')
    expect(src).toContain('data-selected={selected ? \'true\' : \'false\'}')
    expect(src).toContain("t('fontSelectedLabel')")
    expect(src).toContain("t('fontDefaultLocaleHint')")
    expect(src).toContain('fontsByLocale')
    expect(src).toContain('fontBody:')
    expect(src).toContain('selectLanguageFont')
  })
})

describe('Create Tenant wizard — feature flags', () => {
  it('does not use a nested max-height scroll region', () => {
    const src = readFileSync(join(ROOT, 'app', 'console', 'tenants', 'new', 'page.tsx'), 'utf8')
    expect(src).not.toContain('max-h-80')
    expect(src).not.toContain('overflow-y-auto')
    expect(src).toContain('data-testid="feature-flags-section"')
    expect(src).toContain('groupFeatureFlags')
    expect(src).toContain('setFeatureFlagOverrides')
  })
})

describe('Create Tenant wizard — next step scroll', () => {
  it('advances step and resets scroll via wizard helper', () => {
    const src = readFileSync(join(ROOT, 'app', 'console', 'tenants', 'new', 'page.tsx'), 'utf8')
    expect(src).toContain('function next()')
    expect(src).toContain('setStepIndex((s) => s + 1)')
    expect(src).toContain('scrollWizardToTop')
    expect(src).toContain('wizardRef')
    expect(src).toContain('data-testid="wizard-next"')
  })

  it('scrollWizardToTop uses a dedicated overflow container when present', () => {
    const outer = document.createElement('div')
    Object.defineProperty(outer, 'scrollHeight', { value: 800, configurable: true })
    Object.defineProperty(outer, 'clientHeight', { value: 200, configurable: true })
    outer.style.overflowY = 'auto'
    outer.scrollTop = 400
    const inner = document.createElement('div')
    outer.appendChild(inner)
    document.body.appendChild(outer)

    expect(findScrollableAncestor(inner)).toBe(outer)
    scrollWizardToTop(inner)
    expect(outer.scrollTop).toBe(0)

    document.body.removeChild(outer)
  })
})
