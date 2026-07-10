import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { tenantService } from '@/services/tenant.service'
import { getMarketplaceMeta } from '@/types/marketplace'
import { buildBranchMetadata, buildBranchJsonLd } from '@/utils'
import BranchHomepageClient from './BranchHomepageClient'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string; branchSlug: string }>
}): Promise<Metadata> {
  const { tenantSlug, branchSlug } = await params
  const tenant = await tenantService.getTenant(tenantSlug)

  if (tenant.slug === 'default' && tenantSlug !== 'default') {
    return { title: 'Branch not found — Savor Platform' }
  }

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
      siteName: 'Savor Platform',
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
  const tenant = await tenantService.getTenant(tenantSlug)

  if (tenant.slug === 'default' && tenantSlug !== 'default') {
    notFound()
  }

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
