// P10.3.1 — Dashboard Access Audit
//
// Phase 2 (RBAC unification) rewrite: useHasDashboardAccess() no longer
// consults Owner/Staff/Tenant eligibility (isOwnerEligible/
// isStaffMemberEligible/isTenantEligible, all removed from the runtime
// path). It is now a thin wrapper over usePermission('dashboard:access'),
// which reads exclusively from useRbacStore.currentTenantSession — the
// single RBAC source of truth. These tests verify that single-source
// behavior, replacing the old ownership-eligibility assertions.

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHasDashboardAccess } from '@/hooks'
import { useAuthStore, useTenantStore, useRbacStore } from '@/stores'
import { tenantService } from '@/services/tenant.service'
import { normalizeTenantPermissions } from '@/services/permission.service'
import type { User, Tenant } from '@/types'

function userFor(email: string, role: User['role'] = 'customer'): User {
  return {
    id: 'test-user-' + email,
    email,
    first_name: 'Test',
    last_name: 'User',
    role,
    is_verified: true,
    created_at: new Date().toISOString(),
  }
}

async function tenantById(id: string): Promise<Tenant> {
  const tenants = await tenantService.getTenants()
  const tenant = tenants.find((t) => t.id === id)
  if (!tenant) throw new Error(`Tenant not found in fixtures: ${id}`)
  return tenant
}

beforeEach(() => {
  tenantService._resetMockList()
  useAuthStore.getState().setUser(null)
  useRbacStore.getState().clearCurrentTenantSession()
})

describe('P10.3.1 — useHasDashboardAccess reads only currentTenantSession', () => {
  it('grants access once currentTenantSession carries a role for the active tenant', async () => {
    const samoon = await tenantById('tenant-samoon-01')
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('someone@samoon.com', 'customer'))
    const { permissions } = normalizeTenantPermissions(['owner'])
    useRbacStore.getState().setCurrentTenantSession(samoon.id, ['owner'], permissions)

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)
  })

  it('denies access when no currentTenantSession has been set, regardless of user role', async () => {
    const samoon = await tenantById('tenant-samoon-01')
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('someone@samoon.com', 'admin'))
    // No setCurrentTenantSession call — must not fall back to any
    // ownership/staff/role-string check.

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(false)
  })

  it('denies access when currentTenantSession belongs to a different tenant', async () => {
    const samoon = await tenantById('tenant-samoon-01')
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('someone@samoon.com', 'owner'))
    const { permissions } = normalizeTenantPermissions(['owner'])
    useRbacStore.getState().setCurrentTenantSession('some-other-tenant', ['owner'], permissions)

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(false)
  })

  it('denies access when the resolved role grants no permissions', async () => {
    const samoon = await tenantById('tenant-samoon-01')
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('someone@samoon.com', 'customer'))
    useRbacStore.getState().setCurrentTenantSession(samoon.id, [], [])

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(false)
  })
})
