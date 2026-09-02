import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { PUBLIC_TENANTS_QUERY_KEY } from '@/lib/public-tenant-resolution'
import { DEFAULT_TENANT } from '@/constants'
import { DEFAULT_BRANCH_CHECKOUT } from '@/lib/branch-checkout'
import { useBranchStore, useRbacStore, useTenantStore } from '@/stores'
import type { Branch } from '@/types/branch'
import type { Tenant } from '@/types'
import * as consoleWorkspace from '@/hooks/console-workspace'
import {
  applyCurrentTenant,
  invalidateTenantQueryConsumers,
  synchronizeTenantMutation,
  synchronizeBranchMutation,
  synchronizeBranchDeleted,
} from '@/lib/entity-sync'
import { featureFlagsService } from '@/services/feature-flags.service'

function makeQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function seedListKeys(qc: QueryClient) {
  qc.setQueryData(['tenant'], null)
  qc.setQueryData(['tenants'], [])
  qc.setQueryData(['console-tenants'], [])
  qc.setQueryData(['console-platform-tenants'], [])
  qc.setQueryData(['public-discover'], [])
  qc.setQueryData(PUBLIC_TENANTS_QUERY_KEY, [])
  qc.setQueryData(['feature-flags'], [])
  qc.setQueryData(['tenant-templates'], [])
  qc.setQueryData(['me'], {})
  qc.setQueryData(['public-tenant', 'cafe-one'], null)
}

function isInvalidated(qc: QueryClient, key: readonly unknown[]) {
  return qc.getQueryState(key)?.isInvalidated === true
}

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: 'branch-1',
    tenantId: 'tenant-1',
    name: 'Main',
    slug: 'main',
    status: 'active',
    type: 'physical',
    location: { address: '1 St', city: 'City', country: 'US' },
    contact: {},
    businessHours: [],
    checkout: DEFAULT_BRANCH_CHECKOUT,
    marketplaceVisible: true,
    reservationsEnabled: false,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('Tenant synchronization', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it('Create Tenant invalidates Console list, Discover, public tenants, and session', async () => {
    const qc = makeQc()
    seedListKeys(qc)
    const refresh = vi
      .spyOn(consoleWorkspace, 'refreshConsoleWorkspaceSession')
      .mockResolvedValue(undefined)

    await synchronizeTenantMutation(qc, { ...DEFAULT_TENANT, id: 'new-1', slug: 'new-cafe' }, {
      session: true,
      templates: true,
      discover: true,
      publicTenants: true,
    })

    expect(isInvalidated(qc, ['console-platform-tenants'])).toBe(true)
    expect(isInvalidated(qc, ['tenants'])).toBe(true)
    expect(isInvalidated(qc, ['console-tenants'])).toBe(true)
    expect(isInvalidated(qc, ['public-discover'])).toBe(true)
    expect(isInvalidated(qc, PUBLIC_TENANTS_QUERY_KEY)).toBe(true)
    expect(isInvalidated(qc, ['me'])).toBe(true)
    expect(isInvalidated(qc, ['tenant-templates'])).toBe(true)
    expect(refresh).toHaveBeenCalledTimes(1)
    refresh.mockRestore()
  })

  it('Clone Tenant refreshes Tenant lists and Discover', async () => {
    const qc = makeQc()
    seedListKeys(qc)
    const refresh = vi
      .spyOn(consoleWorkspace, 'refreshConsoleWorkspaceSession')
      .mockResolvedValue(undefined)

    await synchronizeTenantMutation(qc, { ...DEFAULT_TENANT, id: 'clone-1', slug: 'clone' }, {
      session: true,
      templates: true,
      discover: true,
      publicTenants: true,
    })

    expect(isInvalidated(qc, ['console-platform-tenants'])).toBe(true)
    expect(isInvalidated(qc, ['tenants'])).toBe(true)
    expect(isInvalidated(qc, ['public-discover'])).toBe(true)
    expect(refresh).toHaveBeenCalled()
    refresh.mockRestore()
  })

  it('Activate/Suspend/Archive invalidate console-platform-tenants (Console Tenant list)', async () => {
    const qc = makeQc()
    seedListKeys(qc)
    const tenant: Tenant = { ...DEFAULT_TENANT, id: 't-status', slug: 'status-cafe', status: 'ACTIVE' }

    await synchronizeTenantMutation(qc, tenant, { discover: true, publicTenants: true })

    expect(isInvalidated(qc, ['console-platform-tenants'])).toBe(true)
    expect(isInvalidated(qc, ['tenants'])).toBe(true)
    expect(qc.getQueryData(['tenant', 't-status'])).toEqual(tenant)
  })

  it('Tenant settings update the store including featureFlags', async () => {
    const qc = makeQc()
    seedListKeys(qc)
    const base: Tenant = {
      ...DEFAULT_TENANT,
      id: 't-settings',
      slug: 'settings-cafe',
      settings: { featureFlags: { 'ordering.enabled': false } },
    }
    useTenantStore.setState({
      tenant: base,
      tenantState: 'resolved',
      featureFlags: featureFlagsService.resolve(base),
    })

    const updated: Tenant = {
      ...base,
      name: 'Renamed',
      settings: { featureFlags: { 'ordering.enabled': true } },
    }
    await synchronizeTenantMutation(qc, updated, { featureFlags: true, discover: true, publicTenants: true })

    expect(useTenantStore.getState().tenant?.name).toBe('Renamed')
    expect(useTenantStore.getState().featureFlags['ordering.enabled']).toBe(true)
    expect(isInvalidated(qc, ['feature-flags'])).toBe(true)
    expect(isInvalidated(qc, ['console-platform-tenants'])).toBe(true)
  })

  it('applyCurrentTenant does not overwrite a different tenant in the store', () => {
    useTenantStore.setState({
      tenant: { ...DEFAULT_TENANT, id: 'other' },
      tenantState: 'resolved',
    })
    applyCurrentTenant({ ...DEFAULT_TENANT, id: 'not-other', name: 'Nope' })
    expect(useTenantStore.getState().tenant?.id).toBe('other')
    expect(useTenantStore.getState().tenant?.name).not.toBe('Nope')
  })

  it('Feature-flag consumer keys include Discover and Tenant lists', () => {
    const qc = makeQc()
    seedListKeys(qc)
    invalidateTenantQueryConsumers(qc, {
      featureFlags: true,
      discover: true,
      publicTenants: true,
    })
    expect(isInvalidated(qc, ['feature-flags'])).toBe(true)
    expect(isInvalidated(qc, ['public-discover'])).toBe(true)
    expect(isInvalidated(qc, ['console-platform-tenants'])).toBe(true)
    expect(isInvalidated(qc, ['tenants'])).toBe(true)
  })

  it('Tenant media update invalidates public-tenant, Discover, and public tenants', async () => {
    const qc = makeQc()
    seedListKeys(qc)
    const tenant: Tenant = {
      ...DEFAULT_TENANT,
      id: 't-media',
      slug: 'cafe-one',
      image: 'https://cdn.example/logo.png',
    }
    useTenantStore.setState({ tenant, tenantState: 'resolved' })
    await synchronizeTenantMutation(qc, tenant, { discover: true, publicTenants: true })

    expect(isInvalidated(qc, ['public-tenant', 'cafe-one'])).toBe(true)
    expect(isInvalidated(qc, ['public-discover'])).toBe(true)
    expect(isInvalidated(qc, PUBLIC_TENANTS_QUERY_KEY)).toBe(true)
    expect(useTenantStore.getState().tenant?.image).toBe('https://cdn.example/logo.png')
  })
})

describe('Branch synchronization', () => {
  beforeEach(() => {
    useBranchStore.getState().resetBranchResolution()
    useRbacStore.setState({
      activeMembership: { tenantId: 'tenant-1', branchId: 'branch-1' },
    })
  })

  it('Create Branch updates admin list query, store, and switcher list', () => {
    const qc = makeQc()
    const existing = makeBranch()
    qc.setQueryData(['admin-branches', 'tenant-1'], [existing])
    qc.setQueryData(['public-branches', 'tenant-1'], [])
    qc.setQueryData(['storefront-branches', 'tenant-1'], [])
    qc.setQueryData(['branches', 'tenant-1'], [])
    qc.setQueryData(['public-discover'], [])

    useBranchStore.setState({
      branches: [existing],
      selectedBranch: existing,
      branchState: 'ready',
    })

    const created = makeBranch({
      id: 'branch-new',
      name: 'Second',
      slug: 'second',
      image: 'https://cdn.example/b-logo.png',
    })
    synchronizeBranchMutation(qc, 'tenant-1', created)

    expect(useBranchStore.getState().branches.some((b) => b.id === 'branch-new')).toBe(true)
    expect(useBranchStore.getState().branches.find((b) => b.id === 'branch-new')?.name).toBe('Second')
    expect(isInvalidated(qc, ['admin-branches', 'tenant-1'])).toBe(true)
    expect(isInvalidated(qc, ['public-branches', 'tenant-1'])).toBe(true)
    expect(isInvalidated(qc, ['storefront-branches', 'tenant-1'])).toBe(true)
    expect(isInvalidated(qc, ['public-discover'])).toBe(true)
  })

  it('Create Branch remains visible when loadBranchesForTenant would skip (lastLoaded cache)', async () => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
    const tenantId = 'tenant-samoon-01'
    useRbacStore.setState({
      activeMembership: { tenantId, branchId: undefined },
    })
    await useBranchStore.getState().loadBranchesForTenant(tenantId)
    const created = makeBranch({
      id: 'branch-created-after-load',
      tenantId,
      name: 'New Desk',
      slug: 'new-desk',
    })
    useBranchStore.getState().applyBranchMutationResult(created)
    await useBranchStore.getState().loadBranchesForTenant(tenantId)
    expect(useBranchStore.getState().branches.some((b) => b.id === 'branch-created-after-load')).toBe(
      true,
    )
  })

  it('Update Branch name and media update store and cache from the mutation response', () => {
    const qc = makeQc()
    const existing = makeBranch({ name: 'Old', slug: 'old', image: undefined })
    useBranchStore.setState({
      branches: [existing],
      selectedBranch: existing,
      branchState: 'ready',
    })
    const updated = makeBranch({
      name: 'Harbor',
      slug: 'harbor',
      image: 'https://cdn.example/logo.png',
      coverImage: 'https://cdn.example/cover.png',
      heroImage: 'https://cdn.example/hero.png',
      isDefault: true,
    })
    synchronizeBranchMutation(qc, 'tenant-1', updated)

    const stored = useBranchStore.getState().branches[0]
    expect(stored.name).toBe('Harbor')
    expect(stored.slug).toBe('harbor')
    expect(stored.image).toBe('https://cdn.example/logo.png')
    expect(stored.coverImage).toBe('https://cdn.example/cover.png')
    expect(stored.heroImage).toBe('https://cdn.example/hero.png')
    expect(stored.isDefault).toBe(true)
    expect(useBranchStore.getState().selectedBranch?.name).toBe('Harbor')
    expect(qc.getQueryData(['admin-branch', 'tenant-1', 'branch-1'])).toEqual(updated)
  })

  it('Update Branch status/default invalidates public and admin consumers', () => {
    const qc = makeQc()
    qc.setQueryData(['admin-branches', 'tenant-1'], [])
    qc.setQueryData(['public-branches', 'tenant-1'], [])
    qc.setQueryData(['public-discover'], [])
    const updated = makeBranch({ status: 'maintenance', isDefault: true })
    synchronizeBranchMutation(qc, 'tenant-1', updated)
    expect(isInvalidated(qc, ['admin-branches', 'tenant-1'])).toBe(true)
    expect(isInvalidated(qc, ['public-branches', 'tenant-1'])).toBe(true)
    expect(isInvalidated(qc, ['public-discover'])).toBe(true)
  })

  it('Delete Branch invalidates public Branches and Discover', () => {
    const qc = makeQc()
    qc.setQueryData(['admin-branches', 'tenant-1'], [])
    qc.setQueryData(['public-branches', 'tenant-1'], [{ id: 'branch-1' }])
    qc.setQueryData(['public-discover'], [])
    qc.setQueryData(['storefront-branches', 'tenant-1'], [])
    const existing = makeBranch()
    const other = makeBranch({ id: 'branch-2', name: 'Other', slug: 'other' })
    useBranchStore.setState({
      branches: [existing, other],
      selectedBranch: existing,
      branchState: 'ready',
    })

    synchronizeBranchDeleted(qc, 'tenant-1', 'branch-1')

    expect(useBranchStore.getState().branches.some((b) => b.id === 'branch-1')).toBe(false)
    expect(useBranchStore.getState().selectedBranch?.id).not.toBe('branch-1')
    expect(isInvalidated(qc, ['public-branches', 'tenant-1'])).toBe(true)
    expect(isInvalidated(qc, ['public-discover'])).toBe(true)
    expect(isInvalidated(qc, ['admin-branches', 'tenant-1'])).toBe(true)
  })

  it('Delete selected Branch clears or re-resolves selectedBranch', () => {
    const only = makeBranch()
    useBranchStore.setState({
      branches: [only],
      selectedBranch: only,
      selectedBranchId: only.id,
      branchState: 'ready',
      adminActiveBranch: only,
    })
    useBranchStore.getState().applyBranchDeleted('tenant-1', only.id)
    expect(useBranchStore.getState().selectedBranch).toBeNull()
    expect(useBranchStore.getState().branchState).toBe('empty')
  })
})

describe('Public Tenant same-tab freshness', () => {
  beforeEach(() => {
    useTenantStore.getState().reset()
  })

  it('loadTenant skips a same-slug resolved tenant unless force is set', async () => {
    const tenant: Tenant = { ...DEFAULT_TENANT, id: 'pub-1', slug: 'pub-cafe' }
    useTenantStore.setState({ tenant, tenantState: 'resolved', isLoading: false })
    const { tenantService } = await import('@/services/tenant.service')
    const spy = vi.spyOn(tenantService, 'getTenantById')

    await useTenantStore.getState().loadTenant('pub-cafe')
    expect(spy).not.toHaveBeenCalled()

    vi.spyOn(tenantService, 'getTenants').mockResolvedValue([tenant])
    spy.mockResolvedValue({ ...tenant, name: 'Fresh Name' })

    await useTenantStore.getState().loadTenant('pub-cafe', { force: true })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('Console tenant mutation updates the public store when ids match (no extra fetch required)', async () => {
    const tenant: Tenant = { ...DEFAULT_TENANT, id: 'pub-1', slug: 'pub-cafe', name: 'Stale' }
    useTenantStore.setState({ tenant, tenantState: 'resolved' })
    const qc = makeQc()
    await synchronizeTenantMutation(qc, { ...tenant, name: 'Live' }, { discover: true })
    expect(useTenantStore.getState().tenant?.name).toBe('Live')
    expect(useTenantStore.getState().dataRevision).toBeGreaterThan(0)
  })
})
