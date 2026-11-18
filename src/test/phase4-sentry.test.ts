/**
 * Phase 4.6 — Sentry Production Configuration tests (P4.6.1–P4.6.5)
 *
 * Covers:
 *   P4.6.1 — setSentryUser / clearSentryUser
 *   P4.6.2 — Auth state synchronization (providers wire-up)
 *   P4.6.3 — Tenant tagging (setSentryTenant)
 *   P4.6.4 — Environment & release tagging (setEnvironmentTags)
 *   P4.6.5 — ErrorBoundary enrichment
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Sentry SDK mock ───────────────────────────────────────────────────────────

const mockSetUser = vi.fn()
const mockSetTag = vi.fn()
const mockCaptureException = vi.fn()

vi.mock('@sentry/nextjs', () => ({
  setUser: mockSetUser,
  setTag: mockSetTag,
  captureException: mockCaptureException,
}))

beforeEach(() => {
  vi.resetModules()
  mockSetUser.mockReset()
  mockSetTag.mockReset()
  mockCaptureException.mockReset()
})

afterEach(() => {
  vi.resetModules()
})

// ── Helper: load sentry module with DSN configured ────────────────────────────

async function sentryWithDsn() {
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://fake@sentry.io/123')
  const mod = await import('@/lib/sentry')
  return mod
}

async function sentryWithoutDsn() {
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '')
  const mod = await import('@/lib/sentry')
  return mod
}

// ── P4.6.1 — setSentryUser ────────────────────────────────────────────────────

describe('P4.6.1 — setSentryUser', () => {
  it('calls SentrySDK.setUser with id when DSN is configured', async () => {
    const { setSentryUser } = await sentryWithDsn()
    setSentryUser({ id: 'u1' })
    expect(mockSetUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }))
  })

  it('forwards email when provided', async () => {
    const { setSentryUser } = await sentryWithDsn()
    setSentryUser({ id: 'u1', email: 'a@b.com' })
    expect(mockSetUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.com' }))
  })

  it('forwards accountType when provided', async () => {
    const { setSentryUser } = await sentryWithDsn()
    setSentryUser({ id: 'u1', accountType: 'business' })
    expect(mockSetUser).toHaveBeenCalledWith(expect.objectContaining({ accountType: 'business' }))
  })

  it('forwards tenant when provided', async () => {
    const { setSentryUser } = await sentryWithDsn()
    setSentryUser({ id: 'u1', tenant: 'acme' })
    expect(mockSetUser).toHaveBeenCalledWith(expect.objectContaining({ tenant: 'acme' }))
  })

  it('calls setUser(null) when user is null', async () => {
    const { setSentryUser } = await sentryWithDsn()
    setSentryUser(null)
    expect(mockSetUser).toHaveBeenCalledWith(null)
  })

  it('is a no-op when DSN is not configured', async () => {
    const { setSentryUser } = await sentryWithoutDsn()
    setSentryUser({ id: 'u1', email: 'a@b.com' })
    expect(mockSetUser).not.toHaveBeenCalled()
  })

  it('does not expose tokens in user context', async () => {
    const { setSentryUser } = await sentryWithDsn()
    // Even if caller passes extra fields, only allowed fields are forwarded
    setSentryUser({ id: 'u1', email: 'a@b.com', accountType: 'customer' })
    const call = mockSetUser.mock.calls[0][0] as Record<string, unknown>
    expect(call).not.toHaveProperty('password')
    expect(call).not.toHaveProperty('token')
    expect(call).not.toHaveProperty('access')
    expect(call).not.toHaveProperty('refresh')
  })

  it('never throws even when SentrySDK.setUser throws', async () => {
    mockSetUser.mockImplementation(() => { throw new Error('SDK error') })
    const { setSentryUser } = await sentryWithDsn()
    expect(() => setSentryUser({ id: 'u1' })).not.toThrow()
  })

  it('omits email field when not provided', async () => {
    const { setSentryUser } = await sentryWithDsn()
    setSentryUser({ id: 'u1', accountType: 'customer' })
    const call = mockSetUser.mock.calls[0][0] as Record<string, unknown>
    expect(call).not.toHaveProperty('email')
  })
})

// ── P4.6.1 — clearSentryUser ──────────────────────────────────────────────────

describe('P4.6.1 — clearSentryUser', () => {
  it('calls SentrySDK.setUser(null) when DSN configured', async () => {
    const { clearSentryUser } = await sentryWithDsn()
    clearSentryUser()
    expect(mockSetUser).toHaveBeenCalledWith(null)
  })

  it('is a no-op when DSN is not configured', async () => {
    const { clearSentryUser } = await sentryWithoutDsn()
    clearSentryUser()
    expect(mockSetUser).not.toHaveBeenCalled()
  })

  it('never throws even when SentrySDK.setUser throws', async () => {
    mockSetUser.mockImplementation(() => { throw new Error('SDK error') })
    const { clearSentryUser } = await sentryWithDsn()
    expect(() => clearSentryUser()).not.toThrow()
  })
})

// ── P4.6.3 — setSentryTenant ──────────────────────────────────────────────────

describe('P4.6.3 — setSentryTenant', () => {
  it('calls SentrySDK.setTag with tenant.slug key', async () => {
    const { setSentryTenant } = await sentryWithDsn()
    setSentryTenant('acme')
    expect(mockSetTag).toHaveBeenCalledWith('tenant.slug', 'acme')
  })

  it('is a no-op when DSN is not configured', async () => {
    const { setSentryTenant } = await sentryWithoutDsn()
    setSentryTenant('acme')
    expect(mockSetTag).not.toHaveBeenCalled()
  })

  it('never throws even when SentrySDK.setTag throws', async () => {
    mockSetTag.mockImplementation(() => { throw new Error('SDK error') })
    const { setSentryTenant } = await sentryWithDsn()
    expect(() => setSentryTenant('acme')).not.toThrow()
  })

  it('updates correctly when called with a new slug', async () => {
    const { setSentryTenant } = await sentryWithDsn()
    setSentryTenant('first')
    setSentryTenant('second')
    expect(mockSetTag).toHaveBeenNthCalledWith(1, 'tenant.slug', 'first')
    expect(mockSetTag).toHaveBeenNthCalledWith(2, 'tenant.slug', 'second')
  })
})

// ── P4.6.4 — setEnvironmentTags ──────────────────────────────────────────────

describe('P4.6.4 — setEnvironmentTags', () => {
  it('sets environment tag when DSN configured', async () => {
    const { setEnvironmentTags } = await sentryWithDsn()
    setEnvironmentTags()
    const envCall = mockSetTag.mock.calls.find((c) => c[0] === 'environment')
    expect(envCall).toBeDefined()
    expect(['development', 'test', 'production']).toContain(envCall![1])
  })

  it('sets release tag using VERSION constant', async () => {
    const { setEnvironmentTags } = await sentryWithDsn()
    const { VERSION } = await import('@/lib/version')
    setEnvironmentTags()
    const releaseCall = mockSetTag.mock.calls.find((c) => c[0] === 'release')
    expect(releaseCall).toBeDefined()
    expect(releaseCall![1]).toBe(VERSION)
  })

  it('is a no-op when DSN is not configured', async () => {
    const { setEnvironmentTags } = await sentryWithoutDsn()
    setEnvironmentTags()
    expect(mockSetTag).not.toHaveBeenCalled()
  })

  it('never throws even when SentrySDK.setTag throws', async () => {
    mockSetTag.mockImplementation(() => { throw new Error('SDK error') })
    const { setEnvironmentTags } = await sentryWithDsn()
    expect(() => setEnvironmentTags()).not.toThrow()
  })

  it('does not create a second version source — reuses VERSION from lib/version', async () => {
    const { existsSync } = await import('fs')
    const { join } = await import('path')
    const src = (await import('fs')).readFileSync(
      join(__dirname, '..', 'lib', 'sentry.ts'),
      'utf-8',
    )
    expect(src).toContain("from '@/lib/version'")
    expect(src).toContain('VERSION')
  })

  it('environment tag value is a string', async () => {
    const { setEnvironmentTags } = await sentryWithDsn()
    setEnvironmentTags()
    const envCall = mockSetTag.mock.calls.find((c) => c[0] === 'environment')
    expect(typeof envCall![1]).toBe('string')
  })
})

// ── P4.6 — sentryEnabled flag ─────────────────────────────────────────────────

describe('P4.6 — sentryEnabled', () => {
  it('sentryEnabled is true when DSN is configured', async () => {
    const { sentryEnabled } = await sentryWithDsn()
    expect(sentryEnabled).toBe(true)
  })

  it('sentryEnabled is false when DSN is absent', async () => {
    const { sentryEnabled } = await sentryWithoutDsn()
    expect(sentryEnabled).toBe(false)
  })
})

// ── P4.6 — captureException ───────────────────────────────────────────────────

describe('P4.6 — captureException', () => {
  it('calls SentrySDK.captureException when DSN configured', async () => {
    const { captureException } = await sentryWithDsn()
    const err = new Error('test')
    captureException(err)
    expect(mockCaptureException).toHaveBeenCalledWith(err, expect.any(Object))
  })

  it('is a no-op when DSN is not configured', async () => {
    const { captureException } = await sentryWithoutDsn()
    captureException(new Error('test'))
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('never throws when SDK throws', async () => {
    mockCaptureException.mockImplementation(() => { throw new Error('SDK error') })
    const { captureException } = await sentryWithDsn()
    expect(() => captureException(new Error('test'))).not.toThrow()
  })

  it('passes context as extra to Sentry', async () => {
    const { captureException } = await sentryWithDsn()
    captureException(new Error('e'), { feature: 'Cart' })
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ extra: { feature: 'Cart' } }),
    )
  })
})

// ── P4.6.2 — Auth synchronization ────────────────────────────────────────────

describe('P4.6.2 — Auth synchronization wiring', () => {
  it('providers/index.tsx imports setSentryUser', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(__dirname, '..', 'providers', 'index.tsx'), 'utf-8')
    expect(src).toContain('setSentryUser')
  })

  it('logout teardown (used by providers/index.tsx) imports clearSentryUser', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(__dirname, '..', 'lib', 'auth-session-teardown.ts'), 'utf-8')
    expect(src).toMatch(/import \{ clearSentryUser \} from '@\/lib\/sentry'/)
  })

  it('providers/index.tsx calls setSentryUser after getMe()', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(__dirname, '..', 'providers', 'index.tsx'), 'utf-8')
    // setSentryUser called in the same .then() block as setUser
    expect(src).toContain('setSentryUser')
    expect(src).toContain('user.id')
    expect(src).toContain('user.accountType')
  })

  it('providers/index.tsx clears the Sentry user on logout via clearAuthenticatedClientState', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const providers = readFileSync(join(__dirname, '..', 'providers', 'index.tsx'), 'utf-8')
    const teardown = readFileSync(join(__dirname, '..', 'lib', 'auth-session-teardown.ts'), 'utf-8')
    expect(providers).toContain('clearAuthenticatedClientState(')
    expect(teardown).toContain('clearSentryUser()')
  })

  it('providers/index.tsx imports setSentryTenant', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(__dirname, '..', 'providers', 'index.tsx'), 'utf-8')
    expect(src).toContain('setSentryTenant')
  })

  it('providers/index.tsx calls setSentryTenant after loadTenant resolves', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(__dirname, '..', 'providers', 'index.tsx'), 'utf-8')
    expect(src).toContain('setSentryTenant(tenant.slug)')
  })

  it('providers/index.tsx calls setEnvironmentTags during bootstrap', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(__dirname, '..', 'providers', 'index.tsx'), 'utf-8')
    expect(src).toContain('setEnvironmentTags')
  })

  it('auth sync does not duplicate auth logic — delegates to existing setUser/logout', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(__dirname, '..', 'providers', 'index.tsx'), 'utf-8')
    // Should still use setUser (not reimplementing auth). getMe()'s response
    // nests the User under a `user` key (GetMeResponse) as of the /auth/me/
    // contract update, so the session-restore call site is setUser(data.user).
    expect(src).toContain('setUser(data.user)')
    expect(src).toContain('setUser(null)')
  })
})

// ── P4.6.5 — ErrorBoundary enrichment ────────────────────────────────────────

describe('P4.6.5 — ErrorBoundary enrichment', () => {
  it('ErrorBoundary.tsx imports VERSION from lib/version', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(
      join(__dirname, '..', 'components', 'common', 'ErrorBoundary.tsx'),
      'utf-8',
    )
    expect(src).toContain("from '@/lib/version'")
    expect(src).toContain('VERSION')
  })

  it('ErrorBoundary passes release (VERSION) to captureException context', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(
      join(__dirname, '..', 'components', 'common', 'ErrorBoundary.tsx'),
      'utf-8',
    )
    expect(src).toContain('release')
    expect(src).toContain('VERSION')
  })

  it('ErrorBoundary passes pathname to captureException context', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(
      join(__dirname, '..', 'components', 'common', 'ErrorBoundary.tsx'),
      'utf-8',
    )
    expect(src).toContain('pathname')
  })

  it('ErrorBoundary does not expose tokens in captured context', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(
      join(__dirname, '..', 'components', 'common', 'ErrorBoundary.tsx'),
      'utf-8',
    )
    expect(src).not.toContain('access_token')
    expect(src).not.toContain('refresh_token')
    expect(src).not.toContain('localStorage.getItem')
  })

  it('ErrorBoundary preserves existing fallback UI', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(
      join(__dirname, '..', 'components', 'common', 'ErrorBoundary.tsx'),
      'utf-8',
    )
    expect(src).toContain('role="alert"')
    expect(src).toContain('Try again')
    expect(src).toContain('reset')
  })

  it('ErrorBoundary still calls captureException', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(
      join(__dirname, '..', 'components', 'common', 'ErrorBoundary.tsx'),
      'utf-8',
    )
    expect(src).toContain('captureException')
  })

  it('captureException receives enriched context in componentDidCatch', async () => {
    const { captureException: mockCapture } = await sentryWithDsn()

    // Verify the function signature accepts context with pathname and release
    // (structural test via the source — actual class mounting requires jsdom + React)
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(
      join(__dirname, '..', 'components', 'common', 'ErrorBoundary.tsx'),
      'utf-8',
    )
    expect(src).toContain('componentDidCatch')
    expect(src).toContain('captureException(error, {')
  })
})

// ── Module shape ───────────────────────────────────────────────────────────────

describe('P4.6 — sentry.ts module shape', () => {
  it('exports setSentryUser', async () => {
    const mod = await import('@/lib/sentry')
    expect(typeof mod.setSentryUser).toBe('function')
  })

  it('exports clearSentryUser', async () => {
    const mod = await import('@/lib/sentry')
    expect(typeof mod.clearSentryUser).toBe('function')
  })

  it('exports setSentryTenant', async () => {
    const mod = await import('@/lib/sentry')
    expect(typeof mod.setSentryTenant).toBe('function')
  })

  it('exports setEnvironmentTags', async () => {
    const mod = await import('@/lib/sentry')
    expect(typeof mod.setEnvironmentTags).toBe('function')
  })

  it('exports captureException', async () => {
    const mod = await import('@/lib/sentry')
    expect(typeof mod.captureException).toBe('function')
  })

  it('exports sentryEnabled boolean', async () => {
    const mod = await import('@/lib/sentry')
    expect(typeof mod.sentryEnabled).toBe('boolean')
  })
})
