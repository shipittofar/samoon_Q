/**
 * Effective permissions are authoritative for feature authorization.
 * role ("owner") ≠ ALL_PERMISSIONS when the backend sends an explicit list.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRbacStore, useTenantStore } from '@/stores'
import { usePermissionStore } from '@/stores/permission-store'
import {
  usePermissions,
  usePermission,
  useHasDashboardAccess,
  useAdminModuleNav,
} from '@/hooks'
import { normalizeTenantPermissions } from '@/services/permission.service'
import {
  normalizeGetMeResponse,
  pickTenantRoleGrants,
  mergeTenantRolePermissionsOntoMemberships,
} from '@/lib/auth-me-normalizer'
import { applyTenantSessionRbac } from '@/lib/auth-session-rbac'
import type { TenantMembership } from '@/types/rbac'

const TENANT_A = 'tenant-a-uuid'
const TENANT_B = 'tenant-b-uuid'

function seedActiveTenant(
  tenantId: string,
  roles: TenantMembership['roles'],
  permissions: string[] | undefined,
) {
  const membership: TenantMembership = {
    tenantId,
    tenantSlug: tenantId === TENANT_A ? 'tenant-a' : 'tenant-b',
    roles,
    branchAccess: { scope: 'all' },
    ...(permissions !== undefined ? { permissions: permissions as never } : {}),
  }
  act(() => {
    useRbacStore.getState().setSessionMemberships([membership], { tenantId })
    useTenantStore.setState({
      tenant: { id: tenantId, slug: membership.tenantSlug!, businessTypes: ['restaurant'] } as never,
      tenantState: 'resolved',
      rbacInitialized: true,
      featureFlagsInitialized: true,
      featureFlags: {},
    } as never)
  })
  return membership
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'false')
  useRbacStore.getState()._resetStore()
  usePermissionStore.getState().clearPermissions()
})

describe('auth-me normalizer preserves tenantRoles[].permissions', () => {
  it('pickTenantRoleGrants keeps role + permissions', () => {
    const grants = pickTenantRoleGrants([
      { role: 'owner', permissions: ['menu.view', 'orders.view'] },
    ])
    expect(grants).toEqual([
      { role: 'owner', permissions: ['menu.view', 'orders.view'] },
    ])
  })

  it('mergeTenantRolePermissionsOntoMemberships attaches explicit list', () => {
    const memberships: TenantMembership[] = [
      {
        tenantId: TENANT_A,
        roles: ['owner'],
        branchAccess: { scope: 'all' },
      },
    ]
    const merged = mergeTenantRolePermissionsOntoMemberships(memberships, [
      { role: 'owner', permissions: ['menu.view', 'orders.view'] },
    ])
    expect(merged[0].permissions).toEqual(['menu.view', 'orders.view'])
  })

  it('normalizeGetMeResponse merges root tenantRoles permissions onto memberships', () => {
    const response = normalizeGetMeResponse({
      user: {
        id: 'u1',
        email: 'owner@samoon.com',
        first_name: 'O',
        last_name: 'W',
        accountType: 'business',
        is_verified: true,
        created_at: '2024-01-01T00:00:00.000Z',
      },
      memberships: [
        {
          tenantId: TENANT_A,
          tenantSlug: 'a',
          roles: ['owner'],
          branchAccess: { scope: 'all' },
        },
      ],
      activeMembership: { tenantId: TENANT_A },
      tenantRoles: [
        {
          role: 'owner',
          permissions: ['menu.view', 'menu.manage', 'orders.view'],
        },
      ],
    })

    expect(response.memberships?.[0].roles).toEqual(['owner'])
    expect(response.memberships?.[0].permissions).toEqual([
      'menu.view',
      'menu.manage',
      'orders.view',
    ])
    expect(response.activeMembership?.permissions).toEqual([
      'menu.view',
      'menu.manage',
      'orders.view',
    ])
  })
})

describe('normalizeTenantPermissions — explicit list beats owner role map', () => {
  it('owner + explicit subset does not become ALL_PERMISSIONS', () => {
    const result = normalizeTenantPermissions({
      memberships: [
        {
          tenantId: TENANT_A,
          roles: ['owner'],
          permissions: ['menu.view', 'orders.view'],
          branchAccess: { scope: 'all' },
        },
      ],
      activeMembership: { tenantId: TENANT_A, roles: ['owner'], branchAccess: { scope: 'all' } },
    })
    expect(result.permissionsSource).toBe('explicit')
    expect(result.permissions).toEqual(['menu.view', 'orders.view'])
    expect(result.permissions).not.toContain('analytics.view')
    expect(result.permissions).not.toContain('audit.view')
    expect(result.permissions).not.toContain('kitchen.view')
  })

  it('owner + explicit empty list denies all features', () => {
    const result = normalizeTenantPermissions({
      memberships: [
        {
          tenantId: TENANT_A,
          roles: ['owner'],
          permissions: [],
          branchAccess: { scope: 'all' },
        },
      ],
      activeMembership: { tenantId: TENANT_A, roles: ['owner'], branchAccess: { scope: 'all' } },
    })
    expect(result.permissionsSource).toBe('explicit')
    expect(result.permissions).toEqual([])
  })

  it('manager + explicit analytics.view grants only that set', () => {
    const result = normalizeTenantPermissions({
      memberships: [
        {
          tenantId: TENANT_A,
          roles: ['manager'],
          permissions: ['analytics.view'],
          branchAccess: { scope: 'all' },
        },
      ],
      activeMembership: { tenantId: TENANT_A, roles: ['manager'], branchAccess: { scope: 'all' } },
    })
    expect(result.permissions).toEqual(['analytics.view'])
    expect(result.permissionsSource).toBe('explicit')
  })
})

describe('usePermission / nav — owner without permission is denied', () => {
  it('owner + analytics.view present → allowed', () => {
    seedActiveTenant(TENANT_A, ['owner'], ['analytics.view', 'dashboard:access'])
    act(() => {
      useRbacStore.getState().setCurrentTenantSession(TENANT_A, ['owner'], [], { scope: 'all' })
      usePermissionStore.getState().setPermissions(['analytics.view', 'dashboard:access'], TENANT_A)
    })
    const { result } = renderHook(() => usePermission('analytics.view'))
    expect(result.current).toBe(true)
  })

  it('owner + analytics.view absent → denied', () => {
    seedActiveTenant(TENANT_A, ['owner'], ['menu.view', 'orders.view', 'dashboard:access'])
    act(() => {
      useRbacStore.getState().setCurrentTenantSession(TENANT_A, ['owner'], [], { scope: 'all' })
      usePermissionStore.getState().setPermissions(
        ['menu.view', 'orders.view', 'dashboard:access'],
        TENANT_A,
      )
    })
    expect(renderHook(() => usePermission('analytics.view')).result.current).toBe(false)
    expect(renderHook(() => usePermission('menu.view')).result.current).toBe(true)
  })

  it('owner without analytics.view hides Analytics nav', () => {
    seedActiveTenant(TENANT_A, ['owner'], ['menu.view', 'orders.view', 'dashboard:access'])
    act(() => {
      useRbacStore.getState().setCurrentTenantSession(TENANT_A, ['owner'], [], { scope: 'all' })
      usePermissionStore.getState().setPermissions(
        ['menu.view', 'orders.view', 'dashboard:access'],
        TENANT_A,
      )
    })
    const { result } = renderHook(() => useAdminModuleNav())
    expect(result.current.some((i) => i.href === '/console/analytics')).toBe(false)
    expect(result.current.some((i) => i.href === '/console/menu')).toBe(true)
  })

  it('non-owner with analytics.view → allowed; without → denied', () => {
    seedActiveTenant(TENANT_A, ['manager'], ['analytics.view', 'dashboard:access'])
    act(() => {
      useRbacStore.getState().setCurrentTenantSession(TENANT_A, ['manager'], [], { scope: 'all' })
      usePermissionStore.getState().setPermissions(['analytics.view', 'dashboard:access'], TENANT_A)
    })
    expect(renderHook(() => usePermission('analytics.view')).result.current).toBe(true)

    act(() => {
      usePermissionStore.getState().setPermissions(['orders.view', 'dashboard:access'], TENANT_A)
    })
    expect(renderHook(() => usePermission('analytics.view')).result.current).toBe(false)
  })

  it('bootstrap unsettled → empty admin nav (no owner flash)', () => {
    seedActiveTenant(TENANT_A, ['owner'], undefined)
    act(() => {
      useRbacStore.getState().setCurrentTenantSession(TENANT_A, ['owner'], [], { scope: 'all' })
      usePermissionStore.setState({ loading: true, tenantId: null, permissions: [] })
    })
    const { result } = renderHook(() => useAdminModuleNav())
    expect(result.current).toEqual([])
  })

  it('owner retains console shell access via dashboard:access without feature grants', () => {
    seedActiveTenant(TENANT_A, ['owner'], ['dashboard:access'])
    act(() => {
      useRbacStore.getState().setCurrentTenantSession(TENANT_A, ['owner'], [], { scope: 'all' })
      usePermissionStore.getState().setPermissions(['dashboard:access'], TENANT_A)
    })
    expect(renderHook(() => useHasDashboardAccess()).result.current).toBe(true)
    expect(renderHook(() => usePermission('analytics.view')).result.current).toBe(false)
  })
})

describe('tenant switch replaces effective permissions', () => {
  it('permission present on A is denied after switching to B without it', () => {
    const membershipA: TenantMembership = {
      tenantId: TENANT_A,
      tenantSlug: 'a',
      roles: ['owner'],
      permissions: ['analytics.view', 'dashboard:access'],
      branchAccess: { scope: 'all' },
    }
    const membershipB: TenantMembership = {
      tenantId: TENANT_B,
      tenantSlug: 'b',
      roles: ['owner'],
      permissions: ['menu.view', 'dashboard:access'],
      branchAccess: { scope: 'all' },
    }

    act(() => {
      useRbacStore.getState().setSessionMemberships([membershipA, membershipB], {
        tenantId: TENANT_A,
      })
      useTenantStore.setState({
        tenant: { id: TENANT_A, slug: 'a', businessTypes: ['restaurant'] } as never,
        tenantState: 'resolved',
        rbacInitialized: true,
        featureFlagsInitialized: true,
        featureFlags: {},
      } as never)
      useRbacStore.getState().setCurrentTenantSession(TENANT_A, ['owner'], [], { scope: 'all' })
      usePermissionStore.getState().setPermissions(
        ['analytics.view', 'dashboard:access'],
        TENANT_A,
      )
    })
    expect(renderHook(() => usePermission('analytics.view')).result.current).toBe(true)

    // Simulate post-switch RBAC seed for Tenant B (explicit list only — no role map).
    act(() => {
      useRbacStore.getState().setSessionMemberships([membershipA, membershipB], {
        tenantId: TENANT_B,
      })
      useTenantStore.setState({
        tenant: { id: TENANT_B, slug: 'b', businessTypes: ['restaurant'] } as never,
        tenantState: 'resolved',
      } as never)
      const normalized = normalizeTenantPermissions(
        { memberships: [membershipA, membershipB], activeMembership: membershipB },
        TENANT_B,
      )
      expect(normalized.permissionsSource).toBe('explicit')
      expect(normalized.permissions).not.toContain('analytics.view')
      useRbacStore.getState().setCurrentTenantSession(
        TENANT_B,
        normalized.roles,
        normalized.permissions,
        normalized.branchAccess,
      )
      usePermissionStore.getState().setPermissions(normalized.permissions, TENANT_B)
    })

    expect(useRbacStore.getState().currentTenantSession?.tenantId).toBe(TENANT_B)
    expect(usePermissionStore.getState().tenantId).toBe(TENANT_B)
    expect(renderHook(() => usePermission('analytics.view')).result.current).toBe(false)
    expect(renderHook(() => usePermission('menu.view')).result.current).toBe(true)
    expect(
      renderHook(() => useAdminModuleNav()).result.current.some((i) => i.href === '/console/analytics'),
    ).toBe(false)
  })

  it('applyTenantSessionRbac seeds explicit permissions without role-map expansion', () => {
    const membership: TenantMembership = {
      tenantId: TENANT_A,
      tenantSlug: 'a',
      roles: ['owner'],
      permissions: ['orders.view'],
      branchAccess: { scope: 'all' },
    }
    act(() => {
      useRbacStore.getState().setSessionMemberships([membership], { tenantId: TENANT_A })
      applyTenantSessionRbac(TENANT_A, {
        memberships: [membership],
        activeMembership: membership,
      })
    })
    const session = useRbacStore.getState().currentTenantSession
    expect(session?.roles).toEqual(['owner'])
    expect(session?.permissions).toContain('orders.view')
    expect(session?.permissions).not.toContain('analytics.view')
    expect(session?.permissions).not.toContain('audit.view')
    expect(usePermissionStore.getState().permissions).toEqual(
      expect.arrayContaining(['orders.view', 'dashboard:access']),
    )
    expect(usePermissionStore.getState().permissions).not.toContain('analytics.view')
  })
})
