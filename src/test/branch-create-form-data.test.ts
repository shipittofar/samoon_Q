/**
 * Multipart contract for Branch create/update list fields.
 *
 * DRF ListField on POST /branches/console-branches/tenants/<id>/create/
 * expects a JSON list (or repeated multipart keys). JSON.stringify() of
 * string[] produces a scalar string and 400s with:
 *   Expected a list of items but got type "str".
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  buildBranchCreateFormData,
  buildBranchFormData,
  branchFormToCreateRequest,
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

function isJsonEncodedList(value: FormDataEntryValue | null): boolean {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.startsWith('[') && trimmed.endsWith(']')
}

describe('buildBranchCreateFormData — cuisines / amenities multipart lists', () => {
  it('appends a valid cuisines list as repeated keys, not a JSON string', () => {
    const form = buildBranchCreateFormData(
      createPayload({ cuisines: ['Italian', 'Mediterranean'], amenities: [] }),
    )
    expect(form.getAll('cuisines')).toEqual(['Italian', 'Mediterranean'])
    expect(form.get('cuisines')).toBe('Italian')
    expect(isJsonEncodedList(form.get('cuisines'))).toBe(false)
  })

  it('appends a valid amenities list as repeated keys, not a JSON string', () => {
    const form = buildBranchCreateFormData(
      createPayload({ cuisines: [], amenities: ['WiFi', 'Parking'] }),
    )
    expect(form.getAll('amenities')).toEqual(['WiFi', 'Parking'])
    expect(form.get('amenities')).toBe('WiFi')
    expect(isJsonEncodedList(form.get('amenities'))).toBe(false)
  })

  it('appends both lists together as independent repeated keys', () => {
    const form = buildBranchCreateFormData(
      createPayload({
        cuisines: ['Iranian', 'Italian'],
        amenities: ['WiFi', 'Parking'],
      }),
    )
    expect(form.getAll('cuisines')).toEqual(['Iranian', 'Italian'])
    expect(form.getAll('amenities')).toEqual(['WiFi', 'Parking'])
    expect(isJsonEncodedList(form.get('cuisines'))).toBe(false)
    expect(isJsonEncodedList(form.get('amenities'))).toBe(false)
  })

  it('omits empty lists so DRF sees missing optional fields, not the string "[]"', () => {
    const form = buildBranchCreateFormData(createPayload({ cuisines: [], amenities: [] }))
    expect(form.getAll('cuisines')).toEqual([])
    expect(form.getAll('amenities')).toEqual([])
    expect(form.has('cuisines')).toBe(false)
    expect(form.has('amenities')).toBe(false)
  })

  it('omits missing optional list fields', () => {
    const payload = createPayload()
    delete payload.cuisines
    delete payload.amenities
    const form = buildBranchCreateFormData(payload)
    expect(form.has('cuisines')).toBe(false)
    expect(form.has('amenities')).toBe(false)
  })

  it('keeps nested objects JSON-encoded (location, businessHours) while lists stay repeated keys', () => {
    const form = buildBranchCreateFormData(
      createPayload({ cuisines: ['Italian'], amenities: ['WiFi'] }),
    )
    expect(() => JSON.parse(String(form.get('location')))).not.toThrow()
    expect(() => JSON.parse(String(form.get('businessHours')))).not.toThrow()
    expect(form.getAll('cuisines')).toEqual(['Italian'])
    expect(form.getAll('amenities')).toEqual(['WiFi'])
  })

  it('does not JSON.stringify cuisines or amenities in the FormData builders', () => {
    expect(branchFormSrc).not.toMatch(/form\.append\(\s*['"]cuisines['"]\s*,\s*JSON\.stringify/)
    expect(branchFormSrc).not.toMatch(/form\.append\(\s*['"]amenities['"]\s*,\s*JSON\.stringify/)
  })
})

describe('buildBranchFormData — cuisines / amenities multipart lists (update)', () => {
  it('appends both lists as repeated keys on the update FormData path', () => {
    const form = buildBranchFormData({
      name: 'Downtown',
      cuisines: ['Italian', 'Mediterranean'],
      amenities: ['WiFi', 'Parking'],
    })
    expect(form.getAll('cuisines')).toEqual(['Italian', 'Mediterranean'])
    expect(form.getAll('amenities')).toEqual(['WiFi', 'Parking'])
    expect(isJsonEncodedList(form.get('cuisines'))).toBe(false)
    expect(isJsonEncodedList(form.get('amenities'))).toBe(false)
  })

  it('omits empty and missing list fields on update', () => {
    const empty = buildBranchFormData({ name: 'Downtown', cuisines: [], amenities: [] })
    expect(empty.has('cuisines')).toBe(false)
    expect(empty.has('amenities')).toBe(false)

    const missing = buildBranchFormData({ name: 'Downtown' })
    expect(missing.has('cuisines')).toBe(false)
    expect(missing.has('amenities')).toBe(false)
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
    const stored = await branchManagementService.getBranch(created.id, 'tenant-samoon-01')
    expect(stored.amenities).toEqual(['WiFi'])
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
    const stored = await branchManagementService.getBranch(created.id, 'tenant-samoon-01')
    expect(stored.cuisines).toEqual(['Italian', 'Mediterranean'])
    expect(stored.amenities).toEqual(['WiFi', 'Parking'])
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
