import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { mockServiceability } from '@/lib/address-mock-data'
import type { CheckServiceabilityPayload, ServiceabilityResult } from '@/types/address'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 500) => new Promise((r) => setTimeout(r, ms))

export const serviceabilityService = {
  async check(payload: CheckServiceabilityPayload): Promise<ServiceabilityResult> {
    if (USE_MOCK) {
      await delay()
      return mockServiceability(
        payload.branch_id,
        payload.latitude ?? payload.delivery_address?.latitude ?? undefined,
        payload.longitude ?? payload.delivery_address?.longitude ?? undefined,
      )
    }
    const { data } = await api.post<ServiceabilityResult>(ENDPOINTS.SERVICEABILITY.CHECK, payload)
    return data
  },

  async get(params: {
    branch_id: string
    address_id?: string
    latitude?: number
    longitude?: number
  }): Promise<ServiceabilityResult> {
    if (USE_MOCK) {
      await delay()
      return mockServiceability(params.branch_id, params.latitude, params.longitude)
    }
    const { data } = await api.get<ServiceabilityResult>(ENDPOINTS.SERVICEABILITY.GET, { params })
    return data
  },
}
