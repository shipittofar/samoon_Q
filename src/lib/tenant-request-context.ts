/**
 * Active tenant slug for outbound browser API requests.
 * Updated when tenant/membership context resolves — avoids importing stores
 * from axios.instance (circular dependency with branch.service).
 *
 * X-Tenant-Slug is URL/tenancy identity only. Never store a tenant UUID here.
 */
import { isUsableTenantSlug } from '@/lib/identifier-brands'

let activeTenantSlug: string | undefined

function sanitizeHeaderSlug(
  slug: string | undefined,
  tenantId?: string | null,
): string | undefined {
  const trimmed = slug?.trim()
  if (!trimmed) return undefined
  return isUsableTenantSlug(trimmed, tenantId) ? trimmed : undefined
}

export function setActiveTenantSlugForRequests(
  slug: string | undefined,
  tenantId?: string | null,
): void {
  activeTenantSlug = sanitizeHeaderSlug(slug, tenantId)
}

export function getActiveTenantSlugForRequests(): string | undefined {
  return activeTenantSlug
}

function readTenantSlugFromDom(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const meta = document.querySelector<HTMLMetaElement>('meta[name="x-tenant-slug"]')
  if (meta?.content?.trim()) return meta.content.trim()
  return undefined
}

/** Resolve X-Tenant-Slug for client-side API calls (explicit > registry > meta > env). */
export function resolveTenantSlugForApi(explicit?: string): string | undefined {
  const candidates = [
    explicit?.trim(),
    activeTenantSlug,
    readTenantSlugFromDom(),
    process.env.NEXT_PUBLIC_TENANT_SLUG?.trim(),
  ]
  for (const candidate of candidates) {
    const usable = sanitizeHeaderSlug(candidate)
    if (usable) return usable
  }
  return undefined
}
