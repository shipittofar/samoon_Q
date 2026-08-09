/**
 * Minimal Patch — console tenant synchronization validation.
 * Maps P1–P6 acceptance scenarios to unit-level evidence.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveConsoleTenantPhase } from '@/components/admin/ConsoleWorkspaceGate'
import { useRbacStore, useTenantStore, useBranchStore } from '@/stores'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import { reconcileConsoleWorkspaceConsistency } from '@/lib/console-workspace-consistency'
import { useConsoleTenantId } from '@/hooks/console-workspace'
import { renderHook } from '@testing-library/react'

function snapshot() {
  return {
    activeMembershipTenantId: useRbacStore.getState().activeMembership?.tenantId ?? null,
    tenantId: useTenantStore.getState().tenant?.id ?? null,
    tenantState: useTenantStore.getState().tenantState,
    workspacePhase: useConsoleWorkspaceStore.getState().workspacePhase,
    bootstrapped: useConsoleWorkspaceStore.getState()._bootstrapped,
  }
}

beforeEach(() => {
  useRbacStore.getState()._resetStore()
  useTenantStore.setState({ tenant: null, tenantState: 'not_found' } as never)
  useBranchStore.getState().resetBranchResolution()
  useConsoleWorkspaceStore.getState().resetWorkspace()
})

describe('P6 — gate blocks resolved children when tenant id drifts from activeMembership', () => {
  it('returns tenant_loading when tenantState is resolved but ids differ', () => {
    expect(
      resolveConsoleTenantPhase({
        hasTenantMembership: true,
        sessionMembershipCount: 1,
        activeTenantId: 'tenant-a',
        resolvedTenantId: 'tenant-b',
        tenantState: 'resolved',
        hasDashboardAccess: true,
        retryCount: 0,
      }),
    ).toBe('tenant_loading')
  })

  it('returns tenant_loading when tenantState is resolved but resolvedTenantId is absent', () => {
    expect(
      resolveConsoleTenantPhase({
        hasTenantMembership: true,
        sessionMembershipCount: 1,
        activeTenantId: 'tenant-a',
        resolvedTenantId: undefined,
        tenantState: 'resolved',
        hasDashboardAccess: true,
        retryCount: 0,
      }),
    ).toBe('tenant_loading')
  })

  it('returns resolved only when ids match', () => {
    expect(
      resolveConsoleTenantPhase({
        hasTenantMembership: true,
        sessionMembershipCount: 1,
        activeTenantId: 'tenant-a',
        resolvedTenantId: 'tenant-a',
        tenantState: 'resolved',
        hasDashboardAccess: true,
        retryCount: 0,
      }),
    ).toBe('resolved')
  })
})

describe('P1 — useConsoleTenantId is the API scope source', () => {
  it('reads activeMembership.tenantId, not tenant store', () => {
    useRbacStore.getState().setSessionMemberships(
      [{ tenantId: 'tenant-a', roles: ['owner'], branchAccess: { scope: 'all' } }],
      { tenantId: 'tenant-a' },
    )
    useTenantStore.setState({
      tenant: { id: 'tenant-b', slug: 'b', name: 'B' } as never,
      tenantState: 'resolved',
    } as never)

    const { result } = renderHook(() => useConsoleTenantId())
    expect(result.current).toBe('tenant-a')
    expect(snapshot().tenantId).toBe('tenant-b')
  })
})

describe('P2 — initializeFromSession does not bootstrap on switchTenant failure', () => {
  it('leaves workspace in error when switchTenant returns false', async () => {
    useRbacStore.getState().setSessionMemberships(
      [
        { tenantId: 'tenant-a', roles: ['owner'], branchAccess: { scope: 'all' } },
        { tenantId: 'tenant-b', roles: ['manager'], branchAccess: { scope: 'all' } },
      ],
      { tenantId: 'tenant-a' },
    )
    useTenantStore.setState({ tenant: null, tenantState: 'not_found' } as never)

    vi.spyOn(useConsoleWorkspaceStore.getState(), 'switchTenant').mockResolvedValue(false)
    await useConsoleWorkspaceStore.getState().initializeFromSession()

    const s = snapshot()
    expect(s.bootstrapped).toBe(false)
    expect(s.workspacePhase).toBe('error')
    expect(useConsoleWorkspaceStore.getState().workspaceError).toBeTruthy()
  })
})

describe('P4 — drift self-heal triggers re-bootstrap', () => {
  it('resets workspace and calls initializeFromSession when ids diverge', async () => {
    useRbacStore.getState().setSessionMemberships(
      [{ tenantId: 'tenant-a', roles: ['owner'], branchAccess: { scope: 'all' } }],
      { tenantId: 'tenant-a' },
    )
    useTenantStore.setState({
      tenant: { id: 'tenant-b', slug: 'b', name: 'B' } as never,
      tenantState: 'resolved',
    } as never)
    useConsoleWorkspaceStore.setState({ _bootstrapped: true, workspacePhase: 'ready' } as never)

    const initSpy = vi.spyOn(useConsoleWorkspaceStore.getState(), 'initializeFromSession').mockResolvedValue()
    reconcileConsoleWorkspaceConsistency()
    await Promise.resolve()

    expect(useConsoleWorkspaceStore.getState()._bootstrapped).toBe(false)
    expect(initSpy).toHaveBeenCalled()
    initSpy.mockRestore()
  })
})

describe('P2 guard path — switchTenant returns false for non-active membership', () => {
  it('never marks workspace ready when target !== activeMembership.tenantId', async () => {
    useRbacStore.getState().setSessionMemberships(
      [
        { tenantId: 'tenant-a', roles: ['owner'], branchAccess: { scope: 'all' } },
        { tenantId: 'tenant-b', roles: ['manager'], branchAccess: { scope: 'all' } },
      ],
      { tenantId: 'tenant-a' },
    )

    const switched = await useConsoleWorkspaceStore.getState().switchTenant('tenant-b')
    expect(switched).toBe(false)
    expect(snapshot().workspacePhase).not.toBe('ready')
  })
})
