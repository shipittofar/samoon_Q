import type { Metadata } from 'next'
import { resolvePublicTenantForPage } from '@/lib/public-tenant-resolution'
import { getMarketplaceMeta } from '@/types/marketplace'
import { buildTenantMetadata, buildTenantJsonLd } from '@/utils'
import { TenantHomepageClient } from './TenantHomepageClient'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}): Promise<Metadata> {
  const { tenantSlug } = await params
  const tenant = await resolvePublicTenantForPage(tenantSlug)

  const meta = getMarketplaceMeta(tenant.settings)
  const { title, description, url, image } = buildTenantMetadata({
    tenantName: tenant.name,
    tenantSlug,
    tenantHeroImage: tenant.heroImage,
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
  const tenant = await resolvePublicTenantForPage(tenantSlug)

  const meta = getMarketplaceMeta(tenant.settings)
  const jsonLd = buildTenantJsonLd({
    tenantName: tenant.name,
    tenantSlug,
    tenantHeroImage: tenant.heroImage,
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
      <TenantHomepageClient tenantSlug={tenantSlug} />
    </>
  )
}
