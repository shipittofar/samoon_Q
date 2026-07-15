/**
 * P8.9.1 — Post-login redirect destinations.
 *
 * Pure utility — no React, no hooks. Kept separate so redirect logic
 * can be unit-tested without mounting the login page.
 */

import { resolveWorkspace } from '@/utils/navigation-intelligence'
import { resolveOwnershipIdentity } from '@/services/ownership-resolution.service'

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
}

/**
 * Returns the post-login destination for a demo account email.
 * Falls back to /console for any unmapped email.
 */
export function getDemoRedirect(email: string): string {
  return DEMO_EMAIL_REDIRECTS[email] ?? '/console'
}

/**
 * Returns the post-login destination for a real (non-demo) user based on
 * their role. Customer → /dashboard; staff roles → /console (or
 * role-specific sub-path).
 *
 * P10.3 Phase H — when `email` is available, the destination is first
 * checked against `resolveOwnershipIdentity()` so routing reflects real
 * ownership data rather than only the caller-supplied role string (a
 * role string can be stale/legacy while the ownership model is
 * authoritative — same precedent as `useHasDashboardAccess()` in
 * hooks/index.ts). An eligible Owner or Staff member both currently
 * resolve to `/console` — the same destination `resolveWorkspace('owner'
 * | 'staff')` already gives — because no tenant-selector page exists yet
 * to route an Owner of multiple tenants anywhere else; that case is
 * deliberately deferred (see docs/P10.3_IMPLEMENTATION.md) rather than
 * fabricated. No `email` or no ownership match falls through to the
 * original `resolveWorkspace(role)` behavior unchanged.
 */
export function getPostLoginRedirect(role: string, email?: string | null): string {
  if (email) {
    const identity = resolveOwnershipIdentity(email)
    if (identity.owner || identity.staffMember) {
      return '/console'
    }
  }
  return resolveWorkspace(role)
}
