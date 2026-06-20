/**
 * Environment validation — Phase 4 (P4.1.1)
 *
 * Validates required environment variables at module load time using zod.
 * Import `env` instead of accessing `process.env` directly so the application
 * fails fast with a clear message when a required variable is missing or invalid.
 */
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url('NEXT_PUBLIC_API_BASE_URL must be a valid URL'),
  NEXT_PUBLIC_USE_MOCK: z
    .enum(['true', 'false'], {
      errorMap: () => ({ message: "NEXT_PUBLIC_USE_MOCK must be 'true' or 'false'" }),
    })
    .transform((v) => v === 'true'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
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

  return result.data
}

export const env = parseEnv()

export type Env = typeof env
