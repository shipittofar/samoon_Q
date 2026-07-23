import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  membershipBranchToBranch,
  resolveConsoleActiveTenantId,
  resolveConsoleDefaultBranch,
} from '@/lib/console-workspace'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import { useRbacStore, useTenantStore } from '@/stores'
import { authService } from '@/services/auth.service'
import { requestConsoleTenantSwitch, useConsoleTenantSwitch } from '@/hooks/console-workspace'
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

describe('requestConsoleTenantSwitch', () => {
  beforeEach(() => {
    useRbacStore.getState()._resetStore()
    useConsoleWorkspaceStore.getState().resetWorkspace()
  })

  it('calls switchActiveTenant then refreshes /auth/me without mutating activeMembership locally first', async () => {
    const memberships = [
      { tenantId: 'tenant-a', roles: ['owner'], branchAccess: { scope: 'all' } },
      { tenantId: 'tenant-b', roles: ['manager'], branchAccess: { scope: 'all' } },
    ]
    useRbacStore.getState().setSessionMemberships(memberships, { tenantId: 'tenant-a' })

    const switchSpy = vi.spyOn(authService, 'switchActiveTenant').mockResolvedValue(undefined)
    const getMeSpy = vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', first_name: 'A', last_name: 'B', accountType: 'business', is_verified: true, created_at: '' },
      memberships,
      activeMembership: { tenantId: 'tenant-b' },
    } as never)

    await requestConsoleTenantSwitch('tenant-b')

    expect(switchSpy).toHaveBeenCalledWith({ tenantId: 'tenant-b', tenantSlug: undefined })
    expect(getMeSpy).toHaveBeenCalled()
    expect(useRbacStore.getState().activeMembership?.tenantId).toBe('tenant-b')

    switchSpy.mockRestore()
    getMeSpy.mockRestore()
  })

  it('leaves activeMembership unchanged when switchActiveTenant fails', async () => {
    const memberships = [
      { tenantId: 'tenant-a', roles: ['owner'], branchAccess: { scope: 'all' } },
      { tenantId: 'tenant-b', roles: ['manager'], branchAccess: { scope: 'all' } },
    ]
    useRbacStore.getState().setSessionMemberships(memberships, { tenantId: 'tenant-a' })

    const switchSpy = vi.spyOn(authService, 'switchActiveTenant').mockRejectedValue(new Error('switch failed'))
    const getMeSpy = vi.spyOn(authService, 'getMe')

    await expect(requestConsoleTenantSwitch('tenant-b')).rejects.toThrow('switch failed')

    expect(useRbacStore.getState().activeMembership?.tenantId).toBe('tenant-a')
    expect(getMeSpy).not.toHaveBeenCalled()

    switchSpy.mockRestore()
    getMeSpy.mockRestore()
  })

  it('leaves activeMembership unchanged when getMe fails after successful switch', async () => {
    const memberships = [
      { tenantId: 'tenant-a', roles: ['owner'], branchAccess: { scope: 'all' } },
      { tenantId: 'tenant-b', roles: ['manager'], branchAccess: { scope: 'all' } },
    ]
    useRbacStore.getState().setSessionMemberships(memberships, { tenantId: 'tenant-a' })

    const switchSpy = vi.spyOn(authService, 'switchActiveTenant').mockResolvedValue(undefined)
    const getMeSpy = vi.spyOn(authService, 'getMe').mockRejectedValue(new Error('session refresh failed'))

    await expect(requestConsoleTenantSwitch('tenant-b')).rejects.toThrow('session refresh failed')

    expect(useRbacStore.getState().activeMembership?.tenantId).toBe('tenant-a')
    expect(useConsoleWorkspaceStore.getState()._switching).toBe(false)

    switchSpy.mockRestore()
    getMeSpy.mockRestore()
  })
})

describe('useConsoleTenantSwitch', () => {
  beforeEach(() => {
    useRbacStore.getState()._resetStore()
    useConsoleWorkspaceStore.getState().resetWorkspace()
  })

  it('clears switchingToTenantId after switch failure so retry is possible', async () => {
    const memberships = [
      { tenantId: 'tenant-a', roles: ['owner'], branchAccess: { scope: 'all' } },
      { tenantId: 'tenant-b', roles: ['manager'], branchAccess: { scope: 'all' } },
    ]
    useRbacStore.getState().setSessionMemberships(memberships, { tenantId: 'tenant-a' })

    vi.spyOn(authService, 'switchActiveTenant').mockRejectedValue(new Error('switch failed'))

    const { result } = renderHook(() => useConsoleTenantSwitch())

    await act(async () => {
      await expect(result.current.switchTenant('tenant-b')).rejects.toThrow('switch failed')
    })

    expect(result.current.switchingToTenantId).toBeNull()
    expect(result.current.switching).toBe(false)
  })

  it('ignores concurrent switch requests', async () => {
    const memberships = [
      { tenantId: 'tenant-a', roles: ['owner'], branchAccess: { scope: 'all' } },
      { tenantId: 'tenant-b', roles: ['manager'], branchAccess: { scope: 'all' } },
      { tenantId: 'tenant-c', roles: ['manager'], branchAccess: { scope: 'all' } },
    ]
    useRbacStore.getState().setSessionMemberships(memberships, { tenantId: 'tenant-a' })

    let resolveSwitch: (() => void) | undefined
    const switchSpy = vi.spyOn(authService, 'switchActiveTenant').mockImplementation(
      () => new Promise<void>((resolve) => { resolveSwitch = resolve }),
    )
    vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', first_name: 'A', last_name: 'B', accountType: 'business', is_verified: true, created_at: '' },
      memberships,
      activeMembership: { tenantId: 'tenant-b' },
    } as never)

    const { result } = renderHook(() => useConsoleTenantSwitch())

    let first: Promise<void> | undefined
    let second: Promise<void> | undefined
    await act(async () => {
      first = result.current.switchTenant('tenant-b')
      second = result.current.switchTenant('tenant-c')
    })

    expect(switchSpy).toHaveBeenCalledTimes(1)
    expect(switchSpy).toHaveBeenCalledWith({ tenantId: 'tenant-b', tenantSlug: undefined })

    await act(async () => {
      resolveSwitch?.()
      await first
      await second
    })

    await waitFor(() => {
      expect(result.current.switchingToTenantId).toBeNull()
    })

    switchSpy.mockRestore()
  })
})
