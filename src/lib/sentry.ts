/**
 * Sentry integration — Phase 3 (P3.11)
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
 */

import * as SentrySDK from '@sentry/nextjs'

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
  SentrySDK.captureException(error, { extra: context })
}

/**
 * Set a user context for subsequent Sentry events.
 * Call after successful authentication; call with null on logout.
 */
export function setSentryUser(user: { id: string; email?: string; role?: string } | null): void {
  if (!sentryEnabled) return
  SentrySDK.setUser(user)
}
