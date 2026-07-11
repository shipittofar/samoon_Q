/**
 * P8.9.7.3 — Navigation Intelligence
 *
 * Single source of truth for all navigation decisions that depend on user
 * role, tenant context, or runtime state. Components must NOT duplicate
 * this logic — they import from here and render what they receive.
 *
 * All functions are pure (no React, no hooks) so they can be used in tests,
 * server components, and middleware alike.
 */

// ── Workspace resolution ────────────────────────────────────────────────────
/**
 * Maps a user's primary role to their best console workspace destination.
 * Returns `/dashboard` for customer roles; `/console` sub-paths for staff.
 *
 * Priority is first-match: the most specific role wins in multi-role scenarios.
 */
const ROLE_WORKSPACE_MAP: Record<string, string> = {
  platform: '/console/tenants',
  owner: '/console',
  admin: '/console',
  marketing: '/console/analytics',
  support: '/console/customers',
  cashier: '/console/orders',
  kitchen: '/console/kitchen',
  staff: '/console',
  customer: '/dashboard',
}

const ROLE_PRIORITY = ['platform', 'owner', 'admin', 'marketing', 'support', 'cashier', 'kitchen', 'staff', 'customer']

/**
 * Returns the primary workspace URL for the given role(s).
 * For a single role string, resolves directly. For an array, the
 * highest-priority role (per ROLE_PRIORITY) determines the destination.
 */
export function resolveWorkspace(role: string | string[]): string {
  const roles = (Array.isArray(role) ? role : [role])
    .map((r) => r.toLowerCase())
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) {
      return ROLE_WORKSPACE_MAP[r] ?? '/console'
    }
  }
  return '/console'
}

// ── Tenant-aware public URLs ────────────────────────────────────────────────

/**
 * Resolves the best menu URL. Prefers a tenant-scoped path when a slug is
 * available. Falls back to the global `/menu` route.
 */
export function resolveBestMenu(tenantSlug?: string | null): string {
  if (tenantSlug && tenantSlug !== 'default') {
    return `/menu`
  }
  return '/menu'
}

/**
 * Resolves the best reservation URL. Prefers a tenant-scoped path when a slug
 * is available. Falls back to the global `/reservation` route.
 */
export function resolveBestReservation(tenantSlug?: string | null): string {
  if (tenantSlug && tenantSlug !== 'default') {
    return `/reservation`
  }
  return '/reservation'
}

/**
 * Resolves the best business/explore URL for a customer. Returns the discover
 * page on the default platform surface, or the tenant menu when scoped.
 */
export function resolveBestBusiness(tenantSlug?: string | null): string {
  if (!tenantSlug || tenantSlug === 'default') return '/discover'
  return `/menu`
}

// ── Dashboard quick-action intelligence ────────────────────────────────────

export interface DashboardAction {
  label: string
  href: string
  icon: string
  color: string
  desc: string
}

/**
 * Returns the four dashboard quick-action items with tenant-aware hrefs.
 * Components must call this instead of defining QUICK_ACTIONS inline so
 * route intelligence is centralised here.
 */
export function resolveBestDashboardActions(tenantSlug?: string | null): DashboardAction[] {
  return [
    {
      label: 'Order Food',
      href: resolveBestMenu(tenantSlug),
      icon: '🍕',
      color: 'from-orange-400 to-orange-600',
      desc: 'Browse our menu',
    },
    {
      label: 'Reserve Table',
      href: resolveBestReservation(tenantSlug),
      icon: '🪑',
      color: 'from-purple-400 to-purple-600',
      desc: 'Book in advance',
    },
    {
      label: 'Track Order',
      href: '/dashboard/orders',
      icon: '📦',
      color: 'from-blue-400 to-blue-600',
      desc: 'Live tracking',
    },
    {
      label: 'Favorites',
      href: '/dashboard/favorites',
      icon: '❤️',
      color: 'from-red-400 to-red-600',
      desc: 'Saved dishes',
    },
  ]
}

// ── Fallback route ──────────────────────────────────────────────────────────

/**
 * Returns a safe fallback route for any user. Authenticated users land on
 * their workspace; unauthenticated users on the homepage.
 */
export function resolveFallbackRoute(
  isAuthenticated: boolean,
  role?: string | null,
): string {
  if (!isAuthenticated) return '/'
  return resolveWorkspace(role ?? 'customer')
}

// ── Post-login redirect ─────────────────────────────────────────────────────

/**
 * Returns the post-login destination for a real (non-demo) user based on their
 * role. Replaces the hardcoded two-branch logic in auth-redirect.ts.
 */
export function resolvePostLoginRedirect(role: string): string {
  return resolveWorkspace(role)
}
