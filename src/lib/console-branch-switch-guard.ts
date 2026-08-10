import { useRbacStore, useBranchStore } from '@/stores'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import type { Branch } from '@/types/branch'

export type SwitchBranchGuardResult =
  | { ok: true; activeTenantId: string; branch: Branch }
  | {
      ok: false
      reason:
        | 'tenant_switch_pending'
        | 'no_active_tenant'
        | 'branch_not_in_active_tenant_list'
        | 'branch_tenant_mismatch'
    }

/**
 * Single source of truth for whether POST /authorization/switch-branch/ is allowed.
 * Must be re-checked immediately before the network call (TOCTOU defense).
 */
export function evaluateSwitchBranchGuard(branchId: string): SwitchBranchGuardResult {
  const { workspacePhase, _switching } = useConsoleWorkspaceStore.getState()
  if (_switching || workspacePhase === 'switching_tenant') {
    return { ok: false, reason: 'tenant_switch_pending' }
  }

  const activeTenantId = useRbacStore.getState().activeMembership?.tenantId
  if (!activeTenantId) {
    return { ok: false, reason: 'no_active_tenant' }
  }

  const branch = useBranchStore.getState().branches.find((b) => b.id === branchId)
  if (!branch) {
    return { ok: false, reason: 'branch_not_in_active_tenant_list' }
  }
  if (branch.tenantId !== activeTenantId) {
    return { ok: false, reason: 'branch_tenant_mismatch' }
  }

  return { ok: true, activeTenantId, branch }
}

/** @returns true only when switch-branch may be submitted. */
export function assertCanSubmitConsoleBranchSwitch(branchId: string): boolean {
  const result = evaluateSwitchBranchGuard(branchId)
  if (!result.ok && process.env.NODE_ENV !== 'production') {
    const activeTenantId = useRbacStore.getState().activeMembership?.tenantId
    const branch = useBranchStore.getState().branches.find((b) => b.id === branchId)
    console.warn('[switch-branch] blocked', {
      reason: result.reason,
      branchId,
      activeTenantId,
      activeMembershipTenantId: activeTenantId,
      requestedBranchTenantId: branch?.tenantId,
      workspacePhase: useConsoleWorkspaceStore.getState().workspacePhase,
      tenantSwitchPending: useConsoleWorkspaceStore.getState()._switching,
    })
  }
  return result.ok
}
