import type { Branch } from '@/types/branch'
import { useRbacStore, useTenantStore, useBranchStore } from '@/stores'

/** Reserved console branch route segments that are not branch ids. */
const RESERVED_BRANCH_SEGMENTS = new Set(['new', 'analytics'])

/**
 * Extracts a branch id from console routes such as
 * `/console/branches/:id` or `/console/branches/:id/edit`.
 */
export function parseConsoleBranchIdFromPath(pathname: string | null | undefined): string | null {
  if (!pathname?.startsWith('/console/branches/')) return null
  const rest = pathname.slice('/console/branches/'.length)
  const segment = rest.split('/')[0]
  if (!segment || RESERVED_BRANCH_SEGMENTS.has(segment)) return null
  return segment
}

export function branchBelongsToTenant(
  branch: Pick<Branch, 'tenantId'> | null | undefined,
  tenantId: string | null | undefined,
): boolean {
  if (!branch || !tenantId) return false
  return branch.tenantId === tenantId
}

export function filterBranchesForTenant<T extends Pick<Branch, 'tenantId'>>(
  branches: readonly T[],
  tenantId: string,
): T[] {
  return branches.filter((b) => b.tenantId === tenantId)
}

/**
 * Repairs cross-tenant drift between activeMembership, tenant record, and branch store.
 * Safe to call after boot, tenant switch, or session refresh.
 */
export function reconcileConsoleWorkspaceConsistency(): void {
  const activeTenantId = useRbacStore.getState().activeMembership?.tenantId ?? null
  const activeBranchId = useRbacStore.getState().activeMembership?.branchId ?? null
  const tenant = useTenantStore.getState().tenant
  const { selectedBranch, branches, branchState } = useBranchStore.getState()

  if (!activeTenantId) {
    if (selectedBranch || branches.length > 0) {
      useBranchStore.getState().resetBranchResolution()
    }
    return
  }

  const tenantBranches = filterBranchesForTenant(branches, activeTenantId)
  const branchesDiverged = tenantBranches.length !== branches.length

  if (selectedBranch && !branchBelongsToTenant(selectedBranch, activeTenantId)) {
    useBranchStore.getState().resetBranchResolution()
    return
  }

  if (branchesDiverged) {
    useBranchStore.setState({
      branches: tenantBranches,
      selectedBranch:
        selectedBranch && branchBelongsToTenant(selectedBranch, activeTenantId) ? selectedBranch : null,
      selectedBranchId:
        selectedBranch && branchBelongsToTenant(selectedBranch, activeTenantId)
          ? selectedBranch.id
          : null,
      branchState: tenantBranches.length === 0 ? 'empty' : branchState,
      adminActiveBranch:
        selectedBranch && branchBelongsToTenant(selectedBranch, activeTenantId)
          ? selectedBranch
          : null,
    })
  }

  if (
    activeBranchId &&
    selectedBranch?.id !== activeBranchId &&
    branchState !== 'loading' &&
    tenantBranches.some((b) => b.id === activeBranchId)
  ) {
    const match = tenantBranches.find((b) => b.id === activeBranchId)
    if (match) useBranchStore.getState().selectBranch(match)
  }

  if (tenant && tenant.id !== activeTenantId) {
    // Tenant record is stale relative to session — workspace boot must reload it.
    return
  }
}
