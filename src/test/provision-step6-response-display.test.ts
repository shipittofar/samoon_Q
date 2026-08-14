/**
 * Step 6 Provision — backend TenantResponse name/slug/status + Create First Branch CTA.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  getProvisionedTenantDisplay,
  getCreateFirstBranchHref,
  tenantStatusLabelKey,
} from '@/lib/provision-result-display'
import type { TenantProvisionResult } from '@/types/provisioning'
import { buildTenantProvisionFormData } from '@/services/tenant-provisioning.service'

const ROOT = join(__dirname, '..')
const pageSrc = () =>
  readFileSync(join(ROOT, 'app', 'console', 'tenants', 'new', 'page.tsx'), 'utf8')
const branchNewSrc = () =>
  readFileSync(join(ROOT, 'app', 'console', 'branches', 'new', 'page.tsx'), 'utf8')

function inactiveResult(): TenantProvisionResult {
  return {
    success: true,
    tenantId: 'tenant-123',
    tenant: {
      id: 'tenant-123',
      name: 'My Restaurant',
      slug: 'my-restaurant',
      businessTypes: ['restaurant'],
      status: 'inactive',
      created_at: '2026-01-01T00:00:00.000Z',
    },
  }
}

describe('getProvisionedTenantDisplay — backend response is authoritative', () => {
  it('uses response.name and response.slug from tenant', () => {
    const display = getProvisionedTenantDisplay(inactiveResult())
    expect(display.name).toBe('My Restaurant')
    expect(display.slug).toBe('my-restaurant')
    expect(display.slugMissing).toBe(false)
  })

  it('reads inactive status from backend response', () => {
    const display = getProvisionedTenantDisplay(inactiveResult())
    expect(display.status).toBe('inactive')
    expect(display.isInactive).toBe(true)
    expect(display.tenantId).toBe('tenant-123')
    expect(tenantStatusLabelKey(display.status)).toBe('statusInactive')
  })

  it('does not invent inactive when backend returns active', () => {
    const result: TenantProvisionResult = {
      success: true,
      tenantId: 'tenant-123',
      tenant: {
        id: 'tenant-123',
        name: 'My Restaurant',
        slug: 'my-restaurant',
        businessTypes: ['restaurant'],
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    }
    const display = getProvisionedTenantDisplay(result)
    expect(display.status).toBe('active')
    expect(display.isInactive).toBe(false)
    expect(tenantStatusLabelKey(display.status)).toBe('statusActive')
  })

  it('prefers backend slug over any locally imagined form value', () => {
    const formName = 'Form Name That Differs'
    const formSlugGuess = 'form-name-that-differs'
    const display = getProvisionedTenantDisplay(inactiveResult())
    expect(display.name).not.toBe(formName)
    expect(display.slug).not.toBe(formSlugGuess)
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
        status: 'inactive',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    }
    const display = getProvisionedTenantDisplay(result)
    expect(display.name).toBe('My Restaurant')
    expect(display.slug).toBeUndefined()
    expect(display.slugMissing).toBe(true)
  })

  it('does not mutate status to active', () => {
    const result = inactiveResult()
    getProvisionedTenantDisplay(result)
    expect(result.tenant?.status).toBe('inactive')
  })
})

describe('Create First Branch CTA', () => {
  it('builds href with the newly created tenant id', () => {
    expect(getCreateFirstBranchHref('tenant-123')).toBe(
      '/console/branches/new?tenantId=tenant-123',
    )
    expect(getCreateFirstBranchHref('tenant-123')).not.toContain('activeMembership')
  })

  it('Step 6 wires CTA to getCreateFirstBranchHref(tenantId)', () => {
    const src = pageSrc()
    expect(src).toContain('getCreateFirstBranchHref')
    expect(src).toContain('create-first-branch-cta')
    expect(src).toContain('data-tenant-id={tenantId}')
    expect(src).toContain('provision-inactive-explanation')
    expect(src).toContain('provisioned-tenant-status')
    expect(src).toContain('isInactive')
    // Must not hardcode inactive without reading response
    expect(src).not.toMatch(/status:\s*['"]inactive['"]/)
  })

  it('branch create page prefers query tenantId over workspace tenant', () => {
    const src = branchNewSrc()
    expect(src).toContain("searchParams.get('tenantId')")
    expect(src).toContain('queryTenantId || workspaceTenantId')
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
    expect(src).not.toMatch(/slugify\s*\(/)
  })

  it('provision request object does not include slug', () => {
    const src = pageSrc()
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
