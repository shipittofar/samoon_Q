import type { User } from '@/types'

/**
 * Account-type gate for the Console route family (/console/*).
 *
 * Distinct from RBAC (`dashboard:access`, tenant memberships): this
 * answers only whether the account's *type* may enter Console at all.
 * Business accounts still require membership, tenant resolution, and
 * permissions downstream; customer accounts are turned away before any
 * of that runs.
 */
export function mayAccessConsoleByAccountType(user: User | null | undefined): boolean {
  if (!user) return true
  return user.accountType === 'business'
}

/** True when the authenticated user is a business account (Console CTA, etc.). */
export function isBusinessAccount(user: User | null | undefined): boolean {
  return user?.accountType === 'business'
}

/**
 * True when global bootstrappers must not run Console-specific work
 * (workspace init, membership-based tenant fallback, console branch load).
 */
export function shouldSkipConsoleRouteWork(
  pathname: string | null | undefined,
  user: User | null | undefined,
): boolean {
  if (!pathname?.startsWith('/console')) return false
  if (!user) return false
  return !mayAccessConsoleByAccountType(user)
}
