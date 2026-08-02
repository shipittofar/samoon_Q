/**
 * Branch Service — P7.3
 *
 * Tenant-scoped branch management. Follows the USE_MOCK pattern.
 * Authorization is enforced at the component/hook layer via PermissionGuard.
 * This service does not check permissions itself.
 *
 * The old branchService in combined.service.ts uses the legacy Location/Branch
 * type. This service uses the new P7.3 Branch domain model from types/branch.ts.
 */

import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import type {
  Branch,
  BranchStatus,
  BranchMetrics,
  BranchAnalyticsSummary,
  AssignManagerPayload,
  BranchBusinessHours,
} from '@/types/branch'
import { buildBranchFormData, type BranchWriteRequest } from '@/types/branch-form'
import { buildBranchCheckout, mergeBranchCheckout, DEFAULT_BRANCH_CHECKOUT } from '@/lib/branch-checkout'

import type { PaginatedResponse } from '@/types'
import { mockImageUrlFromFile, multipartRequestConfig } from '@/lib/multipart'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms))

function mockBranchImagesFromRequest(
  payload: BranchWriteRequest,
  existing: { image?: string; coverImage?: string } = {},
): { image?: string; coverImage?: string } {
  return {
    image: payload.removeImage ? undefined : mockImageUrlFromFile(payload.image, existing.image),
    coverImage: payload.removeCoverImage ? undefined : mockImageUrlFromFile(payload.coverImage, existing.coverImage),
  }
}

const MOCK_TENANT_ID = 'tenant-samoon-01'
const TENANT_BREW_CAFE = 'tenant-brew-cafe-01'
const TENANT_OAK_BAR = 'tenant-oak-bar-01'
const TENANT_CENTRAL_FC = 'tenant-central-fc-01'
const TENANT_WHEELS_BREWS = 'tenant-wheels-brews-01'
const TENANT_ROAD_BITES = 'tenant-road-bites-01'

// ── Default business hours helper ─────────────────────────────────────────────

const DAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const

function defaultHours(open = '09:00', close = '22:00'): BranchBusinessHours[] {
  return DAYS.map((day) => ({
    day,
    open,
    close,
    isClosed: day === 'Sunday',
  }))
}

function mockCheckoutFields(config: {
  delivery?: boolean
  pickup?: boolean
  dineIn?: boolean
  radius?: number | null
  reservationsEnabled?: boolean
  maxCapacity?: number
  marketplaceVisible?: boolean
} = {}) {
  return {
    checkout: buildBranchCheckout({
      delivery: config.delivery,
      pickup: config.pickup ?? true,
      dineIn: config.dineIn,
      radius: config.radius ?? null,
    }),
    reservationsEnabled: config.reservationsEnabled ?? false,
    maxCapacity: config.maxCapacity,
    marketplaceVisible: config.marketplaceVisible ?? true,
  }
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const INITIAL_MOCK_BRANCHES: Branch[] = [
  // ── Restaurant branches ────────────────────────────────────────────────────
  {
    id: 'branch-rest-01',
    tenantId: MOCK_TENANT_ID,
    name: 'Main Branch',
    slug: 'main',
    isDefault: true,
    status: 'active',
    type: 'physical',
    location: { address: '123 Culinary Avenue', city: 'New York', country: 'US', latitude: 40.7128, longitude: -74.006 },
    contact: { phone_number: '+1 212 555 0100', email: 'main@samoon.com' },
    managerId: 'staff-manager-01',
    businessHours: defaultHours('10:00', '23:00'),
    ...mockCheckoutFields({ delivery: true, radius: 10, pickup: true, dineIn: true, reservationsEnabled: true, maxCapacity: 120 }),
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  {
    id: 'branch-rest-02',
    tenantId: MOCK_TENANT_ID,
    name: 'Downtown Branch',
    slug: 'downtown',
    status: 'active',
    type: 'physical',
    location: { address: '456 Urban Street', city: 'New York', country: 'US', latitude: 40.72, longitude: -73.99 },
    contact: { phone_number: '+1 212 555 0200', email: 'downtown@samoon.com' },
    managerId: 'staff-admin-01',
    businessHours: defaultHours('11:00', '22:00'),
    ...mockCheckoutFields({ delivery: true, radius: 8, pickup: true, dineIn: true, reservationsEnabled: true, maxCapacity: 80 }),
    created_at: '2023-03-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  {
    id: 'branch-rest-03',
    tenantId: MOCK_TENANT_ID,
    name: 'Airport Branch',
    slug: 'airport',
    status: 'maintenance',
    type: 'physical',
    location: { address: 'JFK Terminal 4', city: 'New York', country: 'US', latitude: 40.6413, longitude: -73.7781 },
    contact: { phone_number: '+1 212 555 0300' },
    businessHours: defaultHours('06:00', '23:00'),
    ...mockCheckoutFields({ delivery: false, pickup: true, dineIn: true, reservationsEnabled: false, maxCapacity: 40 }),
    created_at: '2023-06-01T00:00:00Z',
    updated_at: '2024-05-01T00:00:00Z',
  },
  // ── Cafe branches ──────────────────────────────────────────────────────────
  {
    id: 'branch-cafe-01',
    tenantId: MOCK_TENANT_ID,
    name: 'Midtown Cafe',
    slug: 'midtown-cafe',
    status: 'active',
    type: 'physical',
    location: { address: '789 Coffee Lane', city: 'New York', country: 'US', latitude: 40.754, longitude: -73.984 },
    contact: { phone_number: '+1 212 555 0400', email: 'midtown@samoon.com' },
    businessHours: defaultHours('07:00', '20:00'),
    ...mockCheckoutFields({ delivery: true, radius: 5, pickup: true, dineIn: false, reservationsEnabled: false, maxCapacity: 50 }),
    created_at: '2023-08-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  {
    id: 'branch-cafe-02',
    tenantId: MOCK_TENANT_ID,
    name: 'Brooklyn Cafe',
    slug: 'brooklyn-cafe',
    status: 'active',
    type: 'physical',
    location: { address: '321 Brew Boulevard', city: 'Brooklyn', country: 'US', latitude: 40.678, longitude: -73.944 },
    contact: { phone_number: '+1 718 555 0500' },
    businessHours: defaultHours('08:00', '19:00'),
    ...mockCheckoutFields({ delivery: false, pickup: true, dineIn: false, reservationsEnabled: false, maxCapacity: 30 }),
    created_at: '2023-09-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  // ── Bar branches ───────────────────────────────────────────────────────────
  {
    id: 'branch-bar-01',
    tenantId: MOCK_TENANT_ID,
    name: 'East Village Bar',
    slug: 'east-village-bar',
    status: 'active',
    type: 'physical',
    location: { address: '555 Tap Street', city: 'New York', country: 'US', latitude: 40.726, longitude: -73.983 },
    contact: { phone_number: '+1 212 555 0600', email: 'bar@samoon.com' },
    businessHours: defaultHours('16:00', '02:00'),
    ...mockCheckoutFields({ delivery: false, pickup: false, dineIn: true, reservationsEnabled: true, maxCapacity: 100 }),
    created_at: '2023-07-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  // ── Food court branches ────────────────────────────────────────────────────
  {
    id: 'branch-fc-01',
    tenantId: MOCK_TENANT_ID,
    name: 'Westside Food Court',
    slug: 'westside-fc',
    status: 'active',
    type: 'physical',
    location: { address: '100 Market Street', city: 'New York', country: 'US', latitude: 40.76, longitude: -73.99 },
    contact: { phone_number: '+1 212 555 0700', email: 'foodcourt@samoon.com' },
    businessHours: defaultHours('10:00', '21:00'),
    ...mockCheckoutFields({ delivery: false, pickup: true, dineIn: true, reservationsEnabled: false, maxCapacity: 300 }),
    created_at: '2022-11-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  {
    id: 'branch-fc-02',
    tenantId: MOCK_TENANT_ID,
    name: 'Uptown Food Hall',
    slug: 'uptown-food-hall',
    status: 'inactive',
    type: 'physical',
    location: { address: '200 Plaza Drive', city: 'New York', country: 'US', latitude: 40.782, longitude: -73.981 },
    contact: { phone_number: '+1 212 555 0800' },
    businessHours: defaultHours(),
    ...mockCheckoutFields({ delivery: false, pickup: false, dineIn: false, reservationsEnabled: false }),
    created_at: '2023-02-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  // ── Food truck branches ────────────────────────────────────────────────────
  {
    id: 'branch-ft-01',
    tenantId: MOCK_TENANT_ID,
    name: 'Samoon Truck Alpha',
    slug: 'truck-alpha',
    status: 'active',
    type: 'mobile',
    location: { address: 'Bryant Park', city: 'New York', country: 'US', latitude: 40.753, longitude: -73.983 },
    contact: { phone_number: '+1 212 555 0900' },
    businessHours: defaultHours('11:00', '20:00'),
    ...mockCheckoutFields({ delivery: false, pickup: true, dineIn: false, reservationsEnabled: false }),
    created_at: '2023-04-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  {
    id: 'branch-ft-02',
    tenantId: MOCK_TENANT_ID,
    name: 'Samoon Truck Beta',
    slug: 'truck-beta',
    status: 'active',
    type: 'mobile',
    location: { address: 'Madison Square Park', city: 'New York', country: 'US', latitude: 40.742, longitude: -73.988 },
    contact: { phone_number: '+1 212 555 0901' },
    businessHours: defaultHours('11:00', '19:00'),
    ...mockCheckoutFields({ delivery: false, pickup: true, dineIn: false, reservationsEnabled: false }),
    created_at: '2023-05-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  // ── Mobile cafe ────────────────────────────────────────────────────────────
  {
    id: 'branch-mc-01',
    tenantId: MOCK_TENANT_ID,
    name: 'Mobile Brew Cart',
    slug: 'brew-cart',
    status: 'active',
    type: 'mobile',
    location: { address: 'Central Park South Entrance', city: 'New York', country: 'US', latitude: 40.767, longitude: -73.977 },
    contact: { phone_number: '+1 212 555 1000' },
    businessHours: defaultHours('07:00', '17:00'),
    ...mockCheckoutFields({ delivery: false, pickup: true, dineIn: false, reservationsEnabled: false }),
    created_at: '2023-10-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  {
    id: 'branch-mc-02',
    tenantId: MOCK_TENANT_ID,
    name: 'Espresso Express',
    slug: 'espresso-express',
    status: 'inactive',
    type: 'mobile',
    location: { address: 'Hudson Yards', city: 'New York', country: 'US', latitude: 40.754, longitude: -74.001 },
    contact: { phone_number: '+1 212 555 1001' },
    businessHours: defaultHours(),
    ...mockCheckoutFields({ delivery: false, pickup: true, dineIn: false, reservationsEnabled: false }),
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-02-01T00:00:00Z',
  },

  // ── Brew Cafe branches ─────────────────────────────────────────────────────
  {
    id: 'branch-brewcafe-01',
    tenantId: TENANT_BREW_CAFE,
    name: 'Midtown Cafe',
    slug: 'main',
    isDefault: true,
    status: 'active',
    type: 'physical',
    location: { address: '789 Coffee Lane', city: 'New York', country: 'US', latitude: 40.754, longitude: -73.984 },
    contact: { phone_number: '+1 212 555 0400', email: 'midtown@brewcafe.com' },
    businessHours: defaultHours('07:00', '20:00'),
    ...mockCheckoutFields({ delivery: true, radius: 5, pickup: true, dineIn: false, reservationsEnabled: false, maxCapacity: 50 }),
    created_at: '2023-08-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
  {
    id: 'branch-brewcafe-02',
    tenantId: TENANT_BREW_CAFE,
    name: 'Brooklyn Cafe',
    slug: 'brooklyn-cafe',
    status: 'active',
    type: 'physical',
    location: { address: '321 Brew Boulevard', city: 'Brooklyn', country: 'US', latitude: 40.678, longitude: -73.944 },
    contact: { phone_number: '+1 718 555 0500', email: 'brooklyn@brewcafe.com' },
    businessHours: defaultHours('08:00', '19:00'),
    ...mockCheckoutFields({ delivery: false, pickup: true, dineIn: false, reservationsEnabled: false, maxCapacity: 30 }),
    created_at: '2023-09-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },

  // ── The Oak Bar branch ─────────────────────────────────────────────────────
  {
    id: 'branch-oakbar-01',
    tenantId: TENANT_OAK_BAR,
    name: 'East Village Bar',
    slug: 'main',
    isDefault: true,
    status: 'active',
    type: 'physical',
    location: { address: '555 Tap Street', city: 'New York', country: 'US', latitude: 40.726, longitude: -73.983 },
    contact: { phone_number: '+1 212 555 0600', email: 'bar@theoakbar.com' },
    businessHours: defaultHours('16:00', '02:00'),
    ...mockCheckoutFields({ delivery: false, pickup: false, dineIn: true, reservationsEnabled: true, maxCapacity: 100 }),
    created_at: '2023-07-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },

  // ── Central Food Court branch ──────────────────────────────────────────────
  {
    id: 'branch-centralfc-01',
    tenantId: TENANT_CENTRAL_FC,
    name: 'Westside Food Court',
    slug: 'main',
    isDefault: true,
    status: 'active',
    type: 'physical',
    location: { address: '100 Market Street', city: 'New York', country: 'US', latitude: 40.76, longitude: -73.99 },
    contact: { phone_number: '+1 212 555 0700', email: 'info@centralfoodcourt.com' },
    businessHours: defaultHours('10:00', '21:00'),
    ...mockCheckoutFields({ delivery: false, pickup: true, dineIn: true, reservationsEnabled: false, maxCapacity: 300 }),
    created_at: '2022-11-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },

  // ── Wheels & Brews branch ──────────────────────────────────────────────────
  {
    id: 'branch-wheelsbrews-01',
    tenantId: TENANT_WHEELS_BREWS,
    name: 'Mobile Brew Cart',
    slug: 'main',
    isDefault: true,
    status: 'active',
    type: 'mobile',
    location: { address: 'Central Park South Entrance', city: 'New York', country: 'US', latitude: 40.767, longitude: -73.977 },
    contact: { phone_number: '+1 212 555 1000', email: 'hello@wheelsandbrews.com' },
    businessHours: defaultHours('07:00', '17:00'),
    ...mockCheckoutFields({ delivery: false, pickup: true, dineIn: false, reservationsEnabled: false }),
    created_at: '2023-10-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },

  // ── Road Bites branch ──────────────────────────────────────────────────────
  {
    id: 'branch-roadbites-01',
    tenantId: TENANT_ROAD_BITES,
    name: 'Road Bites Truck',
    slug: 'main',
    isDefault: true,
    status: 'inactive',
    type: 'mobile',
    location: { address: 'Various Locations', city: 'New York', country: 'US', latitude: 40.7128, longitude: -74.006 },
    contact: { phone_number: '+1 212 555 0950', email: 'hello@roadbites.com' },
    businessHours: defaultHours('11:00', '20:00'),
    ...mockCheckoutFields({ delivery: false, pickup: true, dineIn: false, reservationsEnabled: false }),
    created_at: '2024-05-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
  },
]

// Metrics mock data keyed by branchId
const MOCK_METRICS: Record<string, BranchMetrics> = {
  'branch-rest-01': { branchId: 'branch-rest-01', totalOrders: 4820, totalRevenue: 187340, totalReservations: 621, totalCustomers: 2104, staffCount: 5, averageOrderValue: 38.87, period: 'month' },
  'branch-rest-02': { branchId: 'branch-rest-02', totalOrders: 3200, totalRevenue: 112000, totalReservations: 410, totalCustomers: 1560, staffCount: 4, averageOrderValue: 35, period: 'month' },
  'branch-rest-03': { branchId: 'branch-rest-03', totalOrders: 1100, totalRevenue: 38500, totalReservations: 0, totalCustomers: 980, staffCount: 2, averageOrderValue: 35, period: 'month' },
  'branch-cafe-01': { branchId: 'branch-cafe-01', totalOrders: 6200, totalRevenue: 62000, totalReservations: 0, totalCustomers: 3400, staffCount: 3, averageOrderValue: 10, period: 'month' },
  'branch-cafe-02': { branchId: 'branch-cafe-02', totalOrders: 4100, totalRevenue: 41000, totalReservations: 0, totalCustomers: 2200, staffCount: 2, averageOrderValue: 10, period: 'month' },
  'branch-bar-01': { branchId: 'branch-bar-01', totalOrders: 2800, totalRevenue: 84000, totalReservations: 320, totalCustomers: 1800, staffCount: 4, averageOrderValue: 30, period: 'month' },
  'branch-fc-01': { branchId: 'branch-fc-01', totalOrders: 9400, totalRevenue: 188000, totalReservations: 0, totalCustomers: 5200, staffCount: 6, averageOrderValue: 20, period: 'month' },
  'branch-fc-02': { branchId: 'branch-fc-02', totalOrders: 0, totalRevenue: 0, totalReservations: 0, totalCustomers: 0, staffCount: 0, averageOrderValue: 0, period: 'month' },
  'branch-ft-01': { branchId: 'branch-ft-01', totalOrders: 1800, totalRevenue: 27000, totalReservations: 0, totalCustomers: 1600, staffCount: 2, averageOrderValue: 15, period: 'month' },
  'branch-ft-02': { branchId: 'branch-ft-02', totalOrders: 1600, totalRevenue: 24000, totalReservations: 0, totalCustomers: 1400, staffCount: 2, averageOrderValue: 15, period: 'month' },
  'branch-mc-01': { branchId: 'branch-mc-01', totalOrders: 2400, totalRevenue: 19200, totalReservations: 0, totalCustomers: 2100, staffCount: 1, averageOrderValue: 8, period: 'month' },
  'branch-mc-02': { branchId: 'branch-mc-02', totalOrders: 0, totalRevenue: 0, totalReservations: 0, totalCustomers: 0, staffCount: 0, averageOrderValue: 0, period: 'month' },
}

// Mutable in-session stores
let MOCK_BRANCH_LIST: Branch[] = INITIAL_MOCK_BRANCHES.map((b) => ({ ...b }))
let _branchCounter = 100

// ── Helpers ───────────────────────────────────────────────────────────────────

function findBranch(id: string): Branch | undefined {
  return MOCK_BRANCH_LIST.find((b) => b.id === id || b.slug === id)
}

function setBranchStatus(id: string, status: BranchStatus): Branch {
  const branch = findBranch(id)
  if (!branch) throw new Error(`Branch not found: ${id}`)
  branch.status = status
  branch.updated_at = new Date().toISOString()
  return { ...branch }
}

/** Throws if another branch in the same tenant already uses this slug. */
function assertSlugAvailable(tenantId: string, slug: string, excludeId?: string): void {
  const conflict = MOCK_BRANCH_LIST.find(
    (b) => b.tenantId === tenantId && b.slug === slug && b.id !== excludeId,
  )
  if (conflict) throw new Error('duplicate_slug')
}

// ── Service ───────────────────────────────────────────────────────────────────

export const branchManagementService = {
  // ── Reads ──────────────────────────────────────────────────────────────────

  async getTenantsBranches(tenantId: string): Promise<Branch[]> {
    if (USE_MOCK) {
      await delay()
      return MOCK_BRANCH_LIST
        .filter((b) => b.tenantId === tenantId)
        .map((b) => ({ ...b }))
    }

    const res = await api.get<PaginatedResponse<Branch>>(
      ENDPOINTS.TENANTS.BRANCHES(tenantId)
    )

    return res.data.results
  },

  async getBranches(tenantId: string): Promise<Branch[]> {
    if (USE_MOCK) {
      await delay()
      return MOCK_BRANCH_LIST.filter((b) => b.tenantId === tenantId).map((b) => ({ ...b }))
    }
    const res = await api.get<PaginatedResponse<Branch>>(ENDPOINTS.BRANCHES.LIST)
    return res.data.results
  },

  async getBranch(id: string): Promise<Branch> {
    if (USE_MOCK) {
      await delay()
      const branch = findBranch(id)
      if (!branch) throw new Error(`Branch not found: ${id}`)
      return { ...branch }
    }
    const res = await api.get<Branch>(ENDPOINTS.BRANCHES.GET(id))
    return res.data
  },

  /** Public branch detail — tenant-scoped nested route (not /branches/{id}/). */
  async getPublicBranch(tenantId: string, branchId: string): Promise<Branch> {
    if (USE_MOCK) {
      await delay()
      const branch = MOCK_BRANCH_LIST.find(
        (b) => b.id === branchId && b.tenantId === tenantId,
      )
      if (!branch) throw new Error(`Branch not found: ${branchId}`)
      return { ...branch }
    }
    const res = await api.get<Branch>(
      ENDPOINTS.TENANTS.BRANCH_DETAIL(tenantId, branchId),
    )
    return res.data
  },

  async getBranchMetrics(id: string): Promise<BranchMetrics> {
    if (USE_MOCK) {
      await delay()
      if (!findBranch(id)) throw new Error(`Branch not found: ${id}`)
      return MOCK_METRICS[id] ?? {
        branchId: id,
        totalOrders: 0,
        totalRevenue: 0,
        totalReservations: 0,
        totalCustomers: 0,
        staffCount: 0,
        averageOrderValue: 0,
        period: 'month',
      }
    }
    const res = await api.get<BranchMetrics>(ENDPOINTS.BRANCHES.METRICS(id))
    return res.data
  },

  async getConsoleBranchMetrics(id: string): Promise<BranchMetrics> {
    if (USE_MOCK) {
      await delay()
      if (!findBranch(id)) throw new Error(`Branch not found: ${id}`)
      return MOCK_METRICS[id] ?? {
        branchId: id,
        totalOrders: 0,
        totalRevenue: 0,
        totalReservations: 0,
        totalCustomers: 0,
        staffCount: 0,
        averageOrderValue: 0,
        period: 'month',
      }
    }
    const res = await api.get<BranchMetrics>(ENDPOINTS.BRANCHES.CONSOLE_METRICS(id))
    return res.data   
  },
  
  // ── Mutations ──────────────────────────────────────────────────────────────

  async createBranch(tenantId: string, payload: BranchWriteRequest): Promise<Branch> {
    if (USE_MOCK) {
      await delay()
      assertSlugAvailable(tenantId, payload.slug!)
      _branchCounter += 1
      const isFirstBranch = MOCK_BRANCH_LIST.every((b) => b.tenantId !== tenantId)
      const images = mockBranchImagesFromRequest(payload)
      const branch: Branch = {
        id: `branch-new-${_branchCounter}`,
        tenantId,
        name: payload.name!,
        slug: payload.slug!,
        description: payload.description,
        status: 'inactive',
        type: payload.type!,
        location: payload.location!,
        contact: payload.contact ?? {},
        managerId: payload.managerId,
        businessHours: payload.businessHours ?? defaultHours(),
        checkout: mergeBranchCheckout(DEFAULT_BRANCH_CHECKOUT, payload.checkout),
        marketplaceVisible: payload.marketplaceVisible ?? true,
        reservationsEnabled: payload.reservationsEnabled ?? false,
        maxCapacity: payload.maxCapacity,
        image: images.image,
        coverImage: images.coverImage,
        // The tenant's first branch is always the default, regardless of the payload.
        isDefault: isFirstBranch || payload.isDefault,
        timeZone: payload.timeZone,
        currency: payload.currency,
        language: payload.language,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (branch.isDefault) {
        MOCK_BRANCH_LIST.forEach((b) => { if (b.tenantId === tenantId) b.isDefault = false })
      }
      MOCK_BRANCH_LIST.push(branch)
      return { ...branch }
    }
    const formData = buildBranchFormData(payload, { tenantId })
    const res = await api.post<Branch>(ENDPOINTS.BRANCHES.CREATE, formData, multipartRequestConfig())
    return res.data
  },

  async consoleCreateBranch(tenantId: string, payload: BranchWriteRequest): Promise<Branch> {
    if (USE_MOCK) {
      await delay()
      assertSlugAvailable(tenantId, payload.slug!)
      _branchCounter += 1
      const isFirstBranch = MOCK_BRANCH_LIST.every((b) => b.tenantId !== tenantId)
      const images = mockBranchImagesFromRequest(payload)
      const branch: Branch = {
        id: `branch-new-${_branchCounter}`,
        tenantId,
        name: payload.name!,
        slug: payload.slug!,
        description: payload.description,
        status: 'inactive',
        type: payload.type!,
        location: payload.location!,
        contact: payload.contact ?? {},
        managerId: payload.managerId,
        businessHours: payload.businessHours ?? defaultHours(),
        checkout: mergeBranchCheckout(DEFAULT_BRANCH_CHECKOUT, payload.checkout),
        marketplaceVisible: payload.marketplaceVisible ?? true,
        reservationsEnabled: payload.reservationsEnabled ?? false,
        maxCapacity: payload.maxCapacity,
        image: images.image,
        coverImage: images.coverImage,
        // The tenant's first branch is always the default, regardless of the payload.
        isDefault: isFirstBranch || payload.isDefault,
        timeZone: payload.timeZone,
        currency: payload.currency,
        language: payload.language,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (branch.isDefault) {
        MOCK_BRANCH_LIST.forEach((b) => { if (b.tenantId === tenantId) b.isDefault = false })
      }
      MOCK_BRANCH_LIST.push(branch)
      return { ...branch }
    }
    const formData = buildBranchFormData(payload)
    const res = await api.post<Branch>(ENDPOINTS.BRANCHES.CONSOLE_CREATE(tenantId), formData, multipartRequestConfig())
    return res.data
  },

  async updateBranch(id: string, payload: BranchWriteRequest): Promise<Branch> {
    if (USE_MOCK) {
      await delay()
      const branch = findBranch(id)
      if (!branch) throw new Error(`Branch not found: ${id}`)
      if (payload.slug && payload.slug !== branch.slug) {
        assertSlugAvailable(branch.tenantId, payload.slug, branch.id)
        branch.slug = payload.slug
      }
      if (payload.name) branch.name = payload.name
      if (payload.description !== undefined) branch.description = payload.description
      if (payload.location) branch.location = { ...branch.location, ...payload.location }
      if (payload.contact) branch.contact = { ...branch.contact, ...payload.contact }
      if (payload.managerId !== undefined) branch.managerId = payload.managerId
      if (payload.businessHours) branch.businessHours = payload.businessHours
      if (payload.checkout) branch.checkout = mergeBranchCheckout(branch.checkout, payload.checkout)
      if (payload.marketplaceVisible !== undefined) branch.marketplaceVisible = payload.marketplaceVisible
      if (payload.reservationsEnabled !== undefined) branch.reservationsEnabled = payload.reservationsEnabled
      if (payload.maxCapacity !== undefined) branch.maxCapacity = payload.maxCapacity
      const images = mockBranchImagesFromRequest(payload, {
        image: branch.image,
        coverImage: branch.coverImage,
      })
      if (payload.image || payload.removeImage) branch.image = images.image
      if (payload.coverImage || payload.removeCoverImage) branch.coverImage = images.coverImage
      if (payload.timeZone !== undefined) branch.timeZone = payload.timeZone
      if (payload.currency !== undefined) branch.currency = payload.currency
      if (payload.language !== undefined) branch.language = payload.language
      if (payload.isDefault) {
        MOCK_BRANCH_LIST.forEach((b) => { if (b.tenantId === branch.tenantId) b.isDefault = b.id === branch.id })
      }
      branch.updated_at = new Date().toISOString()
      return { ...branch }
    }
    const formData = buildBranchFormData(payload)
    const res = await api.patch<Branch>(ENDPOINTS.BRANCHES.UPDATE(id), formData, multipartRequestConfig())
    return res.data
  },

  /**
   * Deletes a branch. Refuses to delete a tenant's only remaining branch —
   * a tenant must always have at least one branch to operate. Deleting the
   * currently active branch is allowed here (that confirmation/warning is a
   * Console UI concern — see console/branches/[id]/page.tsx) but never the
   * last one, since there would be nothing left to fall back to.
   */
  async deleteBranch(id: string): Promise<void> {
    if (USE_MOCK) {
      await delay()
      const branch = findBranch(id)
      if (!branch) throw new Error(`Branch not found: ${id}`)
      const siblingCount = MOCK_BRANCH_LIST.filter((b) => b.tenantId === branch.tenantId).length
      if (siblingCount <= 1) throw new Error('last_branch')
      MOCK_BRANCH_LIST = MOCK_BRANCH_LIST.filter((b) => b.id !== branch.id)
      // If the deleted branch was the default, promote the next remaining one.
      if (branch.isDefault) {
        const next = MOCK_BRANCH_LIST.find((b) => b.tenantId === branch.tenantId)
        if (next) next.isDefault = true
      }
      return
    }
    await api.delete(ENDPOINTS.BRANCHES.DELETE(id))
  },

  async consoleDeleteBranch(branch_id: string): Promise<void> {
    if (USE_MOCK) {
      await delay()
      const branch = findBranch(branch_id)
      if (!branch) throw new Error(`Branch not found: ${branch_id}`)
      const siblingCount = MOCK_BRANCH_LIST.filter((b) => b.tenantId === branch.tenantId).length
      if (siblingCount <= 1) throw new Error('last_branch')
      MOCK_BRANCH_LIST = MOCK_BRANCH_LIST.filter((b) => b.id !== branch.id)
      // If the deleted branch was the default, promote the next remaining one.
      if (branch.isDefault) {
        const next = MOCK_BRANCH_LIST.find((b) => b.tenantId === branch.tenantId)
        if (next) next.isDefault = true
      }
      return
    }
    await api.delete(ENDPOINTS.BRANCHES.CONSOLE_DELETE(branch_id))
  },

  /** Sets this branch as the tenant's default, unsetting the previous default. */
  async setDefaultBranch(id: string): Promise<Branch> {
    if (USE_MOCK) {
      await delay()
      const branch = findBranch(id)
      if (!branch) throw new Error(`Branch not found: ${id}`)
      MOCK_BRANCH_LIST.forEach((b) => { if (b.tenantId === branch.tenantId) b.isDefault = b.id === branch.id })
      branch.updated_at = new Date().toISOString()
      return { ...branch }
    }
    const res = await api.post<Branch>(ENDPOINTS.BRANCHES.SET_DEFAULT(id))
    return res.data
  },

  async activateBranch(id: string): Promise<Branch> {
    if (USE_MOCK) {
      await delay()
      return setBranchStatus(id, 'active')
    }
    const res = await api.post<Branch>(ENDPOINTS.BRANCHES.ACTIVATE(id))
    return res.data
  },

  async deactivateBranch(id: string): Promise<Branch> {
    if (USE_MOCK) {
      await delay()
      return setBranchStatus(id, 'inactive')
    }
    const res = await api.post<Branch>(ENDPOINTS.BRANCHES.DEACTIVATE(id))
    return res.data
  },

  async setMaintenanceMode(id: string): Promise<Branch> {
    if (USE_MOCK) {
      await delay()
      return setBranchStatus(id, 'maintenance')
    }
    const res = await api.post<Branch>(ENDPOINTS.BRANCHES.MAINTENANCE(id))
    return res.data
  },

  async assignManager(id: string, payload: AssignManagerPayload): Promise<Branch> {
    if (USE_MOCK) {
      await delay()
      const branch = findBranch(id)
      if (!branch) throw new Error(`Branch not found: ${id}`)
      branch.managerId = payload.managerId
      branch.updated_at = new Date().toISOString()
      return { ...branch }
    }
    const res = await api.patch<Branch>(ENDPOINTS.BRANCHES.ASSIGN_MANAGER(id), payload)
    return res.data
  },

  // ── Analytics (derived) ────────────────────────────────────────────────────

  computeAnalytics(branches: Branch[]): BranchAnalyticsSummary {
    const byType: Record<string, number> = { physical: 0, mobile: 0 }
    branches.forEach((b) => {
      byType[b.type] = (byType[b.type] ?? 0) + 1
    })
    return {
      totalBranches: branches.length,
      activeBranches: branches.filter((b) => b.status === 'active').length,
      maintenanceBranches: branches.filter((b) => b.status === 'maintenance').length,
      inactiveBranches: branches.filter((b) => b.status === 'inactive').length,
      totalStaffAssigned: branches.filter((b) => b.managerId).length,
      byType: byType as Record<import('@/types/branch').BranchType, number>,
    }
  },

  // ── Test helpers ───────────────────────────────────────────────────────────

  _resetMockStore(): void {
    MOCK_BRANCH_LIST = INITIAL_MOCK_BRANCHES.map((b) => ({ ...b }))
    _branchCounter = 100
  },
}
