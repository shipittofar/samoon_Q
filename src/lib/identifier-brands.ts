/**
 * URL identity vs domain identity.
 *
 * TenantSlug / BranchSlug — public routing and X-Tenant-Slug only.
 * TenantId / BranchId — nested APIs, Console, React Query domain keys.
 *
 * These brands are documentation + conversion helpers. Call sites still use
 * `string` widely; use `asTenantSlug` / `asTenantId` at service boundaries
 * rather than a repo-wide type migration.
 */

export type TenantId = string & { readonly __brand: 'TenantId' }
export type TenantSlug = string & { readonly __brand: 'TenantSlug' }
export type BranchId = string & { readonly __brand: 'BranchId' }
export type BranchSlug = string & { readonly __brand: 'BranchSlug' }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Canonical UUID (RFC-like). Mock ids such as `t1` are not UUIDs. */
export function looksLikeCanonicalUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

/**
 * True when `value` may be sent as X-Tenant-Slug / used as Tenant.slug.
 * Never treats a tenant id (including UUID) as a slug.
 */
export function isUsableTenantSlug(
  value: string | null | undefined,
  tenantId?: string | null,
): value is string {
  const slug = value?.trim()
  if (!slug) return false
  // A UUID is never a public slug. Mock tenants may use id === slug (`default`).
  if (looksLikeCanonicalUuid(slug)) return false
  if (tenantId && slug === tenantId && looksLikeCanonicalUuid(tenantId)) return false
  return true
}

export function asTenantId(id: string): TenantId {
  return id as TenantId
}

export function asTenantSlug(slug: string): TenantSlug {
  return slug as TenantSlug
}

export function asBranchId(id: string): BranchId {
  return id as BranchId
}

export function asBranchSlug(slug: string): BranchSlug {
  return slug as BranchSlug
}

/** Membership/API slug field, or empty if missing — never copies tenantId. */
export function slugFromMembership(
  tenantSlug: string | null | undefined,
  tenantId?: string | null,
): string {
  return isUsableTenantSlug(tenantSlug, tenantId) ? tenantSlug.trim() : ''
}
