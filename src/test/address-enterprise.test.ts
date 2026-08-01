/**
 * Enterprise Address subsystem tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { filterMockAddresses, mockServiceability } from '@/lib/address-mock-data'
import { buildAddressCreatePayload } from '@/lib/address-profile'
import { userAddressSchema } from '@/lib/address-validation'
import { addressService } from '@/services/address.service'
import { serviceabilityService } from '@/services/serviceability.service'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8000/api')

const ROOT = path.join(__dirname, '..', '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')

describe('address types and validation', () => {
  it('userAddressSchema requires street and city', () => {
    const result = userAddressSchema.safeParse({
      address_type: 'home',
      country: 'US',
      city: '',
      street: '',
    })
    expect(result.success).toBe(false)
  })

  it('userAddressSchema accepts valid payload', () => {
    const result = userAddressSchema.safeParse({
      address_type: 'home',
      country: 'US',
      city: 'New York',
      street: 'Main St',
    })
    expect(result.success).toBe(true)
  })
})

describe('address profile injection', () => {
  it('maps title from address type and injects owner profile', async () => {
    const { resolveAddressTitle, buildAddressCreatePayload } = await import('@/lib/address-profile')
    expect(resolveAddressTitle({ address_type: 'home', custom_label: '' })).toBe('Home')
    expect(resolveAddressTitle({ address_type: 'work', custom_label: 'Office HQ' })).toBe('Office HQ')

    const payload = buildAddressCreatePayload(
      { address_type: 'home', country: 'US', city: 'NYC', street: 'Main' },
      { first_name: 'John', last_name: 'Doe', country_code: '+1' },
    )
    expect(payload.title).toBe('Home')
    expect(payload.first_name).toBe('John')
    expect(payload.last_name).toBe('Doe')
    expect(payload.country_code).toBe('+1')
  })
})

describe('address.service mock CRUD', () => {
  const ownerProfile = { first_name: 'John', last_name: 'Doe', country_code: '+1' }

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
        { address_type: 'home', country: 'US', city: 'Boston', street: 'Beacon St', building_number: '1' },
        ownerProfile,
      ),
    )
    expect(created.formatted_address).toContain('Beacon St')
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
