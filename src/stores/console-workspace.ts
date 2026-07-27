import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TenantMembership } from '@/types/rbac'
import type { Branch } from '@/types/branch'
import { hasMembershipBranches, membershipLabel, resolveConsoleActiveTenantId, resolveConsoleDefaultBranch, resolveConsoleDefaultTenantId } from '@/lib/console-workspace'
import { normalizeTenantPermissions } from '@/services/permission.service'
import { featureFlagsService } from '@/services/feature-flags.service'
import { useTenantStore } from '@/stores/index'
import { useBranchStore } from '@/stores/index'
import { useRbacStore } from '@/stores/index'
import { useCartStore } from '@/stores/index'
import { useDineInStore } from '@/stores/index'
import { useFavoritesStore } from '@/stores/index'
import { useRecentlyViewedStore } from '@/stores/index'

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
  switchTenant: (tenantId: string) => Promise<void>
  switchBranch: (branchId: string) => void
  resetWorkspace: () => void
}

const CONSOLE_WORKSPACE_KEY = 'samoon-console-workspace'

function clearTenantScopedClientState() {
  useRbacStore.getState().clearCurrentTenantSession()
  useCartStore.getState().clearCart()
  useDineInStore.getState().clearTable()
  useFavoritesStore.getState().setFavorites([])
  useRecentlyViewedStore.getState().clear()
}

function clearConsoleActiveTenantState() {
  clearTenantScopedClientState()
  useBranchStore.getState().resetBranchResolution()
  useTenantStore.setState({
    tenant: null,
    isLoading: false,
    tenantState: 'not_found',
    rbacInitialized: false,
    featureFlagsInitialized: false,
    featureFlags: {},
  })
}

function seedRbacForTenant(tenantId: string) {
  const memberships = useRbacStore.getState().sessionMemberships ?? []
  const membership = memberships.find((m) => m.tenantId === tenantId)
  const { roles, permissions, branchAccess } = normalizeTenantPermissions(
    membership
      ? { memberships, activeMembership: membership }
      : { memberships, activeMembership: { tenantId, roles: [], branchAccess: { scope: 'selected', branchIds: [] } } },
    tenantId,
  )
  useRbacStore.getState().setCurrentTenantSession(tenantId, roles, permissions, branchAccess)
  if (roles.length > 0) useRbacStore.getState().setTenantRoles(tenantId, roles)
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
        if (get()._bootstrapped || get()._switching) return
        const memberships = useRbacStore.getState().sessionMemberships
        if (memberships === null) return

        const activeMembership = useRbacStore.getState().activeMembership
        const targetTenantId = resolveConsoleActiveTenantId(memberships, activeMembership)
        if (!targetTenantId) {
          clearConsoleActiveTenantState()
          set({ selectedTenantId: null, workspacePhase: 'ready', workspaceError: null, _bootstrapped: true })
          return
        }

        const currentTenantId = useTenantStore.getState().tenant?.id
        if (currentTenantId === targetTenantId && useTenantStore.getState().tenantState === 'resolved') {
          set({ selectedTenantId: targetTenantId, workspacePhase: 'ready', _bootstrapped: true })
          return
        }

        set({ workspacePhase: 'initializing', workspaceError: null })
        try {
          await get().switchTenant(targetTenantId)
          set({ _bootstrapped: true, workspacePhase: 'ready', workspaceError: null })
        } catch (err) {
          set({
            workspacePhase: 'error',
            workspaceError: err instanceof Error ? err.message : 'Failed to initialize Console workspace',
            _bootstrapped: true,
          })
        }
      },

      switchTenant: async (tenantId: string) => {
        if (get()._switching) return

        const activeTenantId = useRbacStore.getState().activeMembership?.tenantId
        if (!activeTenantId || tenantId !== activeTenantId) return

        const memberships = useRbacStore.getState().sessionMemberships ?? []
        const membership = memberships.find((m) => m.tenantId === tenantId)
        if (!membership) return

        const currentTenantId = useTenantStore.getState().tenant?.id
        if (currentTenantId === tenantId && useTenantStore.getState().tenantState === 'resolved') {
          set({ selectedTenantId: tenantId, workspacePhase: 'ready' })
          return
        }

        set({ _switching: true, workspacePhase: 'switching_tenant', workspaceError: null, selectedTenantId: tenantId })

        try {
          clearTenantScopedClientState()
          useBranchStore.getState().resetBranchResolution()

          await useTenantStore.getState().loadTenantById(tenantId)

          const tenant = useTenantStore.getState().tenant
          const tenantState = useTenantStore.getState().tenantState
          if (tenantState !== 'resolved' || !tenant) {
            set({
              workspacePhase: 'error',
              workspaceError: `Tenant could not be resolved (${tenantState})`,
            })
            return
          }

          seedRbacForTenant(tenantId)
          useTenantStore.getState().setFeatureFlags(featureFlagsService.resolve(tenant))
          useTenantStore.getState().setFeatureFlagsInitialized(true)
          useTenantStore.getState().setRbacInitialized(true)

          if (hasMembershipBranches(membership)) {
            await useBranchStore.getState().loadBranchesFromMembership(tenantId, membership.branches)
          } else {
            await useBranchStore.getState().loadBranchesForTenant(tenantId)
          }

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('console:tenant-changed', { detail: { tenantId } }))
          }

          set({ workspacePhase: 'ready', workspaceError: null })
        } catch (err) {
          set({
            workspacePhase: 'error',
            workspaceError: err instanceof Error ? err.message : 'Failed to switch tenant',
          })
          throw err
        } finally {
          set({ _switching: false })
        }
      },

      switchBranch: (branchId: string) => {
        const branches = useBranchStore.getState().branches
        const branch = branches.find((b) => b.id === branchId)
        if (!branch) return
        set({ workspacePhase: 'switching_branch' })
        useBranchStore.getState().selectBranch(branch)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('console:branch-changed', { detail: { branchId } }))
        }
        set({ workspacePhase: 'ready' })
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

export { membershipLabel, resolveConsoleActiveTenantId, resolveConsoleDefaultBranch, resolveConsoleDefaultTenantId }
