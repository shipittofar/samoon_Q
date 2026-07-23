import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { TenantNotFoundError, TenantForbiddenError } from '@/services/tenant.service'
import { fetchPublicTenantBySlug } from '@/lib/public-tenant-resolution'
import { branchManagementService } from '@/services/branch.service'
import {
  getMarketplaceMeta,
  publicBranchFromDetail,
} from '@/types/marketplace'
import { buildBranchMetadata, buildBranchJsonLd } from '@/utils'
import BranchHomepageClient from './BranchHomepageClient'
import type { Tenant } from '@/types'

/**
 * Resolves a public URL slug to full tenant detail via UUID lookup
 * (resolvePublicTenantId → getTenantById). Never calls GET /tenants/{slug}/.
 */
async function resolvePublicTenant(tenantSlug: string): Promise<Tenant> {
  try {
    return await fetchPublicTenantBySlug(tenantSlug)
  } catch (err) {
    if (err instanceof TenantNotFoundError || err instanceof TenantForbiddenError) {
      notFound()
    }
    throw err
  }
}

async function resolvePublicBranchPage(tenantSlug: string, branchSlug: string) {
  const tenant = await resolvePublicTenant(tenantSlug)
  const meta = getMarketplaceMeta(tenant.settings)
  const marketplaceBranch = meta?.branches?.find((b) => b.slug === branchSlug)

  if (!marketplaceBranch?.id) {
    notFound()
  }

  let branchDetail
  try {
    branchDetail = await branchManagementService.getPublicBranch(
      tenant.id,
      marketplaceBranch.id,
    )
  } catch {
    notFound()
  }

  const branch = publicBranchFromDetail(branchDetail, marketplaceBranch)

  return { tenant, meta, marketplaceBranch, branch }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string; branchSlug: string }>
}): Promise<Metadata> {
  const { tenantSlug, branchSlug } = await params
  const { tenant, meta, branch } = await resolvePublicBranchPage(tenantSlug, branchSlug)

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
  const { tenant, meta, marketplaceBranch, branch } = await resolvePublicBranchPage(
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
