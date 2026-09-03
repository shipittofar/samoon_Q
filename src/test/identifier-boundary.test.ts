import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  isUsableTenantSlug,
  looksLikeCanonicalUuid,
  slugFromMembership,
} from '@/lib/identifier-brands'
import {
  setActiveTenantSlugForRequests,
  getActiveTenantSlugForRequests,
  resolveTenantSlugForApi,
} from '@/lib/tenant-request-context'
import {
  hydrateConsoleTenantFromMembership,
  membershipToTenantShell,
} from '@/lib/console-membership-hydration'
import { refreshPermissionCache } from '@/lib/permission-cache'
import { permissionStore } from '@/stores/permission-store'
import { fetchPublicTenantBySlug, readPublicPathTenantSlug } from '@/lib/public-tenant-resolution'
import { findPublicBranchBySlug } from '@/lib/public-branches'
import { tenantService, TenantNotFoundError } from '@/services/tenant.service'
import { ENDPOINTS } from '@/services/endpoints'
import { useTenantStore } from '@/stores'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import { favoritesKeys } from '@/hooks/favorites'
import type { TenantMembership } from '@/types/rbac'
import type { PublicBranchInfo } from '@/types/marketplace'

const UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('identifier brands', () => {
  it('rejects UUID and id-equal values as tenant slugs', () => {
    expect(looksLikeCanonicalUuid(UUID)).toBe(true)
    expect(isUsableTenantSlug('acme')).toBe(true)
    expect(isUsableTenantSlug(UUID)).toBe(false)
    expect(isUsableTenantSlug(UUID, UUID)).toBe(false)
    expect(isUsableTenantSlug('tenant-samoon-01', 'tenant-samoon-01')).toBe(true)
    expect(isUsableTenantSlug('default', 'default')).toBe(true)
    expect(slugFromMembership(undefined, UUID)).toBe('')
    expect(slugFromMembership(UUID, UUID)).toBe('')
    expect(slugFromMembership('acme', UUID)).toBe('acme')
  })
})

describe('public routing still uses tenantSlug', () => {
  it('path /acme yields tenantSlug acme', () => {
    expect(readPublicPathTenantSlug('/acme')).toBe('acme')
    expect(readPublicPathTenantSlug('/acme/main')).toBe('acme')
  })

  it('fetchPublicTenantBySlug returns distinct id and slug (Test 1, 2, 6)', async () => {
    const tenant = await fetchPublicTenantBySlug('samoon')
    expect(tenant.slug).toBe('samoon')
    expect(tenant.id).toBe('tenant-samoon-01')
    expect(tenant.id).not.toBe(tenant.slug)
  })

  it('tenant detail path is UUID-only (slug must not be interpolated)', () => {
    expect(ENDPOINTS.TENANTS.DETAIL_BY_ID(UUID)).toBe(`/tenants/${UUID}/`)
    expect(ENDPOINTS.TENANTS.DETAIL_BY_ID('wma4he3d')).toBe('/tenants/wma4he3d/')
    expect(ENDPOINTS.PUBLIC.DISCOVER).toBe('/public/discover/')
  })
})

describe('membership hydration never copies tenantId into slug (Test 3)', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
    setActiveTenantSlugForRequests(undefined)
  })

  it('missing membership slug leaves empty slug, not tenantId', () => {
    const membership: TenantMembership = {
      tenantId: UUID,
      roles: ['owner'],
      branchAccess: { scope: 'all' },
    }
    const shell = membershipToTenantShell(membership)
    expect(shell.id).toBe(UUID)
    expect(shell.slug).toBe('')
    expect(shell.slug).not.toBe(shell.id)
  })

  it('hydrate does not set X-Tenant-Slug to the UUID (Test 4)', () => {
    const membership: TenantMembership = {
      tenantId: UUID,
      tenantName: 'Nameless Co',
      roles: ['owner'],
      branchAccess: { scope: 'all' },
    }
    hydrateConsoleTenantFromMembership(membership)
    expect(useTenantStore.getState().tenant?.slug).toBe('')
    expect(getActiveTenantSlugForRequests()).toBeUndefined()
    expect(resolveTenantSlugForApi()).toBeUndefined()
  })
})

describe('X-Tenant-Slug sanitization (Test 4)', () => {
  beforeEach(() => {
    setActiveTenantSlugForRequests(undefined)
    delete process.env.NEXT_PUBLIC_TENANT_SLUG
  })

  it('refuses to store a UUID as the request slug', () => {
    setActiveTenantSlugForRequests(UUID)
    expect(getActiveTenantSlugForRequests()).toBeUndefined()
    expect(resolveTenantSlugForApi(UUID)).toBeUndefined()
  })

  it('refuses a UUID even when passed as the slug argument', () => {
    setActiveTenantSlugForRequests(UUID, UUID)
    expect(getActiveTenantSlugForRequests()).toBeUndefined()
  })

  it('accepts a real slug', () => {
    setActiveTenantSlugForRequests('acme', UUID)
    expect(getActiveTenantSlugForRequests()).toBe('acme')
    expect(resolveTenantSlugForApi()).toBe('acme')
  })
})

describe('permission cache does not promote store UUID slug', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'false')
    vi.spyOn(permissionStore, 'fetchPermissions').mockResolvedValue([])
    setActiveTenantSlugForRequests('acme')
    useTenantStore.setState({
      tenant: {
        id: UUID,
        name: 'X',
        slug: UUID,
        businessTypes: [],
        status: 'ACTIVE',
        created_at: '',
      },
      tenantState: 'resolved',
    } as never)
  })

  it('clears header when only unusable slug is available', async () => {
    await refreshPermissionCache({ tenantId: UUID })
    expect(getActiveTenantSlugForRequests()).toBeUndefined()
  })

  it('sets header from membership tenantSlug', async () => {
    await refreshPermissionCache({
      tenantId: UUID,
      tenantSlug: 'brew-cafe',
      activeMembership: {
        tenantId: UUID,
        tenantSlug: 'brew-cafe',
        roles: [],
        branchAccess: { scope: 'all' },
      },
    })
    expect(getActiveTenantSlugForRequests()).toBe('brew-cafe')
  })
})

describe('console APIs use tenantId (Test 5)', () => {
  it('console tenant detail path interpolates id not slug', () => {
    expect(ENDPOINTS.TENANTS.DETAIL_BY_ID('tenant-samoon-01')).toBe(
      '/tenants/tenant-samoon-01/',
    )
    expect(ENDPOINTS.TENANTS.BRANCHES('tenant-samoon-01')).toBe(
      '/tenants/tenant-samoon-01/branches/',
    )
  })
})

describe('mock tenant lookup is not interchangeable', () => {
  it('getTenantById(slug) does not succeed', async () => {
    await expect(tenantService.getTenantById('samoon')).rejects.toBeInstanceOf(TenantNotFoundError)
  })

  it('getTenantBySlug(id) does not succeed', async () => {
    await expect(tenantService.getTenantBySlug('tenant-samoon-01')).rejects.toBeInstanceOf(
      TenantNotFoundError,
    )
  })

  it('getTenantBySlug(samoon) still works', async () => {
    const tenant = await tenantService.getTenantBySlug('samoon')
    expect(tenant.id).toBe('tenant-samoon-01')
  })
})

describe('branch public resolution uses slug then id', () => {
  it('matches by slug and exposes a distinct id', () => {
    const branches = [
      {
        id: 'branch-rest-01',
        slug: 'main',
        name: 'Main',
        tenantId: 'tenant-samoon-01',
        status: 'active',
        marketplaceVisible: true,
      },
    ] as unknown as PublicBranchInfo[]
    const match = findPublicBranchBySlug(branches, 'main')
    expect(match?.slug).toBe('main')
    expect(match?.id).toBe('branch-rest-01')
    expect(match?.id).not.toBe(match?.slug)
  })
})

describe('tenant switch clears previous X-Tenant-Slug', () => {
  beforeEach(() => {
    setActiveTenantSlugForRequests('tenant-a-slug')
    useConsoleWorkspaceStore.getState().resetWorkspace()
  })

  it('beginTenantSwitch does not keep Tenant A slug while selecting Tenant B', () => {
    useConsoleWorkspaceStore.getState().beginTenantSwitch(UUID)
    expect(useConsoleWorkspaceStore.getState().selectedTenantId).toBe(UUID)
    expect(getActiveTenantSlugForRequests()).toBeUndefined()
  })
})

describe('React Query keys keep public slug vs domain id', () => {
  it('favorites list includes tenant scope', () => {
    expect(favoritesKeys.list('tenant-samoon-01')).toEqual([
      'favorites',
      'list',
      'tenant-samoon-01',
    ])
    const qc = new QueryClient()
    qc.setQueryData(favoritesKeys.list('a'), { count: 1 })
    qc.setQueryData(favoritesKeys.list('b'), { count: 2 })
    expect(qc.getQueryData(favoritesKeys.list('a'))).toEqual({ count: 1 })
    expect(qc.getQueryData(favoritesKeys.list('b'))).toEqual({ count: 2 })
  })
})
