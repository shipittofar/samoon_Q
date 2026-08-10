import type { PermissionOverride, PermissionOverrideEffect } from '@/types/rbac-api'

export type OverrideMutationPlan =
  | { action: 'noop' }
  | { action: 'create'; permissionId: string; effect: PermissionOverrideEffect }
  | {
      action: 'update'
      overrideId: string
      effect: PermissionOverrideEffect
    }

/**
 * Find an existing override by Permission UUID (canonical), then slug/key.
 */
export function findOverrideForPermission(
  overrides: PermissionOverride[],
  opts: { permissionId?: string; permissionKey?: string },
): PermissionOverride | undefined {
  const { permissionId, permissionKey } = opts
  if (permissionId) {
    const byId = overrides.find((o) => o.permissionId === permissionId)
    if (byId) return byId
  }
  if (permissionKey) {
    return overrides.find((o) => o.permission === permissionKey)
  }
  return undefined
}

/** Index overrides by Permission UUID for O(1) Allow/Deny lookups. */
export function indexOverridesByPermissionId(
  overrides: PermissionOverride[],
): Map<string, PermissionOverride> {
  const map = new Map<string, PermissionOverride>()
  for (const override of overrides) {
    if (override.permissionId) {
      map.set(override.permissionId, override)
    }
  }
  return map
}

/**
 * Decide POST create vs PATCH update vs skip for an Allow/Deny click.
 * Backend uniqueness is (membership, permission) — no POST upsert.
 */
export function planPermissionOverrideMutation(
  overrides: PermissionOverride[],
  opts: {
    permissionId: string
    permissionKey?: string
    effect: PermissionOverrideEffect
  },
): OverrideMutationPlan {
  const existing = findOverrideForPermission(overrides, {
    permissionId: opts.permissionId,
    permissionKey: opts.permissionKey,
  })
  if (!existing) {
    return { action: 'create', permissionId: opts.permissionId, effect: opts.effect }
  }
  if (existing.effect === opts.effect) {
    return { action: 'noop' }
  }
  return { action: 'update', overrideId: existing.id, effect: opts.effect }
}

/** Replace or append an override in a list (immutable). */
export function upsertOverrideInList(
  overrides: PermissionOverride[],
  next: PermissionOverride,
): PermissionOverride[] {
  const idx = overrides.findIndex((o) => o.id === next.id)
  if (idx === -1) {
    const byPermissionId =
      next.permissionId != null
        ? overrides.findIndex((o) => o.permissionId === next.permissionId)
        : -1
    if (byPermissionId >= 0) {
      const copy = overrides.slice()
      copy[byPermissionId] = next
      return copy
    }
    return [...overrides, next]
  }
  const copy = overrides.slice()
  copy[idx] = next
  return copy
}
