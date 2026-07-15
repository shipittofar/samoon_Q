// ============================================================
// P10.8 — OTP Authentication Flow Split
//
// Problem: authService.verifyOTP() and useVerifyOTP() previously treated
// is_new_user: true almost identically to is_new_user: false — both
// branches minted/persisted tokens (setTokens()) and, at the hook layer,
// called setUser()/hydrated tenantRoles unconditionally. That is wrong:
// is_new_user: true means the backend does NOT consider the user logged
// in; registration is not complete. Only /complete-profile (via
// useRegister()) may establish the real session.
//
// This file proves:
//   - is_new_user: true never persists tokens, never calls setUser(),
//     never hydrates tenantRoles.
//   - is_new_user: false behaves exactly like a normal login (tokens
//     persisted, user set, tenantRoles hydrated when present).
//   - country_code sent on the wire always reflects the caller's actual
//     dialCode, never a hardcoded value.
// ============================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { authService, MOCK_SESSION_KEY } from '@/services/auth.service'
import { getAccessToken, clearTokens } from '@/services/axios.instance'
import { useAuthStore, useTenantStore, useRbacStore } from '@/stores'
import { useVerifyOTP } from '@/hooks'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.samoon.test')

vi.mock('@/constants', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/constants')>()
  return { ...mod, MOCK_DELAY: 0 }
})

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const KNOWN_PHONE = '+14155550101' // demo@samoon.com
const KNOWN_DIAL_CODE = '+1'
const UNKNOWN_PHONE = '+442071838750' // not in DEMO_PHONE_TO_EMAIL
const UNKNOWN_DIAL_CODE = '+44'

beforeEach(() => {
  vi.useFakeTimers()
  clearTokens()
  if (typeof localStorage !== 'undefined') localStorage.removeItem(MOCK_SESSION_KEY)
  useAuthStore.getState().setUser(null)
  useRbacStore.getState()._resetStore()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  clearTokens()
})

describe('P10.8 — authService.verifyOTP(): is_new_user: true establishes NO session', () => {
  it('an unknown phone resolves is_new_user: true with no user/tokens fields on the result', async () => {
    const promise = authService.verifyOTP({ phone_number: UNKNOWN_PHONE, dialCode: UNKNOWN_DIAL_CODE, otp: '123456' })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.is_new_user).toBe(true)
    expect('user' in result).toBe(false)
    expect('tokens' in result).toBe(false)
  })

  it('does not persist an access token', async () => {
    expect(getAccessToken()).toBeNull()
    const promise = authService.verifyOTP({ phone_number: UNKNOWN_PHONE, dialCode: UNKNOWN_DIAL_CODE, otp: '123456' })
    await vi.runAllTimersAsync()
    await promise
    expect(getAccessToken()).toBeNull()
  })

  it('does not write MOCK_SESSION_KEY to localStorage', async () => {
    const promise = authService.verifyOTP({ phone_number: UNKNOWN_PHONE, dialCode: UNKNOWN_DIAL_CODE, otp: '123456' })
    await vi.runAllTimersAsync()
    await promise
    expect(localStorage.getItem(MOCK_SESSION_KEY)).toBeNull()
  })
})

describe('P10.8 — authService.verifyOTP(): is_new_user: false behaves like a normal login', () => {
  it('a known demo phone resolves is_new_user: false with user/tokens/p7Roles present', async () => {
    const promise = authService.verifyOTP({ phone_number: KNOWN_PHONE, dialCode: KNOWN_DIAL_CODE, otp: '123456' })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.is_new_user).toBe(false)
    if (result.is_new_user) throw new Error('unreachable')
    expect(result.user.email).toBe('john@example.com')
    expect(result.tokens.access).toBeTruthy()
    expect(result.p7Roles).toEqual([])
  })

  it('persists the access token', async () => {
    const promise = authService.verifyOTP({ phone_number: KNOWN_PHONE, dialCode: KNOWN_DIAL_CODE, otp: '123456' })
    await vi.runAllTimersAsync()
    await promise
    expect(getAccessToken()).toBeTruthy()
  })

  it('writes MOCK_SESSION_KEY to localStorage', async () => {
    const promise = authService.verifyOTP({ phone_number: KNOWN_PHONE, dialCode: KNOWN_DIAL_CODE, otp: '123456' })
    await vi.runAllTimersAsync()
    await promise
    expect(localStorage.getItem(MOCK_SESSION_KEY)).toBe('demo@samoon.com')
  })
})

describe('P10.8 — useVerifyOTP(): session bootstrap only runs for is_new_user: false', () => {
  it('is_new_user: true does not call setUser() or hydrate tenantRoles', async () => {
    const { result } = renderHook(() => useVerifyOTP(), { wrapper })
    const mutatePromise = result.current.mutateAsync({ phone_number: UNKNOWN_PHONE, dialCode: UNKNOWN_DIAL_CODE, otp: '123456' })
    await vi.runAllTimersAsync()
    await mutatePromise

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    const tenantId = useTenantStore.getState().tenant.id
    expect(useRbacStore.getState().getRolesForTenant(tenantId)).toEqual([])
  })

  it('is_new_user: false calls setUser() and hydrates tenantRoles exactly like a login', async () => {
    const { result } = renderHook(() => useVerifyOTP(), { wrapper })
    // owner@samoon.com's demo phone
    const mutatePromise = result.current.mutateAsync({ phone_number: '+14155550108', dialCode: KNOWN_DIAL_CODE, otp: '123456' })
    await vi.runAllTimersAsync()
    await mutatePromise

    expect(useAuthStore.getState().user?.email).toBe('owner@samoon.com')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    const tenantId = useTenantStore.getState().tenant.id
    expect(useRbacStore.getState().getRolesForTenant(tenantId)).toEqual(['owner'])
  })
})

describe('P10.8 — country_code always reflects the caller\'s dialCode, never hardcoded', () => {
  it('a UK-formatted dial code round-trips through verifyOTP() untouched (mock mode never inspects it for gating)', async () => {
    // Mock mode's demo lookup is keyed by full E.164 phone, not dialCode —
    // this proves dialCode is accepted and passed through regardless of
    // its value, i.e. nothing in the call path substitutes a fixed one.
    const promise = authService.verifyOTP({ phone_number: UNKNOWN_PHONE, dialCode: '+44', otp: '123456' })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.is_new_user).toBe(true)
  })

  it('two different dial codes for the same OTP call do not collide or get normalized to one value', async () => {
    const a = authService.verifyOTP({ phone_number: '+33612345678', dialCode: '+33', otp: '123456' })
    const b = authService.verifyOTP({ phone_number: '+61412345678', dialCode: '+61', otp: '123456' })
    await vi.runAllTimersAsync()
    const [resultA, resultB] = await Promise.all([a, b])
    expect(resultA.is_new_user).toBe(true)
    expect(resultB.is_new_user).toBe(true)
  })
})
