// ============================================================
// P10.3.2 — Zero Trust Access Path Audit
// Phase J/K — explicit cache-isolation proof + regression coverage.
//
// Verifies the actual mechanisms useLogout() (hooks/index.ts) and
// AdminTenantSwitcher.switchTenant() rely on: QueryClient.clear() and
// the per-store reset/clear actions. This does not re-test React
// rendering (already covered by context-integrity.test.ts's source-text
// check) — it proves the underlying primitives actually behave as
// claimed against a populated cache/store, which is the real security
// property ("no Tenant A data remains after switching to Tenant B").
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { useRbacStore, useCartStore, useFavoritesStore, useRecentlyViewedStore, useDineInStore, useBranchStore } from '@/stores'

function populateTenantAState(qc: QueryClient) {
  qc.setQueryData(['admin-orders', 'tenant-A', {}], [{ id: 'order-a-1' }])
  qc.setQueryData(['admin-reservations', 'tenant-A', {}], [{ id: 'res-a-1' }])
  qc.setQueryData(['branch-orders', 'branch-A-01'], [{ id: 'order-a-branch-1' }])
  qc.setQueryData(['staff', 'tenant-A'], [{ id: 'staff-a-1' }])
  qc.setQueryData(['operations-dashboard', 'tenant-A', 'branch-A-01'], { snapshot: 'tenant-a-data' })

  useCartStore.setState({ items: [{ id: 'item-a-1', quantity: 2 }] } as never)
  useDineInStore.getState().setTableNumber(42)
  useFavoritesStore.getState().setFavorites(['fav-a-1', 'fav-a-2'])
  useRecentlyViewedStore.setState({ items: [{ id: 'viewed-a-1' }] } as never)
  useBranchStore.getState().setAdminActiveBranch({ id: 'branch-A-01' } as never)
  useRbacStore.setState({
    tenantRoles: [{ tenantId: 'tenant-A', roles: ['owner'] }],
    userOverrides: [{ userId: 'u1', tenantId: 'tenant-A', grant: [], revoke: [] }],
    customRoles: [{ id: 'r1', tenantId: 'tenant-A', name: 'Custom', permissions: [], createdBy: 'u2', createdAt: new Date().toISOString() }],
    rbacAuditLog: [{ id: 'e1', tenantId: 'tenant-A', actorId: 'u2', action: 'role.assigned', timestamp: new Date().toISOString() }],
  } as never)
}

/** Mirrors exactly the reset sequence inside useLogout()'s onSettled (hooks/index.ts). */
function simulateLogoutCleanup(qc: QueryClient) {
  useRbacStore.getState()._resetStore()
  useBranchStore.getState().setAdminActiveBranch(null)
  useCartStore.getState().clearCart()
  useDineInStore.getState().clearTable()
  useFavoritesStore.getState().setFavorites([])
  useRecentlyViewedStore.getState().clear()
  qc.clear()
}

/** Mirrors exactly the reset sequence inside AdminTenantSwitcher.switchTenant() (tenant-scoped state only). */
function simulateTenantSwitchCleanup(qc: QueryClient) {
  useBranchStore.getState().setAdminActiveBranch(null)
  useCartStore.getState().clearCart()
  useDineInStore.getState().clearTable()
  useFavoritesStore.getState().setFavorites([])
  useRecentlyViewedStore.getState().clear()
  qc.clear()
}

describe('P10.3.2 Phase J — Cache Isolation Proof: Scenario 1 (Tenant A → logout → Tenant B)', () => {
  let qc: QueryClient

  beforeEach(() => {
    qc = new QueryClient()
  })

  it('no Tenant A query cache remains after the logout cleanup sequence', () => {
    populateTenantAState(qc)
    expect(qc.getQueryData(['admin-orders', 'tenant-A', {}])).toBeDefined()

    simulateLogoutCleanup(qc)

    expect(qc.getQueryData(['admin-orders', 'tenant-A', {}])).toBeUndefined()
    expect(qc.getQueryData(['admin-reservations', 'tenant-A', {}])).toBeUndefined()
    expect(qc.getQueryData(['branch-orders', 'branch-A-01'])).toBeUndefined()
    expect(qc.getQueryData(['staff', 'tenant-A'])).toBeUndefined()
    expect(qc.getQueryData(['operations-dashboard', 'tenant-A', 'branch-A-01'])).toBeUndefined()
    expect(qc.getQueryCache().getAll()).toHaveLength(0)
  })

  it('no Tenant A cart/favorites/dine-in/branch/RBAC state remains after logout', () => {
    populateTenantAState(qc)
    simulateLogoutCleanup(qc)

    expect(useCartStore.getState().items).toEqual([])
    expect(useDineInStore.getState().tableNumber).toBeNull()
    expect(useFavoritesStore.getState().favorites.size).toBe(0)
    expect(useRecentlyViewedStore.getState().items).toEqual([])
    expect(useBranchStore.getState().adminActiveBranch).toBeNull()
    expect(useRbacStore.getState().tenantRoles).toEqual([])
    expect(useRbacStore.getState().userOverrides).toEqual([])
    expect(useRbacStore.getState().customRoles).toEqual([])
    expect(useRbacStore.getState().rbacAuditLog).toEqual([])
  })
})

describe('P10.3.2 Phase J — Cache Isolation Proof: Scenario 2 (Branch A → switch → Branch B)', () => {
  let qc: QueryClient

  beforeEach(() => {
    qc = new QueryClient()
  })

  it('no Branch A query cache or active-branch selection remains after a tenant/branch switch', () => {
    populateTenantAState(qc)
    expect(useBranchStore.getState().adminActiveBranch).toEqual({ id: 'branch-A-01' })

    simulateTenantSwitchCleanup(qc)

    expect(qc.getQueryData(['branch-orders', 'branch-A-01'])).toBeUndefined()
    expect(qc.getQueryCache().getAll()).toHaveLength(0)
    expect(useBranchStore.getState().adminActiveBranch).toBeNull()
    expect(useCartStore.getState().items).toEqual([])
  })

  it('tenantRoles remain correctly keyed per tenant — no cross-tenant permission bleed even without a full reset', () => {
    // Distinct from logout: a tenant switch re-seeds tenantRoles for the
    // NEW tenant via setTenantRoles(), not a full _resetStore(). Verify
    // the underlying store never lets tenant B's lookup read tenant A's
    // roles even when tenant A's entry is still technically present.
    useRbacStore.getState()._resetStore()
    useRbacStore.getState().setTenantRoles('tenant-A', ['owner'])
    useRbacStore.getState().setTenantRoles('tenant-B', ['cashier'])

    expect(useRbacStore.getState().getRolesForTenant('tenant-A')).toEqual(['owner'])
    expect(useRbacStore.getState().getRolesForTenant('tenant-B')).toEqual(['cashier'])
  })
})
