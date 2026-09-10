import { describe, it, expect } from 'vitest'
import { buildBranchCheckout } from '@/lib/branch-checkout'
import {
  BRANCH_HERO_FEATURE_VISIBLE_LIMIT,
  collectBranchHeroFeatures,
  partitionHeroFeatures,
} from '@/lib/branch-hero-features'
import type { PublicBranchInfo } from '@/types/marketplace'

function branch(overrides: Partial<PublicBranchInfo> = {}): PublicBranchInfo {
  return {
    id: 'b1',
    slug: 'main',
    name: 'Main',
    address: '1 St',
    city: 'City',
    openNow: true,
    ...overrides,
  }
}

describe('collectBranchHeroFeatures', () => {
  it('returns nothing when cuisines and amenities are empty', () => {
    expect(collectBranchHeroFeatures(branch({ cuisines: [], amenities: [] }))).toEqual([])
    expect(collectBranchHeroFeatures(branch({}))).toEqual([])
  })

  it('never maps checkout, payments, or reservations into hero chips', () => {
    const features = collectBranchHeroFeatures(
      branch({
        checkout: buildBranchCheckout({
          orderingEnabled: true,
          delivery: true,
          pickup: true,
          dineIn: true,
          cash: true,
          card: true,
          online: true,
          wallet: true,
        }),
        reservationsEnabled: true,
        marketplaceVisible: true,
        cuisines: ['Italian'],
        amenities: ['WiFi', 'Parking'],
      }),
    )
    expect(features.map((f) => f.name)).toEqual(['Italian', 'WiFi', 'Parking'])
    expect(features.every((f) => f.kind === 'cuisine' || f.kind === 'amenity')).toBe(true)
    expect(features.some((f) => /order|deliver|pickup|pay|reserv|marketplace/i.test(f.id))).toBe(false)
  })

  it('lists cuisines then amenities, skips blanks, and dedupes case-insensitively', () => {
    expect(
      collectBranchHeroFeatures(
        branch({
          cuisines: [' Italian ', '', 'Persian', 'italian'],
          amenities: ['Outdoor Seating', '  ', 'WiFi', 'wifi'],
        }),
      ).map((f) => f.name),
    ).toEqual(['Italian', 'Persian', 'Outdoor Seating', 'WiFi'])
  })

  it('includes every amenity and cuisine; overflow is handled by partition', () => {
    const features = collectBranchHeroFeatures(
      branch({
        cuisines: ['Italian', 'Persian', 'Japanese'],
        amenities: ['WiFi', 'Parking', 'Outdoor Seating', 'Wheelchair Accessible', 'Pet Friendly', 'Smoking Area'],
      }),
    )
    expect(features).toHaveLength(9)
    expect(features.filter((f) => f.kind === 'cuisine')).toHaveLength(3)
    expect(features.filter((f) => f.kind === 'amenity')).toHaveLength(6)
  })
})

describe('partitionHeroFeatures', () => {
  it('shows at most 8 chips and parks the rest for More features', () => {
    const features = collectBranchHeroFeatures(
      branch({
        cuisines: ['Italian', 'Persian'],
        amenities: ['WiFi', 'Parking', 'Outdoor Seating', 'Wheelchair Accessible', 'Pet Friendly', 'Smoking Area', 'Live Music'],
      }),
    )
    expect(features.length).toBeGreaterThan(BRANCH_HERO_FEATURE_VISIBLE_LIMIT)
    const { visible, extra } = partitionHeroFeatures(features)
    expect(visible).toHaveLength(BRANCH_HERO_FEATURE_VISIBLE_LIMIT)
    expect(visible[0]?.name).toBe('Italian')
    expect(extra.map((f) => f.name)).toEqual(['Live Music'])
  })
})
