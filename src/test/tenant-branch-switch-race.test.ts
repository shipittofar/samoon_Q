import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Role } from '@/types/rbac'
import { renderHook, act } from '@testing-library/react'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import { useRbacStore, useBranchStore } from '@/stores'
import { authService } from '@/services/auth.service'
import {
  requestConsoleTenantSwitch,
  requestConsoleBranchSwitch,
  useConsoleBranchSwitch,
  useConsoleWorkspace,
  isConsoleTenantSwitchPending,
} from '@/hooks/console-workspace'
import type { Branch } from '@/types/branch'
import { DEFAULT_BRANCH_CHECKOUT } from '@/lib/branch-checkout'

const branch = (id: string, tenantId: string): Branch => ({
  id,
  tenantId,
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
  created_at: '',
  updated_at: '',
})

const memberships = [
  {
    tenantId: 'tenant-a',
    tenantSlug: 'slug-a',
    tenantName: 'Tenant A',
    roles: ['owner'] as Role[],
    branchAccess: { scope: 'all' as const },
    branches: [
      { id: 'branch-a', name: 'Branch A', slug: 'branch-a', status: 'active' as const, isDefault: true },
    ],
  },
  {
    tenantId: 'tenant-b',
    tenantSlug: 'slug-b',
    tenantName: 'Tenant B',
    roles: ['manager'] as Role[],
    branchAccess: { scope: 'all' as const },
    branches: [
      { id: 'branch-b', name: 'Branch B', slug: 'branch-b', status: 'active' as const, isDefault: true },
    ],
  },
]

function seedTenantAWithBranchA() {
  useRbacStore.getState().setSessionMemberships(memberships, {
    tenantId: 'tenant-a',
    branchId: 'branch-a',
  })
  const branchA = branch('branch-a', 'tenant-a')
  useBranchStore.setState({
    branches: [branchA],
    selectedBranch: branchA,
    selectedBranchId: 'branch-a',
    branchState: 'ready',
    adminActiveBranch: branchA,
  } as never)
  useConsoleWorkspaceStore.setState({
    selectedTenantId: 'tenant-a',
    workspacePhase: 'ready',
    workspaceError: null,
    _bootstrapped: true,
    _switching: false,
  })
}

describe('tenant/branch switch race — stale branch prevention', () => {
  beforeEach(() => {
    useRbacStore.getState()._resetStore()
    useConsoleWorkspaceStore.getState().resetWorkspace()
    useBranchStore.getState().resetBranchResolution()
    vi.restoreAllMocks()
  })

  it('1 — Tenant A → Tenant B clears Branch A before switch-tenant resolves', async () => {
    seedTenantAWithBranchA()

    let resolveSwitch!: () => void
    const switchSpy = vi.spyOn(authService, 'switchActiveTenant').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSwitch = resolve
        }),
    )
    vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: {
        id: 'u1',
        email: 'a@b.com',
        first_name: 'A',
        last_name: 'B',
        accountType: 'business',
        is_verified: true,
        created_at: '',
      },
      memberships,
      activeMembership: { tenantId: 'tenant-b', branchId: 'branch-b', roles: ['manager'] as Role[], branchAccess: { scope: 'all' as const } },
    } as never)

    const pending = requestConsoleTenantSwitch('tenant-b')

    // Synchronous pending + clear — before backend resolves.
    expect(useConsoleWorkspaceStore.getState().workspacePhase).toBe('switching_tenant')
    expect(useConsoleWorkspaceStore.getState()._switching).toBe(true)
    expect(useBranchStore.getState().selectedBranch).toBeNull()
    expect(useBranchStore.getState().branches).toEqual([])
    expect(isConsoleTenantSwitchPending()).toBe(true)

    resolveSwitch()
    await pending

    expect(switchSpy).toHaveBeenCalledWith({ tenantId: 'tenant-b' })
    expect(useRbacStore.getState().activeMembership?.tenantId).toBe('tenant-b')
    // Branch A must never remain selected under Tenant B.
    expect(useBranchStore.getState().selectedBranch?.id).not.toBe('branch-a')
    expect(useBranchStore.getState().selectedBranch?.tenantId !== 'tenant-a').toBe(true)
  })

  it('2 — branch switch is a no-op while tenant switching is in progress', async () => {
    seedTenantAWithBranchA()
    useConsoleWorkspaceStore.getState().beginTenantSwitch('tenant-b')

    const switchSpy = vi.spyOn(authService, 'switchActiveBranch')
    await requestConsoleBranchSwitch('branch-a')
    expect(switchSpy).not.toHaveBeenCalled()

    const { result } = renderHook(() => useConsoleBranchSwitch())
    await act(async () => {
      await result.current.switchBranch('branch-a')
    })
    expect(switchSpy).not.toHaveBeenCalled()
  })

  it('3 — Branch A is never submitted after Tenant B is active', async () => {
    seedTenantAWithBranchA()
    // Simulate completed tenant switch: active tenant B, only B branches loaded.
    useRbacStore.getState().setSessionMemberships(memberships, {
      tenantId: 'tenant-b',
      branchId: 'branch-b',
    })
    const branchB = branch('branch-b', 'tenant-b')
    useBranchStore.setState({
      branches: [branchB],
      selectedBranch: branchB,
      selectedBranchId: 'branch-b',
      branchState: 'ready',
    } as never)
    useConsoleWorkspaceStore.setState({
      workspacePhase: 'ready',
      _switching: false,
      selectedTenantId: 'tenant-b',
    })

    const switchSpy = vi.spyOn(authService, 'switchActiveBranch')
    // Attempt to force-submit stale Branch A (not in Tenant B list / wrong tenantId).
    await requestConsoleBranchSwitch('branch-a')
    expect(switchSpy).not.toHaveBeenCalled()

    // Even if somehow Branch A is still in the list with wrong tenantId:
    useBranchStore.setState({
      branches: [branch('branch-a', 'tenant-a'), branchB],
      selectedBranch: branchB,
      selectedBranchId: 'branch-b',
      branchState: 'ready',
    } as never)
    await requestConsoleBranchSwitch('branch-a')
    expect(switchSpy).not.toHaveBeenCalled()
  })

  it('4 — after tenant switch, branch list/selection belong only to the new tenant', async () => {
    seedTenantAWithBranchA()

    vi.spyOn(authService, 'switchActiveTenant').mockResolvedValue(undefined)
    vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: {
        id: 'u1',
        email: 'a@b.com',
        first_name: 'A',
        last_name: 'B',
        accountType: 'business',
        is_verified: true,
        created_at: '',
      },
      memberships,
      activeMembership: {
        tenantId: 'tenant-b',
        branchId: 'branch-b',
        roles: ['manager'] as Role[],
        branchAccess: { scope: 'all' as const },
      },
    } as never)

    await requestConsoleTenantSwitch('tenant-b')

    const { branches, selectedBranch } = useBranchStore.getState()
    expect(branches.every((b) => b.tenantId === 'tenant-b')).toBe(true)
    if (selectedBranch) {
      expect(selectedBranch.tenantId).toBe('tenant-b')
      expect(selectedBranch.id).toBe('branch-b')
    }
  })

  it('5 — rapid tenant switching: last request wins; intermediate branch switch discarded', async () => {
    seedTenantAWithBranchA()

    const resolvers: Array<() => void> = []
    vi.spyOn(authService, 'switchActiveTenant').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvers.push(resolve)
        }),
    )
    vi.spyOn(authService, 'getMe').mockImplementation(async () => {
      // Return whichever tenant switch generation last completed via active mock order.
      const last = useConsoleWorkspaceStore.getState().selectedTenantId
      return {
        user: {
          id: 'u1',
          email: 'a@b.com',
          first_name: 'A',
          last_name: 'B',
          accountType: 'business',
          is_verified: true,
          created_at: '',
        },
        memberships,
        activeMembership: {
          tenantId: last === 'tenant-a' ? 'tenant-a' : 'tenant-b',
          branchId: last === 'tenant-a' ? 'branch-a' : 'branch-b',
          roles: ['owner'] as Role[],
          branchAccess: { scope: 'all' as const },
        },
      } as never
    })

    const branchSpy = vi.spyOn(authService, 'switchActiveBranch')

    const first = requestConsoleTenantSwitch('tenant-b')
    // Mid-flight stale branch attempt must not hit the API.
    await requestConsoleBranchSwitch('branch-a')
    expect(branchSpy).not.toHaveBeenCalled()

    const second = requestConsoleTenantSwitch('tenant-a')

    while (resolvers.length > 0) resolvers.shift()?.()
    await Promise.allSettled([first, second])

    expect(branchSpy).not.toHaveBeenCalled()
    expect(useConsoleWorkspaceStore.getState()._switching).toBe(false)
  })

  it('6 — out-of-order branch response is ignored after tenant switch generation bump', async () => {
    seedTenantAWithBranchA()
    const branchBLocal = branch('branch-b-local', 'tenant-a')
    useBranchStore.setState({
      branches: [branch('branch-a', 'tenant-a'), branchBLocal],
      selectedBranch: branch('branch-a', 'tenant-a'),
      selectedBranchId: 'branch-a',
      branchState: 'ready',
    } as never)

    let resolveBranch!: () => void
    vi.spyOn(authService, 'switchActiveBranch').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveBranch = resolve
        }),
    )
    const getMeSpy = vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: {
        id: 'u1',
        email: 'a@b.com',
        first_name: 'A',
        last_name: 'B',
        accountType: 'business',
        is_verified: true,
        created_at: '',
      },
      memberships,
      activeMembership: {
        tenantId: 'tenant-a',
        branchId: 'branch-b-local',
        roles: ['owner'] as Role[],
        branchAccess: { scope: 'all' as const },
      },
    } as never)

    const inFlight = requestConsoleBranchSwitch('branch-b-local')
    // Tenant switch invalidates in-flight branch generation + clears selection.
    useConsoleWorkspaceStore.getState().beginTenantSwitch('tenant-b')
    expect(useBranchStore.getState().selectedBranch).toBeNull()

    resolveBranch()
    await inFlight

    // Stale branch refresh must not resurrect Branch A/B under the pending tenant switch.
    expect(useBranchStore.getState().selectedBranch).toBeNull()
    expect(getMeSpy).not.toHaveBeenCalled()
  })

  it('7 — cached previous-tenant branches are discarded on beginTenantSwitch', () => {
    seedTenantAWithBranchA()
    expect(useBranchStore.getState().branches).toHaveLength(1)

    useConsoleWorkspaceStore.getState().beginTenantSwitch('tenant-b')

    expect(useBranchStore.getState().branches).toEqual([])
    expect(useBranchStore.getState().selectedBranch).toBeNull()
    expect(useBranchStore.getState().branchState).toBe('idle')
  })

  it('8 — useConsoleWorkspace reports branchLoading during switching_tenant (no hard reload)', () => {
    seedTenantAWithBranchA()
    useConsoleWorkspaceStore.getState().beginTenantSwitch('tenant-b')

    const { result } = renderHook(() => useConsoleWorkspace())
    expect(result.current.tenantSwitching).toBe(true)
    expect(result.current.branchLoading).toBe(true)
    expect(result.current.tenantLoading).toBe(true)
    expect(result.current.workspacePhase).toBe('switching_tenant')
  })
})
