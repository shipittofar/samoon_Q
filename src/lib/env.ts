/**
 * Environment validation — Phase 4 (P4.1.1)
 *
 * Validates required environment variables at module load time using zod.
 * Import `env` instead of accessing `process.env` directly so the application
 * fails fast with a clear message when a required variable is missing or invalid.
 */
import { z } from 'zod'

// ── Required fields — application cannot start without these ─────────────────
const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url('NEXT_PUBLIC_API_BASE_URL must be a valid URL'),
  NEXT_PUBLIC_USE_MOCK: z
    .enum(['true', 'false'], {
      errorMap: () => ({ message: "NEXT_PUBLIC_USE_MOCK must be 'true' or 'false'" }),
    })
    .transform((v) => v === 'true'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

// ── Optional fields — missing values produce warnings, not startup failures ───
const optionalEnvSchema = z.object({
  // P4.9.3: Optional observability / deployment fields
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
})

function parseEnv() {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_USE_MOCK: process.env.NEXT_PUBLIC_USE_MOCK,
    NODE_ENV: process.env.NODE_ENV,
  })

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`[env] Invalid environment variables:\n${issues}`)
  }

  // Validate optional fields — warn but never throw.
  const optResult = optionalEnvSchema.safeParse({
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  })
  if (!optResult.success) {
    const issues = optResult.error.issues.map((i) => `  • ${i.path.join('.')}: ${i.message}`).join('\n')
    // eslint-disable-next-line no-console
    console.warn(`[env] Optional environment variable(s) have invalid values (app will start anyway):\n${issues}`)
  }

  return result.data
}

export const env = parseEnv()

export type Env = typeof env

/** Optional env values — may be undefined; never throw on absence. */
export const optionalEnv = {
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
} as const
