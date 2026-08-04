import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  membershipBranchToBranch,
  resolveConsoleActiveTenantId,
  resolveConsoleActiveBranch,
  resolveConsoleDefaultBranch,
} from '@/lib/console-workspace'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import { useRbacStore, useTenantStore, useBranchStore } from '@/stores'
import { authService } from '@/services/auth.service'
import { ENDPOINTS } from '@/services/endpoints'
import { requestConsoleTenantSwitch, useConsoleTenantSwitch, requestConsoleBranchSwitch, useConsoleBranchSwitch } from '@/hooks/console-workspace'
import type { TenantMembership } from '@/types/rbac'
import type { Branch } from '@/types/branch'
import { DEFAULT_BRANCH_CHECKOUT } from '@/lib/branch-checkout'

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
  checkout: { ...DEFAULT_BRANCH_CHECKOUT },
  marketplaceVisible: true,
  reservationsEnabled: false,
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

describe('resolveConsoleActiveBranch', () => {
  it('returns null when activeMembership.branchId is absent', () => {
    const branches = [branch('one'), branch('two')]
    expect(resolveConsoleActiveBranch(branches, null)).toBeNull()
  })

  it('returns the branch matching activeMembership.branchId', () => {
    const branches = [branch('a'), branch('b')]
    expect(resolveConsoleActiveBranch(branches, 'b')?.id).toBe('b')
  })

  it('returns null when activeMembership.branchId is not in the branch list', () => {
    const branches = [branch('a'), branch('b')]
    expect(resolveConsoleActiveBranch(branches, 'missing')).toBeNull()
  })
})

describe('resolveConsoleDefaultBranch', () => {
  it('delegates to resolveConsoleActiveBranch', () => {
    const branches = [branch('a'), branch('b')]
    expect(resolveConsoleDefaultBranch(branches, 'b')?.id).toBe('b')
    expect(resolveConsoleDefaultBranch(branches, null)).toBeNull()
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

  it('last concurrent switch request wins', async () => {
    const memberships = [
      { tenantId: 'tenant-a', roles: ['owner'], branchAccess: { scope: 'all' } },
      { tenantId: 'tenant-b', roles: ['manager'], branchAccess: { scope: 'all' } },
      { tenantId: 'tenant-c', roles: ['manager'], branchAccess: { scope: 'all' } },
    ]
    useRbacStore.getState().setSessionMemberships(memberships, { tenantId: 'tenant-a' })

    const resolvers: Array<() => void> = []
    const switchSpy = vi.spyOn(authService, 'switchActiveTenant').mockImplementation(
      () => new Promise<void>((resolve) => {
        resolvers.push(resolve)
      }),
    )
    const getMeSpy = vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', first_name: 'A', last_name: 'B', accountType: 'business', is_verified: true, created_at: '' },
      memberships,
      activeMembership: { tenantId: 'tenant-c' },
    } as never)

    const { result } = renderHook(() => useConsoleTenantSwitch())

    let first: Promise<void> | undefined
    let second: Promise<void> | undefined
    await act(async () => {
      first = result.current.switchTenant('tenant-b')
      second = result.current.switchTenant('tenant-c')
    })

    expect(switchSpy).toHaveBeenCalledTimes(2)
    expect(switchSpy).toHaveBeenNthCalledWith(1, { tenantId: 'tenant-b' })
    expect(switchSpy).toHaveBeenNthCalledWith(2, { tenantId: 'tenant-c' })

    await act(async () => {
      while (resolvers.length > 0) resolvers.shift()?.()
      await Promise.all([first, second])
    })

    await waitFor(() => {
      expect(result.current.switchingToTenantId).toBeNull()
    })
    expect(useRbacStore.getState().activeMembership?.tenantId).toBe('tenant-c')

    switchSpy.mockRestore()
    getMeSpy.mockRestore()
  })
})

describe('requestConsoleBranchSwitch', () => {
  it('SWITCH_BRANCH endpoint is defined for switchActiveBranch', () => {
    expect(ENDPOINTS.AUTH.SWITCH_BRANCH).toBe('/authorization/switch-branch/')
  })

  beforeEach(() => {
    useRbacStore.getState()._resetStore()
    useConsoleWorkspaceStore.getState().resetWorkspace()
    useBranchStore.getState().resetBranchResolution()
  })

  it('calls switchActiveBranch then refreshes /auth/me without mutating selectedBranch locally first', async () => {
    const branches = [branch('branch-a'), branch('branch-b')]
    useBranchStore.setState({
      branches,
      selectedBranch: branches[0],
      selectedBranchId: 'branch-a',
      branchState: 'ready',
    } as never)
    useRbacStore.getState().setSessionMemberships(
      [{ tenantId: 't1', roles: ['owner'], branchAccess: { scope: 'all' } }],
      { tenantId: 't1' },
    )

    const switchSpy = vi.spyOn(authService, 'switchActiveBranch').mockResolvedValue(undefined)
    const getMeSpy = vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', first_name: 'A', last_name: 'B', accountType: 'business', is_verified: true, created_at: '' },
      memberships: [{ tenantId: 't1', roles: ['owner'], branchAccess: { scope: 'all' } }],
      activeMembership: { tenantId: 't1', branchId: 'branch-b' },
    } as never)

    await requestConsoleBranchSwitch('branch-b')

    expect(switchSpy).toHaveBeenCalledWith({ branchId: 'branch-b' })
    expect(getMeSpy).toHaveBeenCalled()
    expect(useBranchStore.getState().selectedBranch?.id).toBe('branch-b')
    expect(useRbacStore.getState().activeMembership?.branchId).toBe('branch-b')

    switchSpy.mockRestore()
    getMeSpy.mockRestore()
  })

  it('skips the API when selecting the already-active branch', async () => {
    const branches = [branch('branch-a'), branch('branch-b')]
    useBranchStore.setState({
      branches,
      selectedBranch: branches[0],
      selectedBranchId: 'branch-a',
      branchState: 'ready',
    } as never)

    const switchSpy = vi.spyOn(authService, 'switchActiveBranch')
    const getMeSpy = vi.spyOn(authService, 'getMe')

    await requestConsoleBranchSwitch('branch-a')

    expect(switchSpy).not.toHaveBeenCalled()
    expect(getMeSpy).not.toHaveBeenCalled()

    switchSpy.mockRestore()
    getMeSpy.mockRestore()
  })

  it('leaves selectedBranch unchanged when switchActiveBranch fails', async () => {
    const branches = [branch('branch-a'), branch('branch-b')]
    useBranchStore.setState({
      branches,
      selectedBranch: branches[0],
      selectedBranchId: 'branch-a',
      branchState: 'ready',
    } as never)
    useRbacStore.getState().setSessionMemberships(
      [{ tenantId: 't1', roles: ['owner'], branchAccess: { scope: 'all' } }],
      { tenantId: 't1' },
    )

    const switchSpy = vi.spyOn(authService, 'switchActiveBranch').mockRejectedValue(new Error('switch failed'))
    const getMeSpy = vi.spyOn(authService, 'getMe')

    await expect(requestConsoleBranchSwitch('branch-b')).rejects.toThrow('switch failed')

    expect(useBranchStore.getState().selectedBranch?.id).toBe('branch-a')
    expect(getMeSpy).not.toHaveBeenCalled()

    switchSpy.mockRestore()
    getMeSpy.mockRestore()
  })
})

describe('useConsoleBranchSwitch', () => {
  beforeEach(() => {
    useRbacStore.getState()._resetStore()
    useConsoleWorkspaceStore.getState().resetWorkspace()
    useBranchStore.getState().resetBranchResolution()
  })

  it('clears switchingToBranchId after switch failure so retry is possible', async () => {
    const branches = [branch('branch-a'), branch('branch-b')]
    useBranchStore.setState({
      branches,
      selectedBranch: branches[0],
      selectedBranchId: 'branch-a',
      branchState: 'ready',
    } as never)
    useRbacStore.getState().setSessionMemberships(
      [{ tenantId: 't1', roles: ['owner'], branchAccess: { scope: 'all' } }],
      { tenantId: 't1' },
    )

    vi.spyOn(authService, 'switchActiveBranch').mockRejectedValue(new Error('switch failed'))

    const { result } = renderHook(() => useConsoleBranchSwitch())

    await act(async () => {
      try {
        await result.current.switchBranch('branch-b')
      } catch (err) {
        expect((err as Error).message).toBe('switch failed')
      }
    })

    expect(result.current.switchingToBranchId).toBeNull()
    expect(result.current.switching).toBe(false)
  })

  it('last concurrent switch request wins', async () => {
    const branches = [branch('branch-a'), branch('branch-b'), branch('branch-c')]
    useBranchStore.setState({
      branches,
      selectedBranch: branches[0],
      selectedBranchId: 'branch-a',
      branchState: 'ready',
    } as never)
    useRbacStore.getState().setSessionMemberships(
      [{ tenantId: 't1', roles: ['owner'], branchAccess: { scope: 'all' } }],
      { tenantId: 't1' },
    )

    const resolvers: Array<() => void> = []
    const switchSpy = vi.spyOn(authService, 'switchActiveBranch').mockImplementation(
      () => new Promise<void>((resolve) => {
        resolvers.push(resolve)
      }),
    )
    const getMeSpy = vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', first_name: 'A', last_name: 'B', accountType: 'business', is_verified: true, created_at: '' },
      memberships: [{ tenantId: 't1', roles: ['owner'], branchAccess: { scope: 'all' } }],
      activeMembership: { tenantId: 't1', branchId: 'branch-c' },
    } as never)

    const { result } = renderHook(() => useConsoleBranchSwitch())

    let first: Promise<void> | undefined
    let second: Promise<void> | undefined
    await act(async () => {
      first = result.current.switchBranch('branch-b')
      second = result.current.switchBranch('branch-c')
    })

    expect(switchSpy).toHaveBeenCalledTimes(2)
    expect(switchSpy).toHaveBeenNthCalledWith(1, { branchId: 'branch-b' })
    expect(switchSpy).toHaveBeenNthCalledWith(2, { branchId: 'branch-c' })

    await act(async () => {
      while (resolvers.length > 0) resolvers.shift()?.()
      await Promise.all([first, second])
    })

    await waitFor(() => {
      expect(result.current.switchingToBranchId).toBeNull()
    })
    expect(useBranchStore.getState().selectedBranch?.id).toBe('branch-c')

    switchSpy.mockRestore()
    getMeSpy.mockRestore()
  })
})
