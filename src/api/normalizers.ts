import type {
  AssignmentStatus,
  EffectivePermissionOverrideEntry,
  EffectivePermissionsResponse,
  LocationRef,
  PermissionAuditEntry,
  PermissionCatalogEntry,
  PermissionOverride,
  PermissionOverrideEffect,
  RbacAssignment,
  RoleCatalogEntry,
  RolePermissionsResponse,
} from '@/types/rbac-api'

type WireRecord = Record<string, unknown>

function asRecord(value: unknown): WireRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as WireRecord)
    : null
}

function pickString(record: WireRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = record[key]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return undefined
}

function pickNullableString(record: WireRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    if (!(key in record)) continue
    const v = record[key]
    if (v === null) return null
    if (typeof v === 'string') return v
  }
  return null
}

function pickBool(record: WireRecord, ...keys: string[]): boolean {
  for (const key of keys) {
    const v = record[key]
    if (typeof v === 'boolean') return v
  }
  return false
}

function pickStringArray(record: WireRecord, ...keys: string[]): string[] {
  for (const key of keys) {
    const v = record[key]
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  }
  return []
}

function normalizeLocation(raw: unknown): LocationRef | null {
  const r = asRecord(raw)
  if (!r) {
    if (typeof raw === 'string') return { id: raw, name: raw }
    return null
  }
  const id = pickString(r, 'id')
  if (!id) return null
  return {
    id,
    name: pickString(r, 'name') ?? id,
    slug: pickString(r, 'slug'),
    status: pickString(r, 'status'),
  }
}

function normalizeLocations(raw: unknown): LocationRef[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      const loc = normalizeLocation(entry)
      return loc
    })
    .filter((l): l is LocationRef => l !== null)
}

export function normalizeAssignment(raw: unknown): RbacAssignment | null {
  const r = asRecord(raw)
  if (!r) return null

  const assignmentId =
    pickString(r, 'assignment_id', 'assignmentId', 'id') ?? ''
  if (!assignmentId) return null

  const tenantId = pickString(r, 'tenant_id', 'tenantId') ?? ''
  const roleObj = asRecord(r.role)
  const role =
    pickString(r, 'role') ??
    (roleObj ? pickString(roleObj, 'slug', 'name') : undefined) ??
    ''
  const roleId =
    pickString(r, 'role_id', 'roleId') ??
    (roleObj ? pickString(roleObj, 'id') : undefined)

  const allLocations = pickBool(r, 'all_locations', 'allLocations')
  const locationIds = pickStringArray(r, 'location_ids', 'locationIds')
  const locationsRaw = r.locations ?? r.location_refs
  let locations = normalizeLocations(locationsRaw)
  if (locations.length === 0 && locationIds.length > 0) {
    locations = locationIds.map((id) => ({ id, name: id }))
  }

  const statusRaw = pickString(r, 'status') ?? 'active'
  const status: AssignmentStatus =
    statusRaw === 'future' ||
    statusRaw === 'revoked' ||
    statusRaw === 'expired' ||
    statusRaw === 'active'
      ? statusRaw
      : 'active'

  const modeRaw = pickString(r, 'mode')
  const mode = modeRaw === 'read' ? 'read' : 'manage'

  return {
    assignmentId,
    membershipId: pickString(r, 'membership_id', 'membershipId'),
    userId: pickString(r, 'user_id', 'userId', 'staff_id', 'staffId'),
    tenantId,
    role,
    roleId,
    locations,
    allLocations,
    mode,
    status,
    validFrom: pickNullableString(r, 'valid_from', 'validFrom'),
    validUntil: pickNullableString(r, 'valid_until', 'validUntil'),
    grantedBy: pickString(r, 'granted_by', 'grantedBy') ?? '',
    grantedAt: pickString(r, 'granted_at', 'grantedAt') ?? '',
    revokedBy: pickNullableString(r, 'revoked_by', 'revokedBy'),
    revokedAt: pickNullableString(r, 'revoked_at', 'revokedAt'),
  }
}

export function normalizePermissionEntry(raw: unknown): PermissionCatalogEntry | null {
  const r = asRecord(raw)
  if (!r) return null
  const key = pickString(r, 'key', 'code') ?? ''
  if (!key) return null
  return {
    id: pickString(r, 'id'),
    key,
    resource: pickString(r, 'resource') ?? key.split('.')[0] ?? '',
    action: pickString(r, 'action') ?? key.split('.')[1] ?? '',
    description: pickString(r, 'description') ?? '',
  }
}

export function normalizeRoleEntry(raw: unknown): RoleCatalogEntry | null {
  const r = asRecord(raw)
  if (!r) return null
  const id = pickString(r, 'id') ?? ''
  const slug = pickString(r, 'slug') ?? ''
  const name = pickString(r, 'name', 'label') ?? slug
  if (!id && !slug) return null
  const permsRaw = r.permissions
  const permissions = Array.isArray(permsRaw)
    ? permsRaw.filter((p): p is string => typeof p === 'string')
    : []
  return {
    id: id || slug,
    name,
    slug,
    description: pickString(r, 'description'),
    permissions,
    isSystemRole: pickBool(r, 'is_system_role', 'isSystemRole'),
    editable: typeof r.editable === 'boolean' ? r.editable : !pickBool(r, 'is_system_role', 'isSystemRole'),
  }
}

export function unwrapAssignmentResponse(data: unknown): RbacAssignment | null {
  const root = asRecord(data)
  if (!root) return normalizeAssignment(data)
  const nested = root.assignment ?? root.data
  if (nested) return normalizeAssignment(nested)
  return normalizeAssignment(root)
}

export function unwrapAssignmentList(data: unknown): RbacAssignment[] {
  if (Array.isArray(data)) {
    return data.map((item) => normalizeAssignment(item)).filter((a): a is RbacAssignment => a !== null)
  }
  const root = asRecord(data)
  if (!root) return []
  const results = root.results ?? root.data
  if (Array.isArray(results)) {
    return results.map((item) => normalizeAssignment(item)).filter((a): a is RbacAssignment => a !== null)
  }
  return []
}

export function unwrapPermissionList(data: unknown): string[] {
  const root = asRecord(data)
  if (root?.permissions && Array.isArray(root.permissions)) {
    return root.permissions.filter((p): p is string => typeof p === 'string')
  }
  if (Array.isArray(data)) {
    return data
      .map((entry) => normalizePermissionEntry(entry)?.key)
      .filter((k): k is string => typeof k === 'string')
  }
  return []
}

function normalizeOverrideEffect(raw: unknown): PermissionOverrideEffect {
  return raw === 'deny' ? 'deny' : 'allow'
}

export function normalizePermissionOverride(raw: unknown): PermissionOverride | null {
  const r = asRecord(raw)
  if (!r) return null
  const id = pickString(r, 'id')
  if (!id) return null
  const tenantId = pickString(r, 'tenant_id', 'tenantId') ?? ''
  const permObj = asRecord(r.permission)
  const permission =
    pickString(r, 'permission') ??
    pickString(r, 'permission_key', 'permissionKey') ??
    (permObj ? pickString(permObj, 'key', 'code') : undefined) ??
    ''
  return {
    id,
    tenantId,
    membershipId: pickString(r, 'membership_id', 'membershipId'),
    userId: pickString(r, 'user_id', 'userId'),
    permission,
    permissionId:
      pickString(r, 'permission_id', 'permissionId') ??
      (permObj ? pickString(permObj, 'id') : undefined),
    effect: normalizeOverrideEffect(pickString(r, 'effect')),
    createdAt: pickString(r, 'created_at', 'createdAt') ?? '',
    createdBy: pickString(r, 'created_by', 'createdBy') ?? '',
  }
}

export function unwrapPermissionOverrideList(data: unknown): PermissionOverride[] {
  if (Array.isArray(data)) {
    return data
      .map((item) => normalizePermissionOverride(item))
      .filter((o): o is PermissionOverride => o !== null)
  }
  const root = asRecord(data)
  if (!root) return []
  const results = root.results ?? root.data
  if (Array.isArray(results)) {
    return results
      .map((item) => normalizePermissionOverride(item))
      .filter((o): o is PermissionOverride => o !== null)
  }
  return []
}

export function normalizeEffectivePermissions(raw: unknown): EffectivePermissionsResponse {
  const r = asRecord(raw)
  const inheritedRaw =
    r?.inherited_permissions ?? r?.inheritedPermissions ?? r?.inherited ?? []
  const effectiveRaw =
    r?.effective_permissions ?? r?.effectivePermissions ?? r?.effective ?? []
  const overridesRaw = r?.override_permissions ?? r?.overridePermissions ?? r?.overrides

  const inherited = Array.isArray(inheritedRaw)
    ? inheritedRaw.filter((p): p is string => typeof p === 'string')
    : []

  const effective = Array.isArray(effectiveRaw)
    ? effectiveRaw.filter((p): p is string => typeof p === 'string')
    : []

  let overrides: EffectivePermissionOverrideEntry[] = []
  if (Array.isArray(overridesRaw)) {
    overrides = overridesRaw
      .map((entry) => {
        const o = asRecord(entry)
        if (!o) return null
        const permission =
          pickString(o, 'permission') ??
          pickString(o, 'permission_key', 'permissionKey') ??
          (asRecord(o.permission) ? pickString(asRecord(o.permission)!, 'key') : undefined)
        if (!permission) return null
        return {
          permission,
          effect: normalizeOverrideEffect(pickString(o, 'effect')),
        }
      })
      .filter((x): x is EffectivePermissionOverrideEntry => x !== null)
  }

  return { inherited, overrides, effective }
}

export function normalizePermissionAuditEntry(raw: unknown): PermissionAuditEntry | null {
  const r = asRecord(raw)
  if (!r) return null
  const id = pickString(r, 'id')
  if (!id) return null
  const actorObj = asRecord(r.actor)
  return {
    id,
    timestamp: pickString(r, 'timestamp', 'created_at', 'createdAt') ?? '',
    actorId: pickString(r, 'actor_id', 'actorId') ?? (actorObj ? pickString(actorObj, 'id') : undefined) ?? '',
    actorName:
      pickString(r, 'actor_name', 'actorName') ??
      (actorObj ? pickString(actorObj, 'name', 'email') : undefined),
    action: pickString(r, 'action', 'type') ?? '',
    membershipId: pickString(r, 'membership_id', 'membershipId'),
    permission: pickString(r, 'permission', 'permission_key', 'permissionKey'),
    role: pickString(r, 'role', 'role_slug', 'roleSlug'),
    metadata: asRecord(r.metadata) ?? undefined,
  }
}

export function unwrapPermissionAuditList(data: unknown): PermissionAuditEntry[] {
  if (Array.isArray(data)) {
    return data
      .map((item) => normalizePermissionAuditEntry(item))
      .filter((e): e is PermissionAuditEntry => e !== null)
  }
  const root = asRecord(data)
  if (!root) return []
  const results = root.results ?? root.data
  if (Array.isArray(results)) {
    return results
      .map((item) => normalizePermissionAuditEntry(item))
      .filter((e): e is PermissionAuditEntry => e !== null)
  }
  return []
}

export function normalizeRolePermissions(raw: unknown, roleId: string): RolePermissionsResponse {
  const r = asRecord(raw)
  const idsRaw = r?.permission_ids ?? r?.permissionIds
  const permsRaw = r?.permissions
  const permissionIds = Array.isArray(idsRaw)
    ? idsRaw.filter((id): id is string => typeof id === 'string')
    : []
  const permissions = Array.isArray(permsRaw)
    ? permsRaw.filter((p): p is string => typeof p === 'string')
    : []
  return {
    roleId: r ? pickString(r, 'role_id', 'roleId') ?? roleId : roleId,
    permissionIds,
    permissions,
  }
}
