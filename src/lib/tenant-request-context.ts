/**
 * Active tenant slug for outbound browser API requests.
 * Updated when tenant/membership context resolves — avoids importing stores
 * from axios.instance (circular dependency with branch.service).
 */
let activeTenantSlug: string | undefined

export function setActiveTenantSlugForRequests(slug: string | undefined): void {
  activeTenantSlug = slug?.trim() || undefined
}

function readTenantSlugFromDom(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const meta = document.querySelector<HTMLMetaElement>('meta[name="x-tenant-slug"]')
  if (meta?.content?.trim()) return meta.content.trim()
  return undefined
}

/** Resolve X-Tenant-Slug for client-side API calls (explicit > registry > meta > env). */
export function resolveTenantSlugForApi(explicit?: string): string | undefined {
  if (explicit?.trim()) return explicit.trim()
  if (activeTenantSlug) return activeTenantSlug
  const fromDom = readTenantSlugFromDom()
  if (fromDom) return fromDom
  const fromEnv = process.env.NEXT_PUBLIC_TENANT_SLUG?.trim()
  return fromEnv || undefined
}
