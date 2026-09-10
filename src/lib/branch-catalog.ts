/**
 * Branch create/edit selectable catalogs.
 *
 * There is no dedicated cuisine/amenity API in this repo. Values are the
 * unique labels already used on mock branches and marketplace fixtures
 * (src/services/branch.service.ts, marketplace tests).
 */

import type { ProvisionableBusinessType } from '@/types/provisioning'

/** Food-and-beverage tenant types for which cuisine tags are relevant. */
export const CUISINE_RELEVANT_BUSINESS_TYPES: ReadonlySet<string> = new Set<ProvisionableBusinessType>([
  'restaurant',
  'cafe',
  'bar',
  'food_court',
  'food_truck',
  'mobile_cafe',
])

export const BRANCH_CUISINE_OPTIONS: readonly string[] = [
  'Mediterranean',
  'Italian',
  'Contemporary',
  'Coffee',
  'Pastries',
  'Light Bites',
  'Cocktails',
  'Craft Beer',
  'Bar Bites',
  'International',
  'Asian',
  'Middle Eastern',
  'Western',
  'Brunch',
  'Smoothies',
  'Street Food',
  'Burgers',
  'Wraps',
  'Persian',
]

export const BRANCH_AMENITY_OPTIONS: readonly string[] = [
  'WiFi',
  'Parking',
  'Outdoor Seating',
  'Accessible',
  'Pet Friendly',
  'Family Area',
]

export function tenantShowsCuisines(businessTypes: string[] | undefined): boolean {
  if (!businessTypes?.length) return false
  return businessTypes.some((type) => CUISINE_RELEVANT_BUSINESS_TYPES.has(type))
}

export function mergeCatalogOptions(canonical: readonly string[], current: string[]): string[] {
  const extra = current.filter((value) => !canonical.includes(value))
  return extra.length ? [...canonical, ...extra] : [...canonical]
}
