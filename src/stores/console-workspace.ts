import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TenantMembership } from '@/types/rbac'
import type { Branch } from '@/types/branch'
import { hasMembershipBranches, resolveConsoleActiveTenantId, resolveConsoleActiveBranch, resolveConsoleDefaultBranch, resolveConsoleDefaultTenantId } from '@/lib/console-workspace'
import { canBootTenantFromMembership, hydrateConsoleTenantFromMembership, ensureFullTenantRecord } from '@/lib/console-membership-hydration'
import { isConsoleMembershipTenantInactive } from '@/lib/console-tenant-access'
import { reconcileConsoleWorkspaceConsistency } from '@/lib/console-workspace-consistency'
import { invalidateTenantLoads, nextBranchSwitchGeneration } from '@/lib/console-workspace-switch'
import { hasAnyMembership, normalizeTenantPermissions } from '@/services/permission.service'
import { featureFlagsService } from '@/services/feature-flags.service'
import { refreshPermissionCache } from '@/lib/permission-cache'
import { authService } from '@/services/auth.service'
import { useTenantStore } from '@/stores/index'
import { useBranchStore } from '@/stores/index'
import { useRbacStore } from '@/stores/index'
import { useDineInStore } from '@/stores/index'
import { useRecentlyViewedStore } from '@/stores/index'
import { setActiveTenantSlugForRequests } from '@/lib/tenant-request-context'

export type ConsoleWorkspacePhase = 'idle' | 'initializing' | 'switching_tenant' | 'switching_branch' | 'ready' | 'error'

export interface ConsoleWorkspaceState {
  /** Persisted Console tenant selection (id, never slug). */
  selectedTenantId: string | null
  workspacePhase: ConsoleWorkspacePhase
  workspaceError: string | null
  /** Guards one-shot boot initialization per session. */
  _bootstrapped: boolean
  /** In-flight tenant switch guard. */
  _switching: boolean

  /** Membership list from GET /auth/me — not duplicated, read-through. */
  getAvailableTenants: () => TenantMembership[]
  getSelectedTenant: () => ReturnType<typeof useTenantStore.getState>['tenant']
  getSelectedBranch: () => Branch | null
  getAvailableBranches: () => Branch[]
  isTenantLoading: () => boolean
  isBranchLoading: () => boolean

  initializeFromSession: () => Promise<void>
  /**
   * Mark tenant switch as pending and discard the previous tenant's branch
   * before the backend switch completes. Cancels in-flight branch switches.
   */
  beginTenantSwitch: (targetTenantId: string) => void
  /** Clear tenant-switch pending state after failure (does not hard-reload). */
  endTenantSwitch: (opts?: { error?: string | null }) => void
  switchTenant: (tenantId: string) => Promise<boolean>
  switchBranch: (branchId: string) => void
  resetWorkspace: () => void
}

const CONSOLE_WORKSPACE_KEY = 'samoon-console-workspace'

function clearTenantScopedClientState() {
  useRbacStore.getState().clearCurrentTenantSession()
  useDineInStore.getState().clearTable()
  useRecentlyViewedStore.getState().clear()
}

/** No resolvable active tenant in session — empty store so the gate can show awaiting_selection. */
function clearConsoleActiveTenantState() {
  clearTenantScopedClientState()
  useBranchStore.getState().resetBranchResolution()
  useTenantStore.setState({
    tenant: null,
    isLoading: false,
    // Paired with a missing activeMembership.tenantId → tenant_awaiting_selection.
    // Must not run when a valid active pointer exists (detail GET failures use loadTenantById).
    tenantState: 'not_found',
    rbacInitialized: false,
    featureFlagsInitialized: false,
    featureFlags: {},
  })
}

async function seedRbacAndRefreshForTenant(tenantId: string): Promise<void> {
  const memberships = useRbacStore.getState().sessionMemberships ?? []
  const membership = memberships.find((m) => m.tenantId === tenantId)
  const { roles, permissions, branchAccess, permissionsSource } = normalizeTenantPermissions(
    membership
      ? { memberships, activeMembership: membership }
      : { memberships, activeMembership: { tenantId, roles: [], branchAccess: { scope: 'selected', branchIds: [] } } },
    tenantId,
  )
  // Real: never seed ROLE_PERMISSION_MAP; keep explicit /auth/me list when present.
  // Mock: role-map (or explicit) remains the session source.
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
  const sessionPermissions = useMock
    ? permissions
    : permissionsSource === 'explicit'
      ? permissions
      : []
  useRbacStore.getState().setCurrentTenantSession(
    tenantId,
    roles,
    sessionPermissions,
    branchAccess,
  )
  if (roles.length > 0) useRbacStore.getState().setTenantRoles(tenantId, roles)
  await refreshPermissionCache({
    tenantId,
    memberships,
    activeMembership: membership ?? { tenantId, roles, branchAccess },
    tenantSlug: membership?.tenantSlug,
    explicitPermissions: permissionsSource === 'explicit' ? permissions : undefined,
  })
}

export const useConsoleWorkspaceStore = create<ConsoleWorkspaceState>()(
  persist(
    (set, get) => ({
      selectedTenantId: null,
      workspacePhase: 'idle',
      workspaceError: null,
      _bootstrapped: false,
      _switching: false,

      getAvailableTenants: () => useRbacStore.getState().sessionMemberships ?? [],
      getSelectedTenant: () => useTenantStore.getState().tenant,
      getSelectedBranch: () => useBranchStore.getState().selectedBranch,
      getAvailableBranches: () => useBranchStore.getState().branches,
      isTenantLoading: () => {
        const phase = get().workspacePhase
        const tenantState = useTenantStore.getState().tenantState
        return phase === 'initializing' || phase === 'switching_tenant' || tenantState === 'loading'
      },
      isBranchLoading: () => {
        const phase = get().workspacePhase
        const branchState = useBranchStore.getState().branchState
        return phase === 'switching_tenant' || phase === 'switching_branch' || branchState === 'loading'
      },

      initializeFromSession: async () => {
        // Allow continuation while switching_tenant (post switchActiveTenant hydrate).
        // Block only unrelated concurrent boots.
        if (get()._bootstrapped) return
        if (get()._switching && get().workspacePhase !== 'switching_tenant' && get().workspacePhase !== 'initializing') {
          return
        }
        const memberships = useRbacStore.getState().sessionMemberships
        if (memberships === null) return

        let activeMembership = useRbacStore.getState().activeMembership
        let targetTenantId = resolveConsoleActiveTenantId(memberships, activeMembership)

        // Sole membership + no backend active tenant → activate that tenant before
        // any branch work. Multi-tenant without a pointer still awaits manual selection.
        if (!targetTenantId && memberships.length === 1) {
          const sole = memberships[0]
          if (isConsoleMembershipTenantInactive(sole)) {
            set({ selectedTenantId: null, workspacePhase: 'ready', workspaceError: null, _bootstrapped: true, _switching: false })
            return
          }
          const soleTenantId = sole.tenantId
          // Blocks branch switches (_switching + switching_tenant) until activation finishes.
          get().beginTenantSwitch(soleTenantId)
          try {
            await authService.switchActiveTenant({ tenantId: soleTenantId })
            const data = await authService.getMe()
            useRbacStore.getState().setHasTenantMembership(hasAnyMembership(data))
            useRbacStore.getState().setSessionMemberships(
              data.memberships !== undefined && data.memberships !== null ? data.memberships : null,
              data.activeMembership ?? null,
            )
            activeMembership = useRbacStore.getState().activeMembership
            targetTenantId = resolveConsoleActiveTenantId(
              useRbacStore.getState().sessionMemberships,
              activeMembership,
            )
            if (!targetTenantId) {
              get().endTenantSwitch({
                error: 'Sole tenant could not be activated as the active session tenant',
              })
              set({ _bootstrapped: false })
              return
            }
          } catch (err) {
            get().endTenantSwitch({
              error: err instanceof Error ? err.message : 'Failed to activate sole tenant',
            })
            set({ _bootstrapped: false })
            return
          }
        }

        if (!targetTenantId) {
          clearConsoleActiveTenantState()
          set({ selectedTenantId: null, workspacePhase: 'ready', workspaceError: null, _bootstrapped: true, _switching: false })
          return
        }

        const currentTenantId = useTenantStore.getState().tenant?.id
        const currentTenantState = useTenantStore.getState().tenantState
        if (currentTenantId === targetTenantId && currentTenantState === 'resolved') {
          await seedRbacAndRefreshForTenant(targetTenantId)
          const branchState = useBranchStore.getState().branchState
          if (branchState === 'ready' || branchState === 'empty') {
            set({ selectedTenantId: targetTenantId, workspacePhase: 'ready', _bootstrapped: true, _switching: false })
            return
          }

          const membership = (useRbacStore.getState().sessionMemberships ?? []).find((m) => m.tenantId === targetTenantId)
          if (hasMembershipBranches(membership)) {
            await useBranchStore.getState().loadBranchesFromMembership(targetTenantId, membership.branches)
          } else {
            await useBranchStore.getState().loadBranchesForTenant(targetTenantId)
          }
          set({ selectedTenantId: targetTenantId, workspacePhase: 'ready', _bootstrapped: true, _switching: false })
          reconcileConsoleWorkspaceConsistency()
          return
        }

        if (get().workspacePhase !== 'switching_tenant') {
          set({ workspacePhase: 'initializing', workspaceError: null })
        }
        const switched = await get().switchTenant(targetTenantId)
        if (switched) {
          set({ _bootstrapped: true, workspacePhase: 'ready', workspaceError: null, _switching: false })
          reconcileConsoleWorkspaceConsistency()
        } else {
          set({
            workspacePhase: 'error',
            workspaceError: 'Failed to synchronize tenant workspace with the active session',
            _bootstrapped: false,
            _switching: false,
          })
        }
      },

      beginTenantSwitch: (targetTenantId: string) => {
        // Cancel in-flight branch switches so a stale Branch A cannot land after Tenant B.
        nextBranchSwitchGeneration()
        invalidateTenantLoads()
        // Discard previous tenant branch immediately — do not keep Branch A selected.
        useBranchStore.getState().resetBranchResolution()
        // Do not send Tenant A's slug while Tenant B's id is already selected.
        setActiveTenantSlugForRequests(undefined)
        set({
          _switching: true,
          workspacePhase: 'switching_tenant',
          workspaceError: null,
          selectedTenantId: targetTenantId,
        })
      },

      endTenantSwitch: (opts) => {
        set({
          _switching: false,
          workspacePhase: opts?.error ? 'error' : 'ready',
          workspaceError: opts?.error ?? null,
        })
      },

      switchTenant: async (tenantId: string): Promise<boolean> => {
        // Allow continuation when beginTenantSwitch already marked _switching.
        const alreadyPending = get()._switching && get().workspacePhase === 'switching_tenant'
        if (get()._switching && !alreadyPending) return false

        const activeTenantId = useRbacStore.getState().activeMembership?.tenantId
        if (!activeTenantId || tenantId !== activeTenantId) return false

        const memberships = useRbacStore.getState().sessionMemberships ?? []
        const membership = memberships.find((m) => m.tenantId === tenantId)
        if (!membership) return false

        const currentTenantId = useTenantStore.getState().tenant?.id
        const currentTenantState = useTenantStore.getState().tenantState
        if (currentTenantId === tenantId && currentTenantState === 'resolved') {
          await seedRbacAndRefreshForTenant(tenantId)
          set({ selectedTenantId: tenantId, workspacePhase: 'ready', _switching: false })
          return true
        }

        // P3 — clear stale tenant record synchronously before any async work
        invalidateTenantLoads()
        useTenantStore.setState({
          tenant: null,
          isLoading: true,
          tenantState: 'loading',
        })
        setActiveTenantSlugForRequests(undefined)

        set({ _switching: true, workspacePhase: 'switching_tenant', workspaceError: null, selectedTenantId: tenantId })

        try {
          clearTenantScopedClientState()
          useBranchStore.getState().resetBranchResolution()

          if (canBootTenantFromMembership(membership)) {
            hydrateConsoleTenantFromMembership(membership)
            void ensureFullTenantRecord(tenantId)
          } else {
            await useTenantStore.getState().loadTenantById(tenantId)
          }

          const tenant = useTenantStore.getState().tenant
          const tenantState = useTenantStore.getState().tenantState
          if (tenantState !== 'resolved' || !tenant || tenant.id !== tenantId) {
            set({
              workspacePhase: 'error',
              workspaceError: `Tenant could not be resolved (${tenantState})`,
            })
            return false
          }

          await seedRbacAndRefreshForTenant(tenantId)
          if (!canBootTenantFromMembership(membership)) {
            useTenantStore.getState().setFeatureFlags(featureFlagsService.resolve(tenant))
            useTenantStore.getState().setFeatureFlagsInitialized(true)
            useTenantStore.getState().setRbacInitialized(true)
          }

          if (hasMembershipBranches(membership)) {
            await useBranchStore.getState().loadBranchesFromMembership(tenantId, membership.branches)
          } else {
            await useBranchStore.getState().loadBranchesForTenant(tenantId)
          }

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('console:tenant-changed', { detail: { tenantId } }))
          }

          set({ workspacePhase: 'ready', workspaceError: null })
          return true
        } catch (err) {
          set({
            workspacePhase: 'error',
            workspaceError: err instanceof Error ? err.message : 'Failed to switch tenant',
          })
          return false
        } finally {
          set({ _switching: false })
        }
      },

      switchBranch: (branchId: string) => {
        // Never apply a branch while the active tenant is changing.
        if (get().workspacePhase === 'switching_tenant' || get()._switching) return

        const branches = useBranchStore.getState().branches
        const activeTenantId = useRbacStore.getState().activeMembership?.tenantId
        const branch = branches.find((b) => b.id === branchId)
        if (!branch) return
        if (activeTenantId && branch.tenantId !== activeTenantId) return
        set({ workspacePhase: 'switching_branch' })
        useBranchStore.getState().selectBranch(branch)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('console:branch-changed', { detail: { branchId } }))
        }
        set({ workspacePhase: 'ready' })
        reconcileConsoleWorkspaceConsistency()
      },

      resetWorkspace: () => {
        set({
          selectedTenantId: null,
          workspacePhase: 'idle',
          workspaceError: null,
          _bootstrapped: false,
          _switching: false,
        })
      },
    }),
    {
      name: CONSOLE_WORKSPACE_KEY,
      version: 2,
      partialize: () => ({}),
    },
  ),
)

export { getTenantDisplayName, membershipLabel } from '@/lib/console-tenant-display'
export { resolveConsoleActiveTenantId, resolveConsoleActiveBranch, resolveConsoleDefaultBranch, resolveConsoleDefaultTenantId }
