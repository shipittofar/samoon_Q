import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { DEFAULT_TENANT } from '@/constants'
import { MOCK_TENANT_OWNER_MAP } from './owner.service'
import type { Tenant, TenantStatus, PaginatedResponse } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Typed tenant-resolution failures — callers (useTenantStore.loadTenant())
 * must classify on these, not on a generic caught error, so a 404/403/5xx/
 * network failure never collapses into a silently-substituted fake tenant.
 */
export class TenantNotFoundError extends Error {
  constructor(slug: string) {
    super(`Tenant not found: ${slug}`)
    this.name = 'TenantNotFoundError'
  }
}

export class TenantForbiddenError extends Error {
  constructor(slug: string) {
    super(`Tenant access forbidden: ${slug}`)
    this.name = 'TenantForbiddenError'
  }
}

export class TenantServerError extends Error {
  constructor(slug: string, cause?: unknown) {
    super(`Tenant resolution failed: ${slug}`)
    this.name = 'TenantServerError'
    this.cause = cause
  }
}

/** Statuses under which a resolved tenant is still eligible to be used (mapped to 'resolved'). Anything else (suspended/archived/churned) is treated as forbidden. */
export const ELIGIBLE_TENANT_STATUSES: TenantStatus[] = ['active', 'trial']

/**
 * Mock tenant store keyed by slug.
 * P6.15: extended with seed data covering all 6 business types.
 */
const MOCK_TENANTS: Record<string, Tenant> = {
  default: { ...DEFAULT_TENANT },
  samoon: {
    id: 'tenant-samoon-01',
    name: 'Samoon Restaurant',
    slug: 'samoon',
    businessTypes: ['restaurant'],
    status: 'active',
    created_at: '2024-01-01T00:00:00.000Z',
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
        tagline: 'Where every dish tells a story.',
        priceLevel: 3,
        amenities: ['WiFi', 'Parking', 'Outdoor Seating', 'Accessible'],
        phone_number: '+1 (212) 555-0100',
        email: 'hello@samoon.com',
        website: 'https://www.samoon.com',
        gallery: [
          'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
          'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&q=80',
          'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&q=80',
          'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&q=80',
          'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80',
        ],
        branches: [
          { slug: 'main', name: 'Main Branch', address: '123 Culinary Avenue', city: 'New York', phone_number: '+1 212 555 0100', openNow: true, todayHours: '10:00–23:00', image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80' },
          { slug: 'downtown', name: 'Downtown Branch', address: '456 Urban Street', city: 'New York', phone_number: '+1 212 555 0200', openNow: true, todayHours: '11:00–22:00', image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80' },
          { slug: 'airport', name: 'Airport Branch', address: 'JFK Terminal 4', city: 'New York', phone_number: '+1 212 555 0300', openNow: false, todayHours: '06:00–23:00', image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80' },
        ],
      },
    },
  },
  'brew-cafe': {
    id: 'tenant-brew-cafe-01',
    name: 'Brew Cafe',
    slug: 'brew-cafe',
    businessTypes: ['cafe'],
    status: 'active',
    created_at: '2024-02-01T00:00:00.000Z',
    settings: {
      featureFlags: { 'menu.enabled': true, 'loyalty.enabled': true, 'cafe.loyalty.enabled': true, 'reservations.enabled': true, 'analytics.enabled': true },
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
        tagline: 'Your daily ritual, elevated.',
        priceLevel: 2,
        amenities: ['WiFi', 'Outdoor Seating'],
        phone_number: '+1 (212) 555-0400',
        email: 'hello@brewcafe.com',
        gallery: [
          'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
          'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&q=80',
          'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80',
        ],
        branches: [
          { slug: 'main', name: 'Midtown Cafe', address: '789 Coffee Lane', city: 'New York', phone_number: '+1 212 555 0400', openNow: true, todayHours: '07:00–20:00', image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&q=80' },
          { slug: 'brooklyn-cafe', name: 'Brooklyn Cafe', address: '321 Brew Boulevard', city: 'Brooklyn', phone_number: '+1 718 555 0500', openNow: true, todayHours: '08:00–19:00', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80' },
        ],
      },
    },
  },
  'the-oak-bar': {
    id: 'tenant-oak-bar-01',
    name: 'The Oak Bar',
    slug: 'the-oak-bar',
    businessTypes: ['bar'],
    status: 'active',
    created_at: '2024-03-01T00:00:00.000Z',
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
        tagline: 'Craft cocktails. Live music. Good company.',
        priceLevel: 2,
        amenities: ['Parking', 'Pet Friendly'],
        phone_number: '+1 (212) 555-0600',
        email: 'hello@theoakbar.com',
        gallery: [
          'https://images.unsplash.com/photo-1543007631-283050bb3e8c?w=800&q=80',
          'https://images.unsplash.com/photo-1525268323446-0505b6fe7778?w=800&q=80',
          'https://images.unsplash.com/photo-1514362453360-8f94243c9996?w=800&q=80',
        ],
        branches: [
          { slug: 'main', name: 'East Village', address: '555 Tap Street', city: 'New York', phone_number: '+1 212 555 0600', openNow: false, todayHours: '16:00–02:00', image: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400&q=80' },
        ],
      },
    },
  },
  'central-food-court': {
    id: 'tenant-central-fc-01',
    name: 'Central Food Court',
    slug: 'central-food-court',
    businessTypes: ['food_court'],
    status: 'trial',
    created_at: '2024-04-01T00:00:00.000Z',
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
        tagline: 'Every cuisine under one roof.',
        priceLevel: 1,
        amenities: ['Parking', 'Accessible', 'Family Area'],
        phone_number: '+1 (212) 555-0700',
        email: 'hello@centralfoodcourt.com',
        gallery: [
          'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800&q=80',
          'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
          'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?w=800&q=80',
        ],
        branches: [
          { slug: 'main', name: 'Westside Food Court', address: '100 Market Street', city: 'New York', phone_number: '+1 212 555 0700', openNow: true, todayHours: '10:00–21:00', image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80' },
        ],
      },
    },
  },
  'road-bites': {
    id: 'tenant-road-bites-01',
    name: 'Road Bites',
    slug: 'road-bites',
    businessTypes: ['food_truck'],
    status: 'suspended',
    created_at: '2024-05-01T00:00:00.000Z',
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
    created_at: '2024-06-01T00:00:00.000Z',
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
        tagline: 'Good coffee wherever life takes you.',
        priceLevel: 1,
        amenities: ['Outdoor Seating', 'Pet Friendly'],
        phone_number: '+1 (212) 555-1000',
        email: 'hello@wheelsandbrews.com',
        gallery: [
          'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80',
          'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&q=80',
          'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
        ],
        branches: [
          { slug: 'main', name: 'Brew Cart (Central Park)', address: 'Central Park South Entrance', city: 'New York', phone_number: '+1 212 555 1000', openNow: true, todayHours: '07:00–17:00', image: 'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=400&q=80' },
        ],
      },
    },
  },
}

// P10.2.1 — backfill ownerId from the single source of truth
// (owner.service.ts's MOCK_TENANT_OWNER_MAP) rather than hand-duplicating
// the mapping on every tenant literal above. `default` (DEFAULT_TENANT)
// intentionally has no owner — it is a pre-tenant fallback shape, not a
// provisioned tenant (see docs/P10.2.1_OWNERSHIP_DATA_MODEL_IMPLEMENTATION.md).
for (const tenant of Object.values(MOCK_TENANTS)) {
  const ownerId = MOCK_TENANT_OWNER_MAP[tenant.id]
  if (ownerId) tenant.ownerId = ownerId
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
  /**
   * Resolves a tenant by slug. NEVER swallows a failure into DEFAULT_TENANT —
   * throws a typed error the caller (useTenantStore.loadTenant()) classifies
   * into the TenantLifecycle state machine. Mock mode simulates the same
   * not-found behavior for an unknown slug instead of silently substituting
   * the default tenant, so the 'not_found' path is exercisable without a
   * real backend.
   */
  async getTenant(slug?: string): Promise<Tenant> {
    const resolvedSlug = slug ?? 'default'

    if (USE_MOCK) {
      await delay()
      const found = MOCK_TENANTS[resolvedSlug]
      if (!found) throw new TenantNotFoundError(resolvedSlug)
      return { ...found }
    }

    try {
      const { data } = await api.get<PaginatedResponse<Tenant>>(ENDPOINTS.TENANTS.DETAIL(resolvedSlug))
      const tenant = data.results[0]
      if (!tenant) throw new TenantNotFoundError(resolvedSlug)
      return tenant
    } catch (err) {
      if (err instanceof TenantNotFoundError) throw err
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) throw new TenantNotFoundError(resolvedSlug)
      if (status === 403) throw new TenantForbiddenError(resolvedSlug)
      throw new TenantServerError(resolvedSlug, err)
    }
  },

  /** Same never-swallow contract as getTenant() — see above. */
  async getCurrentTenant(): Promise<Tenant> {
    if (USE_MOCK) {
      await delay()
      return { ...DEFAULT_TENANT }
    }

    try {
      const { data } = await api.get<Tenant>(ENDPOINTS.TENANTS.CURRENT)
      return data
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) throw new TenantNotFoundError('current')
      if (status === 403) throw new TenantForbiddenError('current')
      throw new TenantServerError('current', err)
    }
  },

  /**
   * List all tenants. P6.15 — Tenant Management Finalization.
   *
   * Phase 5 — a real-mode fetch failure is never swallowed into an empty
   * list: that made a genuine backend/network failure indistinguishable
   * from "this tenant genuinely has zero tenants." The rejection is left
   * to propagate so React Query's normal error flow (isError, the global
   * QueryCache.onError toast) handles it, exactly like getTenant().
   */
  async getTenants(): Promise<Tenant[]> {
    if (USE_MOCK) {
      await delay()
      return MOCK_TENANT_LIST.map((t) => ({ ...t }))
    }

    const { data } = await api.get<PaginatedResponse<Tenant>>(ENDPOINTS.TENANTS.LIST)
    return data.results
  },

  /**
   * Phase Z.1 — "my accessible tenants": the tenants the CURRENT user has a
   * real membership in, for surfaces like AdminTenantSwitcher where listing
   * a tenant the caller doesn't belong to is a real access-control bug, not
   * a display nicety. Per docs/BACKEND_CONTRACT.md's recommended
   * `GET /me/tenants` endpoint (not yet implemented by any backend —
   * see API_GAP_REPORT.md item 2). Until that endpoint exists, this is a
   * placeholder boundary that delegates to the same unscoped getTenants()
   * — the caller is still responsible for filtering with
   * permissionService.hasAnyTenantAccess() (see AdminTenantSwitcher.tsx),
   * exactly as it already does. What changes here is the NAME at the call
   * site: "I mean my tenants" is no longer indistinguishable from "I mean
   * every platform tenant" (getPlatformTenants() below).
   */
  async getMyTenants(): Promise<Tenant[]> {
    return tenantService.getTenants()
  },

  /**
   * Phase Z.1 — "all platform tenants": genuinely global, for platform
   * administration surfaces like /console/tenants (tenant analytics,
   * activate/suspend/archive) where seeing every tenant IS the point.
   * Per docs/BACKEND_CONTRACT.md's `GET /platform/tenants` (not yet
   * implemented — see API_GAP_REPORT.md item 2). Placeholder boundary,
   * same underlying data as getTenants() until that endpoint exists.
   */
  async getPlatformTenants(): Promise<Tenant[]> {
    return tenantService.getTenants()
  },

  /**
   * Activate a suspended or trial tenant.
   */
  async activateTenant(slugOrId: string): Promise<Tenant> {
    if (USE_MOCK) {
      await delay(150)
      const result = setMockStatus(slugOrId, 'active')
      if (!result) throw new Error(`Tenant not found: ${slugOrId}`)
      return result
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
      const result = setMockStatus(slugOrId, 'suspended')
      if (!result) throw new Error(`Tenant not found: ${slugOrId}`)
      return result
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
      const result = setMockStatus(slugOrId, 'archived')
      if (!result) throw new Error(`Tenant not found: ${slugOrId}`)
      return result
    }
    const { data } = await api.post<Tenant>(ENDPOINTS.TENANTS.ARCHIVE(slugOrId))
    return data
  },

  /**
   * P10.3 Phase F — the single source of truth for mutating `Tenant.ownerId`.
   * Reassigns which Owner structurally owns a tenant; this is the field
   * `ownerOwnsTenant()`/`resolveOwnerPermissions()` read from, so calling
   * this is what actually moves ownership in the P10.1 model. Distinct
   * from `staffService.transferOwnership()` (legacy — reassigns the
   * `'owner'` P7 role between Staff within one tenant); see that
   * function's JSDoc for how the two are kept in sync.
   */
  async transferOwnership(slugOrId: string, newOwnerId: string): Promise<Tenant> {
    if (USE_MOCK) {
      await delay(150)
      const tenant = findInList(slugOrId)
      if (!tenant) throw new Error(`Tenant not found: ${slugOrId}`)
      tenant.ownerId = newOwnerId
      return { ...tenant }
    }
    const { data } = await api.post<Tenant>(ENDPOINTS.TENANTS.TRANSFER_OWNERSHIP(slugOrId), { newOwnerId })
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
