/**
 * Sentry browser-side initialization — Phase 3 (P3.11)
 *
 * Loaded by Next.js automatically via the @sentry/nextjs instrumentation layer.
 * Only initializes when NEXT_PUBLIC_SENTRY_DSN is set — no-ops otherwise.
 * Production telemetry is therefore opt-in via environment variable.
 */
import * as Sentry from '@sentry/nextjs'

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    // Trace 10 % of sessions in production; 100 % in development.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Capture 10 % of session replays on error.
    replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Session replays disabled by default — enable per environment.
    replaysSessionSampleRate: 0,
    environment: process.env.NODE_ENV,
    // Do not print debug output in production.
    debug: process.env.NODE_ENV === 'development',
  })
}
