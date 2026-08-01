import type { UserAddressInput, UserAddressUpdateInput } from '@/types/address'

/**
 * Single source of truth for address form field requirements.
 * Align with backend POST/PATCH /users/addresses/ contract.
 *
 * Required: address_type, country, city, street, postal_code
 * Optional: everything else (including province and district)
 *
 * Phone, title, first_name, last_name, country_code are injected from auth profile — not form fields.
 */
export const ADDRESS_REQUIRED_FIELDS = [
  'address_type',
  'country',
  'city',
  'street',
  'postal_code',
] as const

export const ADDRESS_OPTIONAL_FIELDS = [
  'province',
  'district',
  'building_number',
  'unit',
  'floor',
  'custom_label',
  'delivery_notes',
  'latitude',
  'longitude',
  'is_default',
] as const

export type AddressRequiredField = (typeof ADDRESS_REQUIRED_FIELDS)[number]
export type AddressOptionalField = (typeof ADDRESS_OPTIONAL_FIELDS)[number]

const OPTIONAL_STRING_FIELDS = [
  'province',
  'district',
  'building_number',
  'unit',
  'floor',
  'custom_label',
  'delivery_notes',
] as const satisfies readonly AddressOptionalField[]

function trimOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

/** Omit empty optional strings so the API only receives values the user provided. */
export function sanitizeAddressInput<T extends UserAddressInput | UserAddressUpdateInput>(input: T): T {
  const result = { ...input } as Record<string, unknown>

  for (const key of OPTIONAL_STRING_FIELDS) {
    if (!(key in result)) continue
    const trimmed = trimOrUndefined(result[key])
    if (trimmed === undefined) delete result[key]
    else result[key] = trimmed
  }

  if ('latitude' in result && (result.latitude == null || Number.isNaN(result.latitude))) {
    delete result.latitude
  }
  if ('longitude' in result && (result.longitude == null || Number.isNaN(result.longitude))) {
    delete result.longitude
  }

  return result as T
}

/** Whether optional section should auto-expand when editing an address with optional data. */
export function hasOptionalAddressData(
  data: Partial<Pick<UserAddressInput, AddressOptionalField>>,
): boolean {
  return ADDRESS_OPTIONAL_FIELDS.some((key) => {
    const value = data[key]
    if (typeof value === 'string') return value.trim().length > 0
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return !Number.isNaN(value)
    return value != null
  })
}
