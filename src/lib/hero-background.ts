import {
  DEFAULT_HERO_SLIDESHOW_INTERVAL_MS,
  DEFAULT_HERO_SLIDESHOW_TRANSITION_MS,
  type HeroBackgroundImage,
  type HeroContent,
} from '@/types/website-builder'
import { resolveMediaUrl } from '@/utils/media-url'

export function createHeroBackgroundId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `hero-bg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function normalizeFrame(img: HeroBackgroundImage, order: number): HeroBackgroundImage {
  return {
    ...img,
    src: resolveMediaUrl(img.src),
    order,
    enabled: img.enabled !== false,
  }
}

/**
 * Active hero frames for the public renderer.
 * 0 → caller uses visual fallback; 1 → static; 2+ → slideshow.
 */
export function resolveHeroBackgroundImages(
  hero?: Pick<HeroContent, 'backgroundImages' | 'backgroundImage'> | null,
  fallbackSrc?: string | null,
): HeroBackgroundImage[] {
  const fromCms = [...(hero?.backgroundImages ?? [])]
    .filter((img) => img && img.enabled !== false && Boolean(img.src?.trim()))
    .sort((a, b) => a.order - b.order)
    .map((img, index) => normalizeFrame(img, index))

  if (fromCms.length > 0) return fromCms

  const legacy = hero?.backgroundImage?.trim()
  if (legacy) {
    return [normalizeFrame({ id: 'legacy-background', src: legacy, order: 0, enabled: true }, 0)]
  }

  const fallback = fallbackSrc?.trim()
  if (fallback) {
    return [normalizeFrame({ id: 'fallback-background', src: fallback, order: 0, enabled: true }, 0)]
  }

  return []
}

export function heroSlideshowIntervalMs(hero?: Pick<HeroContent, 'slideshowIntervalMs'> | null): number {
  const value = hero?.slideshowIntervalMs
  if (typeof value === 'number' && Number.isFinite(value) && value >= 2000) return value
  return DEFAULT_HERO_SLIDESHOW_INTERVAL_MS
}

export function heroSlideshowTransitionMs(hero?: Pick<HeroContent, 'slideshowTransitionMs'> | null): number {
  const value = hero?.slideshowTransitionMs
  if (typeof value === 'number' && Number.isFinite(value) && value >= 200) return value
  return DEFAULT_HERO_SLIDESHOW_TRANSITION_MS
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}
