import type { PermissionCatalogEntry } from '@/types/rbac-api'

/**
 * Resolve a permission key/slug to the Permission UUID for APIs that
 * require `permission_id` as a UUID (e.g. permission overrides).
 * Never falls back to the key — that would send a slug as permission_id.
 */
export function resolvePermissionIdForKey(
  catalog: PermissionCatalogEntry[],
  key: string,
): string | undefined {
  const entry = catalog.find((p) => p.key === key)
  const id = entry?.id
  return typeof id === 'string' && id.length > 0 ? id : undefined
}
