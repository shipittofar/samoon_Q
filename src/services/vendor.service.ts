/**
 * Vendor Service — Phase 6 (P6.11)
 *
 * Provides customer-facing and admin-facing vendor management operations.
 * Scoped to food_court tenants; gated by food_court.vendor_management.enabled.
 *
 * USE_MOCK pattern: when NEXT_PUBLIC_USE_MOCK=true, all methods return realistic
 * in-memory data without hitting the network. Mock state resets on module reload
 * but persists within a session via module-level variables.
 */

import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import type {
  Vendor,
  VendorStats,
  VendorSettlement,
  VendorCategory,
  VendorStatus,
  VendorCommission,
} from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms))

// ── Commission helper ─────────────────────────────────────────────────────────

export function calculateCommission(
  grossRevenue: number,
  commissionRate: number,
): VendorCommission {
  const commissionAmount = Math.round(grossRevenue * (commissionRate / 100) * 100) / 100
  return {
    vendorId: '',
    grossRevenue,
    commissionRate,
    commissionAmount,
    netPayout: Math.round((grossRevenue - commissionAmount) * 100) / 100,
  }
}

// ── Mock data ─────────────────────────────────────────────────────────────────

let mockVendors: Vendor[] = [
  {
    id: 'vendor-1',
    name: "Chang's Asian Kitchen",
    description: 'Authentic Asian cuisine with fresh ingredients and bold flavors.',
    category: 'asian',
    status: 'active',
    rating: 4.7,
    ratingCount: 312,
    featured: true,
    stallNumber: 'A1',
    commissionRate: 15,
    contactEmail: 'changs@example.com',
    contactPhone: '+1-555-0101',
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-2',
    name: 'Burgers & Co.',
    description: 'Gourmet burgers made with 100% grass-fed beef.',
    category: 'western',
    status: 'active',
    rating: 4.4,
    ratingCount: 198,
    featured: false,
    stallNumber: 'B3',
    commissionRate: 12,
    contactEmail: 'burgers@example.com',
    createdAt: '2024-01-12T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-3',
    name: 'Spice Garden',
    description: 'Traditional Indian curries and street food.',
    category: 'indian',
    status: 'active',
    rating: 4.6,
    ratingCount: 245,
    featured: true,
    stallNumber: 'C2',
    commissionRate: 14,
    contactEmail: 'spicegarden@example.com',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-4',
    name: 'Sweet Tooth Desserts',
    description: 'Artisan cakes, gelato and pastries.',
    category: 'desserts',
    status: 'active',
    rating: 4.8,
    ratingCount: 421,
    featured: false,
    stallNumber: 'D1',
    commissionRate: 10,
    contactEmail: 'sweettooth@example.com',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-5',
    name: 'Healthy Bites',
    description: 'Salads, wraps, and smoothie bowls.',
    category: 'healthy',
    status: 'inactive',
    rating: 4.1,
    ratingCount: 87,
    featured: false,
    stallNumber: 'E5',
    commissionRate: 12,
    contactEmail: 'healthy@example.com',
    createdAt: '2024-02-10T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'vendor-6',
    name: 'Taco Fiesta',
    description: 'Authentic Mexican tacos, burritos and quesadillas.',
    category: 'mexican',
    status: 'pending',
    rating: 0,
    ratingCount: 0,
    featured: false,
    stallNumber: 'F2',
    commissionRate: 13,
    contactEmail: 'taco@example.com',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
]

const mockStats: Record<string, VendorStats> = {
  'vendor-1': {
    vendorId: 'vendor-1',
    ordersCount: 1842,
    revenue: 54320.50,
    commissionPaid: 8148.08,
    avgRating: 4.7,
    activeProducts: 28,
    period: '2025-06',
  },
  'vendor-2': {
    vendorId: 'vendor-2',
    ordersCount: 1204,
    revenue: 38900.00,
    commissionPaid: 4668.00,
    avgRating: 4.4,
    activeProducts: 15,
    period: '2025-06',
  },
  'vendor-3': {
    vendorId: 'vendor-3',
    ordersCount: 986,
    revenue: 29100.00,
    commissionPaid: 4074.00,
    avgRating: 4.6,
    activeProducts: 22,
    period: '2025-06',
  },
  'vendor-4': {
    vendorId: 'vendor-4',
    ordersCount: 2341,
    revenue: 18750.00,
    commissionPaid: 1875.00,
    avgRating: 4.8,
    activeProducts: 34,
    period: '2025-06',
  },
  'vendor-5': {
    vendorId: 'vendor-5',
    ordersCount: 203,
    revenue: 4100.00,
    commissionPaid: 492.00,
    avgRating: 4.1,
    activeProducts: 8,
    period: '2025-06',
  },
  'vendor-6': {
    vendorId: 'vendor-6',
    ordersCount: 0,
    revenue: 0,
    commissionPaid: 0,
    avgRating: 0,
    activeProducts: 0,
    period: '2025-06',
  },
}

let mockSettlements: VendorSettlement[] = [
  {
    id: 'settle-1',
    vendorId: 'vendor-1',
    amount: 46172.42,
    status: 'paid',
    settlementDate: '2025-06-01T00:00:00Z',
    payoutReference: 'TXN-20250601-V1',
    commission: { vendorId: 'vendor-1', grossRevenue: 54320.50, commissionRate: 15, commissionAmount: 8148.08, netPayout: 46172.42 },
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2025-06-03T00:00:00Z',
  },
  {
    id: 'settle-2',
    vendorId: 'vendor-2',
    amount: 34232.00,
    status: 'paid',
    settlementDate: '2025-06-01T00:00:00Z',
    payoutReference: 'TXN-20250601-V2',
    commission: { vendorId: 'vendor-2', grossRevenue: 38900.00, commissionRate: 12, commissionAmount: 4668.00, netPayout: 34232.00 },
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2025-06-03T00:00:00Z',
  },
  {
    id: 'settle-3',
    vendorId: 'vendor-3',
    amount: 25026.00,
    status: 'pending',
    settlementDate: new Date().toISOString(),
    commission: { vendorId: 'vendor-3', grossRevenue: 29100.00, commissionRate: 14, commissionAmount: 4074.00, netPayout: 25026.00 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'settle-4',
    vendorId: 'vendor-4',
    amount: 16875.00,
    status: 'failed',
    settlementDate: '2025-05-28T00:00:00Z',
    commission: { vendorId: 'vendor-4', grossRevenue: 18750.00, commissionRate: 10, commissionAmount: 1875.00, netPayout: 16875.00 },
    createdAt: '2025-05-28T00:00:00Z',
    updatedAt: '2025-05-30T00:00:00Z',
  },
]

// ── Payload types ─────────────────────────────────────────────────────────────

export type CreateVendorPayload = Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateVendorPayload = Partial<Omit<Vendor, 'id' | 'createdAt'>>
export type CreateSettlementPayload = {
  vendorId: string
  grossRevenue: number
  settlementDate?: string
  payoutReference?: string
}

// ── Service ───────────────────────────────────────────────────────────────────

export const vendorService = {
  // ── Customer methods ────────────────────────────────────────────────────────

  async getVendors(): Promise<Vendor[]> {
    if (USE_MOCK) {
      await delay(400)
      return [...mockVendors]
    }
    const { data } = await api.get<Vendor[]>(ENDPOINTS.VENDORS.LIST)
    return data
  },

  async getVendor(id: string): Promise<Vendor> {
    if (USE_MOCK) {
      await delay(350)
      const vendor = mockVendors.find((v) => v.id === id)
      if (!vendor) throw new Error(`Vendor "${id}" not found`)
      return { ...vendor }
    }
    const { data } = await api.get<Vendor>(ENDPOINTS.VENDORS.DETAIL(id))
    return data
  },

  async getVendorStats(id: string): Promise<VendorStats> {
    if (USE_MOCK) {
      await delay(400)
      const stats = mockStats[id]
      if (!stats) throw new Error(`Stats for vendor "${id}" not found`)
      return { ...stats }
    }
    const { data } = await api.get<VendorStats>(ENDPOINTS.VENDORS.STATS(id))
    return data
  },

  async getVendorSettlements(id: string): Promise<VendorSettlement[]> {
    if (USE_MOCK) {
      await delay(450)
      return mockSettlements.filter((s) => s.vendorId === id)
    }
    const { data } = await api.get<VendorSettlement[]>(ENDPOINTS.VENDORS.SETTLEMENTS(id))
    return data
  },

  // ── Admin methods ────────────────────────────────────────────────────────────

  async createVendor(payload: CreateVendorPayload): Promise<Vendor> {
    if (USE_MOCK) {
      await delay(600)
      const vendor: Vendor = {
        ...payload,
        id: `vendor-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      mockVendors = [...mockVendors, vendor]
      return vendor
    }
    const { data } = await api.post<Vendor>(ENDPOINTS.VENDORS.ADMIN_LIST, payload)
    return data
  },

  async updateVendor(id: string, payload: UpdateVendorPayload): Promise<Vendor> {
    if (USE_MOCK) {
      await delay(500)
      const idx = mockVendors.findIndex((v) => v.id === id)
      if (idx === -1) throw new Error(`Vendor "${id}" not found`)
      mockVendors = mockVendors.map((v) =>
        v.id === id ? { ...v, ...payload, updatedAt: new Date().toISOString() } : v,
      )
      return { ...mockVendors.find((v) => v.id === id)! }
    }
    const { data } = await api.patch<Vendor>(ENDPOINTS.VENDORS.ADMIN_DETAIL(id), payload)
    return data
  },

  async disableVendor(id: string): Promise<Vendor> {
    return vendorService.updateVendor(id, { status: 'inactive' })
  },

  async createSettlement(payload: CreateSettlementPayload): Promise<VendorSettlement> {
    if (USE_MOCK) {
      await delay(700)
      const vendor = mockVendors.find((v) => v.id === payload.vendorId)
      if (!vendor) throw new Error(`Vendor "${payload.vendorId}" not found`)
      const commission = calculateCommission(payload.grossRevenue, vendor.commissionRate)
      commission.vendorId = payload.vendorId
      const settlement: VendorSettlement = {
        id: `settle-${Date.now()}`,
        vendorId: payload.vendorId,
        amount: commission.netPayout,
        status: 'pending',
        settlementDate: payload.settlementDate ?? new Date().toISOString(),
        payoutReference: payload.payoutReference,
        commission,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      mockSettlements = [...mockSettlements, settlement]
      if (mockStats[payload.vendorId]) {
        mockStats[payload.vendorId].commissionPaid += commission.commissionAmount
      }
      return settlement
    }
    const { data } = await api.post<VendorSettlement>(ENDPOINTS.VENDORS.ADMIN_SETTLEMENTS, payload)
    return data
  },

  calculateCommission,

  _resetMockStore() {
    mockVendors = mockVendors.map((v) => ({
      ...v,
      status: (v.id === 'vendor-5' ? 'inactive' : v.id === 'vendor-6' ? 'pending' : 'active') as VendorStatus,
      updatedAt: new Date().toISOString(),
    }))
    mockSettlements = mockSettlements.filter((s) =>
      ['settle-1', 'settle-2', 'settle-3', 'settle-4'].includes(s.id),
    )
  },
}
