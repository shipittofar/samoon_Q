import type { DiscoverItem } from '@/lib/discover-adapter'
import { collectBranchCuisines, collectBranchCities } from '@/types/marketplace'
import type { SuggestionGroup, SuggestionItem } from './SuggestionList'

const MAX_PER_GROUP = 4
const MAX_TOTAL = 8

function matches(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.toLowerCase())
}

/** Client-side typeahead from already-loaded Discover rows. Not a search index. */
export function buildDiscoverSuggestions(query: string, items: DiscoverItem[]): SuggestionGroup[] {
  const q = query.trim()
  if (q.length < 1) return []

  const businesses: SuggestionItem[] = []
  const cuisineSet = new Map<string, SuggestionItem>()
  const citySet = new Map<string, SuggestionItem>()

  for (const { tenant, meta, branches } of items) {
    if (businesses.length < MAX_PER_GROUP && matches(tenant.name, q)) {
      businesses.push({
        id: `biz-${tenant.id}`,
        kind: 'business',
        label: tenant.name,
        href: `/${tenant.slug}`,
        query: tenant.name,
      })
    }
    for (const cuisine of collectBranchCuisines(branches ?? meta.branches)) {
      if (!cuisineSet.has(cuisine) && matches(cuisine, q)) {
        cuisineSet.set(cuisine, {
          id: `cuisine-${cuisine}`,
          kind: 'cuisine',
          label: cuisine,
          query: cuisine,
        })
      }
    }
    for (const city of collectBranchCities(branches ?? meta.branches, meta.city)) {
      if (!citySet.has(city) && matches(city, q)) {
        citySet.set(city, {
          id: `city-${city}`,
          kind: 'city',
          label: city,
          query: city,
        })
      }
    }
  }

  const groups: SuggestionGroup[] = [
    { id: 'businesses', label: 'businesses', items: businesses },
    { id: 'cuisines', label: 'cuisines', items: Array.from(cuisineSet.values()).slice(0, 3) },
    { id: 'cities', label: 'cities', items: Array.from(citySet.values()).slice(0, 3) },
  ]

  let remaining = MAX_TOTAL
  return groups
    .map((group) => {
      const itemsSliced = group.items.slice(0, remaining)
      remaining -= itemsSliced.length
      return { ...group, items: itemsSliced }
    })
    .filter((group) => group.items.length > 0)
}
