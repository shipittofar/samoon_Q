/**
 * P8.9.1 — Post-login redirect destinations.
 *
 * Pure utility — no React, no hooks. Kept separate so redirect logic
 * can be unit-tested without mounting the login page.
 */

import { resolveWorkspace } from '@/utils/navigation-intelligence'
import type { AccountType } from '@/types'
import type { Role } from '@/types/rbac'

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
 * Returns the post-login destination for a real (non-demo) user.
 *
 * Phase 9.3 — no longer keyed off the removed, ambiguous `User.role`.
 * This is a landing-page HINT only, never an authorization decision —
 * AuthGuard's `dashboard:access` permission check is what actually gates
 * Console, regardless of where this function sends someone.
 *
 * Preference order:
 *   1. `tenantRoles` (the current session's tenant-scoped RBAC roles for
 *      the resolved tenant, when available — e.g. `p7Roles` from a
 *      login/verify-otp response) — routes straight to the specific
 *      console workspace those roles imply, exactly as the old
 *      role-based logic did, but keyed off real RBAC data instead of the
 *      coarse global role. A non-empty array here is today's stand-in
 *      for "this user has ≥1 TenantMembership" (see the Phase 9
 *      architecture doc) until a backend sends a real `memberships[]`
 *      list (Phase 9.2's `normalizeTenantPermissions()` already accepts
 *      that shape once one does).
 *   2. `accountType` fallback ('business' → /console, 'customer' →
 *      /dashboard) — used only when no tenant role data is available at
 *      all, e.g. immediately after registration before any tenant role
 *      has been assigned.
 *
 * Phase 2 (RBAC unification) — previously consulted
 * `resolveOwnershipIdentity()` first, routing an eligible Owner/Staff
 * member to `/console` based on client-held ownership data. That was a
 * client-side access-adjacent decision the frontend shouldn't make; it
 * remains gone here.
 */
export function getPostLoginRedirect(accountType: AccountType, tenantRoles?: Role[] | null): string {
  if (tenantRoles && tenantRoles.length > 0) return resolveWorkspace(tenantRoles)
  return accountType === 'business' ? '/console' : '/dashboard'
}
