import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { DEFAULT_TENANT } from '@/constants'
import { MOCK_TENANT_OWNER_MAP } from './owner.service'
import {
  coerceTenantIsActive,
  isTenantVisible,
  normalizeTenantStatus,
} from '@/lib/tenant-state'
import type { Tenant, TenantStatus, PaginatedResponse } from '@/types'
import { sanitizeTenantSettings, sanitizeTenantSettingsPatch } from '@/lib/tenant-settings'
import { mockImageUrlFromFile, multipartRequestConfig } from '@/lib/multipart'
import { buildTenantMediaFormData, type TenantMediaWriteRequest } from '@/lib/tenant-media'
import { isUsableTenantSlug } from '@/lib/identifier-brands'


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

/**
 * @deprecated Public eligibility is `is_active` (visibility), not status.
 * Kept as a no-op re-export name for any lingering imports; prefer
 * `isTenantVisible` from `@/lib/tenant-state`.
 */
export function isPubliclyEligibleTenant(tenant: Pick<Tenant, 'is_active'>): boolean {
  return isTenantVisible(tenant)
}

/**
 * Phase Z.6 — normalizes a raw backend Tenant response into the frontend's
 * Tenant shape. Every raw field is preserved (spread first, nothing is
 * dropped or filtered) — this adds:
 *   - `businessTypes` from `business_types` when needed
 *   - canonical `status` (ACTIVE | INACTIVE | CLOSED)
 *   - `is_active` (visibility; never inferred from ACTIVE alone)
 */
function normalizeTenant(raw: Tenant & {
  business_types?: string[]
  is_active?: boolean
  discover_avatar?: string
  discover_cover?: string
  hero_image?: string
}): Tenant {
  const status = normalizeTenantStatus(raw.status)
  return {
    ...raw,
    businessTypes: raw.businessTypes ?? raw.business_types ?? [],
    status,
    is_active: coerceTenantIsActive(raw.is_active, raw.status as string),
    settings: sanitizeTenantSettings(raw.settings),
    discoverAvatar: raw.discoverAvatar ?? raw.discover_avatar,
    discoverCover: raw.discoverCover ?? raw.discover_cover,
    heroImage: raw.heroImage ?? raw.hero_image,
  }
}

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
    is_active: true,
    status: 'ACTIVE',
    created_at: '2024-01-01T00:00:00.000Z',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=200&q=80',
    discoverAvatar: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=200&q=80',
    discoverCover: 'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&q=80',
    heroImage: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    qr: { code: 'bi32b4if', url: 'https://api.example.com/qr/bi32b4if' },
    settings: {
      featureFlags: { 'menu.enabled': true, 'reservations.enabled': true, 'reviews.enabled': true, 'analytics.enabled': true },
      theme: {
        primaryColor: '#e85d04',
        accentHoverColor: '#c2410c',
        fontBody: 'inter',
        fontsByLocale: { en: 'inter', fa: 'vazirmatn' },
      },
      contactEmail: 'hello@samoon.com',
      contactPhone: '+1 (212) 555-0100',
      marketplace: {
        tags: ['Fine Dining', 'Date Night', 'Family Friendly'],
        rating: 4.8,
        reviewCount: 1247,
        featured: true,
        popular: true,
        tagline: 'Where every dish tells a story.',
        priceLevel: 3,
        website: 'https://www.samoon.com',
        gallery: [
          'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
          'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800&q=80',
          'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&q=80',
          'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&q=80',
          'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80',
        ],
      },
    },
  },
  'brew-cafe': {
    id: 'tenant-brew-cafe-01',
    name: 'Brew Cafe',
    slug: 'brew-cafe',
    businessTypes: ['cafe'],
    is_active: true,
    status: 'ACTIVE',
    created_at: '2024-02-01T00:00:00.000Z',
    heroImage: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80',
    settings: {
      featureFlags: { 'menu.enabled': true, 'loyalty.enabled': true, 'cafe.loyalty.enabled': true, 'reservations.enabled': true, 'analytics.enabled': true },
      theme: { primaryColor: '#6f4e37' },
      contactEmail: 'hello@brewcafe.com',
      contactPhone: '+1 (212) 555-0400',
      marketplace: {
        tags: ['Specialty Coffee', 'Remote-Work Friendly', 'Vegan Options'],
        rating: 4.6,
        reviewCount: 892,
        popular: true,
        tagline: 'Your daily ritual, elevated.',
        priceLevel: 2,
        gallery: [
          'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
          'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&q=80',
          'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80',
        ],
      },
    },
  },
  'the-oak-bar': {
    id: 'tenant-oak-bar-01',
    name: 'The Oak Bar',
    slug: 'the-oak-bar',
    businessTypes: ['bar'],
    is_active: true,
    status: 'ACTIVE',
    created_at: '2024-03-01T00:00:00.000Z',
    heroImage: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&q=80',
    settings: {
      featureFlags: { 'menu.enabled': true, 'reservations.enabled': true, 'promotions.enabled': true, 'analytics.enabled': true },
      theme: { primaryColor: '#1a1a2e' },
      contactEmail: 'hello@theoakbar.com',
      contactPhone: '+1 (212) 555-0600',
      marketplace: {
        tags: ['Live Music', 'Happy Hour', 'Date Night'],
        rating: 4.7,
        reviewCount: 634,
        featured: true,
        tagline: 'Craft cocktails. Live music. Good company.',
        priceLevel: 2,
        gallery: [
          'https://images.unsplash.com/photo-1543007631-283050bb3e8c?w=800&q=80',
          'https://images.unsplash.com/photo-1525268323446-0505b6fe7778?w=800&q=80',
          'https://images.unsplash.com/photo-1514362453360-8f94243c9996?w=800&q=80',
        ],
      },
    },
  },
  'central-food-court': {
    id: 'tenant-central-fc-01',
    name: 'Central Food Court',
    slug: 'central-food-court',
    businessTypes: ['food_court'],
    is_active: true,
    status: 'ACTIVE',
    created_at: '2024-04-01T00:00:00.000Z',
    heroImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    settings: {
      featureFlags: { 'menu.enabled': true, 'food_court.vendor_management.enabled': true, 'analytics.enabled': true },
      theme: { primaryColor: '#2d6a4f' },
      contactEmail: 'hello@centralfoodcourt.com',
      contactPhone: '+1 (212) 555-0700',
      marketplace: {
        tags: ['Family Friendly', 'Variety', 'Large Portions'],
        rating: 4.3,
        reviewCount: 2108,
        isNew: true,
        tagline: 'Every cuisine under one roof.',
        priceLevel: 1,
        gallery: [
          'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800&q=80',
          'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
          'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?w=800&q=80',
        ],
      },
    },
  },
  'road-bites': {
    id: 'tenant-road-bites-01',
    name: 'Road Bites',
    slug: 'road-bites',
    businessTypes: ['food_truck'],
    is_active: false,
    status: 'CLOSED',
    created_at: '2024-05-01T00:00:00.000Z',
    heroImage: 'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?w=800&q=80',
    settings: {
      featureFlags: { 'menu.enabled': true, 'food_truck.live_location.enabled': true, 'analytics.enabled': true },
      theme: { primaryColor: '#f4a261' },
      contactEmail: 'hello@roadbites.com',
      contactPhone: '+1 (212) 555-0800',
      marketplace: {
        tags: ['Mobile', 'Fast Casual', 'Live Location'],
        rating: 4.4,
        reviewCount: 511,
      },
    },
  },
  'wheels-and-brews': {
    id: 'tenant-wheels-brews-01',
    name: 'Wheels & Brews',
    slug: 'wheels-and-brews',
    businessTypes: ['mobile_cafe'],
    is_active: true,
    status: 'ACTIVE',
    created_at: '2024-06-01T00:00:00.000Z',
    heroImage: 'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=800&q=80',
    settings: {
      featureFlags: { 'menu.enabled': true, 'mobile_cafe.loyalty.enabled': true, 'mobile_cafe.live_location.enabled': true, 'analytics.enabled': true },
      theme: { primaryColor: '#457b9d' },
      contactEmail: 'hello@wheelsandbrews.com',
      contactPhone: '+1 (212) 555-1000',
      marketplace: {
        tags: ['Mobile', 'Outdoor', 'Healthy', 'Loyalty Rewards'],
        rating: 4.5,
        reviewCount: 312,
        isNew: true,
        tagline: 'Good coffee wherever life takes you.',
        priceLevel: 1,
        gallery: [
          'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80',
          'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&q=80',
          'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
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

function findMockById(tenantId: string): Tenant | undefined {
  return MOCK_TENANT_LIST.find((t) => t.id === tenantId)
}

function findMockBySlug(slug: string): Tenant | undefined {
  return MOCK_TENANTS[slug] ?? MOCK_TENANT_LIST.find((t) => t.slug === slug)
}

function setMockStatus(
  tenantId: string,
  status: TenantStatus,
  opts?: { is_active?: boolean },
): Tenant | null {
  const tenant = findMockById(tenantId)
  if (!tenant) return null
  tenant.status = status
  if (opts?.is_active !== undefined) tenant.is_active = opts.is_active
  return { ...tenant }
}

function collectTenantResults(data: PaginatedResponse<Tenant> | Tenant[] | undefined): Tenant[] {
  if (!data) return []
  const rows = Array.isArray(data) ? data : (data.results ?? [])
  return rows.map(normalizeTenant)
}

/** Console/user tenant lists — no is_active or status query params. */
async function fetchUnfilteredTenantList(path: string): Promise<Tenant[]> {
  const { data } = await api.get<PaginatedResponse<Tenant>>(path)
  return collectTenantResults(data)
}

function mergeTenantListsById(lists: Tenant[][]): Tenant[] {
  const byId = new Map<string, Tenant>()
  for (const list of lists) {
    for (const tenant of list) {
      if (!tenant?.id || byId.has(tenant.id)) continue
      byId.set(tenant.id, tenant)
    }
  }
  return Array.from(byId.values())
}

async function fetchTenantFromApi(path: string, identifier: string): Promise<Tenant> {
  try {
    const { data } = await api.get<Tenant>(path)
    if (!data) throw new TenantNotFoundError(identifier)
    return normalizeTenant(data)
  } catch (err) {
    if (err instanceof TenantNotFoundError) throw err
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404) throw new TenantNotFoundError(identifier)
    if (status === 403) throw new TenantForbiddenError(identifier)
    throw new TenantServerError(identifier, err)
  }
}

/**
 * Map a public URL slug to tenant.id without GET /tenants/{slug}/.
 * Production: existing GET /public/discover/ catalog (id + slug), then DETAIL_BY_ID.
 */
async function resolvePublicTenantIdBySlug(slug: string): Promise<string> {
  if (!isUsableTenantSlug(slug)) {
    throw new TenantNotFoundError(slug)
  }
  if (USE_MOCK) {
    await delay()
    const found = findMockBySlug(slug)
    if (!found?.id) throw new TenantNotFoundError(slug)
    return found.id
  }
  try {
    const { data } = await api.get<PaginatedResponse<{ id: string; slug: string }>>(
      ENDPOINTS.PUBLIC.DISCOVER,
    )
    const match = (data.results ?? []).find((t) => t.slug === slug)
    if (!match?.id) throw new TenantNotFoundError(slug)
    return match.id
  } catch (err) {
    if (err instanceof TenantNotFoundError || err instanceof TenantForbiddenError) throw err
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404) throw new TenantNotFoundError(slug)
    if (status === 403) throw new TenantForbiddenError(slug)
    throw new TenantServerError(slug, err)
  }
}

export const tenantService = {
  /**
   * Public URL slug → canonical tenant.id. Never GET /tenants/{slug}/.
   */
  resolvePublicTenantIdBySlug,

  /**
   * Full tenant for a public slug: slug → id (Discover catalog) → GET /tenants/{id}/.
   * Mock: slug table only, then id lookup.
   */
  async getTenantBySlug(slug: string): Promise<Tenant> {
    const tenantId = await resolvePublicTenantIdBySlug(slug)
    return tenantService.getTenantById(tenantId)
  },

  /**
   * Resolves a tenant by canonical id — Console workspace, membership, mutations.
   */
  async getTenantById(tenantId: string): Promise<Tenant> {
    if (USE_MOCK) {
      await delay()
      const found = findMockById(tenantId)
      if (!found) throw new TenantNotFoundError(tenantId)
      return { ...found }
    }
    return fetchTenantFromApi(ENDPOINTS.TENANTS.DETAIL_BY_ID(tenantId), tenantId)
  },

  /** Same never-swallow contract as getTenantBySlug() — see above. */
  async getCurrentTenant(): Promise<Tenant> {
    if (USE_MOCK) {
      await delay()
      return { ...DEFAULT_TENANT }
    }

    try {
      const { data } = await api.get<Tenant>(ENDPOINTS.TENANTS.CURRENT)
      return normalizeTenant(data)
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
   * QueryCache.onError toast) handles it, exactly like getTenantBySlug().
   */
  async getTenants(): Promise<Tenant[]> {
    if (USE_MOCK) {
      await delay()
      return MOCK_TENANT_LIST.map((t) => ({ ...t }))
    }

    const { data } = await api.get<PaginatedResponse<Tenant>>(ENDPOINTS.TENANTS.LIST)
    return data.results.map(normalizeTenant)
  },

  async getConsoleTenants(): Promise<Tenant[]> {
    if (USE_MOCK) {
      await delay()
      // Include ACTIVE, INACTIVE, and CLOSED — never filter by is_active/status.
      return Object.values(MOCK_TENANTS).map((t) => ({ ...t }))
    }

    const consoleTenants = await fetchUnfilteredTenantList(ENDPOINTS.TENANTS.CONSOLE_LIST)
    let ownedTenants: Tenant[] = []
    try {
      ownedTenants = await fetchUnfilteredTenantList(ENDPOINTS.TENANTS.ME)
    } catch {
      // /tenants/me/ is supplemental so owned INACTIVE rows still appear when
      // console-tenants is active-only. A failure must not empty the list.
    }
    return mergeTenantListsById([consoleTenants, ownedTenants])
  },


  /**
   * Tenants associated with the current user (GET /tenants/me/), including
   * INACTIVE. Falls back to the console list if /me/ is unavailable.
   */
  async getMyTenants(): Promise<Tenant[]> {
    if (USE_MOCK) {
      return tenantService.getConsoleTenants()
    }
    try {
      return await fetchUnfilteredTenantList(ENDPOINTS.TENANTS.ME)
    } catch {
      return tenantService.getConsoleTenants()
    }
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

  async getConsolePlatformTenants(): Promise<Tenant[]> {
    return tenantService.getConsoleTenants()
  },

  /**
   * Activate a suspended or trial tenant.
   */
  async activateTenant(tenantId: string): Promise<Tenant> {
    if (USE_MOCK) {
      await delay(150)
      // Operational ACTIVE; keep/restore public visibility for mock admin flows.
      const result = setMockStatus(tenantId, 'ACTIVE', { is_active: true })
      if (!result) throw new Error(`Tenant not found: ${tenantId}`)
      return result
    }
    const { data } = await api.post<Tenant>(ENDPOINTS.TENANTS.ACTIVATE(tenantId))
    return normalizeTenant(data)
  },

  /**
   * Suspend an active tenant → operational CLOSED (visibility unchanged).
   */
  async suspendTenant(tenantId: string): Promise<Tenant> {
    if (USE_MOCK) {
      await delay(150)
      const result = setMockStatus(tenantId, 'CLOSED')
      if (!result) throw new Error(`Tenant not found: ${tenantId}`)
      return result
    }
    const { data } = await api.post<Tenant>(ENDPOINTS.TENANTS.SUSPEND(tenantId))
    return normalizeTenant(data)
  },

  /**
   * Archive a tenant: hide from public (`is_active=false`) and mark CLOSED.
   */
  async archiveTenant(tenantId: string): Promise<Tenant> {
    if (USE_MOCK) {
      await delay(150)
      const result = setMockStatus(tenantId, 'CLOSED', { is_active: false })
      if (!result) throw new Error(`Tenant not found: ${tenantId}`)
      return result
    }
    const { data } = await api.post<Tenant>(ENDPOINTS.TENANTS.ARCHIVE(tenantId))
    return normalizeTenant(data)
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
  async transferOwnership(tenantId: string, newOwnerId: string): Promise<Tenant> {
    if (USE_MOCK) {
      await delay(150)
      const tenant = findMockById(tenantId)
      if (!tenant) throw new Error(`Tenant not found: ${tenantId}`)
      tenant.ownerId = newOwnerId
      return { ...tenant }
    }
    const { data } = await api.post<Tenant>(ENDPOINTS.TENANTS.TRANSFER_OWNERSHIP(tenantId), { newOwnerId })
    return normalizeTenant(data)
  },

  /**
   * Persist canonical tenant settings (theme, featureFlags, marketplace listing, contact, notifications).
   * Branch-owned keys in the patch are stripped and never written.
   */
  async updateTenantSettings(tenantId: string, patch: Record<string, unknown>): Promise<Tenant> {
    const hasDescription = Object.prototype.hasOwnProperty.call(patch, 'description')
    const description =
      typeof patch.description === 'string' ? patch.description.trim() || undefined : undefined
    const settingsOnly = { ...patch }
    delete settingsOnly.description
    const cleaned = sanitizeTenantSettingsPatch(settingsOnly, { allowMockExtras: USE_MOCK })
    if (USE_MOCK) {
      await delay(250)
      const existing = findMockById(tenantId)
      if (!existing) throw new Error(`Tenant not found: ${tenantId}`)
      const updated: Tenant = {
        ...existing,
        ...(hasDescription ? { description } : {}),
        settings: sanitizeTenantSettings(
          { ...(existing.settings ?? {}), ...cleaned },
          { allowMockExtras: true },
        ),
      }
      const idx = MOCK_TENANT_LIST.findIndex((t) => t.id === tenantId)
      if (idx !== -1) MOCK_TENANT_LIST[idx] = updated
      const mockKey = Object.keys(MOCK_TENANTS).find((k) => MOCK_TENANTS[k].id === tenantId)
      if (mockKey) MOCK_TENANTS[mockKey] = updated
      return updated
    }
    const { data } = await api.patch<Tenant>(ENDPOINTS.TENANTS.SETTINGS(tenantId), cleaned)
    let tenant = normalizeTenant(data)
    if (hasDescription) {
      const { data: identity } = await api.patch<Tenant>(ENDPOINTS.TENANTS.DETAIL_BY_ID(tenantId), {
        description: description ?? '',
      })
      tenant = normalizeTenant({ ...tenant, ...identity })
    }
    return tenant
  },

  /**
   * PATCH tenant identity images (logo, discover avatar, discover cover, hero).
   * Distinct from updateTenantSettings — does not write settings.theme or marketplace.
   */
  async updateTenantMedia(tenantId: string, payload: TenantMediaWriteRequest): Promise<Tenant> {
    if (USE_MOCK) {
      await delay(250)
      const existing = findMockById(tenantId)
      if (!existing) throw new Error(`Tenant not found: ${tenantId}`)
      const updated: Tenant = { ...existing }
      if (payload.image || payload.removeImage) {
        updated.image = payload.removeImage ? undefined : mockImageUrlFromFile(payload.image, existing.image)
      }
      if (payload.discoverAvatar || payload.removeDiscoverAvatar) {
        updated.discoverAvatar = payload.removeDiscoverAvatar
          ? undefined
          : mockImageUrlFromFile(payload.discoverAvatar, existing.discoverAvatar)
      }
      if (payload.discoverCover || payload.removeDiscoverCover) {
        updated.discoverCover = payload.removeDiscoverCover
          ? undefined
          : mockImageUrlFromFile(payload.discoverCover, existing.discoverCover)
      }
      if (payload.heroImage || payload.removeHeroImage) {
        updated.heroImage = payload.removeHeroImage
          ? undefined
          : mockImageUrlFromFile(payload.heroImage, existing.heroImage)
      }
      const idx = MOCK_TENANT_LIST.findIndex((t) => t.id === tenantId)
      if (idx !== -1) MOCK_TENANT_LIST[idx] = updated
      const mockKey = Object.keys(MOCK_TENANTS).find((k) => MOCK_TENANTS[k].id === tenantId)
      if (mockKey) MOCK_TENANTS[mockKey] = updated
      return updated
    }
    const form = buildTenantMediaFormData(payload)
    const { data } = await api.patch<Tenant>(
      ENDPOINTS.TENANTS.MEDIA(tenantId),
      form,
      multipartRequestConfig(),
    )
    return normalizeTenant(data)
  },

  /** Mock lookup by canonical id only. */
  _findMockById: findMockById,

  /** Resets mock list to initial state. Test isolation only. */
  _resetMockList(): void {
    MOCK_TENANT_LIST.length = 0
    Object.values(MOCK_TENANTS).forEach((t) => MOCK_TENANT_LIST.push({ ...t }))
    MOCK_TENANTS['road-bites'].status = 'CLOSED'
    MOCK_TENANTS['road-bites'].is_active = false
    MOCK_TENANTS['central-food-court'].status = 'ACTIVE'
    MOCK_TENANTS['central-food-court'].is_active = true
  },
}
