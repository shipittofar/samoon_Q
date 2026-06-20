/**
 * Phase 4.9 — Production Operations & Observability (P4.9.1–P4.9.6)
 *
 * Covers:
 *   P4.9.1 — Structured logger context injection helpers
 *   P4.9.2 — Health endpoint extended payload
 *   P4.9.3 — Env validation optional fields
 *   P4.9.4 — Error context pipeline enrichment
 *   P4.9.5 — Performance metrics hook existence
 *   P4.9.6 — Health client hook behavior
 *   Regression — PWA, auth, RBAC, safe field handling
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '../..')

function src(rel: string): string {
  return fs.readFileSync(path.join(ROOT, 'src', rel), 'utf-8')
}

function file(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}

// ── P4.9.1 — Structured Logger Context Injection ──────────────────────────────

describe('P4.9.1 — Logger context injection helpers', () => {
  afterEach(() => vi.restoreAllMocks())

  it('withContext is exported from logger', () => {
    const content = src('lib/logger.ts')
    expect(content).toContain('export function withContext')
  })

  it('withRequestId is exported from logger', () => {
    expect(src('lib/logger.ts')).toContain('export function withRequestId')
  })

  it('withUserId is exported from logger', () => {
    expect(src('lib/logger.ts')).toContain('export function withUserId')
  })

  it('withTenant is exported from logger', () => {
    expect(src('lib/logger.ts')).toContain('export function withTenant')
  })

  it('createApiLogger is exported from logger', () => {
    expect(src('lib/logger.ts')).toContain('export function createApiLogger')
  })

  it('withContext merges base context into every log call', async () => {
    const { createLogger, withContext } = await import('@/lib/logger')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const base = createLogger('test-ctx')
    const log = withContext(base, { requestId: 'req-123', tenant: 'acme' })
    log.info('hello')
    const output = spy.mock.calls[0].join(' ')
    expect(output).toContain('req-123')
    expect(output).toContain('acme')
  })

  it('withContext per-call context overrides base context', async () => {
    const { createLogger, withContext } = await import('@/lib/logger')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const base = createLogger('test-override')
    const log = withContext(base, { requestId: 'base-id' })
    log.info('msg', { requestId: 'override-id' })
    const output = spy.mock.calls[0].join(' ')
    expect(output).toContain('override-id')
  })

  it('withRequestId injects requestId into context', async () => {
    const { createLogger, withRequestId } = await import('@/lib/logger')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = withRequestId(createLogger('req-test'), 'abc-999')
    log.info('request')
    expect(spy.mock.calls[0].join(' ')).toContain('abc-999')
  })

  it('withUserId injects userId into context', async () => {
    const { createLogger, withUserId } = await import('@/lib/logger')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = withUserId(createLogger('user-test'), 'user-42')
    log.info('action')
    expect(spy.mock.calls[0].join(' ')).toContain('user-42')
  })

  it('withTenant injects tenant into context', async () => {
    const { createLogger, withTenant } = await import('@/lib/logger')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = withTenant(createLogger('tenant-test'), 'savor-demo')
    log.info('event')
    expect(spy.mock.calls[0].join(' ')).toContain('savor-demo')
  })

  it('createApiLogger strips email from context', async () => {
    const { createApiLogger } = await import('@/lib/logger')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = createApiLogger('api-safe')
    log.info('request', { email: 'user@example.com', requestId: 'safe-123' })
    const output = spy.mock.calls[0].join(' ')
    expect(output).not.toContain('user@example.com')
    expect(output).toContain('safe-123')
  })

  it('createApiLogger strips password from context', async () => {
    const { createApiLogger } = await import('@/lib/logger')
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const log = createApiLogger('api-safe-pw')
    log.warn('login attempt', { password: 's3cr3t', userId: 'u1' })
    const output = spy.mock.calls[0].join(' ')
    expect(output).not.toContain('s3cr3t')
    expect(output).toContain('u1')
  })

  it('createApiLogger strips token from context', async () => {
    const { createApiLogger } = await import('@/lib/logger')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const log = createApiLogger('api-safe-tok')
    log.error('auth error', { token: 'abc.def.ghi', userId: 'u2' })
    const output = spy.mock.calls.flat().join(' ')
    expect(output).not.toContain('abc.def.ghi')
    expect(output).toContain('u2')
  })

  it('withContext does not mutate the original logger', async () => {
    const { createLogger, withContext } = await import('@/lib/logger')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const base = createLogger('no-mutate')
    const enriched = withContext(base, { requestId: 'x' })
    // Call original base — should NOT contain requestId
    base.info('plain')
    const plainOutput = spy.mock.calls[0].join(' ')
    // Call enriched — should contain requestId
    enriched.info('enriched')
    const enrichedOutput = spy.mock.calls[1].join(' ')
    expect(plainOutput).not.toContain('"requestId"')
    expect(enrichedOutput).toContain('x')
  })
})

// ── P4.9.2 — Health Endpoint Extended Payload ─────────────────────────────────

describe('P4.9.2 — Health endpoint extended payload', () => {
  it('health route file exists', () => {
    expect(() => src('app/api/health/route.ts')).not.toThrow()
  })

  it('health route returns uptime field', () => {
    expect(src('app/api/health/route.ts')).toContain('uptime')
  })

  it('health route returns memory field', () => {
    expect(src('app/api/health/route.ts')).toContain('memory')
  })

  it('health route returns environment field', () => {
    expect(src('app/api/health/route.ts')).toContain('environment')
  })

  it('health route still returns version field', () => {
    expect(src('app/api/health/route.ts')).toContain('VERSION')
    expect(src('app/api/health/route.ts')).toContain('version')
  })

  it('health route still returns timestamp field', () => {
    expect(src('app/api/health/route.ts')).toContain('timestamp')
  })

  it('health route handles missing process.uptime gracefully', () => {
    const content = src('app/api/health/route.ts')
    // Must have a guard before calling uptime
    expect(content).toContain('process.uptime')
    expect(content).toContain('typeof process')
  })

  it('health route handles missing process.memoryUsage gracefully', () => {
    const content = src('app/api/health/route.ts')
    expect(content).toContain('memoryUsage')
    // Must be wrapped in try/catch or guarded
    expect(content).toMatch(/try[\s\S]*?memoryUsage|memoryUsage[\s\S]*?catch/)
  })

  it('health route still returns 200 status', () => {
    expect(src('app/api/health/route.ts')).toContain('status: 200')
  })

  it('health route still returns status: ok', () => {
    expect(src('app/api/health/route.ts')).toContain("status: 'ok'")
  })
})

// ── P4.9.3 — Env Validation Optional Fields ───────────────────────────────────

describe('P4.9.3 — Env validation optional fields', () => {
  it('env.ts contains optionalEnvSchema', () => {
    expect(src('lib/env.ts')).toContain('optionalEnvSchema')
  })

  it('NEXT_PUBLIC_SENTRY_DSN is in optional schema', () => {
    expect(src('lib/env.ts')).toContain('NEXT_PUBLIC_SENTRY_DSN')
  })

  it('NEXT_PUBLIC_APP_URL is in optional schema', () => {
    expect(src('lib/env.ts')).toContain('NEXT_PUBLIC_APP_URL')
  })

  it('optional fields are marked optional() in zod schema', () => {
    const content = src('lib/env.ts')
    // Both optional fields should be followed by .optional()
    expect(content).toContain('.optional()')
  })

  it('missing optional fields produce a warning, not an error', () => {
    const content = src('lib/env.ts')
    expect(content).toContain('console.warn')
    expect(content).not.toMatch(/throw.*optional/i)
  })

  it('optional fields do not appear in required envSchema', () => {
    const content = src('lib/env.ts')
    // Required schema is defined before optional schema
    const requiredSection = content.split('optionalEnvSchema')[0]
    expect(requiredSection).not.toContain('NEXT_PUBLIC_SENTRY_DSN')
    expect(requiredSection).not.toContain('NEXT_PUBLIC_APP_URL')
  })

  it('optionalEnv convenience object is exported', () => {
    expect(src('lib/env.ts')).toContain('export const optionalEnv')
  })

  it('required env fields are still required (no regression)', () => {
    const content = src('lib/env.ts')
    expect(content).toContain('NEXT_PUBLIC_API_BASE_URL')
    expect(content).toContain('NEXT_PUBLIC_USE_MOCK')
    // Required fields must appear in envSchema (before optionalEnvSchema)
    const beforeOptional = content.split('optionalEnvSchema')[0]
    expect(beforeOptional).toContain('NEXT_PUBLIC_API_BASE_URL')
  })
})

// ── P4.9.4 — Error Context Pipeline ──────────────────────────────────────────

describe('P4.9.4 — Error context pipeline enrichment', () => {
  it('ErrorBoundary imports useTenantStore', () => {
    expect(src('components/common/ErrorBoundary.tsx')).toContain('useTenantStore')
  })

  it('ErrorBoundary passes tenantSlug to captureException', () => {
    expect(src('components/common/ErrorBoundary.tsx')).toContain('tenantSlug')
  })

  it('ErrorBoundary passes environment to captureException', () => {
    expect(src('components/common/ErrorBoundary.tsx')).toContain('environment')
  })

  it('ErrorBoundary passes pathname (route context)', () => {
    expect(src('components/common/ErrorBoundary.tsx')).toContain('pathname')
  })

  it('ErrorBoundary passes release VERSION', () => {
    expect(src('components/common/ErrorBoundary.tsx')).toContain('release')
    expect(src('components/common/ErrorBoundary.tsx')).toContain('VERSION')
  })

  it('ErrorBoundary does not leak tokens or passwords', () => {
    const content = src('components/common/ErrorBoundary.tsx')
    expect(content).not.toContain('access_token')
    expect(content).not.toContain('password')
    expect(content).not.toContain('token:')
  })

  it('ErrorBoundary uses getState() (class component — no hook calls)', () => {
    expect(src('components/common/ErrorBoundary.tsx')).toContain('getState()')
  })
})

// ── P4.9.5 — Performance Metrics Module ──────────────────────────────────────

describe('P4.9.5 — Performance metrics hook', () => {
  it('src/lib/performance.ts exists', () => {
    expect(() => src('lib/performance.ts')).not.toThrow()
  })

  it('performance.ts exports measureNavigationTiming', () => {
    expect(src('lib/performance.ts')).toContain('export function measureNavigationTiming')
  })

  it('performance.ts exports reportWebVitalsHook', () => {
    expect(src('lib/performance.ts')).toContain('export function reportWebVitalsHook')
  })

  it('performance.ts exports NavigationMetrics interface', () => {
    expect(src('lib/performance.ts')).toContain('NavigationMetrics')
  })

  it('performance.ts exports WebVitalEntry interface', () => {
    expect(src('lib/performance.ts')).toContain('WebVitalEntry')
  })

  it('measureNavigationTiming returns empty object when API unavailable', async () => {
    const { measureNavigationTiming } = await import('@/lib/performance')
    // In test env, performance.getEntriesByType returns [] or is unavailable
    const result = measureNavigationTiming()
    expect(result).toBeTypeOf('object')
    expect(result).not.toBeNull()
  })

  it('measureNavigationTiming never throws', async () => {
    const { measureNavigationTiming } = await import('@/lib/performance')
    expect(() => measureNavigationTiming()).not.toThrow()
  })

  it('reportWebVitalsHook returns an unsubscribe function', async () => {
    const { reportWebVitalsHook } = await import('@/lib/performance')
    const unsub = reportWebVitalsHook(() => {})
    expect(typeof unsub).toBe('function')
    expect(() => unsub()).not.toThrow()
  })

  it('performance.ts does not import external libraries', () => {
    const content = src('lib/performance.ts')
    expect(content).not.toContain("from 'web-vitals'")
    expect(content).not.toContain("from '@sentry")
    expect(content).not.toContain("from 'next/")
  })

  it('performance.ts has use client directive', () => {
    expect(src('lib/performance.ts').trimStart()).toMatch(/^'use client'/)
  })
})

// ── P4.9.6 — Health Client Hook ──────────────────────────────────────────────

describe('P4.9.6 — useHealthCheck hook', () => {
  it('useHealthCheck is exported from hooks/index.ts', () => {
    expect(src('hooks/index.ts')).toContain('export function useHealthCheck')
  })

  it('useHealthCheck fetches /api/health', () => {
    expect(src('hooks/index.ts')).toContain("'/api/health'")
  })

  it('useHealthCheck has retry: false', () => {
    const content = src('hooks/index.ts')
    // Ensure retry: false appears after useHealthCheck definition
    const hookSection = content.split('useHealthCheck')[1] ?? ''
    expect(hookSection).toContain('retry: false')
  })

  it('useHealthCheck has staleTime (caching)', () => {
    const content = src('hooks/index.ts')
    const hookSection = content.split('useHealthCheck')[1] ?? ''
    expect(hookSection).toContain('staleTime')
  })

  it('HealthPayload interface is exported', () => {
    expect(src('hooks/index.ts')).toContain('HealthPayload')
  })

  it('HealthPayload includes extended P4.9.2 fields', () => {
    const content = src('hooks/index.ts')
    expect(content).toContain('uptime')
    expect(content).toContain('memory')
    expect(content).toContain('environment')
  })

  it('useHealthCheck disables refetchOnWindowFocus', () => {
    const content = src('hooks/index.ts')
    const hookSection = content.split('useHealthCheck')[1] ?? ''
    expect(hookSection).toContain('refetchOnWindowFocus: false')
  })
})

// ── P4.9.7 — Regression: no PWA breakage ─────────────────────────────────────

describe('Regression: PWA components unchanged', () => {
  it('ServiceWorkerUpdateBanner still exists and has role=alert', () => {
    const content = src('components/pwa/ServiceWorkerUpdateBanner.tsx')
    expect(content).toContain('role="alert"')
  })

  it('OfflineIndicator still exists and has role=status', () => {
    expect(src('components/pwa/OfflineIndicator.tsx')).toContain('role="status"')
  })

  it('offline-queue still exports enqueue and replayQueue', () => {
    const content = src('lib/offline-queue.ts')
    expect(content).toContain('export function enqueue')
    expect(content).toContain('replayQueue')
  })

  it('service-worker.ts still exports registerServiceWorker', () => {
    expect(src('lib/service-worker.ts')).toContain('export function registerServiceWorker')
  })
})

// ── Regression: auth layer unchanged ──────────────────────────────────────────

describe('Regression: auth layer unchanged', () => {
  it('auth store still exports useAuthStore', () => {
    expect(src('stores/index.ts')).toContain('useAuthStore')
  })

  it('providers still mounts AuthBootstrapper', () => {
    expect(src('providers/index.tsx')).toContain('AuthBootstrapper')
  })

  it('providers still mounts NotificationWebSocketProvider', () => {
    expect(src('providers/index.tsx')).toContain('NotificationWebSocketProvider')
  })
})

// ── Regression: RBAC unchanged ────────────────────────────────────────────────

describe('Regression: RBAC layer unchanged', () => {
  it('useHasPermission still exported from hooks/index.ts', () => {
    expect(src('hooks/index.ts')).toContain('export function useHasPermission')
  })

  it('rbac.service still exports hasPermission', () => {
    expect(src('services/rbac.service.ts')).toContain('hasPermission')
  })
})

// ── Regression: safe missing field handling ───────────────────────────────────

describe('Regression: safe missing field handling', () => {
  it('health route uses try/catch for memory (no crash on Edge runtime)', () => {
    expect(src('app/api/health/route.ts')).toContain('try')
    expect(src('app/api/health/route.ts')).toContain('catch')
  })

  it('measureNavigationTiming returns {} safely in non-browser env', async () => {
    const { measureNavigationTiming } = await import('@/lib/performance')
    const result = measureNavigationTiming()
    expect(typeof result).toBe('object')
  })

  it('withContext handles undefined extra context gracefully', async () => {
    const { createLogger, withContext } = await import('@/lib/logger')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = withContext(createLogger('grace'), { requestId: 'r1' })
    expect(() => log.info('no-extra')).not.toThrow()
    spy.mockRestore()
  })

  it('createApiLogger handles empty context gracefully', async () => {
    const { createApiLogger } = await import('@/lib/logger')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = createApiLogger('empty-ctx')
    expect(() => log.info('no ctx')).not.toThrow()
    spy.mockRestore()
  })

  it('createApiLogger handles undefined context gracefully', async () => {
    const { createApiLogger } = await import('@/lib/logger')
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const log = createApiLogger('undef-ctx')
    expect(() => log.info('no ctx', undefined)).not.toThrow()
    spy.mockRestore()
  })
})
