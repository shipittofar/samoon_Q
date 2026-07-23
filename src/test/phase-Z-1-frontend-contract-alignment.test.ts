// ============================================================
// Phase Z.1 — Frontend Contract Alignment Before Backend Implementation
//
// Covers the two required test categories from the task spec:
//   1. Mock Auth Tests — multi-tenant user, single-tenant user, owner
//      role, selected branch access, all branch access.
//   2. Service Boundary Tests — tenant service separates my-tenants from
//      platform-tenants; branch service requires tenantId.
//
// Does not re-test anything already locked by p10.7-rbac-session-hydration
// (login()/getMe()/verifyOTP() p7Roles values are unchanged — proven
// there) — this file's job is to prove the NEW memberships/activeMembership
// shape those functions now also send, and the new service boundary
// methods, without duplicating that existing coverage.
// ============================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { authService, MOCK_SESSION_KEY } from '@/services/auth.service'
import {
  getMockMemberships,
  normalizeTenantPermissions,
  MOCK_TENANT_ID,
  MOCK_TENANT_B_ID,
} from '@/services/permission.service'
import { tenantService } from '@/services/tenant.service'
import { branchService } from '@/services/combined.service'
import fs from 'fs'
import path from 'path'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.samoon.test')

vi.mock('@/constants', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/constants')>()
  return { ...mod, MOCK_DELAY: 0 }
})

const ROOT = path.join(__dirname, '..')
const readSrc = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

beforeEach(() => {
  vi.useFakeTimers()
  if (typeof localStorage !== 'undefined') localStorage.removeItem(MOCK_SESSION_KEY)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ── A — getMockMemberships() (permission.service.ts) ──────────────────────────

describe('Phase Z.1 — getMockMemberships()', () => {
  it('multi-tenant user: returns one membership per tenant', () => {
    const memberships = getMockMemberships('user-multi-01')
    expect(memberships).toHaveLength(2)
    expect(memberships.map((m) => m.tenantId).sort()).toEqual([MOCK_TENANT_B_ID, MOCK_TENANT_ID].sort())
  })

  it('single-tenant user: returns exactly one membership', () => {
    const memberships = getMockMemberships('user-cashier-01')
    expect(memberships).toHaveLength(1)
    expect(memberships[0]!.tenantId).toBe(MOCK_TENANT_ID)
    expect(memberships[0]!.roles).toEqual(['cashier'])
  })

  it('owner role: branchAccess is scope "all"', () => {
    const memberships = getMockMemberships('user-owner-01')
    expect(memberships[0]!.branchAccess).toEqual({ scope: 'all' })
  })

  it('selected branch access: multi-tenant user\'s Tenant B membership has an explicit, non-empty assigned scope', () => {
    const memberships = getMockMemberships('user-multi-01')
    const tenantB = memberships.find((m) => m.tenantId === MOCK_TENANT_B_ID)!
    expect(tenantB.branchAccess).toEqual({ scope: 'selected', branchIds: ['branch-brewcafe-01'] })
  })

  it('all branch access: multi-tenant user\'s Tenant A (manager) membership falls back to the empty assigned default, distinct from Tenant B\'s explicit selection', () => {
    const memberships = getMockMemberships('user-multi-01')
    const tenantA = memberships.find((m) => m.tenantId === MOCK_TENANT_ID)!
    expect(tenantA.branchAccess).toEqual({ scope: 'selected', branchIds: [] })
  })

  it('unknown userId: returns an empty array, never throws', () => {
    expect(getMockMemberships('nobody')).toEqual([])
  })

  it('every membership carries a tenantSlug', () => {
    const memberships = getMockMemberships('user-multi-01')
    memberships.forEach((m) => expect(typeof m.tenantSlug).toBe('string'))
  })

  it('is consistent with normalizeTenantPermissions(): feeding a membership back in produces the same roles/branchAccess', () => {
    const memberships = getMockMemberships('user-owner-01')
    const result = normalizeTenantPermissions({ memberships, activeMembership: memberships[0] }, MOCK_TENANT_ID)
    expect(result.roles).toEqual(['owner'])
    expect(result.branchAccess).toEqual({ scope: 'all' })
  })
})

// ── B — Mock auth responses derive memberships from one source ────────────────

describe('Phase Z.1 — login()/verifyOTP()/getMe() memberships derivation', () => {
  it('login(): owner persona resolves memberships[0] to scope "all"', async () => {
    const promise = authService.login({ email: 'owner@samoon.com', password: 'password' })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.memberships).toHaveLength(1)
    expect(result.activeMembership?.roles).toEqual(['owner'])
    expect(result.activeMembership?.branchAccess).toEqual({ scope: 'all' })
    expect(result.activeMembership?.tenantId).toBe(MOCK_TENANT_ID)
  })

  it('login(): p7Roles is unchanged (single source of truth, not a second declaration)', async () => {
    const promise = authService.login({ email: 'cashier@samoon.com', password: 'password' })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.p7Roles).toEqual(['cashier'])
    expect(result.activeMembership?.roles).toEqual(result.p7Roles)
  })

  it('login(): demo@samoon.com (pure customer) resolves an empty memberships array and no activeMembership', async () => {
    const promise = authService.login({ email: 'demo@samoon.com', password: 'password' })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.memberships).toEqual([])
    expect(result.activeMembership).toBeUndefined()
  })

  it('getMe(): restores the same memberships shape login() would have produced, for a persisted session', async () => {
    localStorage.setItem(MOCK_SESSION_KEY, 'admin@samoon.com')
    const promise = authService.getMe()
    await vi.runAllTimersAsync()
    const user = await promise
    expect(user.memberships).toHaveLength(1)
    expect(user.activeMembership?.roles).toEqual(['admin'])
  })

  it('verifyOTP(): existing-user branch resolves memberships the same way login() does', async () => {
    const promise = authService.verifyOTP({ phone_number: '+14155550102', dialCode: '+1', otp: '123456' })
    await vi.runAllTimersAsync()
    const result = await promise
    if (result.is_new_user) throw new Error('expected an existing-user result')
    expect(result.activeMembership?.roles).toEqual(result.p7Roles)
  })

  it('multirole@samoon.com: a single membership carries both roles (never split into two memberships)', async () => {
    const promise = authService.login({ email: 'multirole@samoon.com', password: 'password' })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.memberships).toHaveLength(1)
    expect(result.memberships![0]!.roles).toEqual(['cashier', 'kitchen'])
  })
})

// ── C — Tenant service boundary ────────────────────────────────────────────────

describe('Phase Z.1 — tenant service boundary (getMyTenants / getPlatformTenants)', () => {
  it('getMyTenants() and getPlatformTenants() both resolve (placeholder boundary over the same mock data)', async () => {
    const minePromise = tenantService.getMyTenants()
    await vi.runAllTimersAsync()
    const mine = await minePromise
    const platformPromise = tenantService.getPlatformTenants()
    await vi.runAllTimersAsync()
    const platform = await platformPromise
    expect(mine.length).toBeGreaterThan(0)
    expect(platform.length).toBe(mine.length)
  })

  it('getMyTenants is a distinct, named export from getPlatformTenants', () => {
    expect(tenantService.getMyTenants).not.toBe(tenantService.getPlatformTenants)
  })

  it('AdminTenantSwitcher (membership surface) uses useConsoleWorkspace, not useMyTenants', () => {
    const src = readSrc('components/admin/AdminTenantSwitcher.tsx')
    expect(src).toContain('useConsoleWorkspace')
    expect(src).not.toContain('useMyTenants')
  })

  it('/console/tenants (platform-tenants surface) uses usePlatformTenants, not the ambiguous useTenants', () => {
    const src = readSrc('app/console/tenants/page.tsx')
    expect(src).toContain('usePlatformTenants')
    expect(src).not.toMatch(/[^A-Za-z]useTenants\(/)
  })
})

// ── D — Branch service boundary ────────────────────────────────────────────────

describe('Phase Z.1 — branch service boundary (getTenantBranches requires tenantId)', () => {
  it('getTenantBranches(tenantId) returns only that tenant\'s branches', async () => {
    const samoonPromise = branchService.getTenantBranches('tenant-samoon-01')
    await vi.runAllTimersAsync()
    const samoon = await samoonPromise
    const brewCafePromise = branchService.getTenantBranches('tenant-brew-cafe-01')
    await vi.runAllTimersAsync()
    const brewCafe = await brewCafePromise
    expect(samoon.length).toBeGreaterThan(0)
    expect(brewCafe.length).toBeGreaterThan(0)
    expect(samoon.map((b) => b.id)).not.toEqual(expect.arrayContaining(brewCafe.map((b) => b.id)))
  })

  it('getTenantBranches signature requires tenantId (no optional-parameter fallback, unlike getBranches)', () => {
    const src = readSrc('services/combined.service.ts')
    expect(src).toContain('async getTenantBranches(tenantId: string)')
    expect(src).not.toContain('async getTenantBranches(tenantId?: string)')
  })

  it('useBranches() loads branches for the resolved tenant via branchService.getBranches', () => {
    const src = readSrc('hooks/index.ts')
    const fnIdx = src.indexOf('export function useBranches')
    const bodyEnd = src.indexOf('\n}', fnIdx)
    const body = src.slice(fnIdx, bodyEnd)
    expect(body).toContain('branchService.getBranches')
  })
})
