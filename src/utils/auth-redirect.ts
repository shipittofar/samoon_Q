/**
 * P8.9.1 — Post-login redirect destinations.
 *
 * Pure utility — no React, no hooks. Kept separate so redirect logic
 * can be unit-tested without mounting the login page.
 */

import { resolveWorkspace } from '@/utils/navigation-intelligence'
import type { AccountType } from '@/types'
import type { Role } from '@/types/rbac'

/** sessionStorage key — survives login → verify → complete-profile without URL params. */
export const INTENDED_AUTH_REDIRECT_KEY = 'samoon-intended-auth-redirect'

/** Auth routes that must never be used as a post-login destination (loop prevention). */
const AUTH_REDIRECT_BLOCKLIST = ['/login', '/verify', '/complete-profile', '/register'] as const

/**
 * Validates an internal post-auth destination. Rejects open redirects and auth-loop paths.
 * Accepts pathname + optional search/hash (e.g. `/checkout?orderType=dine_in&table=3`).
 */
export function sanitizeAuthRedirectPath(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string') return null
  const trimmed = path.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null
  if (trimmed.includes('://')) return null

  const pathnameOnly = trimmed.split('?')[0].split('#')[0]
  for (const blocked of AUTH_REDIRECT_BLOCKLIST) {
    if (pathnameOnly === blocked || pathnameOnly.startsWith(`${blocked}/`)) return null
  }
  return trimmed
}

/**
 * Middleware sends unauthenticated document requests to `/login?redirect=…`.
 * Until AuthBootstrapper finishes GET /auth/me, the login form must not paint:
 * an already-authenticated user would otherwise flash the form, then bounce.
 * Applies to protected prefixes (`/platform-admin`, `/console`, `/dashboard`)
 * — not a Platform Admin special case. Guest checkout uses an in-page AuthModal
 * instead of a middleware bounce to `/login`.
 */
export function shouldHoldLoginFormForSessionRestore(opts: {
  isLoading: boolean
  isAuthenticated: boolean
  redirect: string | null | undefined
}): boolean {
  if (!sanitizeAuthRedirectPath(opts.redirect)) return false
  return opts.isLoading || opts.isAuthenticated
}

/** Persists the route the user intended before authentication (checkout, etc.). */
export function storeIntendedAuthRedirect(path: string): void {
  if (typeof sessionStorage === 'undefined') return
  const safe = sanitizeAuthRedirectPath(path)
  if (safe) sessionStorage.setItem(INTENDED_AUTH_REDIRECT_KEY, safe)
}

/** Reads and clears the stored intended redirect (one-shot). */
export function consumeIntendedAuthRedirect(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  const raw = sessionStorage.getItem(INTENDED_AUTH_REDIRECT_KEY)
  if (!raw) return null
  sessionStorage.removeItem(INTENDED_AUTH_REDIRECT_KEY)
  return sanitizeAuthRedirectPath(raw)
}

/**
 * Post-auth destination: honor a stored/intended route when safe, else account-type default.
 */
export function resolvePostAuthDestination(
  accountType: AccountType,
  tenantRoles?: Role[] | null,
  intendedPath?: string | null,
): string {
  const safe = sanitizeAuthRedirectPath(intendedPath) ?? consumeIntendedAuthRedirect()
  if (safe) return safe
  return getPostLoginRedirect(accountType, tenantRoles)
}

/**
 * Maps demo phone_number (E.164) → email, so the mock OTP flow can resolve
 * the correct user from MOCK_CREDENTIALS after OTP verification.
 */
export const DEMO_PHONE_TO_EMAIL: Record<string, string> = {
  '+14155550101': 'demo@samoon.com',
  '+14155550102': 'staff@samoon.com',
  '+14155550103': 'cashier@samoon.com',
  '+14155550104': 'kitchen@samoon.com',
  '+14155550105': 'marketing@samoon.com',
  '+14155550106': 'support@samoon.com',
  '+14155550107': 'admin@samoon.com',
  '+14155550108': 'owner@samoon.com',
  '+14155550109': 'platform@samoon.com',
  '+14155550110': 'multirole@samoon.com',
  // Phase 1 — service vertical demo owners
  '+14155550111': 'salon@samoon.com',
  '+14155550112': 'clinic@samoon.com',
}

/** Maps demo account email → the frontend route the user should land on after login. */
export const DEMO_EMAIL_REDIRECTS: Record<string, string> = {
  'demo@samoon.com':      '/dashboard',
  'staff@samoon.com':     '/console/orders',
  'cashier@samoon.com':   '/console/orders',
  'kitchen@samoon.com':   '/console/kitchen',
  'marketing@samoon.com': '/console/analytics',
  'support@samoon.com':   '/console/customers',
  'admin@samoon.com':     '/console',
  'owner@samoon.com':     '/console',
  'platform@samoon.com':  '/console/tenants',
  'multirole@samoon.com': '/console/orders',
  'salon@samoon.com':     '/console',
  'clinic@samoon.com':    '/console',
}

/**
 * Returns the post-login destination for a demo account email.
 * Falls back to /console for any unmapped email.
 */
export function getDemoRedirect(email: string): string {
  return DEMO_EMAIL_REDIRECTS[email] ?? '/console'
}

/**
 * Returns the post-login destination for a real (non-demo) user.
 *
 * Phase 9.3 — no longer keyed off the removed, ambiguous `User.role`.
 * This is a landing-page HINT only, never an authorization decision —
 * AuthGuard's `dashboard:access` permission check is what actually gates
 * Console, regardless of where this function sends someone. A `business`
 * account routed here with no permission on its tenant still lands on
 * `/console` and sees AccessDenied there — that is correct, not a bug
 * this function is responsible for preventing.
 *
 * Phase Z.9 — `accountType` is now the AUTHORITATIVE gate on the initial
 * *direction* (Console vs. the customer dashboard), not a fallback that
 * only applies when `tenantRoles` happens to be empty. Previously
 * `tenantRoles` was checked FIRST and could override `accountType` in
 * either direction — in particular, `getPostLoginRedirect('customer',
 * ['owner'])` resolved to `/console`, a `customer` account landing on
 * Console purely because some tenant-scoped role data was present. That
 * is no longer correct: `customer` must always land on `/dashboard`,
 * full stop, regardless of what `tenantRoles` says. `tenantRoles` is
 * still consulted, but only to refine WHICH `/console/*` sub-page a
 * `business` account lands on (e.g. straight to `/console/orders` for a
 * cashier) — it can never route a `business` account anywhere outside
 * Console, and can never apply to a `customer` account at all. `Role`
 * (the tenant-role union — src/types/rbac.ts) has no `'customer'` member,
 * so `resolveWorkspace()` can never resolve a `business` account back out
 * to `/dashboard` via a stray role value either.
 */
export function getPostLoginRedirect(accountType: AccountType, tenantRoles?: Role[] | null): string {
  if (accountType === 'business') {
    if (tenantRoles && tenantRoles.length > 0) return resolveWorkspace(tenantRoles)
    return '/console'
  }
  return '/dashboard'
}
