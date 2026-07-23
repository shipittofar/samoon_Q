import { describe, it, expect, beforeEach } from 'vitest'
import {
  membershipBranchToBranch,
  resolveConsoleActiveTenantId,
  resolveConsoleDefaultBranch,
} from '@/lib/console-workspace'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import { useRbacStore, useTenantStore } from '@/stores'
import type { TenantMembership } from '@/types/rbac'
import type { Branch } from '@/types/branch'

const membership = (tenantId: string, branches?: TenantMembership['branches']): TenantMembership => ({
  tenantId,
  tenantSlug: `slug-${tenantId}`,
  tenantName: `Tenant ${tenantId}`,
  roles: ['owner'],
  branchAccess: { scope: 'all' },
  branches,
})

const branch = (id: string, isDefault?: boolean): Branch => ({
  id,
  tenantId: 't1',
  name: id,
  slug: id,
  status: 'active',
  type: 'physical',
  location: { address: 'a', city: 'b', country: 'c' },
  contact: {},
  businessHours: [],
  settings: { deliveryEnabled: false, pickupEnabled: true, tableOrderingEnabled: false, reservationsEnabled: false },
  isDefault,
  created_at: '',
  updated_at: '',
})

describe('resolveConsoleActiveTenantId', () => {
  it('returns activeMembership.tenantId when present in memberships', () => {
    const memberships = [membership('a'), membership('b')]
    expect(resolveConsoleActiveTenantId(memberships, { tenantId: 'b' })).toBe('b')
  })

  it('returns null when activeMembership is absent', () => {
    const memberships = [membership('a'), membership('b')]
    expect(resolveConsoleActiveTenantId(memberships, null)).toBeNull()
  })

  it('returns null when activeMembership.tenantId is missing', () => {
    expect(resolveConsoleActiveTenantId([membership('only')], { tenantId: '' })).toBeNull()
  })

  it('returns null for sole membership without activeMembership — never auto-selects', () => {
    expect(resolveConsoleActiveTenantId([membership('only')], null)).toBeNull()
  })

  it('returns null when activeMembership points at a tenant outside memberships', () => {
    expect(resolveConsoleActiveTenantId([membership('a')], { tenantId: 'ghost' })).toBeNull()
  })
})

describe('resolveConsoleDefaultBranch', () => {
  it('auto-selects the only branch', () => {
    const branches = [branch('one')]
    expect(resolveConsoleDefaultBranch(branches, null)?.id).toBe('one')
  })

  it('keeps persisted branch when valid', () => {
    const branches = [branch('a'), branch('b')]
    expect(resolveConsoleDefaultBranch(branches, 'b')?.id).toBe('b')
  })

  it('falls back to first branch when persisted id is invalid (API path)', () => {
    const branches = [branch('a'), branch('b')]
    expect(resolveConsoleDefaultBranch(branches, 'missing')?.id).toBe('a')
  })

  it('prefers isDefault branch for membership source', () => {
    const branches = [branch('a'), branch('b', true), branch('c')]
    expect(resolveConsoleDefaultBranch(branches, null, { respectMembershipDefault: true })?.id).toBe('b')
  })
})

describe('membershipBranchToBranch', () => {
  it('maps /auth/me membership branch fields onto Branch', () => {
    const mapped = membershipBranchToBranch(
      { id: 'b1', name: 'Main', slug: 'main', status: 'active', isDefault: true },
      'tenant-1',
    )
    expect(mapped.id).toBe('b1')
    expect(mapped.tenantId).toBe('tenant-1')
    expect(mapped.isDefault).toBe(true)
  })
})

describe('useConsoleWorkspaceStore.switchTenant', () => {
  beforeEach(() => {
    useRbacStore.getState()._resetStore()
    useTenantStore.setState({ tenant: null, tenantState: 'not_found' } as never)
    useConsoleWorkspaceStore.getState().resetWorkspace()
  })

  it('does not activate a membership that is not activeMembership.tenantId', async () => {
    useRbacStore.getState().setSessionMemberships(
      [
        { tenantId: 'tenant-a', roles: ['owner'], branchAccess: { scope: 'all' } },
        { tenantId: 'tenant-b', roles: ['manager'], branchAccess: { scope: 'all' } },
      ],
      { tenantId: 'tenant-a' },
    )

    await useConsoleWorkspaceStore.getState().switchTenant('tenant-b')

    expect(useTenantStore.getState().tenant).toBeNull()
    expect(useConsoleWorkspaceStore.getState().selectedTenantId).toBeNull()
  })
})
