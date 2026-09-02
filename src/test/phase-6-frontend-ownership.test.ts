import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tenantService } from '@/services/tenant.service'
import { branchManagementService } from '@/services/branch.service'
import {
  composeMarketplacePresentation,
  getMarketplaceMeta,
  pickTenantMarketplace,
} from '@/types/marketplace'
import {
  sanitizeTenantSettings,
  sanitizeTenantSettingsPatch,
  resolvePublicContact,
} from '@/lib/tenant-settings'
import { mapDiscoverTenantToItem } from '@/lib/discover-adapter'
import { resolvePublicBranchList } from '@/lib/public-branches'
import type { DiscoverTenant } from '@/types/discover'

describe('Phase 6 — Tenant.settings sanitizer', () => {
  it('keeps canonical keys only', () => {
    const settings = sanitizeTenantSettings({
      theme: { primaryColor: '#e85d04' },
      featureFlags: { 'menu.enabled': true },
      contactEmail: 'a@b.com',
      contactPhone: '+1 555',
      addressCapabilities: { cash_on_delivery: true, scheduled_delivery: false, same_day: true, contactless_delivery: false },
      notificationMatrix: { 'New Order': { Email: true } },
      marketplace: { tagline: 'Hello', city: 'Paris', coverImage: 'x', branches: [] },
      currency: 'EUR',
      language: 'fr',
      timezone: 'Europe/Paris',
      ordering: { delivery: true },
      features: { menu: true },
      businessHours: { Monday: { open: '09:00' } },
      unknownKey: true,
    })

    expect(settings?.theme?.primaryColor).toBe('#e85d04')
    expect(settings?.featureFlags?.['menu.enabled']).toBe(true)
    expect(settings?.contactEmail).toBe('a@b.com')
    expect(settings?.marketplace?.tagline).toBe('Hello')
    expect(settings && 'currency' in settings).toBe(false)
    expect(settings && 'ordering' in settings).toBe(false)
    expect(settings && 'features' in settings).toBe(false)
    expect(settings?.marketplace && 'city' in settings.marketplace).toBe(false)
    expect(settings?.marketplace && 'coverImage' in settings.marketplace).toBe(false)
    expect(settings?.marketplace && 'branches' in settings.marketplace).toBe(false)
  })

  it('does not send deprecated keys in a PATCH payload', () => {
    const patch = sanitizeTenantSettingsPatch({
      currency: 'EUR',
      marketplace: { city: 'Tehran', tagline: 'Hi' },
      ordering: { delivery: true },
    })
    expect(patch.currency).toBeUndefined()
    expect(patch.ordering).toBeUndefined()
    expect((patch.marketplace as { tagline?: string; city?: string } | undefined)?.tagline).toBe('Hi')
    expect((patch.marketplace as { city?: string } | undefined)?.city).toBeUndefined()
  })
})

describe('Phase 6 — contact fallback', () => {
  it('uses branch contact when present', () => {
    expect(
      resolvePublicContact(
        { phone_number: '+1 branch', email: 'branch@x.com' },
        { contactPhone: '+1 tenant', contactEmail: 'tenant@x.com' },
      ),
    ).toEqual({ phone_number: '+1 branch', email: 'branch@x.com' })
  })

  it('falls back to tenant contact', () => {
    expect(
      resolvePublicContact({}, { contactPhone: '+1 tenant', contactEmail: 'tenant@x.com' }),
    ).toEqual({ phone_number: '+1 tenant', email: 'tenant@x.com' })
  })
})

describe('Phase 6 — marketplace compose from Branch', () => {
  beforeEach(() => {
    tenantService._resetMockList()
    branchManagementService._resetMockStore()
  })

  it('does not read city/cover/branches from Tenant.settings.marketplace', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const listing = getMarketplaceMeta(tenant.settings)
    expect(listing?.tagline).toBeTruthy()
    expect(listing && 'city' in listing).toBe(false)
    expect(listing && 'branches' in listing).toBe(false)
    expect(listing && 'coverImage' in listing).toBe(false)
    expect(listing && 'openNow' in listing).toBe(false)
  })

  it('composes city, cover, contact, and computed fields from branches', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    const branches = await resolvePublicBranchList(tenant.id)
    const meta = composeMarketplacePresentation({
      listing: getMarketplaceMeta(tenant.settings),
      branches,
      tenantContact: { contactEmail: tenant.settings?.contactEmail, contactPhone: tenant.settings?.contactPhone },
    })
    expect(meta.city).toBe('New York')
    expect(meta.coverImage).toBeUndefined()
    expect(meta.branchCount).toBeGreaterThan(0)
    expect(meta.primaryBranchSlug).toBeTruthy()
    expect(typeof meta.openNow).toBe('boolean')
    expect(meta.phone_number).toBeTruthy()
    expect(meta.branches?.every((b) => Array.isArray(b.cuisines) || b.cuisines === undefined)).toBe(true)
  })
})

describe('Phase 6 — Discover adapter ownership', () => {
  it('puts listing metadata on tenant.settings.marketplace and branch data on branches', () => {
    const wire: DiscoverTenant = {
      id: 't1',
      slug: 'samoon',
      name: 'Samoon',
      is_active: true,
      status: 'ACTIVE',
      created_at: '2024-01-01T00:00:00.000Z',
      businessTypes: ['restaurant'],
      featureFlags: { 'menu.enabled': true },
      contactEmail: 'tenant@x.com',
      contactPhone: '+1 tenant',
      marketplace: { tagline: 'Story', featured: true, rating: 4.5, openNow: true, branchCount: 1, primaryBranchSlug: 'main' },
      branches: [
        {
          id: 'b1',
          slug: 'main',
          name: 'Main',
          description: 'Branch desc',
          openNow: true,
          image: 'https://example.com/branch.jpg',
          phone_number: '+1 branch',
          email: 'branch@x.com',
          location: { address: '1 Main', city: 'Brooklyn' },
          cuisines: ['Italian'],
          amenities: ['WiFi'],
          marketplaceVisible: true,
        },
      ],
    }
    const item = mapDiscoverTenantToItem(wire)
    expect(item.tenant.settings?.marketplace).toEqual(pickTenantMarketplace(wire.marketplace))
    expect(item.tenant.settings?.marketplace && 'city' in item.tenant.settings.marketplace).toBe(false)
    expect(item.meta.city).toBe('Brooklyn')
    expect(item.tenant.discoverCover).toBeUndefined()
    expect(item.meta.description).toBe('Branch desc')
    expect(item.meta.phone_number).toBe('+1 branch')
    expect(item.meta.openNow).toBe(true)
    expect(item.branches[0].cuisines).toEqual(['Italian'])
    expect(item.tenant.settings?.featureFlags?.['menu.enabled']).toBe(true)
  })

  it('uses tenant contact when branch contact is empty', () => {
    const item = mapDiscoverTenantToItem({
      id: 't1',
      slug: 'x',
      name: 'X',
      is_active: true,
      status: 'ACTIVE',
      created_at: '2024-01-01T00:00:00.000Z',
      businessTypes: ['restaurant'],
      contactEmail: 'fallback@x.com',
      contactPhone: '+1 fallback',
      marketplace: { tagline: 'T' },
      branches: [
        {
          id: 'b1',
          slug: 'main',
          name: 'Main',
          openNow: false,
          location: { address: '1 St', city: 'NYC' },
          marketplaceVisible: true,
        },
      ],
    })
    expect(item.meta.email).toBe('fallback@x.com')
    expect(item.meta.phone_number).toBe('+1 fallback')
  })
})
