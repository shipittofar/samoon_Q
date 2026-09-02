/**
 * Targeted Tenant/Branch frontend synchronization.
 * Query keys here are the ones the UI actually reads — not a global cache wipe.
 */
import type { QueryClient } from '@tanstack/react-query'
import { PUBLIC_TENANTS_QUERY_KEY } from '@/lib/public-tenant-resolution'
import * as consoleWorkspace from '@/hooks/console-workspace'
import { useBranchStore, useTenantStore } from '@/stores'
import type { Tenant } from '@/types'
import type { Branch as AdminBranch } from '@/types/branch'

export type TenantSyncScope = {
  /** Membership / tenant switcher (`useMe` + GET /auth/me workspace). */
  session?: boolean
  discover?: boolean
  publicTenants?: boolean
  featureFlags?: boolean
  templates?: boolean
}

export function applyCurrentTenant(tenant: Tenant): void {
  const store = useTenantStore.getState()
  if (store.tenant?.id !== tenant.id) return
  store.applyResolvedTenant(tenant)
}

export function invalidateTenantQueryConsumers(
  qc: QueryClient,
  scope: TenantSyncScope = {},
  tenant?: Tenant,
): void {
  const {
    session = false,
    discover = true,
    publicTenants = true,
    featureFlags = false,
    templates = false,
  } = scope

  qc.invalidateQueries({ queryKey: ['tenant'] })
  qc.invalidateQueries({ queryKey: ['tenants'] })
  qc.invalidateQueries({ queryKey: ['console-tenants'] })
  qc.invalidateQueries({ queryKey: ['console-platform-tenants'] })

  if (discover) {
    qc.invalidateQueries({ queryKey: ['public-discover'] })
  }
  if (publicTenants) {
    qc.invalidateQueries({ queryKey: PUBLIC_TENANTS_QUERY_KEY })
  }
  if (featureFlags) {
    qc.invalidateQueries({ queryKey: ['feature-flags'] })
  }
  if (templates) {
    qc.invalidateQueries({ queryKey: ['tenant-templates'] })
  }
  if (session) {
    qc.invalidateQueries({ queryKey: ['me'] })
  }
  if (tenant?.slug) {
    qc.invalidateQueries({ queryKey: ['public-tenant', tenant.slug] })
  }
}

/**
 * Authoritative Tenant object (when the mutation returned one) updates the
 * current store; query consumers are invalidated so lists refetch.
 */
export async function synchronizeTenantMutation(
  qc: QueryClient,
  tenant: Tenant | undefined,
  scope: TenantSyncScope = {},
): Promise<void> {
  if (tenant) {
    applyCurrentTenant(tenant)
    qc.setQueryData(['tenant', tenant.id], tenant)
  }
  invalidateTenantQueryConsumers(qc, scope, tenant)
  if (scope.session) {
    await consoleWorkspace.refreshConsoleWorkspaceSession()
  }
}

export function invalidateBranchQueryConsumers(
  qc: QueryClient,
  tenantId: string,
  branchId?: string,
): void {
  if (branchId) {
    qc.invalidateQueries({ queryKey: ['admin-branch', tenantId, branchId] })
    qc.invalidateQueries({ queryKey: ['public-branch', tenantId, branchId] })
  }
  qc.invalidateQueries({ queryKey: ['admin-branches'] })
  qc.invalidateQueries({ queryKey: ['public-branches', tenantId] })
  qc.invalidateQueries({ queryKey: ['storefront-branches', tenantId] })
  qc.invalidateQueries({ queryKey: ['branches', tenantId] })
  qc.invalidateQueries({ queryKey: ['public-discover'] })
}

export function applyBranchToStore(branch: AdminBranch): void {
  useBranchStore.getState().applyBranchMutationResult(branch)
}

export function applyBranchRemovedFromStore(tenantId: string, branchId: string): void {
  useBranchStore.getState().applyBranchDeleted(tenantId, branchId)
}

export function synchronizeBranchMutation(
  qc: QueryClient,
  tenantId: string,
  branch: AdminBranch | undefined,
): void {
  if (branch) {
    qc.setQueryData(['admin-branch', tenantId, branch.id], branch)
    applyBranchToStore(branch)
  }
  invalidateBranchQueryConsumers(qc, tenantId, branch?.id)
}

export function synchronizeBranchDeleted(
  qc: QueryClient,
  tenantId: string,
  branchId: string,
): void {
  applyBranchRemovedFromStore(tenantId, branchId)
  qc.removeQueries({ queryKey: ['admin-branch', tenantId, branchId] })
  invalidateBranchQueryConsumers(qc, tenantId, branchId)
}
