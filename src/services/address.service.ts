import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import {
  filterMockAddresses,
  MOCK_SUGGESTIONS,
  MOCK_USER_ADDRESSES,
  mockReverseGeocode,
} from '@/lib/address-mock-data'
import type { PaginatedResponse } from '@/types'
import type {
  AddressListParams,
  AddressSuggestion,
  ReverseGeocodeResult,
  UserAddress,
  UserAddressInput,
  UserAddressUpdateInput,
} from '@/types/address'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms))

let mockStore = [...MOCK_USER_ADDRESSES]

function buildFormattedAddress(input: UserAddressInput): string {
  const parts = [
    input.building_number && input.street ? `${input.building_number} ${input.street}` : input.street,
    input.unit ? `Unit ${input.unit}` : null,
    input.floor ? `Floor ${input.floor}` : null,
    input.district,
    input.city,
    input.province,
    input.postal_code,
    input.country,
  ].filter(Boolean)
  return parts.join(', ')
}

export const addressService = {
  async list(params: AddressListParams = {}): Promise<PaginatedResponse<UserAddress>> {
    if (USE_MOCK) {
      await delay()
      return filterMockAddresses(mockStore, params)
    }
    const { data } = await api.get<PaginatedResponse<UserAddress>>(ENDPOINTS.USERS.ADDRESSES, { params })
    return data
  },

  async get(id: string): Promise<UserAddress> {
    if (USE_MOCK) {
      await delay()
      const addr = mockStore.find((a) => a.id === id)
      if (!addr) throw new Error('Address not found')
      return addr
    }
    const { data } = await api.get<UserAddress>(ENDPOINTS.USERS.ADDRESS(id))
    return data
  },

  async create(input: UserAddressInput): Promise<UserAddress> {
    if (USE_MOCK) {
      await delay(600)
      const now = new Date().toISOString()
      const created: UserAddress = {
        id: `addr-${Date.now()}`,
        ...input,
        custom_label: input.custom_label ?? null,
        formatted_address: buildFormattedAddress(input),
        verification_status: 'pending',
        is_default: input.is_default ?? mockStore.filter((a) => !a.is_deleted).length === 0,
        capabilities: {
          cash_on_delivery: true,
          scheduled_delivery: true,
          same_day: true,
          contactless_delivery: true,
        },
        created_at: now,
        updated_at: now,
      }
      if (created.is_default) {
        mockStore = mockStore.map((a) => ({ ...a, is_default: false }))
      }
      mockStore = [created, ...mockStore]
      return created
    }
    const { data } = await api.post<UserAddress>(ENDPOINTS.USERS.ADDRESSES, input)
    return data
  },

  async update(id: string, input: UserAddressUpdateInput): Promise<UserAddress> {
    if (USE_MOCK) {
      await delay(600)
      const idx = mockStore.findIndex((a) => a.id === id)
      if (idx === -1) throw new Error('Address not found')
      const merged = { ...mockStore[idx], ...input, updated_at: new Date().toISOString() }
      if (input.street || input.city || input.country) {
        merged.formatted_address = buildFormattedAddress(merged as UserAddressInput)
      }
      mockStore[idx] = merged
      return merged
    }
    const { data } = await api.patch<UserAddress>(ENDPOINTS.USERS.ADDRESS(id), input)
    return data
  },

  async delete(id: string): Promise<void> {
    if (USE_MOCK) {
      await delay(400)
      const idx = mockStore.findIndex((a) => a.id === id)
      if (idx === -1) throw new Error('Address not found')
      mockStore[idx] = { ...mockStore[idx], is_deleted: true, updated_at: new Date().toISOString() }
      return
    }
    await api.delete(ENDPOINTS.USERS.ADDRESS(id))
  },

  async restore(id: string): Promise<UserAddress> {
    if (USE_MOCK) {
      await delay(400)
      const idx = mockStore.findIndex((a) => a.id === id)
      if (idx === -1) throw new Error('Address not found')
      mockStore[idx] = { ...mockStore[idx], is_deleted: false, updated_at: new Date().toISOString() }
      return mockStore[idx]
    }
    const { data } = await api.post<UserAddress>(ENDPOINTS.USERS.ADDRESS_RESTORE(id))
    return data
  },

  async setDefault(id: string): Promise<UserAddress> {
    if (USE_MOCK) {
      await delay(400)
      mockStore = mockStore.map((a) => ({
        ...a,
        is_default: a.id === id,
        updated_at: a.id === id ? new Date().toISOString() : a.updated_at,
      }))
      const addr = mockStore.find((a) => a.id === id)
      if (!addr) throw new Error('Address not found')
      return addr
    }
    const { data } = await api.post<UserAddress>(ENDPOINTS.USERS.ADDRESS_SET_DEFAULT(id))
    return data
  },

  async suggestions(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
    if (USE_MOCK) {
      await delay(300)
      if (!query.trim()) return []
      const q = query.toLowerCase()
      return MOCK_SUGGESTIONS.filter((s) => s.formatted_address.toLowerCase().includes(q))
    }
    const { data } = await api.get<AddressSuggestion[]>(ENDPOINTS.USERS.ADDRESS_SUGGESTIONS, {
      params: { q: query },
      signal,
    })
    return data
  },

  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
    if (USE_MOCK) {
      await delay(500)
      return mockReverseGeocode(latitude, longitude)
    }
    const { data } = await api.post<ReverseGeocodeResult>(ENDPOINTS.USERS.ADDRESS_REVERSE_GEOCODE, {
      latitude,
      longitude,
    })
    return data
  },

  /** Reset mock store — test helper */
  _resetMockStore() {
    mockStore = [...MOCK_USER_ADDRESSES]
  },
}
