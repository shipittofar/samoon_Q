import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildUserPermissionRows } from '@/lib/user-permission-rows'

function src(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('RBAC restoration — user permission rows', () => {
  it('maps inherited permissions to role source without override action', () => {
    const rows = buildUserPermissionRows({
      inherited: ['orders.view', 'orders.edit'],
      overrides: [],
      effective: ['orders.view', 'orders.edit'],
    }, ['Manager'])
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.permission === 'orders.view')).toMatchObject({
      permission: 'orders.view',
      source: 'role',
      sourceLabel: 'Manager',
      status: 'inherited',
      action: null,
    })
  })

  it('shows DENY action on inherited permission with deny override', () => {
    const rows = buildUserPermissionRows({
      inherited: ['reports.view', 'orders.view'],
      overrides: [{ permission: 'reports.view', effect: 'deny' }],
      effective: ['orders.view'],
    })
    const reports = rows.find((r) => r.permission === 'reports.view')
    expect(reports?.source).toBe('role')
    expect(reports?.action).toBe('deny')
    expect(reports?.status).toBe('deny')
  })

  it('shows ALLOW override for permission not in inherited set', () => {
    const rows = buildUserPermissionRows({
      inherited: ['orders.view'],
      overrides: [{ permission: 'reports.export', effect: 'allow' }],
      effective: ['orders.view', 'reports.export'],
    })
    const exportRow = rows.find((r) => r.permission === 'reports.export')
    expect(exportRow?.source).toBe('override')
    expect(exportRow?.action).toBe('allow')
    expect(exportRow?.status).toBe('allow')
  })

  it('scenario: Manager without deny gets reports.view in effective', () => {
    const rows = buildUserPermissionRows({
      inherited: ['reports.view', 'orders.view'],
      overrides: [],
      effective: ['reports.view', 'orders.view'],
    })
    expect(rows.some((r) => r.permission === 'reports.view' && r.action !== 'deny')).toBe(true)
  })

  it('scenario: Manager with DENY reports.view shows deny on role row', () => {
    const rows = buildUserPermissionRows({
      inherited: ['reports.view', 'orders.view'],
      overrides: [{ permission: 'reports.view', effect: 'deny' }],
      effective: ['orders.view'],
    })
    const reports = rows.find((r) => r.permission === 'reports.view')
    expect(reports?.action).toBe('deny')
  })
})

describe('RBAC restoration — source files', () => {
  it('staff detail uses StaffAssignedRolesSection with Add Role', () => {
    const content = src('src/app/console/staff/[id]/page.tsx')
    expect(content).toContain('StaffAssignedRolesSection')
    expect(content).toContain('StaffPermissionOverridesSection')
    expect(content).toContain('StaffEffectivePermissionsSection')
    expect(content).toContain('StaffPermissionAuditSection')
  })

  it('roles/[id] uses rbac.manage_roles read-only for system roles', () => {
    const content = src('src/app/console/roles/[id]/page.tsx')
    expect(content).toContain('rbac.manage_roles')
    expect(content).toContain('isSystemRole')
    expect(content).toContain('readOnly')
  })

  it('authorization API uses ENDPOINTS for verified override paths', () => {
    const content = src('src/api/authorization.ts')
    expect(content).toContain('ENDPOINTS.RBAC.MEMBERSHIP_PERMISSION_OVERRIDES')
    expect(content).toContain('ENDPOINTS.RBAC.PERMISSION_OVERRIDES')
    const endpoints = src('src/services/endpoints.ts')
    expect(endpoints).toContain('/authorization/tenants/')
    expect(endpoints).toContain('memberships/')
    expect(endpoints).toContain('permission-overrides')
    expect(endpoints).not.toContain('/access/')
  })

  it('rbac API uses ENDPOINTS for verified staff membership paths', () => {
    const staffApi = src('src/api/staff.ts')
    expect(staffApi).toContain('listStaffMemberships')
    const invitations = src('src/api/invitations.ts')
    expect(invitations).toContain('createStaffMembership')
    expect(invitations).not.toContain('/invites/')
    expect(invitations).not.toContain('/tenants/${tenantId}/staff/')
    const endpoints = src('src/services/endpoints.ts')
    expect(endpoints).toContain('staff-memberships')
    expect(endpoints).not.toContain('/tenants/${tenantId}/invites/')
    expect(endpoints).not.toContain('/tenants/${tenantId}/staff/')
  })

  it('rbac API uses ENDPOINTS for verified staff assignment paths', () => {
    const content = src('src/api/rbac.ts')
    expect(content).toContain('ENDPOINTS.RBAC.ASSIGNMENTS')
    expect(content).toContain('ENDPOINTS.RBAC.ASSIGNMENT')
    const endpoints = src('src/services/endpoints.ts')
    expect(endpoints).toContain('/authorization/tenants/')
    expect(endpoints).toContain('staff-assignments')
    expect(endpoints).not.toContain('/access/')
  })

  it('endpoints use verified permission catalog and role paths', () => {
    const endpoints = src('src/services/endpoints.ts')
    expect(endpoints).toContain("PERMISSIONS: '/permissions/'")
    expect(endpoints).toContain('/tenants/${tenantId}/roles/')
    expect(endpoints).toContain('/authorization/roles/')
    expect(endpoints).not.toContain('/access/permissions/')
    expect(endpoints).not.toContain('/access/tenants/')
  })

  it('assignment mutations invalidate effective permissions', () => {
    const content = src('src/lib/rbac-query-invalidation.ts')
    expect(content).toContain('invalidateRbacAssignmentMutations')
    expect(content).toContain('invalidateEffectivePermissions')
  })

  it('users/[id] redirects to permissions RBAC page', () => {
    const content = src('src/app/console/users/[id]/page.tsx')
    expect(content).toContain('/console/permissions/')
  })
})
