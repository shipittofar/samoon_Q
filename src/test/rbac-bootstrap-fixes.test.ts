/**
 * RBAC bootstrap fixes — regression coverage for console permission seeding.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { renderHook } from '@testing-library/react'
import { useRbacStore, useTenantStore } from '@/stores'
import { usePermissionStore } from '@/stores/permission-store'
import { usePermissions, useHasDashboardAccess } from '@/hooks'
import { normalizeTenantPermissions } from '@/services/permission.service'
import { applyTenantSessionRbac } from '@/lib/auth-session-rbac'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')

const TENANT_A = 'tenant-a-uuid'
const TENANT_B = 'tenant-b-uuid'
const ROOT = path.join(__dirname, '..')
const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

function ownerMembership(tenantId: string) {
  return {
    tenantId,
    tenantSlug: 'samoon',
    roles: ['owner' as const],
    branchAccess: { scope: 'all' as const },
  }
}

beforeEach(() => {
  useRbacStore.getState()._resetStore()
  useTenantStore.setState({ tenant: null, tenantState: 'not_found' } as never)
  usePermissionStore.getState().clearPermissions()
})

describe('Fix 1 — AuthBootstrapper console RBAC seeding', () => {
  it('always calls applyTenantSessionRbac on /console before tenant alignment', () => {
    const src = readSrc('providers/index.tsx')
    const block = src.slice(
      src.indexOf('// Console workspace resolves tenant by membership id'),
      src.indexOf('const fallbackTenantId = resolveConsoleTenantFallbackTenantId'),
    )
    expect(block).toContain('applyTenantSessionRbac(activeTenantId, sessionInput)')
    expect(block).not.toMatch(/if \(currentTenant\?\.id === activeTenantId\)[\s\S]*applyTenantSessionRbac/)
    expect(block).toContain('loadTenantById(activeTenantId)')
  })
})

describe('Fix 2 — console-workspace early-return RBAC seeding', () => {
  it('initializeFromSession and switchTenant call seedRbacAndRefreshForTenant on early return', () => {
    const src = readSrc('stores/console-workspace.ts')
    expect(src).toContain('async function seedRbacAndRefreshForTenant')
    expect(src).toMatch(
      /currentTenantId === targetTenantId && currentTenantState === 'resolved'[\s\S]*await seedRbacAndRefreshForTenant\(targetTenantId\)/,
    )
    expect(src).toMatch(
      /currentTenantId === tenantId && currentTenantState === 'resolved'[\s\S]*await seedRbacAndRefreshForTenant\(tenantId\)/,
    )
  })
})

describe('Fix 3 — permission cache refresh after RBAC seed', () => {
  it('seedRbacAndRefreshForTenant awaits refreshPermissionCache', () => {
    const src = readSrc('stores/console-workspace.ts')
    const fn = src.slice(src.indexOf('async function seedRbacAndRefreshForTenant'), src.indexOf('export const useConsoleWorkspaceStore'))
    expect(fn).toContain('await refreshPermissionCache(')
  })
})

describe('Fix 5 — usePermissions unions session + store', () => {
  it('unions session and store permissions when both exist for active tenant', () => {
    useRbacStore.getState().setSessionMemberships([ownerMembership(TENANT_A)], { tenantId: TENANT_A })
    const { permissions } = normalizeTenantPermissions(
      { memberships: [ownerMembership(TENANT_A)], activeMembership: { tenantId: TENANT_A } },
      TENANT_A,
    )
    useRbacStore.getState().setCurrentTenantSession(TENANT_A, ['owner'], permissions, { scope: 'all' })
    usePermissionStore.getState().setPermissions(['orders.view'], TENANT_A)

    const { result } = renderHook(() => usePermissions())
    expect(result.current).toContain('dashboard:access')
    expect(result.current).toContain('orders.view')
  })

  it('dashboard:access survives when store omits it but session has owner role', () => {
    useRbacStore.getState().setSessionMemberships([ownerMembership(TENANT_A)], { tenantId: TENANT_A })
    applyTenantSessionRbac(TENANT_A, {
      memberships: [ownerMembership(TENANT_A)],
      activeMembership: { tenantId: TENANT_A },
    })
    usePermissionStore.getState().setPermissions(['orders.view', 'menu.view'], TENANT_A)

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)
  })
})

describe('Fix 6 — dev diagnostics hook', () => {
  it('exports logRbacDiagnostics and usePermissions invokes it', () => {
    expect(readSrc('lib/rbac-diagnostics.ts')).toContain('logRbacDiagnostics')
    expect(readSrc('hooks/index.ts')).toContain('logRbacDiagnostics(resolved)')
  })
})

describe('Hard refresh simulation — dashboard access', () => {
  it('applyTenantSessionRbac seeds currentTenantSession before tenant record exists', () => {
    const memberships = [ownerMembership(TENANT_A)]
    applyTenantSessionRbac(TENANT_A, {
      memberships,
      activeMembership: { tenantId: TENANT_A },
    })

    const session = useRbacStore.getState().currentTenantSession
    expect(session?.tenantId).toBe(TENANT_A)
    expect(session?.permissions.length).toBeGreaterThan(0)
    expect(session?.permissions).toContain('dashboard:access')
    expect(useTenantStore.getState().tenant).toBeNull()
  })

  it('useHasDashboardAccess is true after session seed without tenant store', () => {
    useRbacStore.getState().setSessionMemberships([ownerMembership(TENANT_A)], { tenantId: TENANT_A })
    applyTenantSessionRbac(TENANT_A, {
      memberships: [ownerMembership(TENANT_A)],
      activeMembership: { tenantId: TENANT_A },
    })

    const { result } = renderHook(() => useHasDashboardAccess())
    expect(result.current).toBe(true)
  })
})

describe('Tenant switch preserves RBAC for active tenant', () => {
  it('session permissions remain scoped to active membership tenantId', () => {
    useRbacStore.getState().setSessionMemberships(
      [ownerMembership(TENANT_A), ownerMembership(TENANT_B)],
      { tenantId: TENANT_A },
    )
    applyTenantSessionRbac(TENANT_A, {
      memberships: [ownerMembership(TENANT_A), ownerMembership(TENANT_B)],
      activeMembership: { tenantId: TENANT_A },
    })

    const { result: permsA } = renderHook(() => usePermissions())
    expect(permsA.current).toContain('dashboard:access')

    useRbacStore.getState().clearCurrentTenantSession()
    applyTenantSessionRbac(TENANT_B, {
      memberships: [ownerMembership(TENANT_A), ownerMembership(TENANT_B)],
      activeMembership: { tenantId: TENANT_B },
    })
    useRbacStore.getState().setSessionMemberships(
      [ownerMembership(TENANT_A), ownerMembership(TENANT_B)],
      { tenantId: TENANT_B },
    )

    const session = useRbacStore.getState().currentTenantSession
    expect(session?.tenantId).toBe(TENANT_B)
    expect(session?.permissions).toContain('dashboard:access')
  })
})
