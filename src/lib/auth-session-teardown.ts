/**
 * Authentication-boundary teardown for logout / session invalidation.
 *
 * A newly authenticated user must never inherit the previous user's
 * tenant/branch/workspace/request-context state. Hard reload must not be required.
 */
import type { QueryClient } from '@tanstack/react-query'
import {
  useAuthStore,
  useTenantStore,
  useRbacStore,
  useBranchStore,
  useDineInStore,
  useRecentlyViewedStore,
} from '@/stores'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import { clearPermissionCache } from '@/lib/permission-cache'
import { applyPlatformRoleFromSession } from '@/platform-admin/store'
import { setActiveTenantSlugForRequests } from '@/lib/tenant-request-context'
import {
  invalidateTenantLoads,
  nextBranchSwitchGeneration,
} from '@/lib/console-workspace-switch'
import { clearSentryUser } from '@/lib/sentry'
import { clearTokens } from '@/services/axios.instance'

export interface ClearAuthenticatedClientStateOptions {
  /**
   * When true (default), clear JWT tokens and Sentry user.
   * Set false only when the caller already cleared credentials and only needs
   * in-memory store/cache teardown (rare).
   */
  clearCredentials?: boolean
  queryClient?: QueryClient
}

/**
 * Full authenticated-client teardown shared by useLogout and AuthBootstrapper
 * clearSession. Does not hard-reload and does not clear the guest cart.
 */
export function clearAuthenticatedClientState(
  options: ClearAuthenticatedClientStateOptions = {},
): void {
  const { clearCredentials = true, queryClient } = options

  useAuthStore.getState().logout()
  applyPlatformRoleFromSession(null)
  clearSentryUser()

  if (clearCredentials) {
    clearTokens()
  }

  // Invalidate in-flight tenant/branch loads so User A responses cannot
  // write back after User B has started a new session.
  invalidateTenantLoads()
  nextBranchSwitchGeneration()

  useRbacStore.getState()._resetStore()
  useConsoleWorkspaceStore.getState().resetWorkspace()

  // Console admin branch resolution
  useBranchStore.getState().resetBranchResolution()
  // Storefront activeBranch is persisted separately and must not survive logout
  useBranchStore.setState({ activeBranch: null })

  // In-memory tenant record + outbound X-Tenant-Slug — the primary survivors
  // that caused User B to inherit User A's workspace until hard refresh.
  useTenantStore.getState().reset()
  setActiveTenantSlugForRequests(undefined)

  clearPermissionCache()
  useDineInStore.getState().clearTable()
  useRecentlyViewedStore.getState().clear()

  queryClient?.clear()
}
