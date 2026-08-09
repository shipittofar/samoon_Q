import type { QueryClient } from '@tanstack/react-query'

/** Invalidate staff + assignment caches after RBAC D2 mutations. */
export function invalidateRbacStaffQueries(
  qc: QueryClient,
  tenantId: string,
  staffMemberId?: string,
  userId?: string,
): void {
  qc.invalidateQueries({ queryKey: ['staff', tenantId] })
  qc.invalidateQueries({ queryKey: ['staff'] })
  qc.invalidateQueries({ queryKey: ['assignments', tenantId] })
  if (staffMemberId) {
    qc.invalidateQueries({ queryKey: ['staff-member', staffMemberId] })
  }
  if (userId) {
    qc.invalidateQueries({
      queryKey: ['assignments', tenantId, { user_id: userId }],
    })
  }
}

export function invalidatePermissionCatalog(qc: QueryClient): void {
  qc.invalidateQueries({ queryKey: ['permission-catalog'] })
  qc.invalidateQueries({ queryKey: ['tenant-roles'] })
}

/** Invalidate Wave 4 permission override / effective / audit caches. */
export function invalidatePermissionOverrides(
  qc: QueryClient,
  tenantId: string,
  membershipId?: string,
  userId?: string,
): void {
  qc.invalidateQueries({ queryKey: ['permission-overrides', tenantId] })
  if (membershipId) {
    qc.invalidateQueries({
      queryKey: ['permission-overrides', tenantId, { membership_id: membershipId }],
    })
  }
  if (userId) {
    qc.invalidateQueries({
      queryKey: ['permission-overrides', tenantId, { user_id: userId }],
    })
  }
}

export function invalidateEffectivePermissions(
  qc: QueryClient,
  membershipId?: string,
  userId?: string,
): void {
  qc.invalidateQueries({ queryKey: ['effective-permissions'] })
  if (membershipId || userId) {
    qc.invalidateQueries({
      queryKey: ['effective-permissions', { membership_id: membershipId, user_id: userId }],
    })
  }
}

export function invalidatePermissionAudit(qc: QueryClient, tenantId: string): void {
  qc.invalidateQueries({ queryKey: ['permission-audit', tenantId] })
}

export function invalidateRolePermissions(qc: QueryClient, roleId?: string): void {
  if (roleId) {
    qc.invalidateQueries({ queryKey: ['role-permissions', roleId] })
  }
  qc.invalidateQueries({ queryKey: ['role-permissions'] })
  invalidatePermissionCatalog(qc)
}

export function invalidateRbacWave4Mutations(
  qc: QueryClient,
  tenantId: string,
  opts?: { membershipId?: string; userId?: string; roleId?: string },
): void {
  invalidatePermissionOverrides(qc, tenantId, opts?.membershipId, opts?.userId)
  invalidateEffectivePermissions(qc, opts?.membershipId, opts?.userId)
  invalidatePermissionAudit(qc, tenantId)
  invalidatePermissionCatalog(qc)
  if (opts?.roleId) invalidateRolePermissions(qc, opts.roleId)
  qc.invalidateQueries({ queryKey: ['me-permissions'] })
}

export function invalidateRbacAssignmentMutations(
  qc: QueryClient,
  tenantId: string,
  opts?: { staffMemberId?: string; userId?: string; membershipId?: string },
): void {
  invalidateRbacStaffQueries(qc, tenantId, opts?.staffMemberId, opts?.userId)
  invalidateEffectivePermissions(qc, opts?.membershipId, opts?.userId)
  invalidatePermissionOverrides(qc, tenantId, opts?.membershipId, opts?.userId)
  invalidatePermissionCatalog(qc)
  qc.invalidateQueries({ queryKey: ['me-permissions'] })
}
