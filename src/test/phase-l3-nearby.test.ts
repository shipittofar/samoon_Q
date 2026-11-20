/**
 * Phase L3 — nearby search: Persian-aware normalization, item (menu) search,
 * travel estimates, nearest-branch ranking, and the discover data threading.
 */
import { describe, it, expect } from 'vitest'
import { normalizeSearchText, expandSearchTerms, textMatchesTerms } from '@/lib/search-normalize'
import { estimateTravelMinutes, suggestTravelMode, formatDistance, MAX_WALK_KM } from '@/lib/travel'
import { computeNearby, rankNearby, matchesMenuQuery, menuMatchesFor, type NearbyInput } from '@/lib/nearby'
import { mapDiscoverBranchToPublicBranchInfo } from '@/lib/discover-adapter'
import { matchesSearch, type PublicBranchInfo } from '@/types/marketplace'
import { buildBranchCheckout } from '@/lib/branch-checkout'
import { parseDiscoverQuery, serializeDiscoverQuery } from '@/app/discover/DiscoverClientPage'

const USER = { lat: 35.7, lng: 51.4 }
/** Point `km` north of USER. */
const north = (km: number) => ({ lat: USER.lat + km / 111.32, lng: USER.lng })

function branch(id: string, km: number, extra: Partial<PublicBranchInfo> = {}): PublicBranchInfo {
  const p = north(km)
  return {
    id, slug: id, name: `Branch ${id}`, address: '', city: 'Tehran', openNow: true,
    latitude: p.lat, longitude: p.lng, locationVerifiedAt: '2026-11-01T00:00:00Z', ...extra,
  }
}

function biz(id: string, branches: PublicBranchInfo[], meta: NearbyInput['meta'] = {}, businessTypes = ['restaurant']): NearbyInput {
  return { tenant: { id, businessTypes }, meta, branches }
}

describe('normalizeSearchText', () => {
  it('folds Arabic letter variants to Persian', () => {
    expect(normalizeSearchText('پيتزا')).toBe(normalizeSearchText('پیتزا'))
    expect(normalizeSearchText('كباب')).toBe('کباب')
    expect(normalizeSearchText('آش')).toBe(normalizeSearchText('اش'))
  })

  it('treats ZWNJ as a space and strips tashkeel, tatweel, accents', () => {
    expect(normalizeSearchText('می‌خواهم')).toBe('می خواهم')
    expect(normalizeSearchText('كـــباب')).toBe('کباب')
    expect(normalizeSearchText('مُحَمَّد')).toBe('محمد')
    expect(normalizeSearchText('Café  CRÈME ')).toBe('cafe creme')
  })

  it('converts Persian and Arabic-Indic digits', () => {
    expect(normalizeSearchText('۱۲۳٤٥')).toBe('12345')
  })
})

describe('expandSearchTerms', () => {
  it('maps a Persian query to English menu words and back', () => {
    expect(expandSearchTerms('پیتزا')).toContain('pizza')
    expect(expandSearchTerms('Pizza')).toContain(normalizeSearchText('پیتزا'))
    expect(expandSearchTerms('پيتزا')).toContain('pizza') // Arabic yeh
  })

  it('expands a prefix of at least 3 letters', () => {
    expect(expandSearchTerms('piz')).toContain('pizza')
    expect(expandSearchTerms('pi')).toEqual(['pi'])
  })

  it('textMatchesTerms is substring + normalized', () => {
    expect(textMatchesTerms('Margherita PIZZA', expandSearchTerms('پیتزا'))).toBe(true)
    expect(textMatchesTerms('Caesar salad', expandSearchTerms('پیتزا'))).toBe(false)
  })
})

describe('travel estimates', () => {
  it('walk is slower than drive for the same distance', () => {
    expect(estimateTravelMinutes(2, 'walk')).toBeGreaterThan(estimateTravelMinutes(2, 'drive'))
    expect(estimateTravelMinutes(0, 'walk')).toBe(1)
  })

  it('walks when close, drives beyond the walking limit', () => {
    expect(suggestTravelMode(MAX_WALK_KM)).toBe('walk')
    expect(suggestTravelMode(MAX_WALK_KM + 0.1)).toBe('drive')
  })

  it('formats metres and kilometres', () => {
    expect(formatDistance(0.437)).toEqual({ value: 440, unit: 'm' })
    expect(formatDistance(3.24)).toEqual({ value: 3.2, unit: 'km' })
    expect(formatDistance(23.6)).toEqual({ value: 24, unit: 'km' })
  })
})

describe('computeNearby', () => {
  it('picks the nearest branch and reports distance + service area', () => {
    const [r] = computeNearby([biz('a', [branch('far', 8), branch('near', 1)])], USER)
    expect(r.branches.map((b) => b.branchId)).toEqual(['near', 'far'])
    expect(r.best?.branchId).toBe('near')
    expect(r.best?.distanceKm).toBeCloseTo(1, 1)
    expect(r.best?.inside).toBe(true) // restaurant default: visit_only 5 km
    expect(r.best?.mode).toBe('visit_only')
    expect(r.best?.travelMode).toBe('walk')
  })

  it('prefers a serving branch over a slightly nearer one outside its area', () => {
    const tiny = { mode: 'delivery' as const, shape: { type: 'circle' as const, radiusKm: 0.5 } }
    const [r] = computeNearby([biz('a', [branch('near', 1, { serviceArea: tiny }), branch('serves', 1.5)])], USER)
    expect(r.branches[0].branchId).toBe('near')
    expect(r.branches[0].inside).toBe(false)
    expect(r.best?.branchId).toBe('serves')
  })

  it('uses the delivery radius from checkout when there is no custom area', () => {
    const checkout = buildBranchCheckout({ delivery: true })
    checkout.delivery = { ...checkout.delivery, radius: 12 }
    const [r] = computeNearby([biz('a', [branch('d', 10, { checkout })])], USER)
    expect(r.best).toMatchObject({ mode: 'delivery', inside: true, radiusKm: 12 })
  })

  it('applies the vertical default (clinic: 15 km)', () => {
    const [r] = computeNearby([biz('c', [branch('c1', 12)], {}, ['clinic'])], USER)
    expect(r.best).toMatchObject({ inside: true, radiusKm: 15 })
  })

  it('skips branches without coordinates and flags unverified pins', () => {
    const [r] = computeNearby(
      [biz('a', [branch('nopin', 1, { latitude: undefined, longitude: undefined }), branch('unv', 2, { locationVerifiedAt: null })])],
      USER,
    )
    expect(r.branches.map((b) => b.branchId)).toEqual(['unv'])
    expect(r.best?.verified).toBe(false)
  })

  it('returns no proximity without a valid user point', () => {
    const [r] = computeNearby([biz('a', [branch('x', 1)])], null)
    expect(r.best).toBeNull()
  })

  it('item query: matches menu items and prefers the branch that has them', () => {
    const items = biz('a', [
      branch('noPizza', 0.5, { menuItemNames: ['Caesar Salad'] }),
      branch('pizza', 2, { menuItemNames: ['Margherita Classic', 'Pepperoni Pizza'], menuCategoryNames: ['Pizza'] }),
    ])
    const [r] = computeNearby([items], USER, { itemQuery: 'پیتزا' })
    expect(r.menuMatch).toBe(true)
    expect(r.best?.branchId).toBe('pizza')
    expect(r.best?.menuMatches).toEqual(['Pepperoni Pizza'])
  })

  it('falls back to a matching category name', () => {
    expect(menuMatchesFor(branch('x', 1, { menuItemNames: ['Margherita'], menuCategoryNames: ['Pizza'] }), ['pizza'])).toEqual(['Pizza'])
  })
})

describe('rankNearby', () => {
  it('serving first, then distance; unlocated last', () => {
    const tiny = { mode: 'delivery' as const, shape: { type: 'circle' as const, radiusKm: 0.3 } }
    const results = computeNearby(
      [
        biz('nopin', [branch('n', 0, { latitude: undefined, longitude: undefined })]),
        biz('outside', [branch('o', 0.8, { serviceArea: tiny })]),
        biz('far', [branch('f', 4)]),
        biz('close', [branch('c', 1)]),
      ],
      USER,
    )
    expect(rankNearby(results).map((r) => r.item.tenant.id)).toEqual(['close', 'far', 'outside', 'nopin'])
  })

  it('near-ties go to open-now, then rating', () => {
    const results = computeNearby(
      [
        biz('closed', [branch('a', 2, { openNow: false })], { rating: 5 }),
        biz('lowRated', [branch('b', 2.05)], { rating: 3 }),
        biz('highRated', [branch('c', 2.1)], { rating: 4.8 }),
      ],
      USER,
    )
    expect(rankNearby(results).map((r) => r.item.tenant.id)).toEqual(['highRated', 'lowRated', 'closed'])
  })
})

describe('search integration', () => {
  it('matchesMenuQuery finds a business by an item on its menu', () => {
    const branches = [branch('x', 1, { menuItemNames: ['Pepperoni Pizza'] })]
    expect(matchesMenuQuery(branches, 'پیتزا')).toBe(true)
    expect(matchesMenuQuery(branches, 'sushi')).toBe(false)
  })

  it('matchesSearch now folds Arabic/Persian variants', () => {
    expect(matchesSearch('کافه مهر', {}, [], 'كافه')).toBe(true)
  })
})

describe('discover data threading', () => {
  it('keeps coordinates, service area, pin verification and menu names', () => {
    const area = { mode: 'on_site' as const, shape: { type: 'circle' as const, radiusKm: 6 } }
    const out = mapDiscoverBranchToPublicBranchInfo({
      id: 'b', slug: 'b', name: 'B', openNow: true,
      location: { address: 'a', city: 'Tehran', latitude: 35.7, longitude: 51.4 },
      serviceArea: area,
      locationVerifiedAt: null,
      menuItemNames: ['Pizza'],
      menuCategoryNames: ['Mains'],
    })
    expect(out).toMatchObject({
      latitude: 35.7, longitude: 51.4, serviceArea: area, locationVerifiedAt: null,
      menuItemNames: ['Pizza'], menuCategoryNames: ['Mains'],
    })
  })
})

describe('discover URL state', () => {
  it('round-trips view=map, near=1 and sort=nearest', () => {
    const qs = serializeDiscoverQuery({ q: 'pizza', category: '', openNow: false, sort: 'nearest', view: 'map', near: true })
    expect(qs).toBe('q=pizza&sort=nearest&near=1&view=map')
    expect(parseDiscoverQuery(new URLSearchParams(qs))).toMatchObject({ sort: 'nearest', view: 'map', near: true })
  })
})

describe('area search bounds', () => {
  it('isInBounds checks a [south, west, north, east] box (and antimeridian boxes)', async () => {
    const { isInBounds } = await import('@/lib/geo')
    expect(isInBounds({ lat: 35.75, lng: 51.4 }, [35.7, 51.3, 35.8, 51.5])).toBe(true)
    expect(isInBounds({ lat: 40.75, lng: -73.98 }, [35.7, 51.3, 35.8, 51.5])).toBe(false)
    expect(isInBounds({ lat: 0, lng: 179.5 }, [-1, 179, 1, -179])).toBe(true)
  })

})

describe('branch-scoped results (a business has no location of its own)', () => {
  it('serves-me keeps only serving branches and re-picks the best among them', async () => {
    const { scopeResult } = await import('@/lib/nearby')
    const tiny = { mode: 'delivery' as const, shape: { type: 'circle' as const, radiusKm: 0.3 } }
    // nearest branch does NOT serve; a farther one does
    const [r] = computeNearby([biz('chain', [branch('near', 1, { serviceArea: tiny }), branch('serves', 3), branch('far', 40)])], USER)
    const scoped = scopeResult(r, (b) => b.inside)!
    expect(scoped.branches.map((b) => b.branchId)).toEqual(['serves'])
    expect(scoped.best?.branchId).toBe('serves')
    expect(scopeResult(r, () => false)).toBeNull()
  })

  it('a chain is listed from its branch in your city, not its head-office city', async () => {
    const { scopeResult } = await import('@/lib/nearby')
    const [r] = computeNearby([biz('chain', [branch('ny', 9000, { city: 'New York' }), branch('thr', 1, { city: 'Tehran' })])], USER)
    const scoped = scopeResult(r, (b) => b.distanceKm <= 20)!
    expect(scoped.best).toMatchObject({ branchId: 'thr', city: 'Tehran' })
  })

  it('search and city filters use branch cities', async () => {
    const { collectBranchCities, matchesFilters, DEFAULT_FILTERS } = await import('@/types/marketplace')
    const meta = { city: 'New York', branches: [branch('a', 1, { city: 'New York' }), branch('b', 2, { city: 'Tehran' })] }
    expect(collectBranchCities(meta.branches, meta.city).sort()).toEqual(['New York', 'Tehran'])
    expect(collectBranchCities([], 'Shiraz')).toEqual(['Shiraz'])
    expect(matchesSearch('Chain', meta, [], 'tehran')).toBe(true)
    expect(matchesFilters(meta, {}, { ...DEFAULT_FILTERS, cities: ['Tehran'] })).toBe(true)
  })
})
