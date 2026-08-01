/**
 * Enterprise Address subsystem tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { filterMockAddresses, mockServiceability } from '@/lib/address-mock-data'
import {
  buildAddressCreatePayload,
  getMissingAddressOwnerFields,
  resolvePhoneFromUser,
} from '@/lib/address-profile'
import { userAddressSchema } from '@/lib/address-validation'
import { addressService } from '@/services/address.service'
import { serviceabilityService } from '@/services/serviceability.service'
import type { User } from '@/types'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

const validForm = {
  address_type: 'home' as const,
  country: 'US',
  city: 'New York',
  street: 'Main St',
  postal_code: '10001',
}

const validFormMinimal = {
  address_type: 'home' as const,
  country: 'US',
  city: 'New York',
  street: 'Main St',
  postal_code: '10001',
}

const ownerProfile = {
  first_name: 'John',
  last_name: 'Doe',
  country_code: '+1',
  phone: '+15551234567',
}

describe('address types and validation', () => {
  it('userAddressSchema requires street, city, and postal_code', () => {
    const result = userAddressSchema.safeParse({
      address_type: 'home',
      country: 'US',
      city: '',
      street: '',
      postal_code: '',
    })
    expect(result.success).toBe(false)
  })

  it('userAddressSchema accepts payload without province or district', () => {
    const result = userAddressSchema.safeParse(validFormMinimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.province).toBeUndefined()
      expect(result.data.district).toBeUndefined()
    }
  })

  it('userAddressSchema rejects empty postal_code', () => {
    const result = userAddressSchema.safeParse({ ...validForm, postal_code: '' })
    expect(result.success).toBe(false)
  })

  it('userAddressSchema accepts valid payload', () => {
    const result = userAddressSchema.safeParse(validForm)
    expect(result.success).toBe(true)
  })
})

describe('address profile injection', () => {
  it('maps title from address type and injects owner profile including phone', async () => {
    const { resolveAddressTitle, buildAddressCreatePayload } = await import('@/lib/address-profile')
    expect(resolveAddressTitle({ address_type: 'home', custom_label: '' })).toBe('Home')
    expect(resolveAddressTitle({ address_type: 'work', custom_label: 'Office HQ' })).toBe('Office HQ')

    const payload = buildAddressCreatePayload(
      { address_type: 'home', country: 'US', city: 'NYC', street: 'Main', postal_code: '10001' },
      ownerProfile,
    )
    expect(payload.title).toBe('Home')
    expect(payload.first_name).toBe('John')
    expect(payload.last_name).toBe('Doe')
    expect(payload.country_code).toBe('+1')
    expect(payload.phone).toBe('+15551234567')
  })

  it('flags missing phone in profile', () => {
    const user = { id: '1', phone_number: '', first_name: 'Jane', last_name: 'Doe' } as User
    expect(resolvePhoneFromUser(user)).toBeNull()
    expect(getMissingAddressOwnerFields(user)).toContain('phone')
  })
})

describe('address.service mock CRUD', () => {
  beforeEach(() => {
    addressService._resetMockStore()
  })

  it('lists addresses with pagination', async () => {
    const res = await addressService.list({ page: 1, page_size: 1 })
    expect(res.results).toHaveLength(1)
    expect(res.count).toBeGreaterThan(1)
  })

  it('creates address with formatted_address', async () => {
    const created = await addressService.create(
      buildAddressCreatePayload(
        { ...validForm, building_number: '1' },
        ownerProfile,
      ),
    )
    expect(created.formatted_address).toContain('Main St')
    expect(created.verification_status).toBe('pending')
  })

  it('updates address', async () => {
    const updated = await addressService.update('addr-1', { custom_label: 'Updated Home' })
    expect(updated.custom_label).toBe('Updated Home')
  })

  it('soft deletes and restores', async () => {
    await addressService.delete('addr-1')
    const list = await filterMockAddresses(
      (await addressService.list({ include_deleted: true })).results,
      { include_deleted: false },
    )
    expect(list.results.find((a) => a.id === 'addr-1')).toBeUndefined()

    const restored = await addressService.restore('addr-1')
    expect(restored.is_deleted).toBeFalsy()
  })

  it('sets default address', async () => {
    const result = await addressService.setDefault('addr-2')
    expect(result.is_default).toBe(true)
  })

  it('returns suggestions for query', async () => {
    const suggestions = await addressService.suggestions('5th Ave')
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions[0].formatted_address).toBeTruthy()
  })

  it('reverse geocodes coordinates', async () => {
    const result = await addressService.reverseGeocode(40.7, -74.0)
    expect(result.formatted_address).toBeTruthy()
    expect(result.latitude).toBe(40.7)
  })
})

describe('serviceability.service', () => {
  it('returns deliverable for in-range coordinates', async () => {
    const result = await serviceabilityService.check({
      branch_id: 'branch-1',
      latitude: 40.71,
      longitude: -74.0,
    })
    expect(result.deliverable).toBe(true)
    expect(result.delivery_fee).toBeDefined()
  })

  it('returns not deliverable for out-of-range', () => {
    const result = mockServiceability('branch-1', 40.0, -74.0)
    expect(result.deliverable).toBe(false)
    expect(result.reason).toBeTruthy()
  })
})

describe('checkout integration', () => {
  const src = () => readSrc('app/checkout/page.tsx')

  it('uses AddressPicker for delivery', () => {
    expect(src()).toContain('AddressPicker')
    expect(src()).toContain('useCheckServiceability')
    expect(src()).toContain('address_id')
    expect(src()).toContain('delivery_address_override')
  })

  it('shows DeliveryInfoCard for serviceability', () => {
    expect(src()).toContain('DeliveryInfoCard')
  })
})

describe('address components exist', () => {
  const components = [
    'AddressCard.tsx',
    'AddressForm.tsx',
    'AddressPicker.tsx',
    'VerificationBadge.tsx',
    'MapSelector.tsx',
    'DeliveryInfoCard.tsx',
  ]

  it.each(components)('exports %s', (file) => {
    expect(fs.existsSync(path.join(ROOT, 'src', 'components', 'address', file))).toBe(true)
  })
})

describe('endpoints coverage', () => {
  const endpoints = () => readSrc('services/endpoints.ts')

  it('declares all address endpoints', () => {
    const src = endpoints()
    expect(src).toContain("ADDRESSES: '/users/addresses/'")
    expect(src).toContain('ADDRESS_RESTORE')
    expect(src).toContain('ADDRESS_SET_DEFAULT')
    expect(src).toContain('ADDRESS_SUGGESTIONS')
    expect(src).toContain('ADDRESS_REVERSE_GEOCODE')
    expect(src).toContain("CHECK: '/serviceability/check/'")
  })
})

describe('hooks export address mutations', () => {
  const hooks = () => readSrc('hooks/index.ts')

  it('re-exports enterprise address hooks', () => {
    const src = hooks()
    expect(src).toContain('useCreateAddress')
    expect(src).toContain('useUpdateAddress')
    expect(src).toContain('useSetDefaultAddress')
    expect(src).toContain('useCheckServiceability')
  })
})

describe('address form UX', () => {
  const formSrc = () => readSrc('components/address/AddressForm.tsx')

  it('does not render a phone input', () => {
    expect(formSrc()).not.toMatch(/label=\{t\('phone'\)\}/)
  })

  it('uses collapsible optional section without required province/district', () => {
    expect(formSrc()).toContain('CollapsibleSection')
    expect(formSrc()).toContain("sections.required")
    expect(formSrc()).toContain("sections.optional")
    expect(formSrc()).toContain("register('postal_code')")
    expect(formSrc()).not.toMatch(/label=\{t\('province'\)\}[^]*required/)
    expect(formSrc()).not.toMatch(/label=\{t\('district'\)\}[^]*required/)
    expect(formSrc()).toContain("mode: 'onChange'")
  })
})

describe('address field contract', () => {
  it('defines province and district as optional in single source of truth', async () => {
    const { ADDRESS_REQUIRED_FIELDS, ADDRESS_OPTIONAL_FIELDS, sanitizeAddressInput } = await import('@/lib/address-fields')
    expect(ADDRESS_REQUIRED_FIELDS).not.toContain('province')
    expect(ADDRESS_REQUIRED_FIELDS).not.toContain('district')
    expect(ADDRESS_OPTIONAL_FIELDS).toContain('province')
    expect(ADDRESS_OPTIONAL_FIELDS).toContain('district')

    const sanitized = sanitizeAddressInput({
      address_type: 'home',
      country: 'US',
      city: 'NYC',
      street: 'Main',
      postal_code: '10001',
      province: '',
      district: '  ',
    })
    expect(sanitized.province).toBeUndefined()
    expect(sanitized.district).toBeUndefined()
  })
})

describe('deleted addresses feature flag', () => {
  it('ENABLE_DELETED_ADDRESSES is off and strips include_deleted from list params', async () => {
    const { ENABLE_DELETED_ADDRESSES, normalizeAddressListParams } = await import('@/lib/address-features')
    expect(ENABLE_DELETED_ADDRESSES).toBe(false)
    expect(normalizeAddressListParams({ include_deleted: true, page: 1 })).toEqual({ page: 1 })
  })

  it('addresses page gates deleted-address UI behind feature flag', () => {
    const src = readSrc('app/dashboard/addresses/page.tsx')
    expect(src).toContain('ENABLE_DELETED_ADDRESSES')
    expect(src).toContain('showDeleted')
    expect(src).toContain('useRestoreAddress')
  })
})
