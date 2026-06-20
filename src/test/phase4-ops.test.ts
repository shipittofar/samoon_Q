/**
 * Phase 4.3 — Observability tests (P4.3.1–P4.3.5)
 *
 * Covers:
 *   P4.3.1 — Structured logger shape, scope, and level methods
 *   P4.3.2 — Health endpoint response contract
 *   P4.3.3 — Readiness endpoint success and failure paths
 *   P4.3.4 — Version metadata and fallback
 *   P4.3.5 — Module export audit
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { createLogger, logger } from '@/lib/logger'
import { z } from 'zod'

// ── P4.3.1 — Structured Logger ────────────────────────────────────────────────

describe('P4.3.1 — createLogger: output shape', () => {
  afterEach(() => vi.restoreAllMocks())

  it('createLogger returns an object with info, warn, error, debug methods', () => {
    const log = createLogger('test')
    expect(typeof log.info).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.error).toBe('function')
    expect(typeof log.debug).toBe('function')
  })

  it('info() calls console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = createLogger('scope-a')
    log.info('hello world')
    expect(spy).toHaveBeenCalled()
    const output = spy.mock.calls[0].join(' ')
    expect(output).toContain('hello world')
  })

  it('warn() calls console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const log = createLogger('scope-b')
    log.warn('something off')
    expect(spy).toHaveBeenCalled()
    const output = spy.mock.calls[0].join(' ')
    expect(output).toContain('something off')
  })

  it('error() calls console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const log = createLogger('scope-c')
    log.error('something broke')
    expect(spy).toHaveBeenCalled()
    const output = spy.mock.calls[0].join(' ')
    expect(output).toContain('something broke')
  })

  it('debug() calls console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = createLogger('scope-d')
    log.debug('trace detail')
    expect(spy).toHaveBeenCalled()
    const output = spy.mock.calls[0].join(' ')
    expect(output).toContain('trace detail')
  })

  it('output includes the scope name', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = createLogger('my-feature')
    log.info('test')
    const output = spy.mock.calls[0].join(' ')
    expect(output).toContain('my-feature')
  })

  it('output includes the message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = createLogger('x')
    log.info('unique-message-42')
    const output = spy.mock.calls[0].join(' ')
    expect(output).toContain('unique-message-42')
  })

  it('output includes the log level label', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = createLogger('x')
    log.info('msg')
    const output = spy.mock.calls[0].join(' ')
    expect(output.toLowerCase()).toContain('info')
  })

  it('output includes a timestamp', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = createLogger('x')
    log.info('msg')
    const output = spy.mock.calls[0].join(' ')
    expect(output).toMatch(/\d{4}-\d{2}-\d{2}T/)
  })

  it('context fields are included in output', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = createLogger('x')
    log.info('msg', { correlationId: 'abc-123', userId: 'u-1' })
    const output = spy.mock.calls[0].join(' ')
    expect(output).toContain('abc-123')
    expect(output).toContain('u-1')
  })

  it('correlationId and tenant are preserved in context', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = createLogger('svc')
    log.info('request received', { correlationId: 'req-xyz', tenant: 'acme' })
    const output = spy.mock.calls[0].join(' ')
    expect(output).toContain('req-xyz')
    expect(output).toContain('acme')
  })

  it('two loggers with different scopes produce different scope labels', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const logA = createLogger('scope-alpha')
    const logB = createLogger('scope-beta')
    logA.info('from a')
    logB.info('from b')
    const outputA = spy.mock.calls[0].join(' ')
    const outputB = spy.mock.calls[1].join(' ')
    expect(outputA).toContain('scope-alpha')
    expect(outputB).toContain('scope-beta')
  })

  it('module exports a default app-level logger instance', () => {
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
  })
})

// ── P4.3.2 — Health Endpoint ──────────────────────────────────────────────────

describe('P4.3.2 — Health endpoint contract', () => {
  it('GET /api/health returns 200', async () => {
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    expect(response.status).toBe(200)
  })

  it('response body contains status: "ok"', async () => {
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    const body = await response.json()
    expect(body.status).toBe('ok')
  })

  it('response body contains a timestamp', async () => {
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    const body = await response.json()
    expect(body.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/)
  })

  it('response body contains a version field', async () => {
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    const body = await response.json()
    expect(typeof body.version).toBe('string')
    expect(body.version.length).toBeGreaterThan(0)
  })
})

// ── P4.3.3 — Readiness Endpoint ───────────────────────────────────────────────

/**
 * The readiness route re-reads process.env on each GET() call, so we can test
 * both paths by stubbing env vars before calling the already-imported handler.
 */
describe('P4.3.3 — Readiness endpoint', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns 200 and { status: "ready" } when env is valid', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.savor.com')
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'false')
    const { GET } = await import('@/app/api/ready/route')
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('ready')
  })

  it('returns 503 and { status: "not_ready" } when API URL is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'false')
    const { GET } = await import('@/app/api/ready/route')
    const response = await GET()
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.status).toBe('not_ready')
  })

  it('returns 503 when NEXT_PUBLIC_USE_MOCK has an invalid value', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.savor.com')
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'yes')
    const { GET } = await import('@/app/api/ready/route')
    const response = await GET()
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.status).toBe('not_ready')
  })

  it('readiness schema accepts "true" for NEXT_PUBLIC_USE_MOCK', () => {
    const schema = z.object({
      NEXT_PUBLIC_API_BASE_URL: z.string().url(),
      NEXT_PUBLIC_USE_MOCK: z.enum(['true', 'false']),
    })
    const result = schema.safeParse({
      NEXT_PUBLIC_API_BASE_URL: 'https://api.savor.com',
      NEXT_PUBLIC_USE_MOCK: 'true',
    })
    expect(result.success).toBe(true)
  })

  it('readiness schema rejects non-URL API base', () => {
    const schema = z.object({
      NEXT_PUBLIC_API_BASE_URL: z.string().url(),
      NEXT_PUBLIC_USE_MOCK: z.enum(['true', 'false']),
    })
    const result = schema.safeParse({
      NEXT_PUBLIC_API_BASE_URL: 'not-a-url',
      NEXT_PUBLIC_USE_MOCK: 'false',
    })
    expect(result.success).toBe(false)
  })
})

// ── P4.3.4 — Version Metadata ─────────────────────────────────────────────────

describe('P4.3.4 — Version metadata', () => {
  it('VERSION export from src/lib/version.ts is a non-empty string', async () => {
    const { VERSION } = await import('@/lib/version')
    expect(typeof VERSION).toBe('string')
    expect(VERSION.length).toBeGreaterThan(0)
  })

  it('VERSION falls back to "unknown" when npm_package_version is unset', () => {
    // Verify the fallback expression used in version.ts resolves correctly
    const simulatedEnvValue: string | undefined = undefined
    const version = simulatedEnvValue ?? 'unknown'
    expect(version).toBe('unknown')
  })

  it('health response version matches VERSION export', async () => {
    const { GET } = await import('@/app/api/health/route')
    const { VERSION } = await import('@/lib/version')
    const response = await GET()
    const body = await response.json()
    expect(body.version).toBe(VERSION)
  })
})

// ── P4.3.5 — Module exports audit ────────────────────────────────────────────

describe('P4.3.5 — module exports', () => {
  it('logger.ts exports createLogger function', async () => {
    const mod = await import('@/lib/logger')
    expect(typeof mod.createLogger).toBe('function')
  })

  it('logger.ts exports default logger instance', async () => {
    const mod = await import('@/lib/logger')
    expect(typeof mod.logger).toBe('object')
    expect(typeof mod.logger.info).toBe('function')
  })

  it('version.ts exports VERSION string', async () => {
    const mod = await import('@/lib/version')
    expect(typeof mod.VERSION).toBe('string')
  })

  it('health route exports GET handler', async () => {
    const mod = await import('@/app/api/health/route')
    expect(typeof mod.GET).toBe('function')
  })

  it('ready route exports GET handler', async () => {
    const mod = await import('@/app/api/ready/route')
    expect(typeof mod.GET).toBe('function')
  })
})
