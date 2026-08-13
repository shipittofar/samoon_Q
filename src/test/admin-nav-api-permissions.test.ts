/**
 * Real-backend permission source-of-truth — nav must not widen API grants
 * via client ROLE_PERMISSION_MAP / session∪store union.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRbacStore, useTenantStore } from '@/stores'
import { usePermissionStore } from '@/stores/permission-store'
import { usePermissions, usePermission, useHasDashboardAccess } from '@/hooks'
import { withDashboardAccess } from '@/lib/effective-permissions'

const TENANT_A = 'tenant-a-uuid'

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'false')
  useRbacStore.getState()._resetStore()
  useTenantStore.setState({
    tenant: { id: TENANT_A, slug: 'samoon', businessTypes: ['restaurant'] } as never,
    tenantState: 'resolved',
    rbacInitialized: true,
    featureFlagsInitialized: true,
    featureFlags: {},
  } as never)
  usePermissionStore.getState().clearPermissions()
  act(() => {
    useRbacStore.getState().setSessionMemberships(
      [{ tenantId: TENANT_A, tenantSlug: 'samoon', roles: ['owner'], branchAccess: { scope: 'all' } }],
      { tenantId: TENANT_A },
    )
  })
})

describe('withDashboardAccess', () => {
  it('adds dashboard:access when API omits it but roles/permissions exist', () => {
    expect(withDashboardAccess(['orders.view'], { hasTenantRoles: true })).toContain('dashboard:access')
    expect(withDashboardAccess([], { hasTenantRoles: true })).toEqual(['dashboard:access'])
    expect(withDashboardAccess([], { hasTenantRoles: false })).toEqual([])
  })
})

describe('Real backend — API permissions are authoritative', () => {
  it('does not grant analytics.view from owner role when API omits it', () => {
    act(() => {
      useRbacStore.getState().setCurrentTenantSession(
        TENANT_A,
        ['owner'],
        [], // real-mode seed: empty until API returns
        { scope: 'all' },
      )
      usePermissionStore.getState().setPermissions(
        ['orders.view', 'menu.view', 'analytics.export', 'dashboard:access'],
        TENANT_A,
      )
    })

    const { result: perms } = renderHook(() => usePermissions())
    expect(perms.current).toContain('orders.view')
    expect(perms.current).toContain('analytics.export')
    expect(perms.current).not.toContain('analytics.view')
    expect(perms.current).not.toContain('audit.view')
    expect(perms.current).not.toContain('tenant.manage')

    const { result: analytics } = renderHook(() => usePermission('analytics.view'))
    expect(analytics.current).toBe(false)

    const { result: orders } = renderHook(() => usePermission('orders.view'))
    expect(orders.current).toBe(true)
  })

  it('returns empty permissions before the API cache is scoped to the tenant', () => {
    act(() => {
      useRbacStore.getState().setCurrentTenantSession(TENANT_A, ['owner'], [], { scope: 'all' })
    })
    const { result } = renderHook(() => usePermissions())
    expect(result.current).toEqual([])
  })

  it('provisionally grants dashboard access while permissions load when roles exist', () => {
    act(() => {
      useRbacStore.getState().setCurrentTenantSession(TENANT_A, ['manager'], [], { scope: 'all' })
      usePermissionStore.setState({ loading: true, tenantId: null, permissions: [] })
    })

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)
  })

  it('does not crash when currentTenantSession and activeMembership are both null (pre-bootstrap)', () => {
    act(() => {
      useRbacStore.getState()._resetStore()
      usePermissionStore.setState({ loading: true, tenantId: null, permissions: [] })
    })
    expect(useRbacStore.getState().currentTenantSession).toBeNull()
    expect(useRbacStore.getState().activeMembership).toBeNull()

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(false)
  })
})
