import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { tenantService, TenantNotFoundError, TenantForbiddenError } from '@/services/tenant.service'
import { getMarketplaceMeta } from '@/types/marketplace'
import { buildBranchMetadata, buildBranchJsonLd } from '@/utils'
import BranchHomepageClient from './BranchHomepageClient'
import type { Tenant } from '@/types'

/**
 * tenantService.getTenant() throws typed errors instead of returning a
 * placeholder tenant (Phase 1 tenant resolution refactor). Public pages
 * must translate that into the correct Next.js response:
 *   - not_found/forbidden slugs  -> notFound() (a real 404, same as before)
 *   - server/network failures    -> rethrown, so Next's error boundary
 *     handles it — a temporary backend outage must never render as a
 *     silent 404, only a genuinely nonexistent/inaccessible business should.
 */
async function resolvePublicTenant(tenantSlug: string): Promise<Tenant> {
  try {
    return await tenantService.getTenant(tenantSlug)
  } catch (err) {
    if (err instanceof TenantNotFoundError || err instanceof TenantForbiddenError) {
      notFound()
    }
    throw err
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string; branchSlug: string }>
}): Promise<Metadata> {
  const { tenantSlug, branchSlug } = await params
  const tenant = await resolvePublicTenant(tenantSlug)

  const meta = getMarketplaceMeta(tenant.settings)
  const branch = meta?.branches?.find((b) => b.slug === branchSlug)

  if (!branch) {
    return { title: `${tenant.name} — Branch not found` }
  }

  const { title, description, url, image } = buildBranchMetadata({
    branchName: branch.name,
    tenantName: tenant.name,
    tenantSlug,
    branchSlug,
    branchAddress: branch.address,
    branchCity: branch.city,
    branchImage: branch.image,
    meta,
  })

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Samoon Platform',
      type: 'website',
      images: [{ url: image, width: 1200, height: 630, alt: branch.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

export default async function BranchPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; branchSlug: string }>
}) {
  const { tenantSlug, branchSlug } = await params
  const tenant = await resolvePublicTenant(tenantSlug)

  const meta = getMarketplaceMeta(tenant.settings)
  const branch = meta?.branches?.find((b) => b.slug === branchSlug)
  if (!branch) {
    notFound()
  }

  const jsonLd = buildBranchJsonLd({
    branchName: branch.name,
    tenantSlug,
    branchSlug,
    branchAddress: branch.address,
    branchCity: branch.city,
    branchPhone: branch.phone_number,
    branchImage: branch.image,
    meta,
  })

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      )}
      <BranchHomepageClient tenantSlug={tenantSlug} branchSlug={branchSlug} />
    </>
  )
}
