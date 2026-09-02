/** Discover card primary CTA: public tenant page (`Explore`), including single-branch tenants. */
export function getDiscoverCardPrimaryCta(input: {
  tenantSlug: string
  branchCount?: number
  primaryBranchSlug?: string
}): { href: string; labelKey: 'explore' } {
  return { href: `/${input.tenantSlug}`, labelKey: 'explore' }
}
