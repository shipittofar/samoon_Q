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

/** Maps legacy flat hrefs to canonical module names. */
const HREF_TO_MODULE: Record<string, string> = {
  '/':            '',
  '/restaurant':  '',
  '/menu':        'menu',
  '/reservation': 'reservation',
  '/promotions':  'promotions',
  '/events':      'events',
  '/loyalty':     'loyalty',
  '/checkout':    'checkout',
  '/reviews':     'reviews',
}

export function buildPublicUrl({ tenantSlug, branchSlug, module = '' }: PublicUrlParams): string {
  if (!tenantSlug || !branchSlug) {
    return module ? `/${module}` : '/'
  }
  const base = `/${tenantSlug}/${branchSlug}`
  return module ? `${base}/${module}` : base
}

/**
 * Converts a legacy flat href (e.g. "/menu") into a context-aware public URL.
 * Used inside PreviewButton to upgrade all existing static hrefs automatically.
 */
export function hrefToPublicUrl(
  href: string,
  tenantSlug: string | null | undefined,
  branchSlug: string | null | undefined,
): string {
  const module = HREF_TO_MODULE[href] ?? href.replace(/^\//, '')
  return buildPublicUrl({ tenantSlug, branchSlug, module })
}
