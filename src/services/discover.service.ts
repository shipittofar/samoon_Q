import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { tenantService } from './tenant.service'
import { branchManagementService } from './branch.service'
import { pickTenantMarketplace } from '@/types/marketplace'
import { pickTenantContact } from '@/lib/tenant-settings'
import { resolveBranchHoursStatus } from '@/lib/branch-hours'
import type { DiscoverBranch, DiscoverResponse, DiscoverTenant } from '@/types/discover'
import type { Branch } from '@/types/branch'
import type { PaginatedResponse } from '@/types'
import { MOCK_BRANCH_CATEGORIES, MOCK_BRANCH_ITEMS } from '@/lib/mock-data'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms))

function branchEntityToDiscoverBranch(branch: Branch): DiscoverBranch {
  const hoursStatus = branch.businessHours?.length
    ? resolveBranchHoursStatus(branch.businessHours)
    : { openNow: branch.status === 'active' }

  return {
    id: branch.id,
    slug: branch.slug,
    name: branch.name,
    description: branch.description,
    image: branch.image,
    coverImage: branch.coverImage,
    heroImage: branch.heroImage,
    openNow: hoursStatus.openNow,
    todayHours: hoursStatus.todayHours,
    phone_number: branch.contact.phone_number,
    email: branch.contact.email,
    location: {
      address: branch.location.address,
      city: branch.location.city,
      country: branch.location.country,
      latitude: branch.location.latitude,
      longitude: branch.location.longitude,
    },
    serviceArea: branch.serviceArea,
    locationVerifiedAt: branch.locationVerifiedAt,
    // Only branches with their own mock menu advertise items (no default fallback).
    menuItemNames: MOCK_BRANCH_ITEMS[branch.id]?.filter((i) => i.available !== false).map((i) => i.name),
    menuCategoryNames: MOCK_BRANCH_CATEGORIES[branch.id]?.map((c) => c.name),
    checkout: branch.checkout,
    businessHours: branch.businessHours,
    currency: branch.currency,
    marketplaceVisible: branch.marketplaceVisible,
    reservationsEnabled: branch.reservationsEnabled,
    maxCapacity: branch.maxCapacity,
    cuisines: branch.cuisines,
    amenities: branch.amenities,
  }
}

async function buildMockDiscoverTenant(
  tenant: Awaited<ReturnType<typeof tenantService.getTenants>>[number],
): Promise<DiscoverTenant> {
  const listing = pickTenantMarketplace(tenant.settings?.marketplace)
  const tenantContact = pickTenantContact(tenant.settings)

  let branches: DiscoverBranch[] = []
  try {
    const entities = await branchManagementService.getTenantsBranches(tenant.id)
    branches = entities.map(branchEntityToDiscoverBranch)
  } catch {
    branches = []
  }

  const visible = branches.filter((b) => b.marketplaceVisible !== false)
  const theme = tenant.settings?.theme

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    description: tenant.description,
    status: tenant.status,
    is_active: tenant.is_active,
    created_at: tenant.created_at,
    businessTypes: tenant.businessTypes,
    image: tenant.image,
    discoverAvatar: tenant.discoverAvatar,
    discoverCover: tenant.discoverCover,
    heroImage: tenant.heroImage,
    featureFlags: tenant.settings?.featureFlags,
    contactEmail: tenantContact.contactEmail,
    contactPhone: tenantContact.contactPhone,
    branding: theme
      ? {
          primaryColor: theme.primaryColor,
          accentHoverColor: theme.accentHoverColor,
          fontBody: theme.fontBody,
          fontsByLocale: theme.fontsByLocale,
        }
      : undefined,
    theme,
    marketplace: {
      ...listing,
      branchCount: visible.length,
      openNow: visible.length > 0 ? visible.some((b) => b.openNow) : undefined,
      primaryBranchSlug: visible[0]?.slug,
    },
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
