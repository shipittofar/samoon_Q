// ============================================================
// ENTERPRISE ADDRESS TYPES
// Aligned with backend UserAddress / DeliveryAddress snapshot API
// ============================================================

export type AddressType = 'home' | 'work' | 'office' | 'warehouse' | 'other'

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired'

export interface AddressCapabilities {
  cash_on_delivery: boolean
  scheduled_delivery: boolean
  same_day: boolean
  contactless_delivery: boolean
}

export interface UserAddress {
  id: string
  address_type: AddressType
  custom_label?: string | null
  formatted_address: string
  country: string
  province?: string | null
  city: string
  district?: string | null
  street: string
  building_number?: string | null
  unit?: string | null
  floor?: string | null
  postal_code?: string | null
  phone?: string | null
  delivery_notes?: string | null
  latitude?: number | null
  longitude?: number | null
  verification_status: VerificationStatus
  is_default: boolean
  capabilities?: AddressCapabilities | null
  is_deleted?: boolean
  created_at: string
  updated_at: string
}

/** Payload for create / full update */
export interface UserAddressInput {
  address_type: AddressType
  custom_label?: string | null
  country: string
  province?: string | null
  city: string
  district?: string | null
  street: string
  building_number?: string | null
  unit?: string | null
  floor?: string | null
  postal_code?: string | null
  phone?: string | null
  delivery_notes?: string | null
  latitude?: number | null
  longitude?: number | null
  is_default?: boolean
}

export type UserAddressUpdateInput = Partial<UserAddressInput>

/** Order delivery snapshot — never concatenate; use formatted_address from backend when available */
export interface DeliveryAddressSnapshot {
  formatted_address?: string
  street: string
  city: string
  province?: string | null
  district?: string | null
  building_number?: string | null
  unit?: string | null
  floor?: string | null
  postal_code?: string | null
  phone?: string | null
  delivery_notes?: string | null
  latitude?: number | null
  longitude?: number | null
}

/** Overrides applied at checkout on top of a saved address */
export interface DeliveryAddressOverride {
  delivery_notes?: string | null
  unit?: string | null
  floor?: string | null
  building_number?: string | null
  phone?: string | null
}

export interface AddressSuggestion {
  formatted_address: string
  confidence: number
  provider: string
  latitude: number
  longitude: number
  country?: string
  province?: string
  city?: string
  district?: string
  street?: string
  building_number?: string
  postal_code?: string
}

export interface ReverseGeocodeResult {
  formatted_address: string
  country: string
  province?: string
  city: string
  district?: string
  street: string
  building_number?: string
  postal_code?: string
  latitude: number
  longitude: number
}

export interface ServiceabilityBranch {
  id: string
  name: string
  distance_km?: number
  delivery_radius_km?: number
  status: 'active' | 'inactive' | 'maintenance'
}

export interface ServiceabilityResult {
  deliverable: boolean
  delivery_fee?: number | null
  eta_minutes?: number | null
  minimum_order?: number | null
  reason?: string | null
  branch?: ServiceabilityBranch | null
  capabilities?: AddressCapabilities | null
}

export interface CheckServiceabilityPayload {
  branch_id: string
  address_id?: string
  delivery_address?: DeliveryAddressSnapshot
  latitude?: number
  longitude?: number
}

export interface AddressListParams {
  page?: number
  page_size?: number
  search?: string
  include_deleted?: boolean
}

/** @deprecated Use UserAddress */
export type Address = UserAddress
