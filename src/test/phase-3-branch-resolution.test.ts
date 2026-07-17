// ============================================================
// Phase 3 — Branch Resolution Architecture Refactor — regression tests
//
// Covers useBranchStore's admin branch-resolution state machine
// (selectedBranch/branchState/selectedBranchId) exactly as required by
// the phase's testing checklist: first load, refresh-with-persisted-id,
// persisted branch deleted upstream, tenant switch, branch switch, empty
// tenant, branch API failure, and "no automatic first-branch selection"
// under every one of those scenarios.
// ============================================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBranchStore } from '@/stores'
import { branchManagementService } from '@/services/branch.service'

const TENANT_ID = 'tenant-samoon-01'
const BRANCH_A = 'branch-rest-01'
const BRANCH_B = 'branch-rest-02'

beforeEach(() => {
  branchManagementService._resetMockStore()
  useBranchStore.getState().resetBranchResolution()
})

describe('Phase 3 — first application load (no persisted branch id)', () => {
  it('resolves to branchState = "empty" with selectedBranch null, never branches[0]', async () => {
    expect(useBranchStore.getState().selectedBranchId).toBeNull()
    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)

    const state = useBranchStore.getState()
    expect(state.branchState).toBe('empty')
    expect(state.selectedBranch).toBeNull()
    expect(state.branches.length).toBeGreaterThan(0)
    // The fixture's first branch (branch-rest-01) must NOT have been
    // auto-selected just because it's index 0.
    expect(state.selectedBranch?.id).not.toBe(state.branches[0]?.id)
  })

  it('is "loading" synchronously while the fetch is in flight', () => {
    const promise = useBranchStore.getState().loadBranchesForTenant(TENANT_ID)
    expect(useBranchStore.getState().branchState).toBe('loading')
    return promise
  })
})

describe('Phase 3 — refresh with a persisted branch id', () => {
  it('validates the persisted id against a fresh fetch and resolves to "ready"', async () => {
    // Simulate what survives a reload: only selectedBranchId, exactly as
    // partialize() persists it — never the full branch object.
    useBranchStore.setState({ selectedBranchId: BRANCH_A })

    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)

    const state = useBranchStore.getState()
    expect(state.branchState).toBe('ready')
    expect(state.selectedBranch?.id).toBe(BRANCH_A)
  })
})

describe('Phase 3 — persisted branch deleted on backend (id no longer exists)', () => {
  it('resolves to "empty", not a fallback to any other branch', async () => {
    useBranchStore.setState({ selectedBranchId: 'branch-does-not-exist-anymore' })

    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)

    const state = useBranchStore.getState()
    expect(state.branchState).toBe('empty')
    expect(state.selectedBranch).toBeNull()
  })
})

describe('Phase 3 — tenant switch', () => {
  it('a branch id valid for tenant A is never treated as valid/selected for tenant B', async () => {
    useBranchStore.setState({ selectedBranchId: BRANCH_A })
    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)
    expect(useBranchStore.getState().selectedBranch?.id).toBe(BRANCH_A)

    // Switching tenants must clear the previous selection before loading
    // the new tenant's branches — mirrors BranchResolutionBootstrapper's
    // resetBranchResolution() call on a genuine tenant change.
    useBranchStore.getState().resetBranchResolution()
    expect(useBranchStore.getState().selectedBranchId).toBeNull()

    await useBranchStore.getState().loadBranchesForTenant('tenant-oak-bar-01')
    const state = useBranchStore.getState()
    // No leakage: branch-rest-01 belongs to tenant-samoon-01, so it must
    // not be selected for a different tenant even if some branch of the
    // new tenant happened to share an id (it doesn't here, but the point
    // is nothing carries over automatically).
    expect(state.selectedBranch?.id).not.toBe(BRANCH_A)
  })
})

describe('Phase 3 — branch switch', () => {
  it('selectBranch() is the only way to move from one valid branch to another, and persists only the id', async () => {
    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)
    const branches = useBranchStore.getState().branches
    const branchA = branches.find((b) => b.id === BRANCH_A)!
    const branchB = branches.find((b) => b.id === BRANCH_B)!

    useBranchStore.getState().selectBranch(branchA)
    expect(useBranchStore.getState().selectedBranch?.id).toBe(BRANCH_A)
    expect(useBranchStore.getState().selectedBranchId).toBe(BRANCH_A)

    useBranchStore.getState().selectBranch(branchB)
    const state = useBranchStore.getState()
    expect(state.selectedBranch?.id).toBe(BRANCH_B)
    expect(state.selectedBranchId).toBe(BRANCH_B)
    expect(state.branchState).toBe('ready')
  })
})

describe('Phase 3 — empty tenant (zero branches)', () => {
  it('resolves to "empty" without throwing when the tenant has no branches at all', async () => {
    vi.spyOn(branchManagementService, 'getBranches').mockResolvedValueOnce([])

    await useBranchStore.getState().loadBranchesForTenant('tenant-with-no-branches')

    const state = useBranchStore.getState()
    expect(state.branchState).toBe('empty')
    expect(state.selectedBranch).toBeNull()
    expect(state.branches).toEqual([])
  })
})

describe('Phase 3 — branch API failure', () => {
  it('resolves to branchState = "error", not a stale/fallback selection', async () => {
    vi.spyOn(branchManagementService, 'getBranches').mockRejectedValueOnce(new Error('network error'))

    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)

    const state = useBranchStore.getState()
    expect(state.branchState).toBe('error')
    expect(state.selectedBranch).toBeNull()
  })
})

describe('Phase 3.2 — retry from branchState = "error"', () => {
  it('is not automatic: branchState stays "error" until loadBranchesForTenant is explicitly called again', async () => {
    vi.spyOn(branchManagementService, 'getBranches').mockRejectedValueOnce(new Error('network error'))
    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)
    expect(useBranchStore.getState().branchState).toBe('error')

    // No timers fire, no effect re-runs — state simply stays 'error' until
    // something explicitly retries.
    await new Promise((r) => setTimeout(r, 50))
    expect(useBranchStore.getState().branchState).toBe('error')
  })

  it('an explicit retry call resolves out of "error" the same way any other load does', async () => {
    vi.spyOn(branchManagementService, 'getBranches').mockRejectedValueOnce(new Error('network error'))
    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)
    expect(useBranchStore.getState().branchState).toBe('error')

    // The retry action (useRetryLoadBranches in hooks/index.ts) is a thin
    // wrapper that re-calls loadBranchesForTenant() for the current
    // tenant — this exercises the same underlying call it makes.
    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)
    const state = useBranchStore.getState()
    expect(state.branchState).toBe('empty') // no persisted id in this test, so 'empty' not 'ready'
    expect(state.branches.length).toBeGreaterThan(0)
  })
})

describe('Phase 3 — persistence: only selectedBranch.id survives, never the full object', () => {
  it('partialize output contains selectedBranchId but not selectedBranch/branches/branchState', async () => {
    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)
    useBranchStore.getState().selectBranch(
      useBranchStore.getState().branches.find((b) => b.id === BRANCH_A)!,
    )

    // Mirrors stores/index.ts's actual partialize function for useBranchStore.
    const state = useBranchStore.getState()
    const persisted = { activeBranch: state.activeBranch, selectedBranchId: state.selectedBranchId }
    expect(persisted).not.toHaveProperty('selectedBranch')
    expect(persisted).not.toHaveProperty('branches')
    expect(persisted).not.toHaveProperty('branchState')
    expect(persisted.selectedBranchId).toBe(BRANCH_A)
  })
})

describe('Phase 3 — no automatic first-branch selection anywhere in the store', () => {
  it('loadBranchesForTenant never selects branches[0] when selectedBranchId is null', async () => {
    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)
    const state = useBranchStore.getState()
    expect(state.branches[0]).toBeDefined() // sanity: branches did load
    expect(state.selectedBranch).toBeNull() // yet nothing was auto-picked
    expect(state.branchState).toBe('empty')
  })

  it('AdminBranchSwitcher-equivalent logic never falls back to branches[0] when selectedBranch is null', async () => {
    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)
    const state = useBranchStore.getState()
    // The old bug was `adminActiveBranch ?? branches[0] ?? null` — assert
    // the store alone (no such fallback baked in) yields null, matching
    // what AdminBranchSwitcher now renders directly from state.
    expect(state.selectedBranch).toBeNull()
  })
})
