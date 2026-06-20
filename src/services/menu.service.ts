import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { MOCK_CATEGORIES, MOCK_MENU_ITEMS } from '@/lib/mock-data'
import type { Category, MenuItem, PaginatedResponse } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 600) => new Promise((r) => setTimeout(r, ms))

export interface MenuFilters {
  category?: string
  search?: string
  min_price?: number
  max_price?: number
  min_rating?: number
  available?: boolean
  sort?: 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'popular'
  page?: number
  page_size?: number
}

export const menuService = {
  async getCategories(): Promise<Category[]> {
    if (USE_MOCK) {
      await delay(400)
      return MOCK_CATEGORIES
    }
    const { data } = await api.get<Category[]>(ENDPOINTS.MENU.CATEGORIES)
    return data
  },

  async getItems(filters?: MenuFilters): Promise<PaginatedResponse<MenuItem>> {
    if (USE_MOCK) {
      await delay(600)
      let items = [...MOCK_MENU_ITEMS]

      if (filters?.category) {
        const cat = MOCK_CATEGORIES.find(
          (c) => c.slug === filters.category || c.id === filters.category,
        )
        if (cat) items = items.filter((i) => i.category_id === cat.id)
      }

      if (filters?.search) {
        const q = filters.search.toLowerCase()
        items = items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q),
        )
      }

      if (filters?.min_price) items = items.filter((i) => i.price >= filters.min_price!)
      if (filters?.max_price) items = items.filter((i) => i.price <= filters.max_price!)
      if (filters?.min_rating) items = items.filter((i) => i.rating >= filters.min_rating!)
      if (filters?.available !== undefined) items = items.filter((i) => i.available === filters.available)

      if (filters?.sort) {
        switch (filters.sort) {
          case 'price_asc': items.sort((a, b) => a.price - b.price); break
          case 'price_desc': items.sort((a, b) => b.price - a.price); break
          case 'rating': items.sort((a, b) => b.rating - a.rating); break
          case 'popular': items.sort((a, b) => b.rating_count - a.rating_count); break
        }
      }

      return { count: items.length, next: null, previous: null, results: items }
    }

    const { data } = await api.get<PaginatedResponse<MenuItem>>(ENDPOINTS.MENU.ITEMS, {
      params: filters,
    })
    return data
  },

  async getItem(id: string): Promise<MenuItem> {
    if (USE_MOCK) {
      await delay(400)
      const item = MOCK_MENU_ITEMS.find((i) => i.id === id || i.slug === id)
      if (!item) throw new Error('Item not found')
      return item
    }
    const { data } = await api.get<MenuItem>(ENDPOINTS.MENU.ITEM(id))
    return data
  },

  async getFeatured(): Promise<MenuItem[]> {
    if (USE_MOCK) {
      await delay(400)
      return MOCK_MENU_ITEMS.filter((i) => i.is_featured)
    }
    const { data } = await api.get<MenuItem[]>(ENDPOINTS.MENU.FEATURED)
    return data
  },

  async getPopular(): Promise<MenuItem[]> {
    if (USE_MOCK) {
      await delay(400)
      return MOCK_MENU_ITEMS.filter((i) => i.is_popular)
    }
    const { data } = await api.get<MenuItem[]>(ENDPOINTS.MENU.POPULAR)
    return data
  },

  async getRelated(id: string): Promise<MenuItem[]> {
    if (USE_MOCK) {
      await delay(400)
      const item = MOCK_MENU_ITEMS.find((i) => i.id === id)
      if (!item) return []
      return MOCK_MENU_ITEMS.filter(
        (i) => i.category_id === item.category_id && i.id !== id,
      ).slice(0, 4)
    }
    const { data } = await api.get<MenuItem[]>(ENDPOINTS.MENU.RELATED(id))
    return data
  },

  async search(query: string): Promise<MenuItem[]> {
    if (USE_MOCK) {
      await delay(300)
      const q = query.toLowerCase()
      return MOCK_MENU_ITEMS.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.tags?.some((t) => t.toLowerCase().includes(q)),
      )
    }
    const { data } = await api.get<MenuItem[]>(ENDPOINTS.MENU.SEARCH, { params: { q: query } })
    return data
  },
}
