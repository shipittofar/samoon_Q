/**
 * P8.8.6.1 — Opinionated Website Builder tests
 *
 * Covers:
 *   - BRAND_THEMES catalog correctness
 *   - DEFAULT_BRAND_THEME validity
 *   - HERO_LAYOUT_LABELS coverage
 *   - HERO_PRIMARY_CTA_LABELS / HERO_SECONDARY_CTA_LABELS coverage
 *   - DEFAULT_HERO_CONFIG required fields
 *   - DEFAULT_SECTION_TEMPLATES correctness
 *   - Template label maps completeness
 *   - HomepageLayout backward compatibility
 *   - BrandThemeTokens required fields
 *   - Uniqueness and validity constraints
 */
import { describe, it, expect } from 'vitest'
import {
  BRAND_THEMES,
  DEFAULT_BRAND_THEME,
  HERO_LAYOUT_LABELS,
  HERO_PRIMARY_CTA_LABELS,
  HERO_SECONDARY_CTA_LABELS,
  DEFAULT_HERO_CONFIG,
  DEFAULT_SECTION_TEMPLATES,
  DEFAULT_LAYOUT,
  GALLERY_TEMPLATE_LABELS,
  REVIEWS_TEMPLATE_LABELS,
  CONTACT_TEMPLATE_LABELS,
  ABOUT_TEMPLATE_LABELS,
} from '@/types/website-builder'
import type {
  BrandThemeName,
  HeroLayoutVariant,
  HeroPrimaryCtaType,
  HeroSecondaryCtaType,
  GalleryTemplate,
  ReviewsTemplate,
  ContactTemplate,
  AboutTemplate,
  DarkModePreference,
} from '@/types/website-builder'

describe('P8.8.6.1 — BRAND_THEMES catalog', () => {
  it('has exactly 10 themes', () => {
    expect(BRAND_THEMES).toHaveLength(10)
  })

  it('all themes have required fields', () => {
    for (const theme of BRAND_THEMES) {
      expect(theme.name).toBeTruthy()
      expect(theme.label).toBeTruthy()
      expect(theme.description).toBeTruthy()
      expect(theme.tokens).toBeDefined()
      expect(theme.darkModePreference).toBeTruthy()
    }
  })

  it('no two themes share the same name', () => {
    const names = BRAND_THEMES.map((t) => t.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('all darkModePreference values are valid', () => {
    const valid: DarkModePreference[] = ['light', 'dark', 'system']
    for (const theme of BRAND_THEMES) {
      expect(valid).toContain(theme.darkModePreference)
    }
  })

  it('all BrandThemeTokens have required fields', () => {
    const requiredKeys = ['primary', 'accent', 'bg', 'fg', 'card', 'fgMuted', 'fontFamily', 'borderRadius', 'cardShadow'] as const
    for (const theme of BRAND_THEMES) {
      for (const key of requiredKeys) {
        expect(theme.tokens[key]).toBeDefined()
      }
    }
  })

  it('all themes have bg and fg defined (accessibility baseline)', () => {
    for (const theme of BRAND_THEMES) {
      expect(theme.tokens.bg).toBeTruthy()
      expect(theme.tokens.fg).toBeTruthy()
    }
  })
})

describe('P8.8.6.1 — DEFAULT_BRAND_THEME', () => {
  it('exists in BRAND_THEMES', () => {
    const names: BrandThemeName[] = BRAND_THEMES.map((t) => t.name)
    expect(names).toContain(DEFAULT_BRAND_THEME)
  })

  it('is "modern"', () => {
    expect(DEFAULT_BRAND_THEME).toBe('modern')
  })
})

describe('P8.8.6.1 — HERO_LAYOUT_LABELS', () => {
  const allVariants: HeroLayoutVariant[] = ['hero_a', 'hero_b', 'hero_c', 'hero_d', 'hero_e']

  it('covers all 5 HeroLayoutVariant values', () => {
    for (const variant of allVariants) {
      expect(HERO_LAYOUT_LABELS[variant]).toBeDefined()
    }
  })

  it('each entry has label and description', () => {
    for (const variant of allVariants) {
      expect(HERO_LAYOUT_LABELS[variant].label).toBeTruthy()
      expect(HERO_LAYOUT_LABELS[variant].description).toBeTruthy()
    }
  })
})

describe('P8.8.6.1 — HERO_PRIMARY_CTA_LABELS', () => {
  const allTypes: HeroPrimaryCtaType[] = ['reserve', 'order_online', 'view_menu', 'contact', 'directions']

  it('covers all HeroPrimaryCtaType values', () => {
    for (const type of allTypes) {
      expect(HERO_PRIMARY_CTA_LABELS[type]).toBeTruthy()
    }
  })

  it('has 5 entries', () => {
    expect(Object.keys(HERO_PRIMARY_CTA_LABELS)).toHaveLength(5)
  })
})

describe('P8.8.6.1 — HERO_SECONDARY_CTA_LABELS', () => {
  const allTypes: HeroSecondaryCtaType[] = ['promotions', 'loyalty', 'gallery', 'reviews']

  it('covers all HeroSecondaryCtaType values', () => {
    for (const type of allTypes) {
      expect(HERO_SECONDARY_CTA_LABELS[type]).toBeTruthy()
    }
  })

  it('has 4 entries', () => {
    expect(Object.keys(HERO_SECONDARY_CTA_LABELS)).toHaveLength(4)
  })
})

describe('P8.8.6.1 — DEFAULT_HERO_CONFIG', () => {
  it('has required field: layout', () => {
    expect(DEFAULT_HERO_CONFIG.layout).toBeTruthy()
  })

  it('has required field: backgroundType', () => {
    expect(DEFAULT_HERO_CONFIG.backgroundType).toBeTruthy()
  })

  it('has required field: alignment', () => {
    expect(DEFAULT_HERO_CONFIG.alignment).toBeTruthy()
  })

  it('layout is a valid HeroLayoutVariant', () => {
    const valid: HeroLayoutVariant[] = ['hero_a', 'hero_b', 'hero_c', 'hero_d', 'hero_e']
    expect(valid).toContain(DEFAULT_HERO_CONFIG.layout)
  })
})

describe('P8.8.6.1 — DEFAULT_SECTION_TEMPLATES', () => {
  it('has all 4 keys', () => {
    expect(DEFAULT_SECTION_TEMPLATES.gallery).toBeDefined()
    expect(DEFAULT_SECTION_TEMPLATES.reviews).toBeDefined()
    expect(DEFAULT_SECTION_TEMPLATES.contact).toBeDefined()
    expect(DEFAULT_SECTION_TEMPLATES.about).toBeDefined()
  })

  it('gallery default is valid', () => {
    const valid: GalleryTemplate[] = ['grid', 'slider', 'masonry', 'compact']
    expect(valid).toContain(DEFAULT_SECTION_TEMPLATES.gallery)
  })

  it('reviews default is valid', () => {
    const valid: ReviewsTemplate[] = ['cards', 'carousel', 'minimal', 'compact']
    expect(valid).toContain(DEFAULT_SECTION_TEMPLATES.reviews)
  })

  it('contact default is valid', () => {
    const valid: ContactTemplate[] = ['map_left', 'map_right', 'card', 'minimal']
    expect(valid).toContain(DEFAULT_SECTION_TEMPLATES.contact)
  })

  it('about default is valid', () => {
    const valid: AboutTemplate[] = ['story_left', 'story_right', 'wide', 'compact']
    expect(valid).toContain(DEFAULT_SECTION_TEMPLATES.about)
  })
})

describe('P8.8.6.1 — Template label maps', () => {
  it('GALLERY_TEMPLATE_LABELS has 4 entries', () => {
    expect(Object.keys(GALLERY_TEMPLATE_LABELS)).toHaveLength(4)
  })

  it('REVIEWS_TEMPLATE_LABELS has 4 entries', () => {
    expect(Object.keys(REVIEWS_TEMPLATE_LABELS)).toHaveLength(4)
  })

  it('CONTACT_TEMPLATE_LABELS has 4 entries', () => {
    expect(Object.keys(CONTACT_TEMPLATE_LABELS)).toHaveLength(4)
  })

  it('ABOUT_TEMPLATE_LABELS has 4 entries', () => {
    expect(Object.keys(ABOUT_TEMPLATE_LABELS)).toHaveLength(4)
  })

  it('all GALLERY_TEMPLATE_LABELS have non-empty strings', () => {
    for (const val of Object.values(GALLERY_TEMPLATE_LABELS)) {
      expect(val).toBeTruthy()
    }
  })
})

describe('P8.8.6.1 — HomepageLayout backward compat', () => {
  it('DEFAULT_LAYOUT still has sections', () => {
    expect(Array.isArray(DEFAULT_LAYOUT.sections)).toBe(true)
    expect(DEFAULT_LAYOUT.sections.length).toBeGreaterThan(0)
  })

  it('DEFAULT_LAYOUT still has hero', () => {
    expect(DEFAULT_LAYOUT.hero).toBeDefined()
  })

  it('DEFAULT_LAYOUT still has about', () => {
    expect(DEFAULT_LAYOUT.about).toBeDefined()
  })

  it('DEFAULT_LAYOUT still has contact', () => {
    expect(DEFAULT_LAYOUT.contact).toBeDefined()
  })

  it('DEFAULT_LAYOUT still has faq', () => {
    expect(Array.isArray(DEFAULT_LAYOUT.faq)).toBe(true)
  })

  it('DEFAULT_LAYOUT still has theme', () => {
    expect(DEFAULT_LAYOUT.theme).toBeDefined()
  })

  it('DEFAULT_LAYOUT still has status', () => {
    expect(DEFAULT_LAYOUT.status).toBeTruthy()
  })

  it('new brandTheme field is optional (undefined in DEFAULT_LAYOUT)', () => {
    expect(DEFAULT_LAYOUT.brandTheme).toBeUndefined()
  })

  it('new heroConfig field is optional (undefined in DEFAULT_LAYOUT)', () => {
    expect(DEFAULT_LAYOUT.heroConfig).toBeUndefined()
  })

  it('new sectionTemplates field is optional (undefined in DEFAULT_LAYOUT)', () => {
    expect(DEFAULT_LAYOUT.sectionTemplates).toBeUndefined()
  })
})
