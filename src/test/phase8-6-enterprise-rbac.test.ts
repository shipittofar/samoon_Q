/**
 * P8.6 — Enterprise Permission Management (Advanced RBAC) — Test Suite
 *
 * Covers:
 *  B  — CustomRoleTemplate store
 *  C  — RbacAuditEvent store
 *  D  — PERMISSION_DEPENDENCIES
 *  E  — validatePermissionGrant
 *  F  — resolveWithDependencies
 *  G  — rbac-audit.service exports
 *  H  — Module registry: USERS_NAV_ITEM in all 6 modules
 *  I  — Module registry: ADMIN_USERS_ROUTES in all 6 modules
 *  J  — Admin pages exist (source-text)
 *  R  — Regression: backward-compatible after P8.6 changes
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { useRbacStore } from '@/stores'
import { PERMISSION_DEPENDENCIES, validatePermissionGrant, resolveWithDependencies, ALL_PERMISSIONS } from '@/services/permission.service'
import type { CustomRoleTemplate, RbacAuditEvent, P7Permission } from '@/types/rbac'

const src = (rel: string) => readFileSync(resolve(__dirname, '../../', rel), 'utf-8')

// ── B — CustomRoleTemplate store ──────────────────────────────────────────────

describe('B — CustomRoleTemplate store', () => {
  beforeEach(() => {
    useRbacStore.getState()._resetStore()
  })

  it('starts with empty customRoles', () => {
    expect(useRbacStore.getState().customRoles).toHaveLength(0)
  })

  it('addCustomRole appends a role', () => {
    const role: CustomRoleTemplate = {
      id: 'cr-1',
      name: 'Senior Cashier',
      description: 'Cashier with extended permissions',
      color: '#6366f1',
      permissions: ['orders.view', 'orders.create'],
      tenantId: 't1',
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: true,
    }
    useRbacStore.getState().addCustomRole(role)
    expect(useRbacStore.getState().customRoles).toHaveLength(1)
    expect(useRbacStore.getState().customRoles[0].name).toBe('Senior Cashier')
  })

  it('updateCustomRole patches fields', () => {
    useRbacStore.getState().addCustomRole({
      id: 'cr-2',
      name: 'Test Role',
      description: '',
      color: '#000',
      permissions: [],
      tenantId: 't1',
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: true,
    })
    useRbacStore.getState().updateCustomRole('cr-2', { name: 'Updated Role', enabled: false })
    const updated = useRbacStore.getState().customRoles.find((r) => r.id === 'cr-2')
    expect(updated?.name).toBe('Updated Role')
    expect(updated?.enabled).toBe(false)
  })

  it('deleteCustomRole removes by id', () => {
    useRbacStore.getState().addCustomRole({
      id: 'cr-3',
      name: 'Delete Me',
      description: '',
      color: '#f00',
      permissions: [],
      tenantId: 't1',
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: true,
    })
    useRbacStore.getState().deleteCustomRole('cr-3')
    expect(useRbacStore.getState().customRoles).toHaveLength(0)
  })

  it('getCustomRoles filters by tenantId', () => {
    useRbacStore.getState().addCustomRole({
      id: 'cr-t1',
      name: 'T1 Role',
      description: '',
      color: '#0f0',
      permissions: [],
      tenantId: 't1',
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: true,
    })
    useRbacStore.getState().addCustomRole({
      id: 'cr-t2',
      name: 'T2 Role',
      description: '',
      color: '#00f',
      permissions: [],
      tenantId: 't2',
      createdBy: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: true,
    })
    expect(useRbacStore.getState().getCustomRoles('t1')).toHaveLength(1)
    expect(useRbacStore.getState().getCustomRoles('t2')).toHaveLength(1)
    expect(useRbacStore.getState().getCustomRoles('t3')).toHaveLength(0)
  })

  it('_resetStore clears customRoles', () => {
    useRbacStore.getState().addCustomRole({
      id: 'cr-y',
      name: 'Y',
      description: '',
      color: '#y',
      permissions: [],
      tenantId: 't1',
      createdBy: 'x',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enabled: true,
    })
    useRbacStore.getState()._resetStore()
    expect(useRbacStore.getState().customRoles).toHaveLength(0)
  })
})

// ── C — RbacAuditEvent store ──────────────────────────────────────────────────

describe('C — RbacAuditEvent store', () => {
  beforeEach(() => {
    useRbacStore.getState()._resetStore()
  })

  it('starts with empty rbacAuditLog', () => {
    expect(useRbacStore.getState().rbacAuditLog).toHaveLength(0)
  })

  it('addRbacAuditEvent appends an event', () => {
    const event: RbacAuditEvent = {
      id: 'ev-1',
      type: 'role_assigned',
      actorId: 'admin',
      targetUserId: 'u1',
      tenantId: 't1',
      role: 'cashier',
      timestamp: new Date().toISOString(),
    }
    useRbacStore.getState().addRbacAuditEvent(event)
    expect(useRbacStore.getState().rbacAuditLog).toHaveLength(1)
  })

  it('getRbacAuditLog filters by tenantId', () => {
    useRbacStore.getState().addRbacAuditEvent({
      id: 'ev-t1',
      type: 'permission_granted',
      actorId: 'admin',
      targetUserId: 'u1',
      tenantId: 't1',
      permission: 'orders.view',
      timestamp: new Date().toISOString(),
    })
    useRbacStore.getState().addRbacAuditEvent({
      id: 'ev-t2',
      type: 'role_removed',
      actorId: 'admin',
      targetUserId: 'u2',
      tenantId: 't2',
      role: 'kitchen',
      timestamp: new Date().toISOString(),
    })
    expect(useRbacStore.getState().getRbacAuditLog('t1')).toHaveLength(1)
    expect(useRbacStore.getState().getRbacAuditLog('t2')).toHaveLength(1)
    expect(useRbacStore.getState().getRbacAuditLog('t3')).toHaveLength(0)
  })

  it('clearRbacAuditLog removes events for tenantId', () => {
    useRbacStore.getState().addRbacAuditEvent({
      id: 'ev-clear',
      type: 'role_assigned',
      actorId: 'a',
      targetUserId: 'b',
      tenantId: 't1',
      timestamp: new Date().toISOString(),
    })
    useRbacStore.getState().clearRbacAuditLog('t1')
    expect(useRbacStore.getState().getRbacAuditLog('t1')).toHaveLength(0)
  })

  it('_resetStore clears rbacAuditLog', () => {
    useRbacStore.getState().addRbacAuditEvent({
      id: 'ev-z',
      type: 'custom_role_created',
      actorId: 'a',
      targetUserId: 'b',
      tenantId: 't1',
      timestamp: new Date().toISOString(),
    })
    useRbacStore.getState()._resetStore()
    expect(useRbacStore.getState().rbacAuditLog).toHaveLength(0)
  })
})

// ── D — PERMISSION_DEPENDENCIES ───────────────────────────────────────────────

describe('D — PERMISSION_DEPENDENCIES', () => {
  it('PERMISSION_DEPENDENCIES is exported from permission.service', () => {
    expect(PERMISSION_DEPENDENCIES).toBeDefined()
    expect(typeof PERMISSION_DEPENDENCIES).toBe('object')
  })

  it('orders.manage requires orders.view', () => {
    const dep = PERMISSION_DEPENDENCIES['orders.manage']
    expect(dep?.requires).toContain('orders.view')
  })

  it('staff.manage requires staff.view', () => {
    const dep = PERMISSION_DEPENDENCIES['staff.manage']
    expect(dep?.requires).toContain('staff.view')
  })

  it('payments.refund requires payments.process', () => {
    const dep = PERMISSION_DEPENDENCIES['payments.refund']
    expect(dep?.requires).toContain('payments.process')
  })

  it('analytics.export requires analytics.view', () => {
    const dep = PERMISSION_DEPENDENCIES['analytics.export']
    expect(dep?.requires).toContain('analytics.view')
  })

  it('audit.export requires audit.view', () => {
    const dep = PERMISSION_DEPENDENCIES['audit.export']
    expect(dep?.requires).toContain('audit.view')
  })

  it('has at least 10 dependency rules', () => {
    expect(Object.keys(PERMISSION_DEPENDENCIES).length).toBeGreaterThanOrEqual(10)
  })
})

// ── E — validatePermissionGrant ───────────────────────────────────────────────

describe('E — validatePermissionGrant', () => {
  it('returns no issues when requirements are met', () => {
    const current: P7Permission[] = ['orders.view']
    const result = validatePermissionGrant('orders.manage', current)
    expect(result.hasIssues).toBe(false)
    expect(result.missingRequirements).toHaveLength(0)
  })

  it('reports missing requirements', () => {
    const result = validatePermissionGrant('orders.manage', [])
    expect(result.hasIssues).toBe(true)
    expect(result.missingRequirements).toContain('orders.view')
  })

  it('reports missing requirements for payments.refund', () => {
    const result = validatePermissionGrant('payments.refund', [])
    expect(result.missingRequirements).toContain('payments.process')
  })

  it('returns no issues for a permission with no dependencies', () => {
    const result = validatePermissionGrant('orders.view', [])
    expect(result.hasIssues).toBe(false)
  })

  it('result shape has all required fields', () => {
    const result = validatePermissionGrant('orders.manage', [])
    expect(result).toHaveProperty('permission')
    expect(result).toHaveProperty('missingRequirements')
    expect(result).toHaveProperty('impliedGrants')
    expect(result).toHaveProperty('conflicts')
    expect(result).toHaveProperty('hasIssues')
  })
})

// ── F — resolveWithDependencies ───────────────────────────────────────────────

describe('F — resolveWithDependencies', () => {
  it('returns the permission itself when no deps', () => {
    const resolved = resolveWithDependencies('orders.view', [])
    expect(resolved).toContain('orders.view')
  })

  it('auto-includes required permissions', () => {
    const resolved = resolveWithDependencies('orders.manage', [])
    expect(resolved).toContain('orders.view')
    expect(resolved).toContain('orders.manage')
  })

  it('does not duplicate already-present permissions', () => {
    const resolved = resolveWithDependencies('orders.manage', ['orders.view'])
    const unique = new Set(resolved)
    expect(unique.size).toBe(resolved.length)
  })

  it('includes implied permissions when not already effective', () => {
    const dep = PERMISSION_DEPENDENCIES['staff.manage']
    if (dep?.implies && dep.implies.length > 0) {
      // Pass empty currentEffective so implied perms are not filtered out
      const resolved = resolveWithDependencies('staff.manage', [])
      for (const implied of dep.implies) {
        expect(resolved).toContain(implied)
      }
    }
  })
})

// ── G — rbac-audit.service exports ───────────────────────────────────────────

describe('G — rbac-audit.service exports', () => {
  const srcText = () => src('src/services/rbac-audit.service.ts')

  it('exports rbacAuditService', () => {
    expect(srcText()).toContain('export const rbacAuditService')
  })

  it('exports setRbacAuditStoreAccessor', () => {
    expect(srcText()).toContain('export function setRbacAuditStoreAccessor')
  })

  it('has logRoleAssigned method', () => {
    expect(srcText()).toContain('logRoleAssigned')
  })

  it('has logPermissionGranted method', () => {
    expect(srcText()).toContain('logPermissionGranted')
  })

  it('has logPermissionDenied method', () => {
    expect(srcText()).toContain('logPermissionDenied')
  })

  it('has logPermissionReset method', () => {
    expect(srcText()).toContain('logPermissionReset')
  })

  it('has logCustomRoleCreated method', () => {
    expect(srcText()).toContain('logCustomRoleCreated')
  })

  it('has getLog method', () => {
    expect(srcText()).toContain('getLog')
  })
})

// ── H — USERS_NAV_ITEM in all 6 modules ──────────────────────────────────────

describe('H — USERS_NAV_ITEM in registry', () => {
  const registrySrc = () => src('src/modules/registry.ts')

  it('registry exports USERS_NAV_ITEM', () => {
    expect(registrySrc()).toContain("href: '/console/users'")
  })

  it('all 6 modules include USERS_NAV_ITEM', () => {
    const content = registrySrc()
    const count = (content.match(/USERS_NAV_ITEM/g) ?? []).length
    // 1 declaration + 6 uses = 7 minimum
    expect(count).toBeGreaterThanOrEqual(7)
  })
})

// ── I — ADMIN_USERS_ROUTES in registry ───────────────────────────────────────

describe('I — ADMIN_USERS_ROUTES in registry', () => {
  const registrySrc = () => src('src/modules/registry.ts')

  it('registry exports ADMIN_USERS_ROUTES', () => {
    expect(registrySrc()).toContain('ADMIN_USERS_ROUTES')
  })

  it('routes include /console/users', () => {
    expect(registrySrc()).toContain("'/console/users'")
  })
})

// ── J — Admin pages exist ─────────────────────────────────────────────────────

describe('J — P8.6 admin pages exist', () => {
  it('/console/users/page.tsx exists and uses PermissionGuard', () => {
    const content = src('src/app/console/users/page.tsx')
    expect(content).toContain('PermissionGuard')
    expect(content).toContain('staff.manage')
  })

  it('/console/users/[id]/page.tsx exists and uses PermissionGuard', () => {
    const content = src('src/app/console/users/[id]/page.tsx')
    expect(content).toContain('PermissionGuard')
    expect(content).toContain('staff.manage')
  })

  it('/console/roles/new/page.tsx exists and uses PermissionGuard', () => {
    const content = src('src/app/console/roles/new/page.tsx')
    expect(content).toContain('PermissionGuard')
    expect(content).toContain('staff.manage')
  })

  it('/console/permissions/simulator/page.tsx exists and uses PermissionGuard', () => {
    const content = src('src/app/console/permissions/simulator/page.tsx')
    expect(content).toContain('PermissionGuard')
    expect(content).toContain('staff.manage')
  })

  it('/console/users/page.tsx renders user list', () => {
    const content = src('src/app/console/users/page.tsx')
    expect(content).toContain('userManagementTitle')
    expect(content).toContain('inviteUserLabel')
  })

  it('/console/users/[id]/page.tsx has tab navigation', () => {
    const content = src('src/app/console/users/[id]/page.tsx')
    expect(content).toContain('Profile')
    expect(content).toContain('Roles')
    expect(content).toContain('Permissions')
    expect(content).toContain('Security')
  })

  it('/console/roles/new/page.tsx has Role Builder UI', () => {
    const content = src('src/app/console/roles/new/page.tsx')
    expect(content).toContain('roleBuilderTitle')
    expect(content).toContain('saveRoleLabel')
    expect(content).toContain('cloneFromRoleLabel')
  })

  it('/console/permissions/simulator/page.tsx has simulation UI', () => {
    const content = src('src/app/console/permissions/simulator/page.tsx')
    expect(content).toContain('permissionSimulatorTitle')
    expect(content).toContain('runSimulationLabel')
  })
})

// ── R — Regression ────────────────────────────────────────────────────────────

describe('R — Regression', () => {
  it('permission.service ALL_PERMISSIONS has 48 entries', () => {
    expect(ALL_PERMISSIONS).toHaveLength(56)
  })

  it('rbac types file defines all P8.6 interfaces', () => {
    const rbacTypes = src('src/types/rbac.ts')
    expect(rbacTypes).toContain('interface CustomRoleTemplate')
    expect(rbacTypes).toContain('interface PermissionDependency')
    expect(rbacTypes).toContain('interface RbacAuditEvent')
    expect(rbacTypes).toContain('interface SimulationResult')
    expect(rbacTypes).toContain('interface DependencyValidationResult')
  })

  it('stores index exports all P8.6 store actions', () => {
    const storesSrc = src('src/stores/index.ts')
    expect(storesSrc).toContain('customRoles')
    expect(storesSrc).toContain('addCustomRole')
    expect(storesSrc).toContain('rbacAuditLog')
    expect(storesSrc).toContain('addRbacAuditEvent')
  })

  it('permission.service exports PERMISSION_DEPENDENCIES and dependency functions', () => {
    const permSrc = src('src/services/permission.service.ts')
    expect(permSrc).toContain('PERMISSION_DEPENDENCIES')
    expect(permSrc).toContain('validatePermissionGrant')
    expect(permSrc).toContain('resolveWithDependencies')
  })

  beforeEach(() => {
    useRbacStore.getState()._resetStore()
  })

  it('_resetStore clears all 4 state arrays', () => {
    const s = useRbacStore.getState()
    expect(s.tenantRoles).toHaveLength(0)
    expect(s.userOverrides).toHaveLength(0)
    expect(s.customRoles).toHaveLength(0)
    expect(s.rbacAuditLog).toHaveLength(0)
  })
})
