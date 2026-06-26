import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { tenantService } from '@/services/tenant.service'
import { getMarketplaceMeta } from '@/types/marketplace'
import { TenantHomepageClient } from './TenantHomepageClient'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.savor.com'

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
  const title = `${tenant.name} — Savor Platform`
  const description =
    meta?.description ?? `Discover ${tenant.name} on the Savor platform.`
  const url = `${BASE_URL}/${tenantSlug}`
  const image = meta?.coverImage ?? `${BASE_URL}/og-image.jpg`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Savor',
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

  return <TenantHomepageClient tenantSlug={tenantSlug} />
}
