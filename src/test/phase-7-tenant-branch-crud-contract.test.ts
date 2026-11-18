import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { sanitizeTenantSettings, sanitizeTenantSettingsPatch } from '@/lib/tenant-settings'
import { branchFormToWriteRequest, EMPTY_BRANCH_FORM } from '@/types/branch-form'
import { pickTenantMarketplace } from '@/types/marketplace'
import { tenantService } from '@/services/tenant.service'
import { tenantProvisioningService } from '@/services/tenant-provisioning.service'

const ROOT = path.resolve(__dirname, '../..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8')

const LEGACY_TENANT_SETTINGS = [
  'settings.currency',
  'settings.language',
  'settings.timezone',
  'settings.ordering',
  'settings.features',
  'settings.businessHours',
]

describe('Phase 7 — Tenant Edit surface', () => {
  it('has a Tenant Edit page reachable from tenant detail', () => {
    const edit = readSrc('app/console/tenants/[tenantId]/edit/page.tsx')
    const detail = readSrc('app/console/tenants/[tenantId]/page.tsx')
    expect(edit).toContain('useUpdateTenantSettings')
    expect(edit).toContain('TenantCanonicalSettingsForm')
    expect(edit).toContain('tenant.manage')
    expect(detail).toContain('/console/tenants/${tenant.id}/edit')
  })

  it('does not invent updateTenant; reuses PATCH settings', () => {
    const service = readSrc('services/tenant.service.ts')
    expect(service).not.toMatch(/async updateTenant\(/)
    expect(service).toContain('updateTenantSettings')
    expect(service).toContain('ENDPOINTS.TENANTS.SETTINGS')
  })

  it('tenant edit payload helper strips branch-owned marketplace keys', () => {
    const listing = pickTenantMarketplace({
      tagline: 'Hi',
      city: 'Tehran',
      coverImage: 'x.jpg',
      branches: [],
      cuisines: ['Italian'],
      amenities: ['WiFi'],
      description: 'branch desc',
    })
    expect(listing?.tagline).toBe('Hi')
    expect(listing && 'city' in listing).toBe(false)
    expect(listing && 'coverImage' in listing).toBe(false)
    expect(listing && 'cuisines' in listing).toBe(false)
  })
})

describe('Phase 7 — Add Tenant payload', () => {
  it('provision JSON settings contain only featureFlags and theme', async () => {
    tenantProvisioningService._resetMockSlugs()
    const result = await tenantProvisioningService.provisionTenant({
      name: 'Audit Cafe',
      description: 'Audit cafe description',
      businessType: 'cafe',
      branding: { primaryColor: '#6f4e37' },
    })
    expect(result.success).toBe(true)
    const settings = result.tenant?.settings as Record<string, unknown> | undefined
    expect(settings?.featureFlags).toBeTruthy()
    expect(settings?.theme).toBeTruthy()
    for (const key of ['currency', 'language', 'timezone', 'ordering', 'features', 'businessHours']) {
      expect(settings && key in settings).toBe(false)
    }
    const marketplace = settings?.marketplace as Record<string, unknown> | undefined
    expect(marketplace).toBeUndefined()
  })

  it('provision service source does not write legacy tenant settings keys', () => {
    const src = readSrc('services/tenant-provisioning.service.ts')
    for (const field of LEGACY_TENANT_SETTINGS) {
      expect(src).not.toContain(field)
    }
  })
})

describe('Phase 7 — Add/Edit Branch payload', () => {
  it('branchFormToWriteRequest puts owned fields on the branch, not tenant.settings', () => {
    const payload = branchFormToWriteRequest({
      ...EMPTY_BRANCH_FORM,
      name: 'Downtown',
      address: '1 Main',
      city: 'New York',
      country: 'US',
      description: 'Our flagship',
      phone_number: '2125550100',
      email: 'd@x.com',
      timeZone: 'America/New_York',
      currency: 'USD',
      language: 'en',
      cuisines: ['Italian', 'Mediterranean'],
      amenities: ['WiFi', 'Parking'],
      reservationsEnabled: true,
    })
    expect(payload.location?.city).toBe('New York')
    expect(payload.description).toBe('Our flagship')
    expect(payload.contact?.phone_number).toBe('2125550100')
    expect(payload.contact?.email).toBe('d@x.com')
    expect(payload.timeZone).toBe('America/New_York')
    expect(payload.currency).toBe('USD')
    expect(payload.language).toBe('en')
    expect(payload.cuisines).toEqual(['Italian', 'Mediterranean'])
    expect(payload.amenities).toEqual(['WiFi', 'Parking'])
    expect(payload.reservationsEnabled).toBe(true)
    expect(payload.checkout).toBeTruthy()
    expect(payload).not.toHaveProperty('slug')
    expect(payload).not.toHaveProperty('settings')
    expect(payload).not.toHaveProperty('marketplace')
  })
})

describe('Phase 7 — sanitizer mock extras', () => {
  it('strips websiteBuilder and branchOverrides unless mock extras are allowed', () => {
    const cleaned = sanitizeTenantSettings({
      theme: { primaryColor: '#000' },
      websiteBuilder: { status: 'draft' },
      branchOverrides: { 'b-1': { hero: 'x' } },
    })
    expect(cleaned && 'websiteBuilder' in cleaned).toBe(false)
    expect(cleaned && 'branchOverrides' in cleaned).toBe(false)
  })

  it('keeps mock extras when allowMockExtras is true', () => {
    const cleaned = sanitizeTenantSettings(
      {
        websiteBuilder: { status: 'draft' },
        branchOverrides: { 'b-1': {} },
      },
      { allowMockExtras: true },
    ) as Record<string, unknown>
    expect(cleaned.websiteBuilder).toEqual({ status: 'draft' })
    expect(cleaned.branchOverrides).toEqual({ 'b-1': {} })
  })

  it('PATCH sanitizer never sends deprecated tenant settings', () => {
    const patch = sanitizeTenantSettingsPatch({
      currency: 'EUR',
      language: 'fa',
      timezone: 'Asia/Tehran',
      ordering: { delivery: true },
      marketplace: { tagline: 'Hi', city: 'Tehran', email: 'x@y.com' },
    })
    expect(patch.currency).toBeUndefined()
    expect(patch.language).toBeUndefined()
    expect(patch.timezone).toBeUndefined()
    expect(patch.ordering).toBeUndefined()
    expect((patch.marketplace as { tagline?: string })?.tagline).toBe('Hi')
    expect((patch.marketplace as { city?: string })?.city).toBeUndefined()
  })
})

describe('Phase 7 — tenantService settings writer', () => {
  it('exposes updateTenantSettings and not updateTenant', () => {
    expect(typeof tenantService.updateTenantSettings).toBe('function')
    expect('updateTenant' in tenantService).toBe(false)
  })
})
