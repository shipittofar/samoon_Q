import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildDiscoverSuggestions } from '@/components/search/buildDiscoverSuggestions'
import { bandsToPriceRange } from '@/components/search/priceLevels'
import { HighlightText } from '@/components/search/HighlightText'
import { render } from '@testing-library/react'
import type { DiscoverItem } from '@/lib/discover-adapter'

const ROOT = join(__dirname, '..')

function item(overrides: Partial<DiscoverItem['tenant']> & { city?: string; cuisines?: string[] }): DiscoverItem {
  const { city, cuisines, ...tenantBits } = overrides
  return {
    tenant: {
      id: tenantBits.id ?? 't1',
      slug: tenantBits.slug ?? 'place',
      name: tenantBits.name ?? 'Samoon Kitchen',
      is_active: true,
      status: 'ACTIVE',
      created_at: '2024-01-01T00:00:00.000Z',
      businessTypes: ['restaurant'],
      ...tenantBits,
    } as DiscoverItem['tenant'],
    meta: { city: city ?? 'Tehran', branches: [] },
    branches: [
      {
        id: 'b1',
        slug: 'main',
        name: 'Main',
        address: '',
        city: city ?? 'Tehran',
        openNow: true,
        cuisines: cuisines ?? ['Persian'],
      },
    ],
  } as DiscoverItem
}

describe('buildDiscoverSuggestions', () => {
  it('groups matching businesses, cuisines, and cities from loaded rows', () => {
    const groups = buildDiscoverSuggestions('per', [
      item({ name: 'Persian House', id: '1', slug: 'persian-house', cuisines: ['Persian'] }),
      item({ name: 'Cafe Noor', id: '2', slug: 'cafe-noor', city: 'Persepolis', cuisines: ['Coffee'] }),
    ])
    const byId = Object.fromEntries(groups.map((g) => [g.id, g.items.map((i) => i.label)]))
    expect(byId.businesses).toContain('Persian House')
    expect(byId.cuisines).toContain('Persian')
    expect(byId.cities).toContain('Persepolis')
  })

  it('returns nothing for an empty query', () => {
    expect(buildDiscoverSuggestions('  ', [item({})])).toEqual([])
  })
})

describe('bandsToPriceRange', () => {
  it('maps selected menu price bands onto min/max without changing the API shape', () => {
    expect(bandsToPriceRange([])).toEqual({})
    expect(bandsToPriceRange([1])).toEqual({ max: 15 })
    expect(bandsToPriceRange([3])).toEqual({ min: 35 })
    expect(bandsToPriceRange([1, 2])).toEqual({ max: 35 })
    expect(bandsToPriceRange([1, 2, 3])).toEqual({})
  })
})

describe('HighlightText', () => {
  it('wraps the first case-insensitive match in a mark', () => {
    const { container } = render(<HighlightText text="Burrata Salad" query="burr" />)
    expect(container.querySelector('mark')?.textContent).toBe('Burr')
  })
})

describe('search system wiring', () => {
  it('SearchField uses logical inset classes and no physical left/right padding', () => {
    const src = readFileSync(join(ROOT, 'components', 'search', 'SearchField.tsx'), 'utf8')
    expect(src).toContain('start-3')
    expect(src).toContain('end-0')
    expect(src).toContain('ps-11')
    expect(src).not.toMatch(/\bleft-/)
    expect(src).not.toMatch(/\bright-/)
    expect(src).not.toMatch(/\bpl-/)
    expect(src).not.toMatch(/\bpr-/)
    expect(src).toContain("variant === 'overlay'")
    expect(src).toContain('--search-field-height-chrome')
    expect(src).toContain('--search-field-height-overlay')
  })

  it('search tokens include a compact filter sheet width and overlay', () => {
    const src = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8')
    expect(src).toContain('--search-sheet-width')
    expect(src).toContain('--search-sheet-max-block-size')
    expect(src).toContain('--search-sheet-overlay')
  })

  it('Drawer end/start placement uses logical CSS, not physical left/right inset', () => {
    const src = readFileSync(join(ROOT, 'components', 'ui', 'Modal.tsx'), 'utf8')
    expect(src).toContain("side === 'end' && 'ms-auto border-s'")
    expect(src).toContain("side === 'start' && 'border-e'")
    expect(src).toContain("overlay === 'subtle'")
    expect(src).not.toContain('left-1/2')
  })

  it('Discover uses SearchField, overlay, and no marketing hero', () => {
    const src = readFileSync(join(ROOT, 'app', 'discover', 'DiscoverClientPage.tsx'), 'utf8')
    expect(src).toContain('SearchField')
    expect(src).toContain('SearchOverlay')
    expect(src).toContain('useDiscover')
    expect(src).toContain('branches={branches}')
    expect(src).not.toContain('Find Your Next')
    expect(src).not.toContain('bg-gradient-to-br')
    expect(src).not.toContain('eyebrow')
    expect(src).not.toContain('All Businesses')
    expect(src).not.toContain('BusinessSearch')
    expect(src).not.toContain('SortBar')
    expect(src).not.toContain('AdvancedFilters')
  })

  it('Menu uses SearchField, persists q, and has no hero or tag scroller', () => {
    const src = readFileSync(join(ROOT, 'components', 'menu', 'MenuContent.tsx'), 'utf8')
    expect(src).toContain('SearchField')
    expect(src).toContain("params.set('q'")
    expect(src).toContain("searchParams.get('q')")
    expect(src).toContain('FilterSheet')
    expect(src).not.toContain('bg-gradient-to-b')
    expect(src).not.toContain('Grid3X3')
    expect(src).not.toContain('minRating')
    expect(src).not.toContain('type="range"')
    expect(src).toContain('priceBand')
  })

  it('FilterSheet is a compact logical sheet, not a full-screen takeover', () => {
    const src = readFileSync(join(ROOT, 'components', 'search', 'FilterSheet.tsx'), 'utf8')
    expect(src).toContain("side={isDesktop ? 'end' : 'bottom'}")
    expect(src).toContain("overlay=\"subtle\"")
    expect(src).toContain('fitContent')
    expect(src).toContain("size=\"compact\"")
    expect(src).toContain('min-width: 600px')
    expect(src).not.toMatch(/\bleft-/)
    expect(src).not.toMatch(/\bright-/)
    expect(src).not.toMatch(/\bpl-/)
    expect(src).not.toMatch(/\bpr-/)
  })
})
