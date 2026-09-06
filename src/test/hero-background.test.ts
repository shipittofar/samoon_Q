import { describe, expect, it } from 'vitest'
import {
  heroSlideshowIntervalMs,
  heroSlideshowTransitionMs,
  resolveHeroBackgroundImages,
} from '@/lib/hero-background'
import {
  DEFAULT_HERO_SLIDESHOW_INTERVAL_MS,
  DEFAULT_HERO_SLIDESHOW_TRANSITION_MS,
} from '@/types/website-builder'

describe('resolveHeroBackgroundImages', () => {
  it('returns empty when nothing is configured', () => {
    expect(resolveHeroBackgroundImages()).toEqual([])
    expect(resolveHeroBackgroundImages({})).toEqual([])
  })

  it('uses the legacy single URL when the gallery is empty', () => {
    const images = resolveHeroBackgroundImages({ backgroundImage: 'https://cdn.example/hero.jpg' })
    expect(images).toHaveLength(1)
    expect(images[0].src).toBe('https://cdn.example/hero.jpg')
    expect(images[0].id).toBe('legacy-background')
  })

  it('prefers the gallery over the legacy URL and skips disabled frames', () => {
    const images = resolveHeroBackgroundImages({
      backgroundImage: 'https://cdn.example/old.jpg',
      backgroundImages: [
        { id: 'b', src: 'https://cdn.example/b.jpg', order: 2, enabled: true },
        { id: 'a', src: 'https://cdn.example/a.jpg', order: 1, enabled: true },
        { id: 'off', src: 'https://cdn.example/off.jpg', order: 0, enabled: false },
      ],
    })
    expect(images.map((img) => img.id)).toEqual(['a', 'b'])
    expect(images[0].order).toBe(0)
    expect(images[1].order).toBe(1)
  })

  it('falls back to the provided source when CMS is empty', () => {
    const images = resolveHeroBackgroundImages({}, 'https://cdn.example/tenant-hero.jpg')
    expect(images).toHaveLength(1)
    expect(images[0].src).toBe('https://cdn.example/tenant-hero.jpg')
  })
})

describe('hero slideshow timing', () => {
  it('uses defaults for missing or invalid values', () => {
    expect(heroSlideshowIntervalMs()).toBe(DEFAULT_HERO_SLIDESHOW_INTERVAL_MS)
    expect(heroSlideshowTransitionMs()).toBe(DEFAULT_HERO_SLIDESHOW_TRANSITION_MS)
    expect(heroSlideshowIntervalMs({ slideshowIntervalMs: 500 })).toBe(DEFAULT_HERO_SLIDESHOW_INTERVAL_MS)
  })

  it('accepts configured values', () => {
    expect(heroSlideshowIntervalMs({ slideshowIntervalMs: 4000 })).toBe(4000)
    expect(heroSlideshowTransitionMs({ slideshowTransitionMs: 400 })).toBe(400)
  })
})
