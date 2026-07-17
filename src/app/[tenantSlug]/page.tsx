import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { tenantService, TenantNotFoundError, TenantForbiddenError } from '@/services/tenant.service'
import { getMarketplaceMeta } from '@/types/marketplace'
import { buildTenantMetadata, buildTenantJsonLd } from '@/utils'
import { TenantHomepageClient } from './TenantHomepageClient'
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
  params: Promise<{ tenantSlug: string }>
}): Promise<Metadata> {
  const { tenantSlug } = await params
  const tenant = await resolvePublicTenant(tenantSlug)

  const meta = getMarketplaceMeta(tenant.settings)
  const { title, description, url, image } = buildTenantMetadata({
    tenantName: tenant.name,
    tenantSlug,
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
      images: [{ url: image, width: 1200, height: 630, alt: tenant.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

export default async function TenantPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await resolvePublicTenant(tenantSlug)

  const meta = getMarketplaceMeta(tenant.settings)
  const jsonLd = buildTenantJsonLd({ tenantName: tenant.name, tenantSlug, meta })

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      )}
      <TenantHomepageClient tenantSlug={tenantSlug} />
    </>
  )
}
