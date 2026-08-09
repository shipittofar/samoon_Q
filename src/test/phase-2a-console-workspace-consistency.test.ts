import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBranchStore, useRbacStore, useTenantStore } from '@/stores'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import {
  parseConsoleBranchIdFromPath,
  reconcileConsoleWorkspaceConsistency,
  branchBelongsToTenant,
} from '@/lib/console-workspace-consistency'
import {
  isCurrentBranchSwitch,
  nextBranchSwitchGeneration,
} from '@/lib/console-workspace-switch'
import { DEFAULT_BRANCH_CHECKOUT } from '@/lib/branch-checkout'
import type { Branch } from '@/types/branch'

const branch = (id: string, tenantId: string): Branch => ({
  id,
  tenantId,
  name: id,
  slug: id,
  status: 'active',
  type: 'physical',
  location: { address: '', city: '', country: '' },
  contact: {},
  businessHours: [],
  checkout: { ...DEFAULT_BRANCH_CHECKOUT },
  marketplaceVisible: true,
  reservationsEnabled: false,
  created_at: '',
  updated_at: '',
})

beforeEach(() => {
  useRbacStore.getState()._resetStore()
  useTenantStore.setState({ tenant: null, tenantState: 'not_found' } as never)
  useBranchStore.getState().resetBranchResolution()
  useConsoleWorkspaceStore.getState().resetWorkspace()
})

describe('parseConsoleBranchIdFromPath', () => {
  it('parses branch detail and nested routes', () => {
    expect(parseConsoleBranchIdFromPath('/console/branches/branch-rest-02')).toBe('branch-rest-02')
    expect(parseConsoleBranchIdFromPath('/console/branches/branch-rest-02/edit')).toBe('branch-rest-02')
  })

  it('ignores reserved segments', () => {
    expect(parseConsoleBranchIdFromPath('/console/branches/new')).toBeNull()
    expect(parseConsoleBranchIdFromPath('/console/branches/analytics')).toBeNull()
  })
})

describe('reconcileConsoleWorkspaceConsistency', () => {
  it('clears a cross-tenant selected branch', () => {
    useRbacStore.getState().setSessionMemberships(
      [{ tenantId: 'tenant-b', roles: ['owner'], branchAccess: { scope: 'all' } }],
      { tenantId: 'tenant-b' },
    )
    useBranchStore.setState({
      branches: [branch('branch-a-01', 'tenant-a')],
      selectedBranch: branch('branch-a-01', 'tenant-a'),
      selectedBranchId: 'branch-a-01',
      branchState: 'ready',
      adminActiveBranch: branch('branch-a-01', 'tenant-a'),
    })

    reconcileConsoleWorkspaceConsistency()

    const state = useBranchStore.getState()
    expect(state.selectedBranch).toBeNull()
    expect(state.branches).toEqual([])
    expect(state.branchState).toBe('idle')
  })

  it('aligns selected branch with activeMembership.branchId when list is loaded', () => {
    const branches = [branch('branch-rest-01', 'tenant-a'), branch('branch-rest-02', 'tenant-a')]
    useRbacStore.getState().setSessionMemberships(
      [{ tenantId: 'tenant-a', roles: ['owner'], branchAccess: { scope: 'all' } }],
      { tenantId: 'tenant-a', branchId: 'branch-rest-02' },
    )
    useBranchStore.setState({
      branches,
      selectedBranch: branches[0],
      selectedBranchId: 'branch-rest-01',
      branchState: 'ready',
      adminActiveBranch: branches[0],
    })

    reconcileConsoleWorkspaceConsistency()

    expect(useBranchStore.getState().selectedBranch?.id).toBe('branch-rest-02')
  })

  it('re-syncs workspace when tenant store drifts from activeMembership', async () => {
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

describe('branchBelongsToTenant', () => {
  it('returns false for cross-tenant branch', () => {
    expect(branchBelongsToTenant(branch('b1', 'tenant-a'), 'tenant-b')).toBe(false)
  })
})

describe('console switch generation', () => {
  it('discards stale branch switch generations', () => {
    const first = nextBranchSwitchGeneration()
    nextBranchSwitchGeneration()
    expect(isCurrentBranchSwitch(first)).toBe(false)
    expect(isCurrentBranchSwitch(2)).toBe(true)
  })
})
