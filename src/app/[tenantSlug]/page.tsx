import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { tenantService } from '@/services/tenant.service'
import { getMarketplaceMeta } from '@/types/marketplace'
import { buildTenantMetadata, buildTenantJsonLd } from '@/utils'
import { TenantHomepageClient } from './TenantHomepageClient'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}): Promise<Metadata> {
  const { tenantSlug } = await params
  const tenant = await tenantService.getTenant(tenantSlug)

  if (tenant.slug === 'default' && tenantSlug !== 'default') {
    return { title: 'Business not found — Savor Platform' }
  }

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
      siteName: 'Savor Platform',
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
  const tenant = await tenantService.getTenant(tenantSlug)

  if (tenant.slug === 'default' && tenantSlug !== 'default') {
    notFound()
  }

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
