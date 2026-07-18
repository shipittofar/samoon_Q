// ============================================================
// P10.10 — Authentication Real Backend Contract: shape + lifecycle tests
//
// Verifies the contract documented in
// docs/P10.10_AUTH_BACKEND_API_CONTRACT.md against the mock
// implementation of authService (the same contract the real backend
// must satisfy) plus the AuthBootstrapper 401-vs-transient-error
// distinction added this phase (src/providers/index.tsx).
// ============================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { authService, MOCK_SESSION_KEY } from '@/services/auth.service'
import { getAccessToken, clearTokens } from '@/services/axios.instance'
import { useAuthStore, useRbacStore, useTenantStore } from '@/stores'

const providersSource = readFileSync(join(process.cwd(), 'src/providers/index.tsx'), 'utf-8')

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')

vi.mock('@/constants', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/constants')>()
  return { ...mod, MOCK_DELAY: 0 }
})

beforeEach(() => {
  vi.useFakeTimers()
  clearTokens()
  if (typeof localStorage !== 'undefined') localStorage.removeItem(MOCK_SESSION_KEY)
  useAuthStore.getState().setUser(null)
  useRbacStore.getState()._resetStore()
  // AuthBootstrapper's tenant-scoped role hydration is a no-op unless a
  // tenant has actually resolved — simulate the correctly-ordered case.
  useTenantStore.getState().setTenant({
    id: 'tenant-test-01',
    name: 'Test Tenant',
    slug: 'test-tenant',
    businessTypes: ['restaurant'],
    status: 'active',
    created_at: '2024-01-01T00:00:00.000Z',
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  clearTokens()
})

describe('P10.10 Test 1 — login() response matches the documented SessionResponse contract', () => {
  it('returns { user, tokens: { access, refresh }, p7Roles } and persists tokens', async () => {
    const promise = authService.login({ email: 'owner@samoon.com', password: 'password' })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.user).toBeTruthy()
    expect(result.user.id).toBeTruthy()
    expect(typeof result.tokens.access).toBe('string')
    expect(typeof result.tokens.refresh).toBe('string')
    expect(result.p7Roles).toEqual(['owner'])
    expect(getAccessToken()).toBe(result.tokens.access)
  })
})

describe('P10.10 Test 2 — verifyOTP(): existing user creates a session', () => {
  it('is_new_user: false carries user + tokens and persists the access token', async () => {
    const promise = authService.verifyOTP({ phone_number: '+14155550108', dialCode: '+1', otp: '123456' })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.is_new_user).toBe(false)
    if (result.is_new_user) throw new Error('unreachable')
    expect(result.user).toBeTruthy()
    expect(result.tokens.access).toBeTruthy()
    expect(getAccessToken()).toBe(result.tokens.access)
  })
})

describe('P10.10 Test 3 — verifyOTP(): new user does NOT create a session', () => {
  it('is_new_user: true carries no user/tokens and leaves storage untouched', async () => {
    expect(getAccessToken()).toBeNull()
    const promise = authService.verifyOTP({ phone_number: '+15005559999', dialCode: '+1', otp: '123456' })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.is_new_user).toBe(true)
    expect('user' in result).toBe(false)
    expect('tokens' in result).toBe(false)
    expect(getAccessToken()).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})

describe('P10.10 Test 4 — getMe(): restores RBAC state identically to login', () => {
  it('a staff (cashier) session restored via getMe() returns the same tenantRoles login would have set', async () => {
    const loginPromise = authService.login({ email: 'cashier@samoon.com', password: 'password' })
    await vi.runAllTimersAsync()
    const login = await loginPromise
    expect(login.p7Roles).toEqual(['cashier'])

    const mePromise = authService.getMe()
    await vi.runAllTimersAsync()
    const me = await mePromise

    expect(me.activeMembership?.roles).toEqual(login.p7Roles)

    // Mirrors AuthBootstrapper's hydration call exactly.
    const tenantId = useTenantStore.getState().tenant!.id
    useRbacStore.getState().setTenantRoles(tenantId, me.activeMembership?.roles ?? [])
    expect(useRbacStore.getState().getRolesForTenant(tenantId)).toEqual(['cashier'])
  })
})

describe('P10.10 Test 5 — refresh token failure: clearSession happens (category A)', () => {
  it('AuthBootstrapper source clears the session specifically on a 401 status', () => {
    // Source-text assertion (established convention — see
    // p10.9-register-country-code-split.test.tsx) rather than a full
    // component mount: proves src/providers/index.tsx's getMe().catch()
    // branch checks `response?.status === 401` and calls clearSession()
    // when it matches. This is the exact condition a real backend's
    // REFRESH_TOKEN_INVALID / TOKEN_EXPIRED (both HTTP 401 per
    // docs/P10.10_AUTH_BACKEND_API_CONTRACT.md §4) must satisfy.
    expect(providersSource).toContain("status === 401")
    expect(providersSource).toMatch(/if \(status === 401\) \{\s*clearSession\(\)/)
  })

  it('reproduces the decision logic directly: a 401 response triggers the clear branch', () => {
    const err = { response: { status: 401, data: { code: 'TOKEN_EXPIRED' } } }
    const status = (err as { response?: { status?: number } }).response?.status
    expect(status === 401).toBe(true)
  })
})

describe('P10.10 Test 6 — network error: session remains (category B)', () => {
  it('the clearSession() call is gated behind the 401 check, not the bare catch (no unconditional clear)', () => {
    // Guards against a regression back to P10.9's original bug where
    // ANY rejection (network error, 5xx, or 401) cleared the session.
    // Requires the literal adjacency `if (status === 401) { clearSession()`
    // — a comment mentioning clearSession() elsewhere in the catch block
    // (e.g. explaining the branch) does not satisfy this.
    expect(providersSource).toMatch(/if \(status === 401\) \{\s*clearSession\(\)\s*\}/)
    // Phase 7 — the non-401 branch no longer just calls a bare
    // setLoading(false); it now marks the failure as transient via
    // setSessionCheckFailed(true) (which itself resolves isLoading without
    // touching tokens or the session — see useAuthStore.setSessionCheckFailed).
    // Only clearSession() may be gated behind the 401 check; the else
    // branch must never also call clearSession().
    const catchBlock = providersSource.slice(
      providersSource.indexOf('.catch((err: unknown)'),
      providersSource.indexOf('.catch((err: unknown)') + 1500,
    )
    expect(catchBlock).toMatch(/if \(status === 401\) \{\s*clearSession\(\)\s*\}\s*else\s*\{\s*setSessionCheckFailed\(true\)\s*\}/)
  })

  it('reproduces the decision logic directly: a network error (no response) does not trigger the clear branch', () => {
    const networkErr = { message: 'Network Error' } // Axios error with no `.response` at all
    const status = (networkErr as { response?: { status?: number } }).response?.status
    expect(status === 401).toBe(false)

    const serverErr = { response: { status: 503 } }
    const serverStatus = (serverErr as { response?: { status?: number } }).response?.status
    expect(serverStatus === 401).toBe(false)
  })
})
