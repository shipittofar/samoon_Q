/**
 * P8.7.5 — Public URL builder
 *
 * Generates context-aware public URLs of the form:
 *   /[tenantSlug]/[branchSlug]/[module]
 *
 * Falls back to the flat route if tenant or branch context is unavailable.
 *
 * Usage:
 *   buildPublicUrl({ tenantSlug: 'savor', branchSlug: 'main', module: 'menu' })
 *   // → '/savor/main/menu'
 *
 *   buildPublicUrl({ tenantSlug: 'savor', branchSlug: 'main' })
 *   // → '/savor/main'
 *
 *   buildPublicUrl({ tenantSlug: null, branchSlug: null, module: 'menu' })
 *   // → '/menu'  (fallback)
 */

export interface PublicUrlParams {
  tenantSlug: string | null | undefined
  branchSlug: string | null | undefined
  /** Module path without leading slash. e.g. 'menu', 'reservation', 'table/12' */
  module?: string
}

/**
 * Hrefs that map to the tenant homepage (/{tenantSlug}) rather than a
 * branch-level module. When these are used in PreviewButton the user is
 * taken to the business's public landing page, not a specific branch.
 */
const TENANT_HOMEPAGE_HREFS = new Set(['/', '/restaurant'])

/** Maps legacy flat hrefs to canonical module names. */
const HREF_TO_MODULE: Record<string, string> = {
  '/menu':        'menu',
  '/reservation': 'reservation',
  '/promotions':  'promotions',
  '/events':      'events',
  '/loyalty':     'loyalty',
  '/checkout':    'checkout',
  '/reviews':     'reviews',
}

export function buildPublicUrl({ tenantSlug, branchSlug, module: mod = '' }: PublicUrlParams): string {
  if (!tenantSlug) {
    return mod ? `/${mod}` : '/'
  }
  if (!branchSlug) {
    return mod ? `/${tenantSlug}/${mod}` : `/${tenantSlug}`
  }
  const base = `/${tenantSlug}/${branchSlug}`
  return mod ? `${base}/${mod}` : base
}

/**
 * Converts a legacy flat href (e.g. "/menu") into a context-aware public URL.
 * Used inside PreviewButton to upgrade all existing static hrefs automatically.
 *
 * "/" and "/restaurant" → /{tenantSlug}  (tenant homepage, P8.7.7.2)
 * "/menu"               → /{tenantSlug}/{branchSlug}/menu
 * "/reservation"        → /{tenantSlug}/{branchSlug}/reservation
 * etc.
 */
export function hrefToPublicUrl(
  href: string,
  tenantSlug: string | null | undefined,
  branchSlug: string | null | undefined,
): string {
  if (TENANT_HOMEPAGE_HREFS.has(href)) {
    return tenantSlug ? `/${tenantSlug}` : '/'
  }

  const publicModule = HREF_TO_MODULE[href] ?? href.replace(/^\//, '')
  return buildPublicUrl({ tenantSlug, branchSlug, module: publicModule })
}
