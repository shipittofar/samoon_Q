'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui'
import { cn } from '@/utils'
import {
  collectBranchHeroFeatures,
  partitionHeroFeatures,
  type BranchHeroFeature,
} from '@/lib/branch-hero-features'
import type { PublicBranchInfo } from '@/types/marketplace'

function FeatureChip({ feature }: { feature: BranchHeroFeature }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'max-w-full border-white/25 bg-white/15 text-white',
        'px-2.5 py-1 text-xs font-medium leading-tight',
        'whitespace-nowrap',
      )}
    >
      <span className="truncate">{feature.name}</span>
    </Badge>
  )
}

export function BranchHeroFeatures({ branch }: { branch: PublicBranchInfo }) {
  const t = useTranslations('branch.features')
  const [expanded, setExpanded] = useState(false)
  const features = collectBranchHeroFeatures(branch)
  const { visible, extra } = partitionHeroFeatures(features)

  if (features.length === 0) return null

  const shown = expanded ? features : visible

  return (
    <ul className="flex min-w-0 flex-wrap gap-1.5" aria-label={t('ariaLabel')}>
      {shown.map((feature) => (
        <li key={feature.id} className="min-w-0 max-w-full">
          <FeatureChip feature={feature} />
        </li>
      ))}
      {extra.length > 0 && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className={cn(
              'inline-flex min-h-8 items-center rounded-full border border-white/30',
              'bg-white/10 px-3 py-1 text-xs font-semibold text-white',
              'hover:bg-white/20 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80',
            )}
          >
            {expanded ? t('showLess') : t('moreFeatures')}
          </button>
        </li>
      )}
    </ul>
  )
}
