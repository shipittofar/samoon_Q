import { useCallback, useState, useRef, useEffect } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { useRbacStore, useTenantStore, useBranchStore } from '@/stores'
import { hasMembershipBranches, isConsoleSelectorsReady } from '@/lib/console-workspace'
import { getTenantDisplayName } from '@/lib/console-tenant-display'
import { reconcileConsoleWorkspaceConsistency, parseConsoleBranchIdFromPath } from '@/lib/console-workspace-consistency'
import {
  isCurrentBranchSwitch,
  isCurrentTenantSwitch,
  nextBranchSwitchGeneration,
  nextTenantSwitchGeneration,
} from '@/lib/console-workspace-switch'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import { authService, writeMockMembershipCache } from '@/services/auth.service'
import type { GetMeResponse } from '@/services/auth.service'
import { hasAnyMembership } from '@/services/permission.service'
import { applyTenantSessionRbac } from '@/lib/auth-session-rbac'
import { clearPermissionCache } from '@/lib/permission-cache'
import { assertCanSubmitConsoleBranchSwitch } from '@/lib/console-branch-switch-guard'
import { isConsoleMembershipTenantInactive } from '@/lib/console-tenant-access'

/** Branch-scoped query prefixes — keep in sync with hooks/index.ts BRANCH_SCOPED_QUERY_KEYS. */
const BRANCH_SCOPED_QUERY_KEYS = [
  'admin-customers',
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
  'pending-orders-count',
  'pending-reservations-count',
] as const

/** Query-key prefixes invalidated when the Console active tenant changes. */
export const TENANT_SCOPED_QUERY_KEYS = [
  'categories',
  'extra-groups',
  'console-extra-groups',
  'console-extras',
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
export async function refreshConsoleWorkspaceSession(generation?: number): Promise<void> {
  if (generation !== undefined && !isCurrentTenantSwitch(generation)) return
  clearPermissionCache()
  const data = await authService.getMe()
  if (generation !== undefined && !isCurrentTenantSwitch(generation)) return

  useRbacStore.getState().setHasTenantMembership(hasAnyMembership(data))
  useRbacStore.getState().setSessionMemberships(
    data.memberships !== undefined && data.memberships !== null ? data.memberships : null,
    data.activeMembership ?? null,
  )

  const tenantId = data.activeMembership?.tenantId ?? data.memberships?.[0]?.tenantId
  if (tenantId) {
    applyTenantSessionRbac(tenantId, {
      memberships: data.memberships,
      activeMembership: data.activeMembership,
    })
  }

  // Do NOT resetWorkspace() here — that cleared switching_tenant and opened a
  // window where switch-branch could run with Tenant B active + Branch A pending.
  const prior = useConsoleWorkspaceStore.getState()
  const keepTenantSwitchPending =
    generation !== undefined ||
    prior._switching ||
    prior.workspacePhase === 'switching_tenant'

  useConsoleWorkspaceStore.setState({
    _bootstrapped: false,
    _switching: keepTenantSwitchPending ? true : prior._switching,
    workspacePhase: keepTenantSwitchPending ? 'switching_tenant' : 'initializing',
    workspaceError: null,
    selectedTenantId: prior.selectedTenantId ?? tenantId ?? null,
  })

  await useConsoleWorkspaceStore.getState().initializeFromSession()
  if (generation !== undefined && !isCurrentTenantSwitch(generation)) return
  reconcileConsoleWorkspaceConsistency()
}

function resolveConsoleActiveBranchId(
  data: GetMeResponse,
  fallbackBranchId?: string,
): string | null {
  if (data.activeMembership?.branchId) return data.activeMembership.branchId
  if (fallbackBranchId) return fallbackBranchId
  return null
}

/**
 * Re-fetches GET /auth/me and applies the backend's active branch pointer
 * to the Console workspace (selectedBranch in useBranchStore).
 */
export async function refreshConsoleBranchSession(
  fallbackBranchId?: string,
  generation?: number,
): Promise<void> {
  if (generation !== undefined && !isCurrentBranchSwitch(generation)) return
  const data = await authService.getMe()
  if (generation !== undefined && !isCurrentBranchSwitch(generation)) return

  useRbacStore.getState().setHasTenantMembership(hasAnyMembership(data))
  useRbacStore.getState().setSessionMemberships(
    data.memberships !== undefined && data.memberships !== null ? data.memberships : null,
    data.activeMembership ?? null,
  )

  const resolvedBranchId = resolveConsoleActiveBranchId(data, fallbackBranchId)
  if (!resolvedBranchId) {
    reconcileConsoleWorkspaceConsistency()
    return
  }

  const activeTenantId = data.activeMembership?.tenantId
  if (activeTenantId) {
    const branchState = useBranchStore.getState().branchState
    const hasBranch = useBranchStore.getState().branches.some((b) => b.id === resolvedBranchId)
    if (!hasBranch && branchState !== 'loading') {
      const membership = data.memberships?.find((m) => m.tenantId === activeTenantId)
      if (hasMembershipBranches(membership)) {
        await useBranchStore.getState().loadBranchesFromMembership(activeTenantId, membership.branches)
      } else {
        await useBranchStore.getState().loadBranchesForTenant(activeTenantId)
      }
    }
  }

  if (generation !== undefined && !isCurrentBranchSwitch(generation)) return

  useConsoleWorkspaceStore.getState().switchBranch(resolvedBranchId)
  reconcileConsoleWorkspaceConsistency()
}

/**
 * Requests a backend tenant switch, then refreshes /auth/me so
 * activeMembership remains the sole source of truth for workspace boot.
 */
export async function requestConsoleTenantSwitch(tenantId: string): Promise<void> {
  const activeTenantId = useRbacStore.getState().activeMembership?.tenantId
  if (activeTenantId === tenantId) return

  const memberships = useRbacStore.getState().sessionMemberships ?? []
  const membership = memberships.find((m) => m.tenantId === tenantId)
  if (!membership) return
  const loaded = useTenantStore.getState().tenant
  if (isConsoleMembershipTenantInactive(membership, loaded?.id === tenantId ? loaded : null)) {
    return
  }

  const generation = nextTenantSwitchGeneration()

  writeMockMembershipCache(memberships)

  // Mark pending + discard Branch A before the backend tenant pointer moves.
  useConsoleWorkspaceStore.getState().beginTenantSwitch(tenantId)

  try {
    await authService.switchActiveTenant({
      tenantId,
    })
    if (!isCurrentTenantSwitch(generation)) return

    await refreshConsoleWorkspaceSession(generation)
    if (!isCurrentTenantSwitch(generation)) return

    reconcileConsoleWorkspaceConsistency()
  } catch (err) {
    if (isCurrentTenantSwitch(generation)) {
      useConsoleWorkspaceStore.getState().endTenantSwitch({
        error: err instanceof Error ? err.message : 'Failed to switch tenant',
      })
      // Restore workspace from the still-active session tenant (no hard reload).
      try {
        useConsoleWorkspaceStore.getState().resetWorkspace()
        await useConsoleWorkspaceStore.getState().initializeFromSession()
      } catch {
        /* keep error phase from endTenantSwitch / initialize */
      }
    }
    throw err
  }
}

/**
 * True when a Console tenant switch is in progress — branch switches must not run.
 */
export function isConsoleTenantSwitchPending(): boolean {
  const { workspacePhase, _switching } = useConsoleWorkspaceStore.getState()
  return _switching || workspacePhase === 'switching_tenant'
}

/**
 * Requests a backend branch switch, then refreshes /auth/me so
 * activeMembership.branchId remains the sole source of truth for branch context.
 *
 * Invariant: branch.tenantId === activeTenant.id at the moment switch-branch is called.
 * Enforced here and again inside authService.switchActiveBranch immediately before POST.
 */
export async function requestConsoleBranchSwitch(branchId: string): Promise<void> {
  const currentBranchId = useBranchStore.getState().selectedBranch?.id
  if (currentBranchId === branchId) return

  if (!assertCanSubmitConsoleBranchSwitch(branchId)) return

  const expectedTenantId = useRbacStore.getState().activeMembership?.tenantId
  const generation = nextBranchSwitchGeneration()

  // Final pre-flight immediately before handing off to the API layer.
  if (!assertCanSubmitConsoleBranchSwitch(branchId)) return
  if (useRbacStore.getState().activeMembership?.tenantId !== expectedTenantId) return

  await authService.switchActiveBranch({ branchId })
  if (!isCurrentBranchSwitch(generation)) return
  if (isConsoleTenantSwitchPending()) return
  if (useRbacStore.getState().activeMembership?.tenantId !== expectedTenantId) return

  await refreshConsoleBranchSession(branchId, generation)
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

/** Tenant switch orchestration for AdminTenantSwitcher — last click wins. */
export function useConsoleTenantSwitch() {
  const [switchingToTenantId, setSwitchingToTenantId] = useState<string | null>(null)
  const latestTenantIdRef = useRef<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const switchTenant = useCallback(async (tenantId: string) => {
    latestTenantIdRef.current = tenantId
    setSwitchingToTenantId(tenantId)
    try {
      await requestConsoleTenantSwitch(tenantId)
    } finally {
      if (mountedRef.current && latestTenantIdRef.current === tenantId) {
        setSwitchingToTenantId(null)
      }
    }
  }, [])

  return {
    switchTenant,
    switchingToTenantId,
    switching: switchingToTenantId !== null,
  }
}

/** Branch switch orchestration for AdminBranchSwitcher — last click wins. */
export function useConsoleBranchSwitch() {
  const [switchingToBranchId, setSwitchingToBranchId] = useState<string | null>(null)
  const latestBranchIdRef = useRef<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const switchBranch = useCallback(async (branchId: string) => {
    if (isConsoleTenantSwitchPending()) return
    latestBranchIdRef.current = branchId
    setSwitchingToBranchId(branchId)
    try {
      await requestConsoleBranchSwitch(branchId)
    } finally {
      if (mountedRef.current && latestBranchIdRef.current === branchId) {
        setSwitchingToBranchId(null)
      }
    }
  }, [])

  return {
    switchBranch,
    switchingToBranchId,
    switching: switchingToBranchId !== null,
  }
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
    tenantDisplayName: activeTenantId
      ? getTenantDisplayName(activeTenantId, {
          memberships: sessionMemberships,
          loadedTenant: resolvedActiveTenant,
        })
      : '',
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
    branchLoading:
      branchState === 'loading' ||
      workspacePhase === 'switching_branch' ||
      workspacePhase === 'switching_tenant',
    tenantSwitching: workspacePhase === 'switching_tenant',
    workspacePhase,
    workspaceError,
    switchBranch,
  }
}

/** Whether both Console selectors may render (not skeleton). */
export function useConsoleSelectorsReady(): boolean {
  const sessionMemberships = useRbacStore((s) => s.sessionMemberships)
  const activeTenantId = useRbacStore((s) => s.activeMembership?.tenantId)
  const workspacePhase = useConsoleWorkspaceStore((s) => s.workspacePhase)
  const tenantState = useTenantStore((s) => s.tenantState)
  const branchState = useBranchStore((s) => s.branchState)

  return isConsoleSelectorsReady({
    sessionMemberships,
    workspacePhase,
    tenantState,
    branchState,
    activeTenantId,
  })
}

/** Console API scope — always from GET /auth/me activeMembership, never the tenant record. */
export function useConsoleTenantId(): string | undefined {
  return useRbacStore((s) => s.activeMembership?.tenantId)
}

export function useConsoleBranchId(): string | undefined {
  return useBranchStore((s) => s.selectedBranch?.id)
}

/**
 * When a console route embeds a branch id (`/console/branches/:id`), align
 * session + store + selector with that branch.
 */
export async function syncConsoleBranchFromRoute(pathname: string | null | undefined): Promise<void> {
  if (isConsoleTenantSwitchPending()) return

  const branchId = parseConsoleBranchIdFromPath(pathname)
  if (!branchId) return

  const activeTenantId = useRbacStore.getState().activeMembership?.tenantId
  if (!activeTenantId) return

  const selectedBranchId = useBranchStore.getState().selectedBranch?.id
  if (selectedBranchId === branchId) return

  // URL may still contain Tenant A's branch after switching to Tenant B — never POST it.
  if (!assertCanSubmitConsoleBranchSwitch(branchId)) return

  await requestConsoleBranchSwitch(branchId)
}
