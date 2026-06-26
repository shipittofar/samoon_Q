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
      marketplace: {
        description: 'Fine dining with contemporary Mediterranean cuisine crafted with passion in an elegant atmosphere.',
        coverImage: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
        cuisines: ['Mediterranean', 'Italian', 'Contemporary'],
        tags: ['Fine Dining', 'Date Night', 'Family Friendly'],
        rating: 4.8,
        reviewCount: 1247,
        city: 'New York',
        branchCount: 3,
        openNow: true,
        primaryBranchSlug: 'main',
        featured: true,
        popular: true,
      },
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
      marketplace: {
        description: 'Specialty coffee roasters with artisan pastries and a cozy, work-friendly atmosphere.',
        coverImage: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80',
        cuisines: ['Coffee', 'Pastries', 'Light Bites'],
        tags: ['Specialty Coffee', 'Remote-Work Friendly', 'Vegan Options'],
        rating: 4.6,
        reviewCount: 892,
        city: 'New York',
        branchCount: 2,
        openNow: true,
        primaryBranchSlug: 'main',
        popular: true,
      },
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
      marketplace: {
        description: 'Sophisticated cocktail bar with live music, craft beer and an extensive spirits collection.',
        coverImage: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&q=80',
        cuisines: ['Cocktails', 'Craft Beer', 'Bar Bites'],
        tags: ['Live Music', 'Happy Hour', 'Date Night'],
        rating: 4.7,
        reviewCount: 634,
        city: 'New York',
        branchCount: 1,
        openNow: false,
        primaryBranchSlug: 'main',
        featured: true,
      },
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
      marketplace: {
        description: 'Multi-vendor food court with diverse cuisines from around the world under one roof.',
        coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
        cuisines: ['International', 'Asian', 'Middle Eastern', 'Western'],
        tags: ['Family Friendly', 'Variety', 'Large Portions'],
        rating: 4.3,
        reviewCount: 2108,
        city: 'New York',
        branchCount: 1,
        openNow: true,
        primaryBranchSlug: 'main',
        isNew: true,
      },
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
      marketplace: {
        description: 'Street food on the move — bold flavours, fast service, live GPS tracking.',
        coverImage: 'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?w=800&q=80',
        cuisines: ['Street Food', 'Burgers', 'Wraps'],
        tags: ['Mobile', 'Fast Casual', 'Live Location'],
        rating: 4.4,
        reviewCount: 511,
        city: 'New York',
        branchCount: 1,
        openNow: false,
        primaryBranchSlug: 'main',
      },
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
      marketplace: {
        description: 'Mobile coffee and brunch on wheels — find our daily stops and enjoy fresh espresso anywhere.',
        coverImage: 'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800&q=80',
        cuisines: ['Coffee', 'Brunch', 'Smoothies'],
        tags: ['Mobile', 'Outdoor', 'Healthy', 'Loyalty Rewards'],
        rating: 4.5,
        reviewCount: 312,
        city: 'New York',
        branchCount: 1,
        openNow: true,
        primaryBranchSlug: 'main',
        isNew: true,
      },
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
