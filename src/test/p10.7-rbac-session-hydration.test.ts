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
//
// Contract update: getMe() now nests the User under a `user` key
// (GetMeResponse — src/services/auth.service.ts), alongside
// `memberships`/`activeMembership` as siblings, rather than returning a
// flat `User & {tenantRoles?}` shape. Every assertion in this file that
// used to read a field directly off getMe()'s result now reads
// `result.user.<field>` for identity, and
// `result.activeMembership?.roles` (or `resolveSessionRestoreInput()`)
// for RBAC fields.
// ============================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { authService, MOCK_SESSION_KEY } from '@/services/auth.service'
import { resolveSessionRestoreInput } from '@/providers'
import { normalizeTenantPermissions } from '@/services/permission.service'
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
 * getMe().then(...) callback (src/providers/index.tsx) — setUser(data.user)
 * + resolveSessionRestoreInput()/normalizeTenantPermissions() +
 * setTenantRoles(). Not a reimplementation of permission logic: this only
 * proves the store-hydration wiring, the same way p10.3.2's
 * simulateLogoutCleanup() mirrors useLogout(). Uses the real exported
 * resolveSessionRestoreInput(), not a mirror, for the RBAC-gate logic
 * itself (see auth-refresh-persistence.test.ts, which tests that function
 * directly).
 */
function simulateSessionRestoreHydration(data: {
  user: User
  tenantRoles?: Role[]
  memberships?: import('@/types/rbac').TenantMembership[]
  activeMembership?: import('@/types/rbac').TenantMembership
}) {
  useAuthStore.getState().setUser(data.user)
  const tenant = useTenantStore.getState().tenant
  const sessionInput = resolveSessionRestoreInput(data)
  if (tenant && sessionInput) {
    const { roles } = normalizeTenantPermissions(sessionInput, tenant.id)
    if (roles.length > 0) useRbacStore.getState().setTenantRoles(tenant.id, roles)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  useAuthStore.getState().setUser(null)
  useRbacStore.getState()._resetStore()
  if (typeof localStorage !== 'undefined') localStorage.removeItem(MOCK_SESSION_KEY)
  // These hydration tests exercise the same tenant-scoped setTenantRoles()
  // call AuthBootstrapper makes — which is now a no-op unless a tenant has
  // actually resolved (tenant !== null). Simulate the correctly-ordered
  // case (tenant resolution completed before auth hydration runs) rather
  // than leaving `tenant` at its default `null`.
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
})

describe('P10.7 — getMe() returns user only (no session email set)', () => {
  it('existing behavior continues: resolves to the fallback MOCK_USER, nested under `user`, with an empty activeMembership', async () => {
    const promise = authService.getMe()
    await vi.runAllTimersAsync()
    const { user, activeMembership } = await promise
    expect(user.id).toBe('1')
    expect(user.accountType).toBe('customer')
    expect(typeof user.email).toBe('string')
    expect(activeMembership).toBeUndefined()
  })
})

describe('P10.7 — getMe() returns tenant roles (via activeMembership) for a known demo session', () => {
  it('cashier@samoon.com: getMe() returns activeMembership.roles === ["cashier"], matching MOCK_CREDENTIALS.p7Roles', async () => {
    localStorage.setItem(MOCK_SESSION_KEY, 'cashier@samoon.com')
    const promise = authService.getMe()
    await vi.runAllTimersAsync()
    const { user, activeMembership } = await promise
    expect(user.email).toBe('cashier@samoon.com')
    expect(activeMembership?.roles).toEqual(['cashier'])
  })

  it('multirole@samoon.com: getMe() returns both roles', async () => {
    localStorage.setItem(MOCK_SESSION_KEY, 'multirole@samoon.com')
    const promise = authService.getMe()
    await vi.runAllTimersAsync()
    const { activeMembership } = await promise
    expect(activeMembership?.roles).toEqual(['cashier', 'kitchen'])
  })

  it('demo@samoon.com: getMe() returns an undefined activeMembership (matches its empty p7Roles)', async () => {
    localStorage.setItem(MOCK_SESSION_KEY, 'demo@samoon.com')
    const promise = authService.getMe()
    await vi.runAllTimersAsync()
    const { memberships, activeMembership } = await promise
    expect(memberships).toEqual([])
    expect(activeMembership).toBeUndefined()
  })
})

describe('P10.7 — page reload simulation: tenant roles now restored from auth bootstrap, not only localStorage', () => {
  it('BEFORE: clearing useRbacStore leaves tenantRoles empty even though the "logged in" user is a role-bearing account', async () => {
    // Simulates what happens today the instant useRbacStore's own
    // persistence is cleared (e.g. a private/incognito reload, or a
    // future phase's partialize excluding tenantRoles) with no
    // session-restore hydration wired in — this is the exact gap
    // P10.6 §3 documented.
    useAuthStore.getState().setUser({
      id: 'x', email: 'owner@samoon.com', first_name: 'O', last_name: 'W',
      accountType: 'customer', is_verified: true, created_at: new Date().toISOString(),
    })
    useRbacStore.getState()._resetStore()
    expect(useRbacStore.getState().tenantRoles).toEqual([])
  })

  it('AFTER: authService.getMe() + the AuthBootstrapper hydration step restores tenant roles without touching localStorage persistence', async () => {
    localStorage.setItem(MOCK_SESSION_KEY, 'owner@samoon.com')
    useRbacStore.getState()._resetStore()
    expect(useRbacStore.getState().tenantRoles).toEqual([])

    const promise = authService.getMe()
    await vi.runAllTimersAsync()
    const data = await promise

    simulateSessionRestoreHydration(data)

    const tenantId = useTenantStore.getState().tenant!.id
    expect(useRbacStore.getState().getRolesForTenant(tenantId)).toEqual(['owner'])
  })
})

describe('P10.7 — missing RBAC payload: no crash, clean fallback', () => {
  it('a getMe()-shaped object with no memberships/activeMembership at all does not throw when hydrated', () => {
    const bareUser: User = {
      id: 'y', email: 'nobody@example.com', first_name: 'N', last_name: 'B',
      accountType: 'customer', is_verified: true, created_at: new Date().toISOString(),
    }
    expect(() => simulateSessionRestoreHydration({ user: bareUser })).not.toThrow()
    expect(useAuthStore.getState().user?.email).toBe('nobody@example.com')
    expect(useRbacStore.getState().tenantRoles).toEqual([])
  })

  it('an explicit empty memberships array does not throw and leaves the store empty', () => {
    const bareUser: User = {
      id: 'z', email: 'nobody2@example.com', first_name: 'N', last_name: 'B',
      accountType: 'customer', is_verified: true, created_at: new Date().toISOString(),
    }
    expect(() => simulateSessionRestoreHydration({ user: bareUser, memberships: [] })).not.toThrow()
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
      expect(meResult.activeMembership?.roles).toEqual(expectedRoles)
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
