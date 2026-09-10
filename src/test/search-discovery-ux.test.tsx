import { describe, expect, it, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildDiscoverSuggestions } from '@/components/search/buildDiscoverSuggestions'
import { bandsToPriceRange } from '@/components/search/priceLevels'
import { HighlightText } from '@/components/search/HighlightText'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/locales/en.json'
import type { DiscoverItem } from '@/lib/discover-adapter'
import {
  DiscoverClientPage,
  parseDiscoverQuery,
  serializeDiscoverQuery,
} from '@/app/discover/DiscoverClientPage'

const { discoverState, searchParamsState, mockReplace } = vi.hoisted(() => ({
  discoverState: { items: [] as DiscoverItem[] },
  searchParamsState: { current: new URLSearchParams() },
  mockReplace: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: (href: string) => mockReplace(href),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/discover',
  useSearchParams: () => searchParamsState.current,
}))

vi.mock('@/hooks', () => ({
  useDiscover: () => ({ data: discoverState.items, isLoading: false, isError: false }),
}))

vi.mock('@/components/layout/Header', () => ({
  Header: () => <header />,
}))

vi.mock('@/components/layout/Footer', () => ({
  Footer: () => <footer />,
}))

vi.mock('@/components/marketplace/BusinessCard', () => ({
  BusinessCard: ({ tenant }: { tenant: { name: string } }) => <div>{tenant.name}</div>,
}))

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
    expect(src).toContain("t('allBusinesses')")
    expect(src).toContain('listedCount')
    expect(src).toContain('isSearchMode')
    expect(src).toContain('ResultToolbar')
    expect(src).not.toContain('BusinessSearch')
    expect(src).not.toContain('SortBar')
    expect(src).not.toContain('<AdvancedFilters')
    expect(src).toContain('parseDiscoverQuery')
    expect(src).toContain('serializeDiscoverQuery')
    expect(src).toContain('countAdvancedFilters')
    expect(src).toContain('showRails')
    expect(src).toContain('replaceDiscoverQuery({ openNow:')
    expect(src).not.toContain("FilterSection title={tMarket('openNow')}")
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

describe('parseDiscoverQuery / serializeDiscoverQuery', () => {
  it('round-trips q, category, openNow, and sort', () => {
    const qs = serializeDiscoverQuery({
      q: 'wine',
      category: 'bar',
      openNow: true,
      sort: 'newest',
    })
    expect(qs).toBe('q=wine&category=bar&openNow=1&sort=newest')
    expect(parseDiscoverQuery(new URLSearchParams(qs))).toEqual({
      q: 'wine',
      category: 'bar',
      openNow: true,
      sort: 'newest',
    })
  })

  it('treats missing params as the default browse state', () => {
    expect(parseDiscoverQuery(new URLSearchParams())).toEqual({
      q: '',
      category: '',
      openNow: false,
      sort: 'recommended',
    })
    expect(serializeDiscoverQuery({
      q: '',
      category: '',
      openNow: false,
      sort: 'recommended',
    })).toBe('')
  })
})

function discoverItem(opts: {
  id: string
  name: string
  businessTypes: string[]
  openNow?: boolean
  featured?: boolean
}): DiscoverItem {
  return {
    tenant: {
      id: opts.id,
      slug: opts.id,
      name: opts.name,
      is_active: true,
      status: 'ACTIVE',
      created_at: '2024-01-01T00:00:00.000Z',
      businessTypes: opts.businessTypes,
    } as DiscoverItem['tenant'],
    meta: {
      openNow: opts.openNow ?? true,
      featured: opts.featured,
      city: 'Tehran',
      branches: [],
    },
    branches: [],
  }
}

const CATALOG: DiscoverItem[] = [
  discoverItem({ id: 'night-bar', name: 'Night Bar', businessTypes: ['bar'], openNow: true, featured: true }),
  discoverItem({ id: 'closed-bar', name: 'Closed Bar', businessTypes: ['bar'], openNow: false }),
  discoverItem({ id: 'wine-bar', name: 'Wine Cellar Bar', businessTypes: ['bar'], openNow: true }),
  discoverItem({ id: 'garden', name: 'Garden Restaurant', businessTypes: ['restaurant'], openNow: true, featured: true }),
]

function renderDiscover() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DiscoverClientPage />
    </NextIntlClientProvider>,
  )
}

describe('Discover category, Open now, and rails', () => {
  beforeEach(() => {
    discoverState.items = CATALOG
    searchParamsState.current = new URLSearchParams()
    mockReplace.mockReset()
    mockReplace.mockImplementation((href: string) => {
      const i = href.indexOf('?')
      searchParamsState.current = new URLSearchParams(i >= 0 ? href.slice(i + 1) : '')
    })
  })

  it('scopes All Businesses to category=bar and hides unscoped rails', () => {
    searchParamsState.current = new URLSearchParams('category=bar')
    renderDiscover()

    expect(screen.getByRole('button', { name: 'Bar' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'All Businesses' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Featured' })).toBeNull()

    const listing = screen.getByRole('heading', { name: 'All Businesses' }).closest('section')!
    expect(within(listing).getByText('Night Bar')).toBeInTheDocument()
    expect(within(listing).getByText('Closed Bar')).toBeInTheDocument()
    expect(within(listing).queryByText('Garden Restaurant')).toBeNull()
    expect(screen.queryByText('Garden Restaurant')).toBeNull()
  })

  it('updates category from the URL without remounting', () => {
    searchParamsState.current = new URLSearchParams('category=bar')
    const view = renderDiscover()
    expect(screen.getByRole('button', { name: 'Bar' })).toHaveAttribute('aria-pressed', 'true')

    searchParamsState.current = new URLSearchParams('category=restaurant')
    view.rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <DiscoverClientPage />
      </NextIntlClientProvider>,
    )
    expect(screen.getByRole('button', { name: 'Restaurant' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Garden Restaurant')).toBeInTheDocument()
    expect(screen.queryByText('Night Bar')).toBeNull()

    searchParamsState.current = new URLSearchParams()
    view.rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <DiscoverClientPage />
      </NextIntlClientProvider>,
    )
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Featured' })).toBeInTheDocument()
    const listing = screen.getByRole('heading', { name: 'All Businesses' }).closest('section')!
    expect(within(listing).getByText('Night Bar')).toBeInTheDocument()
    expect(within(listing).getByText('Garden Restaurant')).toBeInTheDocument()
  })

  it('places Open now beside Search, outside Filters, and does not badge Filters for it', () => {
    searchParamsState.current = new URLSearchParams('openNow=1')
    renderDiscover()

    const openNow = screen.getByRole('button', { name: 'Open now' })
    expect(openNow).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
    expect(openNow.compareDocumentPosition(screen.getByRole('searchbox')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()

    const filters = screen.getByRole('button', { name: 'Filters' })
    expect(filters).toHaveAttribute('aria-pressed', 'false')
    expect(filters.textContent).toBe('Filters')

    fireEvent.click(filters)
    expect(screen.getByText('Price Level')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Open now' })).toHaveLength(1)
  })

  it('toggles Open now through the existing filters.openNow URL bit', () => {
    searchParamsState.current = new URLSearchParams('category=bar')
    const view = renderDiscover()
    fireEvent.click(screen.getByRole('button', { name: 'Open now' }))
    expect(mockReplace).toHaveBeenCalledWith('/discover?category=bar&openNow=1')

    view.rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <DiscoverClientPage />
      </NextIntlClientProvider>,
    )
    const listing = screen.getByRole('heading', { name: 'All Businesses' }).closest('section')!
    expect(within(listing).getByText('Night Bar')).toBeInTheDocument()
    expect(within(listing).queryByText('Closed Bar')).toBeNull()
  })

  it('composes category, search, and Open now on one pipeline', () => {
    searchParamsState.current = new URLSearchParams('q=wine&category=bar&openNow=1')
    renderDiscover()

    expect(screen.queryByRole('heading', { name: 'All Businesses' })).toBeNull()
    expect(screen.getByText('Wine Cellar Bar')).toBeInTheDocument()
    expect(screen.queryByText('Night Bar')).toBeNull()
    expect(screen.queryByText('Closed Bar')).toBeNull()
    expect(screen.queryByText('Garden Restaurant')).toBeNull()
  })
})
