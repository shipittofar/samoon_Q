import type { PublicBranchInfo } from '@/types/marketplace'

/** How many amenity/cuisine chips to show in the hero before “More features”. */
export const BRANCH_HERO_FEATURE_VISIBLE_LIMIT = 8

export type BranchHeroFeatureKind = 'cuisine' | 'amenity'

export interface BranchHeroFeature {
  id: string
  kind: BranchHeroFeatureKind
  name: string
}

type BranchHeroSource = Pick<PublicBranchInfo, 'cuisines' | 'amenities'>

function uniqueLabels(values: string[] | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values ?? []) {
    const name = raw.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

/**
 * Hero chips: what this Branch *has* (cuisines + amenities).
 * Checkout, payments, ordering, and reservations are never included.
 */
export function collectBranchHeroFeatures(branch: BranchHeroSource): BranchHeroFeature[] {
  const features: BranchHeroFeature[] = []

  for (const name of uniqueLabels(branch.cuisines)) {
    features.push({ id: `cuisine:${name}`, kind: 'cuisine', name })
  }
  for (const name of uniqueLabels(branch.amenities)) {
    features.push({ id: `amenity:${name}`, kind: 'amenity', name })
  }

  return features
}

export function partitionHeroFeatures(
  features: BranchHeroFeature[],
  limit = BRANCH_HERO_FEATURE_VISIBLE_LIMIT,
): { visible: BranchHeroFeature[]; extra: BranchHeroFeature[] } {
  return {
    visible: features.slice(0, limit),
    extra: features.slice(limit),
  }
}
