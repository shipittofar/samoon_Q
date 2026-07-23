import { useCallback, useState } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { useRbacStore, useTenantStore, useBranchStore } from '@/stores'
import { hasMembershipBranches } from '@/lib/console-workspace'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import { authService } from '@/services/auth.service'
import { hasAnyMembership } from '@/services/permission.service'

/** Branch-scoped query prefixes — keep in sync with hooks/index.ts BRANCH_SCOPED_QUERY_KEYS. */
const BRANCH_SCOPED_QUERY_KEYS = [
  'branch-orders',
  'branch-reservations',
  'branch-analytics',
  'kitchen-status',
  'operations-dashboard',
  'live-orders',
  'live-reservations',
  'admin-branch',
  'admin-branch-metrics',
  'branch-status',
  'staff-presence',
  'sla-alerts',
  'realtime-statistics',
  'operations-stream',
] as const

/** Query-key prefixes invalidated when the Console active tenant changes. */
export const TENANT_SCOPED_QUERY_KEYS = [
  'categories',
  'extra-groups',
  'extras',
  'menu-items',
  'menu-item',
  'featured-items',
  'popular-items',
  'related-items',
  'menu-search',
  'orders',
  'branches',
  'admin-branches',
  'admin-orders',
  'admin-reservations',
  'admin-customers',
  'admin-stats',
  'analytics-summary',
  'analytics-revenue',
  'analytics-reservations',
  'staff',
  'admin-staff',
  'tenants',
  'notifications',
  'promotions',
  'loyalty',
  'vendors',
  'reservations',
  'inventory',
  'settings',
  'feature-flags',
  'configuration',
  ...BRANCH_SCOPED_QUERY_KEYS,
] as const

export function invalidateConsoleWorkspaceQueries(
  qc: QueryClient,
  scope: 'tenant' | 'branch' | 'all',
) {
  if (scope === 'all' || scope === 'tenant') {
    for (const key of TENANT_SCOPED_QUERY_KEYS) {
      qc.invalidateQueries({ queryKey: [key] })
    }
  } else {
    for (const key of BRANCH_SCOPED_QUERY_KEYS) {
      qc.invalidateQueries({ queryKey: [key] })
    }
  }
}

export function clearConsoleWorkspaceQueryCache(qc: QueryClient) {
  qc.clear()
}

/**
 * Re-fetches GET /auth/me, updates session memberships/activeMembership,
 * and re-runs Console workspace initialization (tenant + branches).
 */
export async function refreshConsoleWorkspaceSession(): Promise<void> {
  const data = await authService.getMe()
  useRbacStore.getState().setHasTenantMembership(hasAnyMembership(data))
  useRbacStore.getState().setSessionMemberships(
    data.memberships !== undefined && data.memberships !== null ? data.memberships : null,
    data.activeMembership ?? null,
  )
  useConsoleWorkspaceStore.getState().resetWorkspace()
  await useConsoleWorkspaceStore.getState().initializeFromSession()
}

/** Shared refresh action for no-active-tenant UX (selector + gate). */
export function useConsoleSessionRefresh() {
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await refreshConsoleWorkspaceSession()
    } finally {
      setRefreshing(false)
    }
  }, [refreshing])

  return { refresh, refreshing }
}

/** Single source of truth for Console tenant + branch context. */
export function useConsoleWorkspace() {
  const sessionMemberships = useRbacStore((s) => s.sessionMemberships)
  const activeMembership = useRbacStore((s) => s.activeMembership)
  const activeTenantId = activeMembership?.tenantId
  const workspacePhase = useConsoleWorkspaceStore((s) => s.workspacePhase)
  const workspaceError = useConsoleWorkspaceStore((s) => s.workspaceError)
  const tenant = useTenantStore((s) => s.tenant)
  const tenantState = useTenantStore((s) => s.tenantState)
  const selectedBranch = useBranchStore((s) => s.selectedBranch)
  const branches = useBranchStore((s) => s.branches)
  const branchState = useBranchStore((s) => s.branchState)
  const switchBranch = useConsoleWorkspaceStore((s) => s.switchBranch)

  const activeMembershipRecord = activeTenantId
    ? (sessionMemberships ?? []).find((m) => m.tenantId === activeTenantId)
    : undefined
  const branchesFromMembership = hasMembershipBranches(activeMembershipRecord)
  const resolvedActiveTenant =
    activeTenantId && tenant?.id === activeTenantId ? tenant : null

  return {
    activeTenantId: activeTenantId ?? null,
    selectedTenantId: activeTenantId ?? null,
    selectedBranchId: selectedBranch?.id ?? null,
    selectedTenant: resolvedActiveTenant,
    selectedBranch,
    availableTenants: sessionMemberships ?? [],
    availableBranches: branches,
    branchesSource: branchesFromMembership ? ('membership' as const) : ('api' as const),
    activeMembership,
    activeMembershipRecord,
    tenantLoading:
      tenantState === 'loading' ||
      workspacePhase === 'initializing' ||
      workspacePhase === 'switching_tenant',
    branchLoading: branchState === 'loading' || workspacePhase === 'switching_branch',
    workspacePhase,
    workspaceError,
    switchBranch,
  }
}

export function useConsoleTenantId(): string | undefined {
  const activeTenantId = useRbacStore((s) => s.activeMembership?.tenantId)
  if (!activeTenantId) return undefined
  const tenantId = useTenantStore((s) => s.tenant?.id)
  return tenantId === activeTenantId ? tenantId : activeTenantId
}

export function useConsoleBranchId(): string | undefined {
  return useBranchStore((s) => s.selectedBranch?.id)
}
