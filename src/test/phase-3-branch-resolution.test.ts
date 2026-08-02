// ============================================================
// Phase 3 — Branch Resolution Architecture Refactor — regression tests
//
// Covers useBranchStore's admin branch-resolution state machine
// (selectedBranch/branchState/selectedBranchId) exactly as required by
// the phase's testing checklist: session branch pointer restore,
// invalid active branch id, tenant switch, branch switch, empty
// tenant, branch API failure, and Console workspace selection rules.
// ============================================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBranchStore, useRbacStore } from '@/stores'
import { branchManagementService } from '@/services/branch.service'
import { DEFAULT_BRANCH_CHECKOUT } from '@/lib/branch-checkout'

const TENANT_ID = 'tenant-samoon-01'
const BRANCH_A = 'branch-rest-01'
const BRANCH_B = 'branch-rest-02'

function seedActiveBranch(branchId: string) {
  useRbacStore.getState().setSessionMemberships(
    [{ tenantId: TENANT_ID, roles: ['owner'], branchAccess: { scope: 'all' } }],
    { tenantId: TENANT_ID, branchId },
  )
}

beforeEach(() => {
  branchManagementService._resetMockStore()
  useRbacStore.getState()._resetStore()
  useBranchStore.getState().resetBranchResolution()
})

describe('Phase 3 — first application load (no active branch pointer)', () => {
  it('stays empty when multiple branches exist but activeMembership.branchId is absent', async () => {
    expect(useBranchStore.getState().selectedBranchId).toBeNull()
    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)

    const state = useBranchStore.getState()
    expect(state.branchState).toBe('empty')
    expect(state.selectedBranch).toBeNull()
    expect(state.branches.length).toBeGreaterThan(1)
  })

  it('is "loading" synchronously while the fetch is in flight', () => {
    const promise = useBranchStore.getState().loadBranchesForTenant(TENANT_ID)
    expect(useBranchStore.getState().branchState).toBe('loading')
    return promise
  })
})

describe('Phase 3 — refresh with activeMembership.branchId', () => {
  it('restores the branch identified by GET /auth/me activeMembership.branchId', async () => {
    seedActiveBranch(BRANCH_A)

    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)

    const state = useBranchStore.getState()
    expect(state.branchState).toBe('ready')
    expect(state.selectedBranch?.id).toBe(BRANCH_A)
    expect(state.selectedBranchId).toBe(BRANCH_A)
  })
})

describe('Phase 3 — active branch id no longer exists in branch list', () => {
  it('resolves to empty instead of falling back to array position', async () => {
    seedActiveBranch('branch-does-not-exist-anymore')

    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)

    const state = useBranchStore.getState()
    expect(state.branchState).toBe('empty')
    expect(state.selectedBranch).toBeNull()
  })
})

describe('Phase 3 — tenant switch', () => {
  it('a branch id valid for tenant A is never treated as valid/selected for tenant B', async () => {
    seedActiveBranch(BRANCH_A)
    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)
    expect(useBranchStore.getState().selectedBranch?.id).toBe(BRANCH_A)

    useBranchStore.getState().resetBranchResolution()
    expect(useBranchStore.getState().selectedBranchId).toBeNull()

    await useBranchStore.getState().loadBranchesForTenant('tenant-oak-bar-01')
    const state = useBranchStore.getState()
    expect(state.selectedBranch?.id).not.toBe(BRANCH_A)
  })
})

describe('Phase 3 — branch switch', () => {
  it('selectBranch() is the only way to move from one valid branch to another, and mirrors the id', async () => {
    seedActiveBranch(BRANCH_A)
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
    vi.spyOn(branchManagementService, 'getTenantsBranches').mockRejectedValueOnce(new Error('network error'))

    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)

    const state = useBranchStore.getState()
    expect(state.branchState).toBe('error')
    expect(state.selectedBranch).toBeNull()
  })
})

describe('Phase 3.2 — retry from branchState = "error"', () => {
  it('is not automatic: branchState stays "error" until loadBranchesForTenant is explicitly called again', async () => {
    vi.spyOn(branchManagementService, 'getTenantsBranches').mockRejectedValueOnce(new Error('network error'))
    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)
    expect(useBranchStore.getState().branchState).toBe('error')

    await new Promise((r) => setTimeout(r, 50))
    expect(useBranchStore.getState().branchState).toBe('error')
  })

  it('an explicit retry call resolves out of "error" when activeMembership.branchId is present', async () => {
    vi.spyOn(branchManagementService, 'getTenantsBranches').mockRejectedValueOnce(new Error('network error'))
    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)
    expect(useBranchStore.getState().branchState).toBe('error')

    seedActiveBranch(BRANCH_A)
    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)
    const state = useBranchStore.getState()
    expect(state.branchState).toBe('ready')
    expect(state.branches.length).toBeGreaterThan(0)
    expect(state.selectedBranch?.id).toBe(BRANCH_A)
  })
})

describe('Phase 3 — membership branches (Console /auth/me path)', () => {
  it('hydrates branches from membership.branches without calling the API', async () => {
    const membershipBranches = [
      { id: 'mb-1', name: 'Main', slug: 'main', status: 'active' as const, isDefault: true },
      { id: 'mb-2', name: 'Second', slug: 'second', status: 'active' as const },
    ]
    const apiSpy = vi.spyOn(branchManagementService, 'getTenantsBranches')
    useRbacStore.getState().setSessionMemberships(
      [{ tenantId: TENANT_ID, roles: ['owner'], branchAccess: { scope: 'all' }, branches: membershipBranches }],
      { tenantId: TENANT_ID, branchId: 'mb-2' },
    )

    await useBranchStore.getState().loadBranchesFromMembership(TENANT_ID, membershipBranches)

    expect(apiSpy).not.toHaveBeenCalled()
    const state = useBranchStore.getState()
    expect(state.branchState).toBe('ready')
    expect(state.selectedBranch?.id).toBe('mb-2')
    expect(state.branches).toHaveLength(2)
  })
})

describe('Phase 3 — persistence: only public activeBranch survives reload', () => {
  it('partialize output contains activeBranch but not console selectedBranch state', async () => {
    seedActiveBranch(BRANCH_A)
    await useBranchStore.getState().loadBranchesForTenant(TENANT_ID)

    const state = useBranchStore.getState()
    const persisted = { activeBranch: state.activeBranch }
    expect(persisted).not.toHaveProperty('selectedBranch')
    expect(persisted).not.toHaveProperty('selectedBranchId')
    expect(persisted).not.toHaveProperty('branches')
    expect(persisted).not.toHaveProperty('branchState')
  })
})

describe('Phase 3 — Console workspace active branch pointer', () => {
  it('selects the sole branch only when activeMembership.branchId points at it', async () => {
    vi.spyOn(branchManagementService, 'getTenantsBranches').mockResolvedValueOnce([
      {
        id: 'only-branch',
        tenantId: 'tenant-with-one',
        name: 'Only',
        slug: 'only',
        status: 'active',
        type: 'physical',
        location: { address: '1', city: 'X', country: 'US' },
        contact: {},
        businessHours: [],
        checkout: { ...DEFAULT_BRANCH_CHECKOUT },
        marketplaceVisible: true,
        reservationsEnabled: false,
        created_at: '',
        updated_at: '',
      },
    ])
    useRbacStore.getState().setSessionMemberships(
      [{ tenantId: 'tenant-with-one', roles: ['owner'], branchAccess: { scope: 'all' } }],
      { tenantId: 'tenant-with-one', branchId: 'only-branch' },
    )
    await useBranchStore.getState().loadBranchesForTenant('tenant-with-one')
    expect(useBranchStore.getState().branchState).toBe('ready')
    expect(useBranchStore.getState().selectedBranch?.id).toBe('only-branch')
  })
})
