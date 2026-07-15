// ============================================================
// P10.7 — RBAC Session Hydration (Phase A/B/C/D implementation)
//
// Problem (docs/P10.6_RBAC_REAL_BACKEND_MIGRATION_PLAN.md §3):
// AuthBootstrapper (src/providers/index.tsx) restores the user session
// via authService.getMe() on page load, but getMe() never restored
// tenantRoles — the only reason tenantRoles survived a page reload was
// useRbacStore's own localStorage persistence. This file proves the
// fix: getMe() now optionally returns tenantRoles (mock mode: seeded
// from MOCK_CREDENTIALS; real mode: pass-through, optional), and
// exercises the exact hydration logic AuthBootstrapper now runs
// (setUser() -> setTenantRoles() if present) without needing to mount
// the full provider tree, matching the established test convention in
// p10.3.2-cache-isolation-audit.test.ts's simulateLogoutCleanup().
// ============================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { authService, MOCK_SESSION_KEY } from '@/services/auth.service'
import { useAuthStore, useTenantStore, useRbacStore } from '@/stores'
import type { User } from '@/types'
import type { Role } from '@/types/rbac'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.samoon.test')

vi.mock('@/constants', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/constants')>()
  return { ...mod, MOCK_DELAY: 0 }
})

/**
 * Mirrors exactly the RBAC-relevant portion of AuthBootstrapper's
 * getMe().then(...) callback (src/providers/index.tsx) — setUser() +
 * the new setTenantRoles() hydration step. Not a reimplementation of
 * permission logic: this only proves the store-hydration wiring, the
 * same way p10.3.2's simulateLogoutCleanup() mirrors useLogout().
 */
function simulateSessionRestoreHydration(user: User & { tenantRoles?: Role[] }) {
  useAuthStore.getState().setUser(user)
  if (user.tenantRoles && user.tenantRoles.length > 0) {
    const tenantId = useTenantStore.getState().tenant.id
    useRbacStore.getState().setTenantRoles(tenantId, user.tenantRoles)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  useAuthStore.getState().setUser(null)
  useRbacStore.getState()._resetStore()
  if (typeof localStorage !== 'undefined') localStorage.removeItem(MOCK_SESSION_KEY)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('P10.7 — getMe() returns user only (no session email set)', () => {
  it('existing behavior continues: resolves to the fallback MOCK_USER with an empty tenantRoles', async () => {
    const promise = authService.getMe()
    await vi.runAllTimersAsync()
    const user = await promise
    expect(user.id).toBe('1')
    expect(user.role).toBe('customer')
    expect(typeof user.email).toBe('string')
    expect(user.tenantRoles).toEqual([])
  })
})

describe('P10.7 — getMe() returns tenantRoles for a known demo session', () => {
  it('cashier@samoon.com: getMe() returns tenantRoles === ["cashier"], matching MOCK_CREDENTIALS.p7Roles', async () => {
    localStorage.setItem(MOCK_SESSION_KEY, 'cashier@samoon.com')
    const promise = authService.getMe()
    await vi.runAllTimersAsync()
    const user = await promise
    expect(user.email).toBe('cashier@samoon.com')
    expect(user.tenantRoles).toEqual(['cashier'])
  })

  it('multirole@samoon.com: getMe() returns both roles', async () => {
    localStorage.setItem(MOCK_SESSION_KEY, 'multirole@samoon.com')
    const promise = authService.getMe()
    await vi.runAllTimersAsync()
    const user = await promise
    expect(user.tenantRoles).toEqual(['cashier', 'kitchen'])
  })

  it('demo@samoon.com: getMe() returns an empty tenantRoles array (matches its empty p7Roles)', async () => {
    localStorage.setItem(MOCK_SESSION_KEY, 'demo@samoon.com')
    const promise = authService.getMe()
    await vi.runAllTimersAsync()
    const user = await promise
    expect(user.tenantRoles).toEqual([])
  })
})

describe('P10.7 — page reload simulation: tenantRoles now restored from auth bootstrap, not only localStorage', () => {
  it('BEFORE: clearing useRbacStore leaves tenantRoles empty even though the "logged in" user is a role-bearing account', async () => {
    // Simulates what happens today the instant useRbacStore's own
    // persistence is cleared (e.g. a private/incognito reload, or a
    // future phase's partialize excluding tenantRoles) with no
    // session-restore hydration wired in — this is the exact gap
    // P10.6 §3 documented.
    useAuthStore.getState().setUser({
      id: 'x', email: 'owner@samoon.com', first_name: 'O', last_name: 'W',
      role: 'customer', is_verified: true, created_at: new Date().toISOString(),
    })
    useRbacStore.getState()._resetStore()
    expect(useRbacStore.getState().tenantRoles).toEqual([])
  })

  it('AFTER: authService.getMe() + the AuthBootstrapper hydration step restores tenantRoles without touching localStorage persistence', async () => {
    localStorage.setItem(MOCK_SESSION_KEY, 'owner@samoon.com')
    useRbacStore.getState()._resetStore()
    expect(useRbacStore.getState().tenantRoles).toEqual([])

    const promise = authService.getMe()
    await vi.runAllTimersAsync()
    const user = await promise

    simulateSessionRestoreHydration(user)

    const tenantId = useTenantStore.getState().tenant.id
    expect(useRbacStore.getState().getRolesForTenant(tenantId)).toEqual(['owner'])
  })
})

describe('P10.7 — missing RBAC payload: no crash, clean fallback', () => {
  it('a getMe()-shaped object with no tenantRoles field at all does not throw when hydrated', () => {
    const bareUser: User = {
      id: 'y', email: 'nobody@example.com', first_name: 'N', last_name: 'B',
      role: 'customer', is_verified: true, created_at: new Date().toISOString(),
    }
    expect(() => simulateSessionRestoreHydration(bareUser)).not.toThrow()
    expect(useAuthStore.getState().user?.email).toBe('nobody@example.com')
    expect(useRbacStore.getState().tenantRoles).toEqual([])
  })

  it('an explicit empty tenantRoles array does not throw and leaves the store empty', () => {
    const emptyRolesUser: User & { tenantRoles: Role[] } = {
      id: 'z', email: 'nobody2@example.com', first_name: 'N', last_name: 'B',
      role: 'customer', is_verified: true, created_at: new Date().toISOString(),
      tenantRoles: [],
    }
    expect(() => simulateSessionRestoreHydration(emptyRolesUser)).not.toThrow()
    expect(useRbacStore.getState().tenantRoles).toEqual([])
  })
})

describe('P10.7 — mock mode: existing accounts continue working end to end', () => {
  const accounts: Array<[string, Role[]]> = [
    ['staff@samoon.com', ['manager']],
    ['kitchen@samoon.com', ['kitchen']],
    ['marketing@samoon.com', ['marketing']],
    ['support@samoon.com', ['support']],
    ['admin@samoon.com', ['admin']],
    ['owner@samoon.com', ['owner']],
    ['platform@samoon.com', ['owner']],
  ]

  for (const [email, expectedRoles] of accounts) {
    it(`${email}: login() -> getMe() round-trip agree on tenant roles`, async () => {
      const loginPromise = authService.login({ email, password: 'password' })
      await vi.runAllTimersAsync()
      const loginResult = await loginPromise
      expect(loginResult.p7Roles).toEqual(expectedRoles)

      const mePromise = authService.getMe()
      await vi.runAllTimersAsync()
      const meResult = await mePromise
      expect(meResult.tenantRoles).toEqual(expectedRoles)
    })
  }

  it('login()/verifyOTP() still resolve p7Roles unchanged (no field rename, no consumer break)', async () => {
    const loginPromise = authService.login({ email: 'owner@samoon.com', password: 'password' })
    await vi.runAllTimersAsync()
    const result = await loginPromise
    expect(result).toHaveProperty('p7Roles')
    expect(result.p7Roles).toEqual(['owner'])
  })
})
