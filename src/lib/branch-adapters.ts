import type { Branch as BranchEntity, BranchBusinessHours } from '@/types/branch'
import type { Location, WorkingHours } from '@/types'
import type { PublicBranchInfo } from '@/types/marketplace'

/** Maps P7 branch business hours to legacy Location working_hours wire shape. */
export function mapBusinessHoursToWorkingHours(hours: BranchBusinessHours[]): WorkingHours[] {
  return hours.map((h) => ({
    day: h.day,
    open: h.open,
    close: h.close,
    is_closed: h.isClosed,
  }))
}

/** Maps canonical P7 branch entity → storefront Location (preserves checkout + top-level fields). */
export function branchEntityToLocation(branch: BranchEntity): Location {
  return {
    id: branch.id,
    tenant_id: branch.tenantId,
    name: branch.name,
    slug: branch.slug,
    address: branch.location.address,
    city: branch.location.city,
    phone_number: branch.contact.phone_number ?? '',
    email: branch.contact.email,
    lat: branch.location.latitude ?? 0,
    lng: branch.location.longitude ?? 0,
    working_hours: mapBusinessHoursToWorkingHours(branch.businessHours ?? []),
    is_active: branch.status === 'active',
    checkout: branch.checkout,
    currency: branch.currency,
    marketplaceVisible: branch.marketplaceVisible,
    reservationsEnabled: branch.reservationsEnabled,
    maxCapacity: branch.maxCapacity,
    delivery_radius: branch.checkout.delivery.radius ?? undefined,
  }
}

/** Maps public branch summary → storefront Location for activeBranch store. */
export function publicBranchToLocation(b: PublicBranchInfo, tenantId: string): Location {
  return {
    id: b.id,
    tenant_id: tenantId,
    name: b.name,
    slug: b.slug,
    address: b.address,
    city: b.city,
    phone_number: b.phone_number ?? '',
    lat: 0,
    lng: 0,
    working_hours: b.businessHours ? mapBusinessHoursToWorkingHours(b.businessHours) : [],
    is_active: b.openNow,
    checkout: b.checkout,
    currency: b.currency,
    marketplaceVisible: b.marketplaceVisible,
    reservationsEnabled: b.reservationsEnabled,
    maxCapacity: b.maxCapacity,
    delivery_radius: b.checkout?.delivery.radius ?? undefined,
  }
}
