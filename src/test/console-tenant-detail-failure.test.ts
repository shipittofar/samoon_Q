import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useRbacStore, useTenantStore } from '@/stores'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import {
  ensureFullTenantRecord,
  hydrateConsoleTenantFromMembership,
} from '@/lib/console-membership-hydration'
import { resolveConsoleTenantPhase } from '@/components/admin/ConsoleWorkspaceGate'
import { tenantService, TenantNotFoundError } from '@/services/tenant.service'
import type { Tenant } from '@/types'
import type { TenantMembership } from '@/types/rbac'

const MEMBERSHIP: TenantMembership = {
  tenantId: 'tenant-1',
  tenantName: 'Samoon',
  tenantSlug: 'samoon',
  roles: ['owner'],
  branchAccess: { scope: 'all' },
}

const FULL_TENANT: Tenant = {
  id: 'tenant-1',
  name: 'Samoon Restaurant Full',
  slug: 'samoon',
  businessTypes: ['restaurant'],
  is_active: true,
  status: 'ACTIVE',
  created_at: '2024-01-01T00:00:00.000Z',
  settings: { contactEmail: 'hello@samoon.com' },
}

beforeEach(() => {
  useRbacStore.getState()._resetStore()
  useTenantStore.getState().reset()
  useConsoleWorkspaceStore.getState().resetWorkspace()
  vi.restoreAllMocks()
})

describe('Console Tenant detail GET failure', () => {
  it('1 — hydrated shell survives GET /tenants/{id}/ 404', async () => {
    useRbacStore.getState().setSessionMemberships([MEMBERSHIP], { tenantId: 'tenant-1' })
    hydrateConsoleTenantFromMembership(MEMBERSHIP)
    vi.spyOn(tenantService, 'getTenantById').mockRejectedValue(new TenantNotFoundError('tenant-1'))

    await useTenantStore.getState().loadTenantById('tenant-1')

    const { tenant, tenantState } = useTenantStore.getState()
    expect(tenant?.id).toBe('tenant-1')
    expect(tenant?.name).toBe('Samoon')
    expect(tenant?.slug).toBe('samoon')
    expect(tenantState).not.toBe('not_found')
    expect(tenantState).toBe('resolved')
  })

  it('2 — ensureFullTenantRecord 404 does not clobber hydrate', async () => {
    hydrateConsoleTenantFromMembership(MEMBERSHIP)
    expect(useTenantStore.getState().tenantState).toBe('resolved')
    vi.spyOn(tenantService, 'getTenantById').mockRejectedValue(new TenantNotFoundError('tenant-1'))

    await ensureFullTenantRecord('tenant-1')

    expect(useTenantStore.getState().tenant).not.toBeNull()
    expect(useTenantStore.getState().tenantState).toBe('resolved')
    expect(useTenantStore.getState().tenant?.name).toBe('Samoon')
  })

  it('3 — multiple memberships without activeMembership await selection', () => {
    expect(
      resolveConsoleTenantPhase({
        hasTenantMembership: true,
        sessionMembershipCount: 2,
        activeTenantId: null,
        resolvedTenantId: null,
        tenantState: 'not_found',
        hasDashboardAccess: true,
        retryCount: 0,
      }),
    ).toBe('tenant_awaiting_selection')
  })

  it('4 — does not fabricate a Tenant when there is no resolvable membership', async () => {
    vi.spyOn(tenantService, 'getTenantById').mockRejectedValue(new TenantNotFoundError('ghost'))
    await useTenantStore.getState().loadTenantById('ghost')
    expect(useTenantStore.getState().tenant).toBeNull()
    expect(useTenantStore.getState().tenantState).toBe('error')
  })

  it('5 — older 404 does not overwrite a newer successful Tenant', async () => {
    let rejectOlder!: (err: Error) => void
    const older = new Promise<Tenant>((_, rej) => {
      rejectOlder = rej
    })
    let calls = 0
    vi.spyOn(tenantService, 'getTenantById').mockImplementation(async () => {
      calls += 1
      if (calls === 1) return older
      return FULL_TENANT
    })

    const first = useTenantStore.getState().loadTenantById('tenant-1')
    const second = useTenantStore.getState().loadTenantById('tenant-1')
    await second
    rejectOlder(new TenantNotFoundError('tenant-1'))
    await first

    expect(useTenantStore.getState().tenant?.name).toBe('Samoon Restaurant Full')
    expect(useTenantStore.getState().tenantState).toBe('resolved')
  })

  it('6 — successful detail GET replaces the membership shell', async () => {
    hydrateConsoleTenantFromMembership(MEMBERSHIP)
    vi.spyOn(tenantService, 'getTenantById').mockResolvedValue(FULL_TENANT)

    await useTenantStore.getState().loadTenantById('tenant-1')

    expect(useTenantStore.getState().tenant?.name).toBe('Samoon Restaurant Full')
    expect(useTenantStore.getState().tenant?.settings?.contactEmail).toBe('hello@samoon.com')
    expect(useTenantStore.getState().tenantState).toBe('resolved')
  })
})
