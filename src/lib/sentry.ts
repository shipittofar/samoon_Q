/**
 * Sentry integration — Phase 3 (P3.11) / Phase 4.6 (P4.6.1–P4.6.4)
 *
 * This module provides a safe wrapper around the Sentry SDK.
 * Error reporting is only activated when NEXT_PUBLIC_SENTRY_DSN is set,
 * preventing accidental telemetry in development or staging environments
 * that have no DSN configured.
 *
 * Sentry is initialized in sentry.client.config.ts (browser) and
 * sentry.server.config.ts (Node). This module exposes the capture helper
 * used by ErrorBoundary and other error handling sites so callers never
 * import from @sentry/nextjs directly.
 *
 * Setup:
 *   1. Set NEXT_PUBLIC_SENTRY_DSN in .env.local (browser-visible)
 *   2. Set SENTRY_DSN in .env.local (server-side, for source map upload)
 *   3. Telemetry begins automatically once the DSN is present.
 *   4. To disable telemetry in production, unset or empty the DSN.
 *
 * P4.6 additions:
 *   setSentryUser    — P4.6.1: set user context (id, role, tenant, email)
 *   clearSentryUser  — P4.6.1: remove user context on logout
 *   setSentryTenant  — P4.6.3: tag events with tenant.slug
 *   setEnvironmentTags — P4.6.4: tag environment + release (called once at init)
 */

import * as SentrySDK from '@sentry/nextjs'
import { VERSION } from '@/lib/version'

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

/** True when a Sentry DSN is configured and telemetry is active. */
export const sentryEnabled = Boolean(DSN)

/**
 * Capture an exception in Sentry.
 * No-ops silently when Sentry is not configured (DSN absent).
 *
 * @example
 * captureException(error, { feature: 'CartDrawer' })
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!sentryEnabled) return
  try {
    SentrySDK.captureException(error, { extra: context })
  } catch {
    // Never throw from error reporting
  }
}

/**
 * P4.6.1 — Set user context for subsequent Sentry events.
 *
 * Only forwards id, accountType, tenant, and email — never tokens or
 * passwords. Call after successful authentication.
 * Safe no-op when DSN is not configured.
 *
 * Phase 9.3 — `accountType` (renamed from the removed, ambiguous
 * `User.role`) is telemetry metadata only, exactly as `role` was before
 * — it has no bearing on any authorization decision.
 */
export function setSentryUser(
  user: { id: string; email?: string | null; accountType?: string; tenant?: string } | null,
): void {
  if (!sentryEnabled) return
  try {
    if (!user) {
      SentrySDK.setUser(null)
      return
    }
    SentrySDK.setUser({
      id: user.id,
      ...(user.email ? { email: user.email } : {}),
      ...(user.accountType ? { accountType: user.accountType } : {}),
      ...(user.tenant ? { tenant: user.tenant } : {}),
    })
  } catch {
    // Never throw from telemetry helpers
  }
}

/**
 * P4.6.1 — Remove user context from Sentry (call on logout).
 * Safe no-op when DSN is not configured.
 */
export function clearSentryUser(): void {
  if (!sentryEnabled) return
  try {
    SentrySDK.setUser(null)
  } catch {
    // Never throw from telemetry helpers
  }
}

/**
 * P4.6.3 — Tag Sentry events with the active tenant slug.
 *
 * Updates automatically when tenant changes. Safe no-op without DSN.
 */
export function setSentryTenant(tenantSlug: string): void {
  if (!sentryEnabled) return
  try {
    SentrySDK.setTag('tenant.slug', tenantSlug)
  } catch {
    // Never throw from telemetry helpers
  }
}

/**
 * P4.6.4 — Apply environment and release tags to all Sentry events.
 *
 * Reuses the VERSION constant (P4.3.4) — no second version source.
 * Safe no-op without DSN.
 */
export function setEnvironmentTags(): void {
  if (!sentryEnabled) return
  try {
    const env = process.env.NODE_ENV ?? 'development'
    SentrySDK.setTag('environment', env)
    SentrySDK.setTag('release', VERSION)
  } catch {
    // Never throw from telemetry helpers
  }
}
