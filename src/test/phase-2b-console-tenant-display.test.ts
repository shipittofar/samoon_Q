import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getTenantDisplayName } from '@/lib/console-tenant-display'
import { canBootTenantFromMembership, hydrateConsoleTenantFromMembership } from '@/lib/console-membership-hydration'
import { buildSamoonMembership } from '@/lib/mock-console-memberships'
import { useRbacStore, useTenantStore, useBranchStore } from '@/stores'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import type { TenantMembership } from '@/types/rbac'

describe('getTenantDisplayName', () => {
  beforeEach(() => {
    useRbacStore.getState()._resetStore()
    useTenantStore.setState({ tenant: null, tenantState: 'not_found' } as never)
  })

  it('prefers membership.tenantName over loaded tenant name', () => {
    const memberships: TenantMembership[] = [
      {
        tenantId: 't1',
        tenantName: 'Samoon Restaurant',
        tenantSlug: 'samoon',
        roles: ['owner'],
        branchAccess: { scope: 'all' },
      },
    ]
    useRbacStore.getState().setSessionMemberships(memberships, { tenantId: 't1' })
    useTenantStore.setState({
      tenant: {
        id: 't1',
        name: 'Stale Tenant Fetch',
        slug: 'samoon',
        businessTypes: [],
        status: 'active',
        created_at: '',
      },
      tenantState: 'resolved',
    } as never)

    expect(getTenantDisplayName('t1')).toBe('Samoon Restaurant')
  })

  it('falls back to loaded tenant name when membership lacks tenantName', () => {
    useTenantStore.setState({
      tenant: {
        id: 't1',
        name: 'Loaded Tenant',
        slug: 'loaded',
        businessTypes: [],
        status: 'active',
        created_at: '',
      },
      tenantState: 'resolved',
    } as never)

    expect(getTenantDisplayName('t1', { memberships: [] })).toBe('Loaded Tenant')
  })

  it('falls back to tenantSlug then tenantId', () => {
    expect(
      getTenantDisplayName('t1', {
        memberships: [{ tenantId: 't1', tenantSlug: 'samoon', roles: [], branchAccess: { scope: 'all' } }],
      }),
    ).toBe('samoon')
    expect(getTenantDisplayName('t1', { memberships: [] })).toBe('t1')
  })
})

describe('console membership hydration', () => {
  beforeEach(() => {
    useRbacStore.getState()._resetStore()
    useTenantStore.setState({ tenant: null, tenantState: 'not_found' } as never)
    useConsoleWorkspaceStore.getState().resetWorkspace()
  })

  it('buildSamoonMembership satisfies production-shaped contract', () => {
    const membership = buildSamoonMembership(['owner'])
    expect(membership.tenantName).toBe('Samoon Restaurant')
    expect(membership.tenantSlug).toBe('samoon')
    expect(membership.tenantLogo).toBeNull()
    expect(membership.branches?.length).toBeGreaterThan(0)
    expect(canBootTenantFromMembership(membership)).toBe(true)
  })

  it('hydrates tenant store without loadTenantById', () => {
    const membership = buildSamoonMembership(['owner'])
    hydrateConsoleTenantFromMembership(membership)

    const tenant = useTenantStore.getState().tenant
    expect(tenant?.id).toBe(membership.tenantId)
    expect(tenant?.name).toBe('Samoon Restaurant')
    expect(useTenantStore.getState().tenantState).toBe('resolved')
  })

  it('switchTenant uses membership hydration when metadata is present', async () => {
    const membership = buildSamoonMembership(['owner'])
    useRbacStore.getState().setSessionMemberships([membership], { tenantId: membership.tenantId })

    const loadSpy = vi.spyOn(useTenantStore.getState(), 'loadTenantById')

    await useConsoleWorkspaceStore.getState().switchTenant(membership.tenantId)

    expect(loadSpy).not.toHaveBeenCalled()
    expect(useTenantStore.getState().tenant?.name).toBe('Samoon Restaurant')
    expect(useBranchStore.getState().branches.length).toBe(membership.branches!.length)

    loadSpy.mockRestore()
  })
})
