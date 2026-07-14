import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { MOCK_BRANCH_CATEGORIES, MOCK_BRANCH_ITEMS } from '@/lib/mock-data'
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

/** Every menu-domain request is branch-scoped — there is no global/shared menu. */
function mockCategories(branchId: string): Category[] {
  return MOCK_BRANCH_CATEGORIES[branchId] ?? MOCK_BRANCH_CATEGORIES.main
}

function mockItems(branchId: string): MenuItem[] {
  return MOCK_BRANCH_ITEMS[branchId] ?? MOCK_BRANCH_ITEMS.main
}

export const menuService = {
  async getCategories(branchId: string): Promise<Category[]> {
    if (USE_MOCK) {
      await delay(400)
      return mockCategories(branchId)
    }
    const { data } = await api.get<Category[]>(ENDPOINTS.MENU.CATEGORIES, {
      params: { branch_id: branchId },
    })
    return data
  },

  async getItems(branchId: string, filters?: MenuFilters): Promise<PaginatedResponse<MenuItem>> {
    if (USE_MOCK) {
      await delay(600)
      let items = [...mockItems(branchId)]

      if (filters?.category) {
        const cat = mockCategories(branchId).find(
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
      params: { branch_id: branchId, ...filters },
    })
    return data
  },

  async getItem(branchId: string, id: string): Promise<MenuItem> {
    if (USE_MOCK) {
      await delay(400)
      const item = mockItems(branchId).find((i) => i.id === id || i.slug === id)
      if (!item) throw new Error('Item not found')
      return item
    }
    const { data } = await api.get<MenuItem>(ENDPOINTS.MENU.ITEM(id), {
      params: { branch_id: branchId },
    })
    return data
  },

  async getFeatured(branchId: string): Promise<MenuItem[]> {
    if (USE_MOCK) {
      await delay(400)
      return mockItems(branchId).filter((i) => i.is_featured)
    }
    const { data } = await api.get<MenuItem[]>(ENDPOINTS.MENU.FEATURED, {
      params: { branch_id: branchId },
    })
    return data
  },

  async getPopular(branchId: string): Promise<MenuItem[]> {
    if (USE_MOCK) {
      await delay(400)
      return mockItems(branchId).filter((i) => i.is_popular)
    }
    const { data } = await api.get<MenuItem[]>(ENDPOINTS.MENU.POPULAR, {
      params: { branch_id: branchId },
    })
    return data
  },

  async getRelated(branchId: string, id: string): Promise<MenuItem[]> {
    if (USE_MOCK) {
      await delay(400)
      const items = mockItems(branchId)
      const item = items.find((i) => i.id === id)
      if (!item) return []
      return items.filter(
        (i) => i.category_id === item.category_id && i.id !== id,
      ).slice(0, 4)
    }
    const { data } = await api.get<MenuItem[]>(ENDPOINTS.MENU.RELATED(id), {
      params: { branch_id: branchId },
    })
    return data
  },

  async search(branchId: string, query: string): Promise<MenuItem[]> {
    if (USE_MOCK) {
      await delay(300)
      const q = query.toLowerCase()
      return mockItems(branchId).filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.tags?.some((t) => t.toLowerCase().includes(q)),
      )
    }
    const { data } = await api.get<MenuItem[]>(ENDPOINTS.MENU.SEARCH, {
      params: { branch_id: branchId, q: query },
    })
    return data
  },

  // ── Admin CRUD (P5.1) ──────────────────────────────────────────────────────

  async createItem(branchId: string, payload: Partial<MenuItem>): Promise<MenuItem> {
    const scopedPayload = { ...payload, branch_id: branchId }
    if (USE_MOCK) {
      await delay(800)
      const newItem: MenuItem = {
        id: `item-${Date.now()}`,
        branch_id: branchId,
        name: payload.name ?? 'New Item',
        slug: payload.slug ?? `new-item-${Date.now()}`,
        description: payload.description ?? '',
        price: payload.price ?? 0,
        image: payload.image ?? '',
        category_id: payload.category_id ?? '',
        available: payload.available ?? true,
        rating: 0,
        rating_count: 0,
        preparation_time: payload.preparation_time ?? 15,
        is_featured: payload.is_featured ?? false,
        is_popular: payload.is_popular ?? false,
        tags: payload.tags ?? [],
        extras: payload.extras ?? [],
        ...payload,
      }
      return newItem
    }
    const { data } = await api.post<MenuItem>(ENDPOINTS.MENU.ITEMS, scopedPayload)
    return data
  },

  async updateItem(branchId: string, id: string, payload: Partial<MenuItem>): Promise<MenuItem> {
    if (USE_MOCK) {
      await delay(600)
      const existing = mockItems(branchId).find((i) => i.id === id)
      return { ...(existing as MenuItem), ...payload, id, branch_id: branchId }
    }
    const { data } = await api.patch<MenuItem>(ENDPOINTS.MENU.ITEM(id), payload, {
      params: { branch_id: branchId },
    })
    return data
  },

  async deleteItem(branchId: string, id: string): Promise<void> {
    if (USE_MOCK) {
      await delay(400)
      return
    }
    await api.delete(ENDPOINTS.MENU.ITEM(id), { params: { branch_id: branchId } })
  },
}
