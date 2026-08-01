import { COUNTRIES } from '@/data/countries'
import type { User } from '@/types'
import type { UserAddressInput, UserAddressUpdateInput } from '@/types/address'

/** Recipient identity fields required by POST/PATCH /users/addresses/ — always from the authenticated user. */
export interface AddressOwnerProfile {
  first_name: string
  last_name: string
  country_code: string
}

/** Backend write payload — form fields plus auto-injected owner identity. */
export interface AddressWriteApiPayload extends UserAddressInput {
  title: string
  first_name: string
  last_name: string
  country_code: string
}

export type AddressPatchApiPayload = Partial<UserAddressInput> & {
  title?: string
  first_name?: string
  last_name?: string
  country_code?: string
}

export class AddressProfileIncompleteError extends Error {
  readonly missing: Array<'first_name' | 'last_name' | 'country_code'>

  constructor(missing: Array<'first_name' | 'last_name' | 'country_code'>) {
    super('Address owner profile is incomplete')
    this.name = 'AddressProfileIncompleteError'
    this.missing = missing
  }
}

/** Derive dial code (e.g. "+1") from the user's E.164 phone_number. */
export function resolveCountryCodeFromUser(user: User | null | undefined): string | null {
  if (!user?.phone_number?.trim()) return null
  const digits = user.phone_number.startsWith('+') ? user.phone_number : `+${user.phone_number}`
  const match = [...COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((c) => digits.startsWith(c.dialCode))
  return match?.dialCode ?? null
}

/**
 * Resolve owner profile from cached auth user.
 * `title` is NOT part of this — it is the address label (see resolveAddressTitle).
 */
export function resolveAddressOwnerProfile(user: User | null | undefined): AddressOwnerProfile | null {
  if (!user) return null

  const first_name = user.first_name?.trim() ?? ''
  const last_name = user.last_name?.trim() ?? ''
  const country_code = resolveCountryCodeFromUser(user) ?? ''

  if (!first_name || !last_name || !country_code) return null

  return { first_name, last_name, country_code }
}

export function getMissingAddressOwnerFields(
  user: User | null | undefined,
): Array<'first_name' | 'last_name' | 'country_code'> {
  const missing: Array<'first_name' | 'last_name' | 'country_code'> = []
  if (!user?.first_name?.trim()) missing.push('first_name')
  if (!user?.last_name?.trim()) missing.push('last_name')
  if (!resolveCountryCodeFromUser(user)) missing.push('country_code')
  return missing
}

/**
 * `title` is the address label (Home, Work, custom label) — NOT a personal title (Mr/Mrs).
 * Maps from the user's Address Type selection and optional custom label.
 */
export function resolveAddressTitle(input: Pick<UserAddressInput, 'address_type' | 'custom_label'>): string {
  const custom = input.custom_label?.trim()
  if (custom) return custom
  return input.address_type.charAt(0).toUpperCase() + input.address_type.slice(1)
}

export function buildAddressCreatePayload(
  input: UserAddressInput,
  profile: AddressOwnerProfile,
): AddressWriteApiPayload {
  return {
    ...input,
    title: resolveAddressTitle(input),
    first_name: profile.first_name,
    last_name: profile.last_name,
    country_code: profile.country_code,
  }
}

export function buildAddressUpdatePayload(
  input: UserAddressUpdateInput,
  profile: AddressOwnerProfile,
  existing?: Pick<UserAddressInput, 'address_type' | 'custom_label'>,
): AddressPatchApiPayload {
  const address_type = input.address_type ?? existing?.address_type ?? 'other'
  const custom_label =
    input.custom_label !== undefined ? input.custom_label : existing?.custom_label

  return {
    ...input,
    title: resolveAddressTitle({ address_type, custom_label }),
    first_name: profile.first_name,
    last_name: profile.last_name,
    country_code: profile.country_code,
  }
}

export function assertAddressOwnerProfile(user: User | null | undefined): AddressOwnerProfile {
  const missing = getMissingAddressOwnerFields(user)
  if (missing.length > 0) throw new AddressProfileIncompleteError(missing)
  const profile = resolveAddressOwnerProfile(user)
  if (!profile) throw new AddressProfileIncompleteError(missing)
  return profile
}
