import type { EffectivePermissionsResponse, PermissionOverrideEffect } from '@/types/rbac-api'

export type UserPermissionSource = 'role' | 'override'

export interface UserPermissionRow {
  permission: string
  source: UserPermissionSource
  /** Display label for source column, e.g. "Manager" or override */
  sourceLabel: string
  /** Inherited from role vs explicit override effect */
  status: 'inherited' | PermissionOverrideEffect
  action: PermissionOverrideEffect | null
}

/**
 * Build display rows from backend effective-permissions payload only.
 * Role names come from assignment display (not permission calculation).
 */
export function buildUserPermissionRows(
  data: EffectivePermissionsResponse,
  roleNames: string[] = [],
): UserPermissionRow[] {
  const inheritedSet = new Set(data.inherited)
  const overrideByPerm = new Map(data.overrides.map((o) => [o.permission, o.effect]))
  const roleLabel = roleNames.length > 0 ? roleNames.join(', ') : 'Role'
  const rows: UserPermissionRow[] = []

  for (const permission of data.inherited) {
    const effect = overrideByPerm.get(permission)
    rows.push({
      permission,
      source: 'role',
      sourceLabel: roleLabel,
      status: effect ? effect : 'inherited',
      action: effect === 'deny' ? 'deny' : effect === 'allow' ? 'allow' : null,
    })
  }

  for (const override of data.overrides) {
    if (!inheritedSet.has(override.permission)) {
      rows.push({
        permission: override.permission,
        source: 'override',
        sourceLabel: 'Override',
        status: override.effect,
        action: override.effect,
      })
    }
  }

  return rows.sort((a, b) => a.permission.localeCompare(b.permission))
}
