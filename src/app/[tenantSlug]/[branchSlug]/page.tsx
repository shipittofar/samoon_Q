import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { tenantService } from '@/services/tenant.service'
import { getMarketplaceMeta } from '@/types/marketplace'
import BranchHomepageClient from './BranchHomepageClient'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.savor.com'

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

  const title = `${branch.name} — ${tenant.name}`
  const description = `Visit ${branch.name} at ${branch.address}, ${branch.city}. ${meta?.description ?? ''}`
  const url = `${BASE_URL}/${tenantSlug}/${branchSlug}`
  const image = branch.image ?? meta?.coverImage ?? `${BASE_URL}/og-image.jpg`

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

  return <BranchHomepageClient tenantSlug={tenantSlug} branchSlug={branchSlug} />
}
