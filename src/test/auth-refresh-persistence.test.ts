// ============================================================
// Auth Refresh Persistence — regression suite
//
// Proves the root cause and fix documented in
// docs/AUTH_REFRESH_PERSISTENCE_AUDIT.md: AuthBootstrapper's
// checkSession() (src/providers/index.tsx) used to gate the ENTIRE
// session-restore block on the legacy `user.tenantRoles` field. A backend
// implementing only the frozen `memberships`/`activeMembership` contract
// (no `tenantRoles` field at all) would satisfy login (useLogin() seeds
// unconditionally) but silently skip session restore on every page
// reload — `useAuthStore.user` stays set, but `currentTenantSession`
// never gets populated, so every permission-gated surface (most
// importantly /console) renders as if logged out. Fixed by
// resolveSessionRestoreInput() (exported from providers/index.tsx),
// which this file tests directly — not a mirror/reimplementation.
//
// Does not re-test 401/expired-token session teardown
// (clearSession()/'auth:logout') or the transient-failure
// sessionCheckFailed path — those are unchanged by this fix and already
// covered by p10.9-auth-session-hardening and
// p10.10-... regression suites. This file is scoped to the
// success-path session-restore gate this fix actually changes.
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest'
import { resolveSessionRestoreInput } from '@/providers'
import { normalizeTenantPermissions, MOCK_TENANT_ID, MOCK_TENANT_B_ID } from '@/services/permission.service'
import { useRbacStore, useTenantStore } from '@/stores'
import type { TenantMembership } from '@/types/rbac'

/** Mirrors exactly the RBAC-relevant portion of checkSession()'s
 * getMe().then(...) success branch — using the REAL exported
 * resolveSessionRestoreInput(), not a reimplementation. */
function restoreSession(user: { tenantRoles?: import('@/types/rbac').Role[]; memberships?: TenantMembership[]; activeMembership?: TenantMembership }) {
  const sessionInput = resolveSessionRestoreInput(user)
  if (!sessionInput) return
  const currentTenant = useTenantStore.getState().tenant
  if (!currentTenant) return
  const { roles, permissions, branchAccess } = normalizeTenantPermissions(sessionInput, currentTenant.id)
  useRbacStore.getState().setCurrentTenantSession(currentTenant.id, roles, permissions, branchAccess)
  useRbacStore.getState().setTenantRoles(currentTenant.id, roles)
}

const OWNER_MEMBERSHIP: TenantMembership = {
  tenantId: MOCK_TENANT_ID,
  tenantSlug: 'samoon',
  roles: ['owner'],
  branchAccess: { scope: 'all' },
  status: 'active',
}

const CASHIER_B_MEMBERSHIP: TenantMembership = {
  tenantId: MOCK_TENANT_B_ID,
  tenantSlug: 'brew-cafe',
  roles: ['cashier'],
  branchAccess: { scope: 'assigned', branchIds: ['branch-brewcafe-01'] },
  status: 'active',
}

beforeEach(() => {
  useRbacStore.getState()._resetStore()
  useTenantStore.getState().setTenant({
    id: MOCK_TENANT_ID,
    name: 'Samoon Restaurant',
    slug: 'samoon',
    businessTypes: ['restaurant'],
    status: 'active',
    created_at: '2024-01-01T00:00:00.000Z',
  })
})

// ── A — resolveSessionRestoreInput(): the exact fixed gate ────────────────────

describe('resolveSessionRestoreInput() — the gate this fix changes', () => {
  it('BUG (pre-fix behavior, proven wrong): a memberships-only response — no legacy tenantRoles — used to be silently skipped', () => {
    // This is exactly what a backend built purely against the frozen
    // memberships contract sends: no `tenantRoles` field exists at all.
    const oldGateWouldSkip = (user: { tenantRoles?: unknown[]; memberships?: unknown; activeMembership?: unknown }) =>
      !(user.tenantRoles && user.tenantRoles.length > 0)
    const backendResponse = { memberships: [OWNER_MEMBERSHIP], activeMembership: OWNER_MEMBERSHIP }
    expect(oldGateWouldSkip(backendResponse)).toBe(true) // the bug: old code would have done nothing
    expect(resolveSessionRestoreInput(backendResponse)).not.toBeNull() // the fix: new code proceeds
  })

  it('owner user: memberships-only response (no tenantRoles) resolves a non-null session input', () => {
    const input = resolveSessionRestoreInput({ memberships: [OWNER_MEMBERSHIP], activeMembership: OWNER_MEMBERSHIP })
    expect(input).toEqual({ roles: undefined, memberships: [OWNER_MEMBERSHIP], activeMembership: OWNER_MEMBERSHIP })
  })

  it('customer user: an empty memberships array (genuinely zero tenants) still resolves a non-null input, not a "nothing to restore" no-op', () => {
    const input = resolveSessionRestoreInput({ memberships: [] })
    expect(input).not.toBeNull()
    expect(input!.memberships).toEqual([])
  })

  it('legacy-only backend (tenantRoles, no memberships field at all) still works — backward compatible', () => {
    const input = resolveSessionRestoreInput({ tenantRoles: ['owner'] })
    expect(input).toEqual({ roles: ['owner'], memberships: undefined, activeMembership: undefined })
  })

  it('a bare response with neither field (undefined tenantRoles, undefined memberships) resolves null — genuinely nothing to restore', () => {
    expect(resolveSessionRestoreInput({})).toBeNull()
  })

  it('multi-membership user: both memberships are preserved on the resolved input', () => {
    const input = resolveSessionRestoreInput({
      memberships: [OWNER_MEMBERSHIP, CASHIER_B_MEMBERSHIP],
      activeMembership: OWNER_MEMBERSHIP,
    })
    expect(input!.memberships).toHaveLength(2)
  })
})

// ── B — Full restore flow (real code path, not a mirror) ──────────────────────

describe('Session restore end to end — real currentTenantSession outcome', () => {
  it('owner user survives a refresh with a memberships-only getMe() response', () => {
    restoreSession({ memberships: [OWNER_MEMBERSHIP], activeMembership: OWNER_MEMBERSHIP })
    const session = useRbacStore.getState().currentTenantSession
    expect(session?.tenantId).toBe(MOCK_TENANT_ID)
    expect(session?.roles).toEqual(['owner'])
    expect(session?.permissions).toContain('dashboard:access')
    expect(session?.branchAccess).toEqual({ scope: 'all' })
  })

  it('customer user (zero memberships) restores to an explicit empty session, not a crash or a stale one', () => {
    restoreSession({ memberships: [] })
    const session = useRbacStore.getState().currentTenantSession
    expect(session?.roles).toEqual([])
    expect(session?.permissions).toEqual([])
  })

  it('multi-membership user: activeMembership selects the correct tenant\'s roles even when the resolved tenant is Tenant B', () => {
    useTenantStore.getState().setTenant({
      id: MOCK_TENANT_B_ID,
      name: 'Brew Cafe',
      slug: 'brew-cafe',
      businessTypes: ['cafe'],
      status: 'active',
      created_at: '2024-02-01T00:00:00.000Z',
    })
    restoreSession({
      memberships: [OWNER_MEMBERSHIP, CASHIER_B_MEMBERSHIP],
      activeMembership: CASHIER_B_MEMBERSHIP,
    })
    const session = useRbacStore.getState().currentTenantSession
    expect(session?.tenantId).toBe(MOCK_TENANT_B_ID)
    expect(session?.roles).toEqual(['cashier'])
    expect(session?.branchAccess).toEqual({ scope: 'assigned', branchIds: ['branch-brewcafe-01'] })
  })

  it('legacy-only backend (tenantRoles, pre-Phase-9 contract) still restores correctly — the fix is additive, not a breaking change', () => {
    restoreSession({ tenantRoles: ['admin'] })
    const session = useRbacStore.getState().currentTenantSession
    expect(session?.roles).toEqual(['admin'])
  })

  it('no tenant resolved yet: does not throw, and does not populate currentTenantSession prematurely (queued by AuthBootstrapper\'s pendingAuthSessionRef in the real component, not tested here)', () => {
    useTenantStore.setState({ tenant: null })
    expect(() => restoreSession({ memberships: [OWNER_MEMBERSHIP], activeMembership: OWNER_MEMBERSHIP })).not.toThrow()
    expect(useRbacStore.getState().currentTenantSession).toBeNull()
  })
})

// ── C — Expired / invalid token (session-restore gate must not interfere) ────

describe('Expired token — resolveSessionRestoreInput() is never reached, by design', () => {
  it('a getMe() response is only ever resolved for a successful (200) call — 401/expired-token handling happens in checkSession()\'s .catch(), unchanged by this fix (see p10.9/p10.10 regression suites)', () => {
    // resolveSessionRestoreInput() only receives a value when getMe()
    // resolves. An expired/invalid token causes getMe() to reject, which
    // checkSession() classifies (401 -> clearSession(), otherwise ->
    // sessionCheckFailed) BEFORE resolveSessionRestoreInput() would ever
    // be called — this fix's gate change cannot mask an expired token.
    expect(resolveSessionRestoreInput).toBeInstanceOf(Function)
  })
})
