/**
 * Live data without page refreshes.
 *
 * The personal socket sends `data.changed` with topic names. Each topic maps
 * to the queries that show it; pages that do not use react-query listen with
 * `onLiveChange`. The `session` topic re-reads GET /auth/me, so an approved
 * business owner gets the console entry (and a removed one loses it) at once.
 */
import type { QueryClient } from '@tanstack/react-query'
import { useAuthStore, useRbacStore } from '@/stores'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import { authService } from '@/services/auth.service'
import { hasAnyMembership } from '@/services/permission.service'
import { applyTenantSessionRbac } from '@/lib/auth-session-rbac'
import { clearPermissionCache } from '@/lib/permission-cache'

export type LiveTopic = 'session' | 'orders' | 'reservations' | 'wallet' | 'settlement' | 'business_requests'

export const ALL_TOPICS: LiveTopic[] = ['session', 'orders', 'reservations', 'wallet', 'settlement', 'business_requests']

export const TOPIC_QUERY_KEYS: Record<LiveTopic, readonly (readonly string[])[]> = {
  session: [],
  orders: [['orders'], ['order']],
  reservations: [['reservations'], ['admin-reservations'], ['admin-reservation'], ['available-slots']],
  wallet: [['wallet']],
  settlement: [],
  business_requests: [],
}

const EVENT = 'samoon:live-change'

/** Reload something when one of `topics` changes. Returns the unsubscribe function. */
export function onLiveChange(topics: LiveTopic[], handler: () => void): () => void {
  const listener = (e: Event) => {
    const changed = (e as CustomEvent<LiveTopic[]>).detail ?? []
    if (changed.some((t) => topics.includes(t))) handler()
  }
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}

let sessionRefresh: Promise<void> | null = null

/** Re-read who the user is and what they may do. Concurrent calls share one request. */
export function refreshSession(queryClient: QueryClient): Promise<void> {
  sessionRefresh ??= doRefreshSession(queryClient).finally(() => {
    sessionRefresh = null
  })
  return sessionRefresh
}

async function doRefreshSession(queryClient: QueryClient): Promise<void> {
  const before = useAuthStore.getState()
  // A console business / branch switch owns the session while it runs.
  const workspace = useConsoleWorkspaceStore.getState()
  if (!before.isAuthenticated || workspace._switching || workspace.workspacePhase === 'switching_tenant') return
  const data = await authService.getMe()
  const now = useAuthStore.getState()
  // Signed out, or another account signed in, while the request was running.
  if (!now.isAuthenticated || now.user?.id !== data.user.id || useConsoleWorkspaceStore.getState()._switching) return

  clearPermissionCache()
  now.setUser(data.user)
  queryClient.setQueryData(['me'], data)
  const rbac = useRbacStore.getState()
  const ids = (list: { tenantId: string }[] | null | undefined) => (list ?? []).map((m) => m.tenantId).sort().join()
  const businessesChanged = ids(rbac.sessionMemberships) !== ids(data.memberships)
  rbac.setHasTenantMembership(hasAnyMembership(data))
  rbac.setSessionMemberships(data.memberships ?? null, data.activeMembership ?? null)
  if (data.activeMembership?.tenantId) {
    applyTenantSessionRbac(data.activeMembership.tenantId, {
      memberships: data.memberships,
      activeMembership: data.activeMembership,
    })
  }
  if (businessesChanged) {
    // The console workspace is set up once per session; let it run again.
    useConsoleWorkspaceStore.setState({ _bootstrapped: false })
    if (window.location.pathname.startsWith('/console') && data.user.accountType === 'business') {
      await useConsoleWorkspaceStore.getState().initializeFromSession()
    }
  }
}

/** Refetch everything on screen that shows these topics. */
export function applyLiveChange(queryClient: QueryClient, topics: LiveTopic[]): void {
  for (const topic of topics) {
    for (const queryKey of TOPIC_QUERY_KEYS[topic] ?? []) void queryClient.invalidateQueries({ queryKey: [...queryKey] })
  }
  // A failed refresh keeps the current session; the next change or focus retries.
  if (topics.includes('session')) void refreshSession(queryClient).catch(() => undefined)
  window.dispatchEvent(new CustomEvent<LiveTopic[]>(EVENT, { detail: topics }))
}
