'use client'

import { HeroBackground } from '@/components/home/HeroBackground'
import { usePlatformHomepageHero } from '@/hooks'
import {
  heroSlideshowIntervalMs,
  heroSlideshowTransitionMs,
  resolveHeroBackgroundImages,
} from '@/lib/hero-background'

const PLATFORM_OVERLAY = (
  <>
    <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
  </>
)

export function PlatformHeroBackground() {
  const { data } = usePlatformHomepageHero()
  const images = resolveHeroBackgroundImages(data)

  return (
    <HeroBackground
      images={images}
      intervalMs={heroSlideshowIntervalMs(data)}
      transitionMs={heroSlideshowTransitionMs(data)}
      overlay={PLATFORM_OVERLAY}
    />
  )
}
