import type { AddressSuggestion, ReverseGeocodeResult, ServiceabilityResult, UserAddress } from '@/types/address'

export const MOCK_USER_ADDRESSES: UserAddress[] = [
  {
    id: 'addr-1',
    address_type: 'home',
    custom_label: 'Home',
    formatted_address: '123 Main St, Apt 4B, Manhattan, New York, NY 10001, USA',
    country: 'US',
    province: 'NY',
    city: 'New York',
    district: 'Manhattan',
    street: 'Main St',
    building_number: '123',
    unit: '4B',
    floor: '4',
    postal_code: '10001',
    phone: '+12125550100',
    delivery_notes: 'Ring doorbell twice',
    latitude: 40.7128,
    longitude: -74.006,
    verification_status: 'verified',
    is_default: true,
    capabilities: {
      cash_on_delivery: true,
      scheduled_delivery: true,
      same_day: true,
      contactless_delivery: true,
    },
    created_at: '2025-01-10T10:00:00Z',
    updated_at: '2025-06-01T12:00:00Z',
  },
  {
    id: 'addr-2',
    address_type: 'work',
    custom_label: 'Office',
    formatted_address: '456 Office Ave, Floor 12, New York, NY 10002, USA',
    country: 'US',
    province: 'NY',
    city: 'New York',
    street: 'Office Ave',
    building_number: '456',
    floor: '12',
    postal_code: '10002',
    phone: '+12125550200',
    latitude: 40.72,
    longitude: -73.99,
    verification_status: 'pending',
    is_default: false,
    capabilities: {
      cash_on_delivery: false,
      scheduled_delivery: true,
      same_day: true,
      contactless_delivery: true,
    },
    created_at: '2025-02-15T08:00:00Z',
    updated_at: '2025-02-15T08:00:00Z',
  },
  {
    id: 'addr-3',
    address_type: 'other',
    custom_label: 'Parents',
    formatted_address: '789 Oak Lane, Brooklyn, NY 11201, USA',
    country: 'US',
    province: 'NY',
    city: 'Brooklyn',
    street: 'Oak Lane',
    building_number: '789',
    postal_code: '11201',
    latitude: 40.678,
    longitude: -73.944,
    verification_status: 'rejected',
    is_default: false,
    is_deleted: true,
    created_at: '2024-11-01T09:00:00Z',
    updated_at: '2025-03-01T09:00:00Z',
  },
]

export function filterMockAddresses(
  items: UserAddress[],
  params: { search?: string; include_deleted?: boolean; page?: number; page_size?: number },
) {
  let filtered = params.include_deleted ? [...items] : items.filter((a) => !a.is_deleted)
  if (params.search?.trim()) {
    const q = params.search.toLowerCase()
    filtered = filtered.filter(
      (a) =>
        a.formatted_address.toLowerCase().includes(q) ||
        (a.custom_label?.toLowerCase().includes(q) ?? false) ||
        a.city.toLowerCase().includes(q),
    )
  }
  const page = params.page ?? 1
  const pageSize = params.page_size ?? 10
  const start = (page - 1) * pageSize
  return {
    count: filtered.length,
    next: start + pageSize < filtered.length ? `?page=${page + 1}` : null,
    previous: page > 1 ? `?page=${page - 1}` : null,
    results: filtered.slice(start, start + pageSize),
  }
}

export const MOCK_SUGGESTIONS: AddressSuggestion[] = [
  {
    formatted_address: '350 5th Ave, New York, NY 10118, USA',
    confidence: 0.95,
    provider: 'nominatim',
    latitude: 40.7484,
    longitude: -73.9857,
    country: 'US',
    province: 'NY',
    city: 'New York',
    street: '5th Ave',
    building_number: '350',
    postal_code: '10118',
  },
  {
    formatted_address: '1 Times Sq, New York, NY 10036, USA',
    confidence: 0.88,
    provider: 'nominatim',
    latitude: 40.758,
    longitude: -73.9855,
    country: 'US',
    province: 'NY',
    city: 'New York',
    street: 'Times Sq',
    building_number: '1',
    postal_code: '10036',
  },
]

export function mockReverseGeocode(lat: number, lng: number): ReverseGeocodeResult {
  return {
    formatted_address: `${lat.toFixed(4)}, ${lng.toFixed(4)} — Sample St, New York, NY 10001, USA`,
    country: 'US',
    province: 'NY',
    city: 'New York',
    street: 'Sample St',
    building_number: '100',
    postal_code: '10001',
    latitude: lat,
    longitude: lng,
  }
}

export function mockServiceability(branchId: string, lat?: number, lng?: number): ServiceabilityResult {
  const outOfRange = lat != null && lng != null && lat < 40.5
  if (outOfRange) {
    return {
      deliverable: false,
      reason: 'Address is outside the delivery radius for this branch.',
      branch: {
        id: branchId,
        name: 'Main Branch',
        distance_km: 18.5,
        delivery_radius_km: 10,
        status: 'active',
      },
      capabilities: {
        cash_on_delivery: false,
        scheduled_delivery: false,
        same_day: false,
        contactless_delivery: false,
      },
    }
  }
  return {
    deliverable: true,
    delivery_fee: 4.99,
    eta_minutes: 35,
    minimum_order: 15,
    branch: {
      id: branchId,
      name: 'Main Branch',
      distance_km: 2.3,
      delivery_radius_km: 10,
      status: 'active',
    },
    capabilities: {
      cash_on_delivery: true,
      scheduled_delivery: true,
      same_day: true,
      contactless_delivery: true,
    },
  }
}
