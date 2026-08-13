import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { tenantService } from './tenant.service'
import { branchManagementService } from './branch.service'
import { getMarketplaceMeta } from '@/types/marketplace'
import type { DiscoverBranch, DiscoverResponse, DiscoverTenant } from '@/types/discover'
import type { Branch } from '@/types/branch'
import type { PublicBranchInfo } from '@/types/marketplace'
import type { PaginatedResponse } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms))

function legacyBranchToDiscoverBranch(
  legacy: PublicBranchInfo,
): DiscoverBranch {
  return {
    id: legacy.id,
    slug: legacy.slug,
    name: legacy.name,
    image: legacy.image,
    openNow: legacy.openNow,
    todayHours: legacy.todayHours,
    location: {
      address: legacy.address,
      city: legacy.city,
    },
  }
}

function branchEntityToDiscoverBranch(
  branch: Branch,
  legacy?: PublicBranchInfo,
): DiscoverBranch {
  return {
    id: branch.id,
    slug: branch.slug,
    name: branch.name,
    image: branch.image ?? branch.coverImage ?? legacy?.image,
    openNow: legacy?.openNow ?? branch.status === 'active',
    todayHours: legacy?.todayHours,
    location: {
      address: branch.location.address,
      city: branch.location.city,
      country: branch.location.country,
    },
  }
}

async function buildMockDiscoverTenant(
  tenant: Awaited<ReturnType<typeof tenantService.getTenants>>[number],
): Promise<DiscoverTenant> {
  const marketplace = getMarketplaceMeta(tenant.settings)
  const legacyBranches = marketplace?.branches ?? []

  let branches: DiscoverBranch[]
  try {
    const entities = await branchManagementService.getTenantsBranches(tenant.id)
    if (entities.length > 0) {
      const legacyBySlug = new Map(legacyBranches.map((b) => [b.slug, b]))
      branches = entities.map((b) =>
        branchEntityToDiscoverBranch(b, legacyBySlug.get(b.slug)),
      )
    } else if (legacyBranches.length > 0) {
      branches = legacyBranches.map(legacyBranchToDiscoverBranch)
    } else {
      branches = []
    }
  } catch {
    branches = legacyBranches.map(legacyBranchToDiscoverBranch)
  }

  const { branches: _omit, ...marketplaceFields } = marketplace ?? {}
  const theme = tenant.settings?.theme

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    created_at: tenant.created_at,
    businessTypes: tenant.businessTypes,
    image: tenant.image,
    featureFlags: tenant.settings?.featureFlags,
    branding: theme
      ? {
          primaryColor: theme.primaryColor,
          accentHoverColor: theme.accentHoverColor,
          fontBody: theme.fontBody,
          fontsByLocale: theme.fontsByLocale,
        }
      : undefined,
    // Legacy Discover field — keep for compatibility with older clients/tests
    theme,
    marketplace: marketplaceFields,
    branches,
  }
}

export const discoverService = {
  async getDiscover(): Promise<DiscoverResponse> {
    if (USE_MOCK) {
      await delay()
      const tenants = await tenantService.getTenants()
      const results = await Promise.all(tenants.map(buildMockDiscoverTenant))
      return { count: results.length, results }
    }

    const { data } = await api.get<PaginatedResponse<DiscoverTenant>>(
      ENDPOINTS.PUBLIC.DISCOVER,
    )
    return { count: data.count, results: data.results }
  },
}
