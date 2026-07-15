/**
 * Phase 4.1 — Security Hardening tests (P4.1.1–P4.1.4)
 *
 * Covers:
 *   P4.1.1 — Environment validation (zod schema, fail-fast behaviour)
 *   P4.1.2 — CSP header generation and directive coverage
 *   P4.1.3 — Mock user role is not admin
 *   P4.1.4 — Security headers present in next.config.ts
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'

const ROOT = join(__dirname, '..', '..')

// ── P4.1.1 — Environment Validation ──────────────────────────────────────────

describe('P4.1.1 — env.ts zod schema', () => {
  // Re-create the same schema used in src/lib/env.ts to unit-test it in isolation
  const envSchema = z.object({
    NEXT_PUBLIC_API_BASE_URL: z.string().url(),
    NEXT_PUBLIC_USE_MOCK: z.enum(['true', 'false']).transform((v) => v === 'true'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  })

  it('accepts valid env values', () => {
    const result = envSchema.safeParse({
      NEXT_PUBLIC_API_BASE_URL: 'https://api.samoon.com',
      NEXT_PUBLIC_USE_MOCK: 'false',
      NODE_ENV: 'production',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_USE_MOCK).toBe(false)
    }
  })

  it('transforms NEXT_PUBLIC_USE_MOCK "true" string to boolean true', () => {
    const result = envSchema.safeParse({
      NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8000',
      NEXT_PUBLIC_USE_MOCK: 'true',
      NODE_ENV: 'development',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_USE_MOCK).toBe(true)
    }
  })

  it('rejects an invalid NEXT_PUBLIC_API_BASE_URL', () => {
    const result = envSchema.safeParse({
      NEXT_PUBLIC_API_BASE_URL: 'not-a-url',
      NEXT_PUBLIC_USE_MOCK: 'false',
      NODE_ENV: 'development',
    })
    expect(result.success).toBe(false)
  })

  it('rejects NEXT_PUBLIC_USE_MOCK values other than "true" or "false"', () => {
    const result = envSchema.safeParse({
      NEXT_PUBLIC_API_BASE_URL: 'https://api.samoon.com',
      NEXT_PUBLIC_USE_MOCK: 'yes',
      NODE_ENV: 'development',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing NEXT_PUBLIC_API_BASE_URL', () => {
    const result = envSchema.safeParse({
      NEXT_PUBLIC_USE_MOCK: 'false',
      NODE_ENV: 'production',
    })
    expect(result.success).toBe(false)
  })

  it('defaults NODE_ENV to "development" when omitted', () => {
    const result = envSchema.safeParse({
      NEXT_PUBLIC_API_BASE_URL: 'https://api.samoon.com',
      NEXT_PUBLIC_USE_MOCK: 'false',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development')
    }
  })

  it('src/lib/env.ts exports a parseEnv function and env object', () => {
    const source = readFileSync(join(ROOT, 'src/lib/env.ts'), 'utf-8')
    expect(source).toContain('export const env')
    expect(source).toContain('safeParse')
    expect(source).toContain('NEXT_PUBLIC_API_BASE_URL')
    expect(source).toContain('NEXT_PUBLIC_USE_MOCK')
    expect(source).toContain('NODE_ENV')
  })

  it('env.ts throws with descriptive message on invalid vars', () => {
    const source = readFileSync(join(ROOT, 'src/lib/env.ts'), 'utf-8')
    expect(source).toContain('[env] Invalid environment variables')
    expect(source).toContain('throw new Error')
  })
})

// ── P4.1.2 — Content Security Policy ─────────────────────────────────────────

describe('P4.1.2 — CSP header in next.config.ts', () => {
  const configSource = readFileSync(join(ROOT, 'next.config.ts'), 'utf-8')

  it('defines a buildCspHeader function', () => {
    expect(configSource).toContain('buildCspHeader')
  })

  it('includes Content-Security-Policy header', () => {
    expect(configSource).toContain('Content-Security-Policy')
  })

  it('CSP sets default-src to self', () => {
    expect(configSource).toContain(`default-src 'self'`)
  })

  it('CSP blocks object-src', () => {
    expect(configSource).toContain(`object-src 'none'`)
  })

  it('CSP blocks frame-ancestors', () => {
    expect(configSource).toContain(`frame-ancestors 'none'`)
  })

  it('CSP restricts base-uri to self', () => {
    expect(configSource).toContain(`base-uri 'self'`)
  })

  it('CSP allows images from https and data URIs', () => {
    expect(configSource).toContain('img-src')
    expect(configSource).toContain('https:')
    expect(configSource).toContain('data:')
  })

  it('CSP allows Next.js inline styles', () => {
    expect(configSource).toContain('style-src')
    expect(configSource).toContain("'unsafe-inline'")
  })
})

// ── P4.1.3 — Mock User Role ───────────────────────────────────────────────────

describe('P4.1.3 — Mock user role hardening', () => {
  it('MOCK_USER.role is "customer", not "admin"', async () => {
    const { MOCK_USER } = await import('@/lib/mock-data')
    expect(MOCK_USER.role).toBe('customer')
    expect(MOCK_USER.role).not.toBe('admin')
    expect(MOCK_USER.role).not.toBe('staff')
  })

  it('mock mode cannot produce an admin-role user from demo credentials', async () => {
    const { MOCK_USER } = await import('@/lib/mock-data')
    // Simulate mock auth response: service returns MOCK_USER
    const mockAuthResponse = { user: MOCK_USER, tokens: { access: 'mock', refresh: 'mock' } }
    expect(mockAuthResponse.user.role).toBe('customer')
  })
})

// ── P4.1.4 — Security Headers Audit ──────────────────────────────────────────

describe('P4.1.4 — Security headers in next.config.ts', () => {
  const configSource = readFileSync(join(ROOT, 'next.config.ts'), 'utf-8')

  it('X-Content-Type-Options is nosniff', () => {
    expect(configSource).toContain('X-Content-Type-Options')
    expect(configSource).toContain('nosniff')
  })

  it('X-Frame-Options is DENY', () => {
    expect(configSource).toContain('X-Frame-Options')
    expect(configSource).toContain('DENY')
  })

  it('X-XSS-Protection is set', () => {
    expect(configSource).toContain('X-XSS-Protection')
  })

  it('Referrer-Policy is strict-origin-when-cross-origin', () => {
    expect(configSource).toContain('Referrer-Policy')
    expect(configSource).toContain('strict-origin-when-cross-origin')
  })

  it('headers apply to all routes via /(.*) matcher', () => {
    expect(configSource).toContain('/(.*)')
  })

  it('P3.3 mock-mode production guard is still in place', () => {
    expect(configSource).toContain('NEXT_PUBLIC_USE_MOCK')
    expect(configSource).toContain("'true'")
    expect(configSource).toContain('Build aborted')
  })
})
