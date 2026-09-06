import type { HeroBackgroundImage, HeroObjectPosition, PlatformHomepageHero } from '@/types/website-builder'
import {
  DEFAULT_HERO_SLIDESHOW_INTERVAL_MS,
  DEFAULT_HERO_SLIDESHOW_TRANSITION_MS,
} from '@/types/website-builder'

/**
 * Server-side Platform Homepage Hero store.
 * Isolated from tenant Website Builder settings — never merged with tenant hero.
 */
const MIN_INTERVAL_MS = 2000
const MAX_INTERVAL_MS = 60_000
const MIN_TRANSITION_MS = 200
const MAX_TRANSITION_MS = 3000

export const PLATFORM_HOMEPAGE_HERO_SEED: PlatformHomepageHero = {
  backgroundImages: [
    {
      id: 'seed-platform-hero',
      src: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1920&q=80',
      order: 0,
      enabled: true,
      objectPosition: 'center',
    },
  ],
  slideshowIntervalMs: DEFAULT_HERO_SLIDESHOW_INTERVAL_MS,
  slideshowTransitionMs: DEFAULT_HERO_SLIDESHOW_TRANSITION_MS,
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function normalizeImage(raw: unknown, order: number): HeroBackgroundImage | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>
  const src = typeof rec.src === 'string' ? rec.src.trim() : ''
  if (!src) return null
  const id = typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : `platform-hero-${order}`
  const altText = typeof rec.altText === 'string' ? rec.altText : undefined
  const POSITIONS = new Set<HeroObjectPosition>(['center', 'top', 'bottom', 'left', 'right'])
  const objectPosition =
    typeof rec.objectPosition === 'string' && POSITIONS.has(rec.objectPosition as HeroObjectPosition)
      ? (rec.objectPosition as HeroObjectPosition)
      : undefined
  const objectPositionMobile =
    typeof rec.objectPositionMobile === 'string' && POSITIONS.has(rec.objectPositionMobile as HeroObjectPosition)
      ? (rec.objectPositionMobile as HeroObjectPosition)
      : undefined
  return {
    id,
    src,
    order,
    enabled: rec.enabled !== false,
    ...(altText ? { altText } : {}),
    ...(objectPosition ? { objectPosition } : {}),
    ...(objectPositionMobile ? { objectPositionMobile } : {}),
  }
}

export function normalizePlatformHomepageHero(raw: unknown): PlatformHomepageHero {
  const rec = raw !== null && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {}
  const images = Array.isArray(rec.backgroundImages)
    ? rec.backgroundImages
        .map((img, i) => normalizeImage(img, i))
        .filter((img): img is HeroBackgroundImage => img !== null)
        .map((img, order) => ({ ...img, order }))
    : []

  return {
    backgroundImages: images,
    slideshowIntervalMs: clamp(
      Number(rec.slideshowIntervalMs),
      MIN_INTERVAL_MS,
      MAX_INTERVAL_MS,
      DEFAULT_HERO_SLIDESHOW_INTERVAL_MS,
    ),
    slideshowTransitionMs: clamp(
      Number(rec.slideshowTransitionMs),
      MIN_TRANSITION_MS,
      MAX_TRANSITION_MS,
      DEFAULT_HERO_SLIDESHOW_TRANSITION_MS,
    ),
  }
}

let memory: PlatformHomepageHero = structuredClone(PLATFORM_HOMEPAGE_HERO_SEED)

export function getPlatformHomepageHero(): PlatformHomepageHero {
  return structuredClone(memory)
}

export function setPlatformHomepageHero(next: PlatformHomepageHero): PlatformHomepageHero {
  memory = normalizePlatformHomepageHero(next)
  return structuredClone(memory)
}

export function resetPlatformHomepageHeroForTests(next?: PlatformHomepageHero): void {
  memory = structuredClone(next ?? PLATFORM_HOMEPAGE_HERO_SEED)
}
