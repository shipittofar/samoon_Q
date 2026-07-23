import type { Metadata } from 'next'
import { resolvePublicBranchPageForPage } from '@/lib/public-tenant-resolution'
import { buildBranchMetadata, buildBranchJsonLd } from '@/utils'
import BranchHomepageClient from './BranchHomepageClient'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string; branchSlug: string }>
}): Promise<Metadata> {
  const { tenantSlug, branchSlug } = await params
  const { tenant, meta, branch } = await resolvePublicBranchPageForPage(tenantSlug, branchSlug)

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
  const { tenant, meta, marketplaceBranch, branch } = await resolvePublicBranchPageForPage(
    tenantSlug,
    branchSlug,
  )

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
      <BranchHomepageClient
        tenantSlug={tenantSlug}
        branchSlug={branchSlug}
        tenantId={tenant.id}
        branchId={branch.id}
        initialBranch={branch}
        marketplaceBranch={marketplaceBranch}
      />
    </>
  )
}
