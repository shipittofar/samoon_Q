/**
 * Step 6 Provision — display backend TenantResponse name/slug.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getProvisionedTenantDisplay } from '@/lib/provision-result-display'
import type { TenantProvisionResult } from '@/types/provisioning'
import { buildTenantProvisionFormData } from '@/services/tenant-provisioning.service'

const ROOT = join(__dirname, '..')
const pageSrc = () =>
  readFileSync(join(ROOT, 'app', 'console', 'tenants', 'new', 'page.tsx'), 'utf8')

describe('getProvisionedTenantDisplay — backend response is authoritative', () => {
  it('uses response.name and response.slug from tenant', () => {
    const result: TenantProvisionResult = {
      success: true,
      tenantId: '123',
      tenant: {
        id: '123',
        name: 'My Restaurant',
        slug: 'my-restaurant-2',
        businessTypes: ['restaurant'],
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    }
    const display = getProvisionedTenantDisplay(result)
    expect(display.name).toBe('My Restaurant')
    expect(display.slug).toBe('my-restaurant-2')
    expect(display.slugMissing).toBe(false)
  })

  it('prefers backend slug over any locally imagined form value', () => {
    const formName = 'Form Name That Differs'
    const formSlugGuess = 'form-name-that-differs'
    const result: TenantProvisionResult = {
      success: true,
      tenantId: '123',
      slug: 'my-restaurant-2',
      tenant: {
        id: '123',
        name: 'My Restaurant',
        slug: 'my-restaurant-2',
        businessTypes: ['restaurant'],
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    }
    const display = getProvisionedTenantDisplay(result)
    expect(display.name).not.toBe(formName)
    expect(display.slug).not.toBe(formSlugGuess)
    expect(display.name).toBe('My Restaurant')
    expect(display.slug).toBe('my-restaurant-2')
  })

  it('flags missing slug as a contract problem without inventing one', () => {
    const result: TenantProvisionResult = {
      success: true,
      tenantId: '123',
      tenant: {
        id: '123',
        name: 'My Restaurant',
        slug: '',
        businessTypes: ['restaurant'],
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    }
    const display = getProvisionedTenantDisplay(result)
    expect(display.name).toBe('My Restaurant')
    expect(display.slug).toBeUndefined()
    expect(display.slugMissing).toBe(true)
  })
})

describe('Step 6 wiring', () => {
  it('renders provisioned name/slug from result.tenant via getProvisionedTenantDisplay', () => {
    const src = pageSrc()
    expect(src).toContain('getProvisionedTenantDisplay')
    expect(src).toContain('ProvisionSuccessPanel')
    expect(src).toContain('data-testid="provisioned-tenant-name"')
    expect(src).toContain('data-testid="provisioned-tenant-slug"')
    expect(src).toContain('setProvisionResult(result)')
    // Must not invent slug from form name
    expect(src).not.toMatch(/slugify\s*\(/)
  })

  it('provision request object does not include slug', () => {
    const src = pageSrc()
    // Active request construction (not commented legacy)
    expect(src).toContain(
      'const req = { name, businessType, capabilityOverrides, branding, featureFlagOverrides, image: logoFile }',
    )
    const activeReqLine = src
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('const req = {') && !l.startsWith('//'))
    expect(activeReqLine).toBeTruthy()
    expect(activeReqLine).not.toContain('slug')
  })
})

describe('provision FormData / JSON body omits slug', () => {
  it('buildTenantProvisionFormData has no slug field', () => {
    const file = new File(['x'], 'logo.png', { type: 'image/png' })
    const form = buildTenantProvisionFormData({
      name: 'My Restaurant',
      businessType: 'restaurant',
      settings: {
        featureFlags: { 'menu.enabled': true },
        theme: { primaryColor: '#e85d04' },
      },
      image: file,
    })
    expect(form.has('slug')).toBe(false)
    expect(form.get('name')).toBe('My Restaurant')
  })
})
