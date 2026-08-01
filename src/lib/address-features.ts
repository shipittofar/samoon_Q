import type { AddressListParams } from '@/types/address'

/**
 * Soft-deleted address book UI (view trash, restore, include_deleted filter).
 *
 * Set to `true` to re-enable:
 * - "Show deleted addresses" toggle on /dashboard/addresses
 * - Restore actions (card button, undo-after-delete toast)
 * - Deleted badge on address cards
 *
 * API client methods (`addressService.restore`, `include_deleted` param) remain
 * implemented regardless of this flag — only UI usage is gated.
 */
export const ENABLE_DELETED_ADDRESSES = false

/** Strip deleted-address query params when the feature is disabled. */
export function normalizeAddressListParams(params: AddressListParams = {}): AddressListParams {
  if (ENABLE_DELETED_ADDRESSES) return params
  const { include_deleted: _includeDeleted, ...rest } = params
  return rest
}

/** Client-side guard — hide soft-deleted rows when the feature is off. */
export function filterActiveAddresses<T extends { is_deleted?: boolean }>(addresses: T[]): T[] {
  if (ENABLE_DELETED_ADDRESSES) return addresses
  return addresses.filter((a) => !a.is_deleted)
}
