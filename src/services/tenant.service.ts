import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { DEFAULT_TENANT } from '@/constants'
import type { Tenant, TenantStatus } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Mock tenant store keyed by slug.
 * P6.15: extended with seed data covering all 6 business types.
 */
const MOCK_TENANTS: Record<string, Tenant> = {
  default: { ...DEFAULT_TENANT },
  savor: {
    id: 'tenant-savor-01',
    name: 'Savor Restaurant',
    slug: 'savor',
    businessTypes: ['restaurant'],
    status: 'active',
    createdAt: '2024-01-01T00:00:00.000Z',
    settings: {
      featureFlags: { 'menu.enabled': true, 'reservations.enabled': true, 'reviews.enabled': true, 'analytics.enabled': true },
      theme: { primaryColor: '#e85d04' },
    },
  },
  'brew-cafe': {
    id: 'tenant-brew-cafe-01',
    name: 'Brew Cafe',
    slug: 'brew-cafe',
    businessTypes: ['cafe'],
    status: 'active',
    createdAt: '2024-02-01T00:00:00.000Z',
    settings: {
      featureFlags: { 'menu.enabled': true, 'cafe.loyalty.enabled': true, 'reservations.enabled': true, 'analytics.enabled': true },
      theme: { primaryColor: '#6f4e37' },
    },
  },
  'the-oak-bar': {
    id: 'tenant-oak-bar-01',
    name: 'The Oak Bar',
    slug: 'the-oak-bar',
    businessTypes: ['bar'],
    status: 'active',
    createdAt: '2024-03-01T00:00:00.000Z',
    settings: {
      featureFlags: { 'menu.enabled': true, 'reservations.enabled': true, 'promotions.enabled': true, 'analytics.enabled': true },
      theme: { primaryColor: '#1a1a2e' },
    },
  },
  'central-food-court': {
    id: 'tenant-central-fc-01',
    name: 'Central Food Court',
    slug: 'central-food-court',
    businessTypes: ['food_court'],
    status: 'trial',
    createdAt: '2024-04-01T00:00:00.000Z',
    settings: {
      featureFlags: { 'menu.enabled': true, 'food_court.vendor_management.enabled': true, 'analytics.enabled': true },
      theme: { primaryColor: '#2d6a4f' },
    },
  },
  'road-bites': {
    id: 'tenant-road-bites-01',
    name: 'Road Bites',
    slug: 'road-bites',
    businessTypes: ['food_truck'],
    status: 'suspended',
    createdAt: '2024-05-01T00:00:00.000Z',
    settings: {
      featureFlags: { 'menu.enabled': true, 'food_truck.live_location.enabled': true, 'analytics.enabled': true },
      theme: { primaryColor: '#f4a261' },
    },
  },
  'wheels-and-brews': {
    id: 'tenant-wheels-brews-01',
    name: 'Wheels & Brews',
    slug: 'wheels-and-brews',
    businessTypes: ['mobile_cafe'],
    status: 'active',
    createdAt: '2024-06-01T00:00:00.000Z',
    settings: {
      featureFlags: { 'menu.enabled': true, 'mobile_cafe.loyalty.enabled': true, 'mobile_cafe.live_location.enabled': true, 'analytics.enabled': true },
      theme: { primaryColor: '#457b9d' },
    },
  },
}

const MOCK_TENANT_LIST: Tenant[] = Object.values(MOCK_TENANTS).map((t) => ({ ...t }))

function findInList(slugOrId: string): Tenant | undefined {
  return MOCK_TENANT_LIST.find((t) => t.id === slugOrId || t.slug === slugOrId)
}

function setMockStatus(slugOrId: string, status: TenantStatus): Tenant | null {
  const tenant = findInList(slugOrId)
  if (!tenant) return null
  tenant.status = status
  return { ...tenant }
}

export const tenantService = {
  async getTenant(slug?: string): Promise<Tenant> {
    const resolvedSlug = slug ?? 'default'

    if (USE_MOCK) {
      await delay()
      const found = MOCK_TENANTS[resolvedSlug]
      return found ? { ...found } : { ...DEFAULT_TENANT }
    }

    try {
      const { data } = await api.get<Tenant>(ENDPOINTS.TENANTS.DETAIL(resolvedSlug))
      return data
    } catch {
      return DEFAULT_TENANT
    }
  },

  async getCurrentTenant(): Promise<Tenant> {
    if (USE_MOCK) {
      await delay()
      return { ...DEFAULT_TENANT }
    }

    try {
      const { data } = await api.get<Tenant>(ENDPOINTS.TENANTS.CURRENT)
      return data
    } catch {
      return DEFAULT_TENANT
    }
  },

  /**
   * List all tenants. P6.15 — Tenant Management Finalization.
   */
  async getTenants(): Promise<Tenant[]> {
    if (USE_MOCK) {
      await delay()
      return MOCK_TENANT_LIST.map((t) => ({ ...t }))
    }

    try {
      const { data } = await api.get<Tenant[]>(ENDPOINTS.TENANTS.LIST)
      return data
    } catch {
      return []
    }
  },

  /**
   * Activate a suspended or trial tenant.
   */
  async activateTenant(slugOrId: string): Promise<Tenant> {
    if (USE_MOCK) {
      await delay(150)
      return setMockStatus(slugOrId, 'active') ?? { ...DEFAULT_TENANT }
    }
    const { data } = await api.post<Tenant>(ENDPOINTS.TENANTS.ACTIVATE(slugOrId))
    return data
  },

  /**
   * Suspend an active tenant.
   */
  async suspendTenant(slugOrId: string): Promise<Tenant> {
    if (USE_MOCK) {
      await delay(150)
      return setMockStatus(slugOrId, 'suspended') ?? { ...DEFAULT_TENANT }
    }
    const { data } = await api.post<Tenant>(ENDPOINTS.TENANTS.SUSPEND(slugOrId))
    return data
  },

  /**
   * Archive a tenant (terminal state).
   */
  async archiveTenant(slugOrId: string): Promise<Tenant> {
    if (USE_MOCK) {
      await delay(150)
      return setMockStatus(slugOrId, 'archived') ?? { ...DEFAULT_TENANT }
    }
    const { data } = await api.post<Tenant>(ENDPOINTS.TENANTS.ARCHIVE(slugOrId))
    return data
  },

  /**
   * Persist tenant settings (general, branding, hours, integrations, notifications).
   * In mock mode: patches the in-memory tenant record and returns the updated object.
   */
  async updateTenantSettings(slug: string, patch: Record<string, unknown>): Promise<Tenant> {
    if (USE_MOCK) {
      await delay(250)
      const existing = findInList(slug)
      if (!existing) throw new Error(`Tenant not found: ${slug}`)
      const updated: Tenant = {
        ...existing,
        settings: { ...(existing.settings ?? {}), ...patch },
      }
      const idx = MOCK_TENANT_LIST.findIndex((t) => t.slug === slug || t.id === slug)
      if (idx !== -1) MOCK_TENANT_LIST[idx] = updated
      const mockKey = Object.keys(MOCK_TENANTS).find(
        (k) => MOCK_TENANTS[k].slug === slug || MOCK_TENANTS[k].id === slug,
      )
      if (mockKey) MOCK_TENANTS[mockKey] = updated
      return updated
    }
    const { data } = await api.patch<Tenant>(ENDPOINTS.TENANTS.SETTINGS(slug), patch)
    return data
  },

  /** Exposes mock lookup by ID/slug for use by provisioning service. */
  _findMockById: findInList,

  /** Resets mock list to initial state. Test isolation only. */
  _resetMockList(): void {
    MOCK_TENANT_LIST.length = 0
    Object.values(MOCK_TENANTS).forEach((t) => MOCK_TENANT_LIST.push({ ...t }))
    MOCK_TENANTS['road-bites'].status = 'suspended'
    MOCK_TENANTS['central-food-court'].status = 'trial'
  },
}
