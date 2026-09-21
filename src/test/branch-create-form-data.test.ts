/**
 * JSON contract for Branch create/update list fields.
 *
 * Cuisines/amenities must remain string arrays, never JSON-stringified scalars.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  branchFormToCreateRequest,
  branchFormToWriteRequest,
  EMPTY_BRANCH_FORM,
  type BranchCreateRequest,
} from '@/types/branch-form'

process.env.NEXT_PUBLIC_USE_MOCK = 'true'

const ROOT = path.resolve(__dirname, '../..')
const branchFormSrc = fs.readFileSync(path.join(ROOT, 'src/types/branch-form.ts'), 'utf8')

function createPayload(
  overrides: Partial<typeof EMPTY_BRANCH_FORM> = {},
): BranchCreateRequest {
  return branchFormToCreateRequest({
    ...EMPTY_BRANCH_FORM,
    name: 'Downtown',
    address: '1 Main',
    city: 'NYC',
    country: 'US',
    ...overrides,
  })
}

describe('branch create JSON — cuisines / amenities', () => {
  it('keeps cuisines as a string array', () => {
    const payload = createPayload({ cuisines: ['Italian', 'Mediterranean'], amenities: [] })
    expect(payload.cuisines).toEqual(['Italian', 'Mediterranean'])
    expect(typeof payload.cuisines).not.toBe('string')
  })

  it('keeps amenities as a string array', () => {
    const payload = createPayload({ cuisines: [], amenities: ['WiFi', 'Parking'] })
    expect(payload.amenities).toEqual(['WiFi', 'Parking'])
  })

  it('does not JSON.stringify cuisines or amenities in the form mapper', () => {
    expect(branchFormSrc).not.toMatch(/JSON\.stringify\(\s*payload\.cuisines/)
    expect(branchFormSrc).not.toMatch(/JSON\.stringify\(\s*form\.cuisines/)
  })
})

describe('branch write request images', () => {
  it('does not put File objects on create/update JSON', () => {
    const logo = new File([new Uint8Array(8)], 'logo.jpg', { type: 'image/jpeg' })
    const payload = branchFormToCreateRequest({
      ...EMPTY_BRANCH_FORM,
      name: 'Downtown',
      address: '1 Main',
      city: 'NYC',
      country: 'US',
      image: { file: logo, existingUrl: '', cleared: false },
    })
    expect(payload.image_asset_id).toBeUndefined()
    expect(branchFormToWriteRequest({
      ...EMPTY_BRANCH_FORM,
      name: 'Downtown',
      image: { file: null, existingUrl: 'https://cdn.example/a.jpg', cleared: true },
    }).image_asset_id).toBeNull()
  })

  it('omits slug and keeps flattened checkout on create', () => {
    const create = createPayload({ website: 'https://example.com', latitude: 40.7, longitude: -74 })
    expect(create).not.toHaveProperty('slug')
    expect(create.pickupEnabled).toBe(true)
    expect(create.location.latitude).toBe(40.7)
  })
})

describe('consoleCreateBranch mock persistence of list fields', () => {
  beforeEach(async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    branchManagementService._resetMockStore()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('persists a cuisines list on the created branch', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const created = await branchManagementService.consoleCreateBranch(
      'tenant-samoon-01',
      createPayload({ name: 'Cuisine Branch', cuisines: ['Italian'], amenities: [] }),
    )
    expect(created.cuisines).toEqual(['Italian'])
    const stored = await branchManagementService.getBranch(created.id, 'tenant-samoon-01')
    expect(stored.cuisines).toEqual(['Italian'])
  })

  it('persists an amenities list on the created branch', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const created = await branchManagementService.consoleCreateBranch(
      'tenant-samoon-01',
      createPayload({ name: 'Amenity Branch', cuisines: [], amenities: ['WiFi'] }),
    )
    expect(created.amenities).toEqual(['WiFi'])
  })

  it('persists both lists together', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const created = await branchManagementService.consoleCreateBranch(
      'tenant-samoon-01',
      createPayload({
        name: 'Catalog Branch',
        cuisines: ['Italian', 'Mediterranean'],
        amenities: ['WiFi', 'Parking'],
      }),
    )
    expect(created.cuisines).toEqual(['Italian', 'Mediterranean'])
    expect(created.amenities).toEqual(['WiFi', 'Parking'])
  })

  it('persists empty lists when provided', async () => {
    const { branchManagementService } = await import('@/services/branch.service')
    const created = await branchManagementService.consoleCreateBranch(
      'tenant-samoon-01',
      createPayload({ name: 'Empty Catalog Branch', cuisines: [], amenities: [] }),
    )
    expect(created.cuisines).toEqual([])
    expect(created.amenities).toEqual([])
  })
})
