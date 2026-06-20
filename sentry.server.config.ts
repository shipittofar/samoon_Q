/**
 * Sentry server-side initialization — Phase 3 (P3.11)
 *
 * Loaded by Next.js for Edge and Node.js runtimes.
 * Only initializes when SENTRY_DSN is set.
 */
import * as Sentry from '@sentry/nextjs'

const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    environment: process.env.NODE_ENV,
    debug: process.env.NODE_ENV === 'development',
  })
}
