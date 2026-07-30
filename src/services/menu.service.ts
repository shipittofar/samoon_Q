import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { MOCK_BRANCH_CATEGORIES, MOCK_BRANCH_ITEMS, MOCK_BRANCH_EXTRA_GROUPS, MOCK_BRANCH_EXTRAS } from '@/lib/mock-data'
import {
  normalizeExtra,
  normalizeExtras,
  normalizeMenuItem,
  normalizeMenuItems,
  normalizePaginatedMenuItems,
  type ExtraWire,
  type MenuItemWire,
} from '@/lib/menu-normalizers'
import { buildDrfPaginationParams, paginateList } from '@/utils/pagination'
import type { Category, DrfPaginationParams, Extra, ExtraGroup, MenuItem, PaginatedResponse } from '@/types'
import { buildMenuItemFormData, type MenuItemWriteRequest } from '@/types/menu-item'
import {
  buildCategoryFormData,
  type CategoryWriteRequest,
} from '@/types/category'
import {
  buildExtraFormData,
  type ExtraWriteRequest,
} from '@/types/extra'
import { mockImageUrlFromFile, multipartRequestConfig } from '@/lib/multipart'
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

/**
 * Query params for `getConsoleItems`.
 * Pagination defaults are applied in the service via `buildDrfPaginationParams`.
 *
 * Server-side search/category/status are not documented on
 * `GET /menu/console-menu/items/{branchId}/` — see `console-menu-client-filters.ts`.
 */
export type ConsoleMenuItemsParams = DrfPaginationParams

const DEFAULT_MOCK_BRANCH_ID = 'branch-rest-01'

/** Maps storefront MenuFilters to query params for GET /menu/items/branches/{branchId}/. */
function buildMenuItemQueryParams(filters?: MenuFilters): Record<string, string | number | boolean> {
  if (!filters) return {}

  const params: Record<string, string | number | boolean> = {}
  if (filters.category) params.category = filters.category
  if (filters.search) params.search = filters.search
  if (filters.min_price != null) params.min_price = filters.min_price
  if (filters.max_price != null) params.max_price = filters.max_price
  if (filters.min_rating != null) params.min_rating = filters.min_rating
  if (filters.available !== undefined) params.available = filters.available
  if (filters.sort) params.sort = filters.sort
  if (filters.page != null) params.page = filters.page
  if (filters.page_size != null) params.page_size = filters.page_size
  return params
}

function mockImageFromRequest(payload: { image?: File; removeImage?: boolean }, fallback = ''): string {
  if (payload.removeImage) return ''
  return mockImageUrlFromFile(payload.image, fallback)
}

function menuItemFromWriteRequest(
  branchId: string,
  payload: MenuItemWriteRequest,
  overrides: Partial<MenuItem> = {},
): MenuItem {
  const { image: _image, removeImage: _removeImage, ...fields } = payload
  return {
    id: overrides.id ?? `item-${Date.now()}`,
    branch_id: branchId,
    name: fields.name ?? 'New Item',
    slug: overrides.slug ?? `new-item-${Date.now()}`,
    description: fields.description ?? '',
    price: fields.price ?? 0,
    image: mockImageFromRequest(payload, overrides.image ?? ''),
    category_id: fields.category_id ?? '',
    available: fields.available ?? true,
    is_active: fields.is_active ?? true,
    rating: overrides.rating ?? 0,
    rating_count: overrides.rating_count ?? 0,
    preparation_time: fields.preparation_time ?? 15,
    is_featured: fields.is_featured ?? false,
    is_popular: fields.is_popular ?? false,
    tags: overrides.tags ?? [],
    extras: overrides.extras ?? [],
    discount: fields.discount,
    calories: fields.calories,
  }
}

/** Every menu-domain request is branch-scoped — there is no global/shared menu. */
function mockCategories(branchId: string): Category[] {
  return MOCK_BRANCH_CATEGORIES[branchId] ?? MOCK_BRANCH_CATEGORIES[DEFAULT_MOCK_BRANCH_ID]
}

function mockItems(branchId: string): MenuItem[] {
  return MOCK_BRANCH_ITEMS[branchId] ?? MOCK_BRANCH_ITEMS[DEFAULT_MOCK_BRANCH_ID]
}

function mockExtraGroups(branchId: string): ExtraGroup[] {
  return MOCK_BRANCH_EXTRA_GROUPS[branchId] ?? MOCK_BRANCH_EXTRA_GROUPS[DEFAULT_MOCK_BRANCH_ID]
}

function mockExtras(branchId: string): Extra[] {
  return MOCK_BRANCH_EXTRAS[branchId] ?? MOCK_BRANCH_EXTRAS[DEFAULT_MOCK_BRANCH_ID]
}

export const menuService = {
  async getCategories(branchId: string): Promise<Category[]> {
    if (USE_MOCK) {
      await delay(400)
      return mockCategories(branchId)
    }
    const { data } = await api.get<PaginatedResponse<Category>>(ENDPOINTS.MENU.CATEGORY(branchId))
    return data.results
  },

  async getConsoleCategories(branchId: string): Promise<Category[]> {
    if (USE_MOCK) {
      await delay(400)
      return mockCategories(branchId)
    }
    const { data } = await api.get<PaginatedResponse<Category>>(ENDPOINTS.MENU.CONSOLE_CATEGORY(branchId))
    return data.results
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

    const { data } = await api.get<PaginatedResponse<MenuItemWire>>(
      ENDPOINTS.MENU.PUBLIC_ITEMS(branchId),
      { params: buildMenuItemQueryParams(filters) },
    )
    return normalizePaginatedMenuItems(data)
  },

  async getConsoleItems(
    branchId: string,
    params?: ConsoleMenuItemsParams,
  ): Promise<PaginatedResponse<MenuItem>> {
    const paginationParams = buildDrfPaginationParams(params)

    if (USE_MOCK) {
      await delay(400)
      return paginateList(
        mockItems(branchId),
        paginationParams.page,
        paginationParams.page_size,
      )
    }

    const { data } = await api.get<PaginatedResponse<MenuItemWire>>(ENDPOINTS.MENU.CONSOLE_ITEMS(branchId), {
      params: paginationParams,
    })
    return normalizePaginatedMenuItems(data)
  },
  async getItem(branchId: string, id: string): Promise<MenuItem> {
    if (USE_MOCK) {
      await delay(400)
      const item = mockItems(branchId).find((i) => i.id === id || i.slug === id)
      if (!item) throw new Error('Item not found')
      return item
    }
    const { data } = await api.get<MenuItemWire>(ENDPOINTS.MENU.ITEM(id), {
      params: { branch_id: branchId },
    })
    return normalizeMenuItem(data)
  },

  async getConsoleItem(branchId: string): Promise<MenuItem[]> {
    if (USE_MOCK) {
      await delay(400)
      const item = mockItems(branchId).find((i) => i.id === branchId || i.slug === branchId)
      if (!item) throw new Error('Item not found')
      return [item]
    }
    const { data } = await api.get<PaginatedResponse<MenuItemWire>>(ENDPOINTS.MENU.CONSOLE_ITEM(branchId))
    return normalizeMenuItems(data.results)
  },

  async getFeatured(branchId: string): Promise<MenuItem[]> {
    if (USE_MOCK) {
      await delay(400)
      return mockItems(branchId).filter((i) => i.is_featured)
    }
    const { data } = await api.get<MenuItemWire[]>(ENDPOINTS.MENU.FEATURED, {
      params: { branch_id: branchId },
    })
    return normalizeMenuItems(data)
  },

  async getPopular(branchId: string): Promise<MenuItem[]> {
    if (USE_MOCK) {
      await delay(400)
      return mockItems(branchId).filter((i) => i.is_popular)
    }
    const { data } = await api.get<MenuItemWire[]>(ENDPOINTS.MENU.POPULAR, {
      params: { branch_id: branchId },
    })
    return normalizeMenuItems(data)
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
    const { data } = await api.get<MenuItemWire[]>(ENDPOINTS.MENU.RELATED(id), {
      params: { branch_id: branchId },
    })
    return normalizeMenuItems(data)
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
    const { data } = await api.get<MenuItemWire[]>(ENDPOINTS.MENU.SEARCH, {
      params: { branch_id: branchId, q: query },
    })
    return normalizeMenuItems(data)
  },

  // ── Admin CRUD (P5.1) ──────────────────────────────────────────────────────

  async createItem(branchId: string, payload: MenuItemWriteRequest): Promise<MenuItem> {
    if (USE_MOCK) {
      await delay(800)
      return menuItemFromWriteRequest(branchId, payload)
    }
    const formData = buildMenuItemFormData(payload, { branchId })
    const { data } = await api.post<MenuItemWire>(ENDPOINTS.MENU.ITEMS, formData, multipartRequestConfig())
    return normalizeMenuItem(data)
  },

  async consoleCreateItem(branchId: string, payload: MenuItemWriteRequest): Promise<MenuItem> {
    if (USE_MOCK) {
      await delay(800)
      return menuItemFromWriteRequest(branchId, payload)
    }
    const formData = buildMenuItemFormData(payload, { branchId })
    const { data } = await api.post<MenuItemWire>(
      ENDPOINTS.MENU.CONSOLE_CREATE_ITEMS,
      formData,
      multipartRequestConfig(),
    )
    return normalizeMenuItem(data)
  },

  async updateItem(branchId: string, id: string, payload: MenuItemWriteRequest): Promise<MenuItem> {
    if (USE_MOCK) {
      await delay(600)
      const existing = mockItems(branchId).find((i) => i.id === id)
      const { image: _image, removeImage: _removeImage, ...fields } = payload
      const image = mockImageFromRequest(payload, existing?.image ?? '')
      return {
        ...(existing as MenuItem),
        ...fields,
        image,
        id,
        branch_id: branchId,
      }
    }
    const formData = buildMenuItemFormData(payload)
    const { data } = await api.patch<MenuItemWire>(ENDPOINTS.MENU.ITEM(id), formData, {
      params: { branch_id: branchId },
      ...multipartRequestConfig(),
    })
    return normalizeMenuItem(data)
  },

  async deleteItem(branchId: string, id: string): Promise<void> {
    if (USE_MOCK) {
      await delay(400)
      return
    }
    await api.delete(ENDPOINTS.MENU.ITEM(id), { params: { branch_id: branchId } })
  },

  // ── Category Admin CRUD ────────────────────────────────────────────────────
  // Same conventions as the MenuItem admin CRUD above: branch-scoped, and in
  // mock mode returns a plausible response object without mutating the
  // underlying MOCK_BRANCH_CATEGORIES array (the caller's optimistic cache
  // update is what makes the change visible — identical to createItem/
  // updateItem/deleteItem's existing mock behavior).

  async createCategory(branchId: string, payload: CategoryWriteRequest): Promise<Category> {
    if (USE_MOCK) {
      await delay(600)
      const existing = mockCategories(branchId)
      const { image: _image, removeImage: _removeImage, ...fields } = payload
      const newCategory: Category = {
        id: `cat-${Date.now()}`,
        branch_id: branchId,
        name: fields.name ?? 'New Category',
        slug: `new-category-${Date.now()}`,
        description: fields.description,
        image: mockImageFromRequest(payload),
        icon: undefined,
        sort_order: fields.sort_order ?? existing.length + 1,
        is_active: fields.is_active ?? true,
        created_at: new Date().toISOString(),
      }
      return newCategory
    }
    const formData = buildCategoryFormData(payload, { branchId })
    const { data } = await api.post<Category>(ENDPOINTS.MENU.CATEGORIES, formData, multipartRequestConfig())
    return data
  },

  async updateCategory(branchId: string, id: string, payload: CategoryWriteRequest): Promise<Category> {
    if (USE_MOCK) {
      await delay(500)
      const existing = mockCategories(branchId).find((c) => c.id === id)
      const { image: _image, removeImage: _removeImage, ...fields } = payload
      return {
        ...(existing as Category),
        ...fields,
        image: mockImageFromRequest(payload, existing?.image),
        id,
        branch_id: branchId,
      }
    }
    const formData = buildCategoryFormData(payload)
    const { data } = await api.patch<Category>(ENDPOINTS.MENU.CONSOLE_CATEGORY(branchId), formData, {
      params: { branch_id: branchId },
      ...multipartRequestConfig(),
    })
    return data
  },

  async deleteCategory(branchId: string, id: string): Promise<void> {
    if (USE_MOCK) {
      await delay(400)
      return
    }
    await api.delete(ENDPOINTS.MENU.CATEGORY(id), { params: { branch_id: branchId } })
  },

  /** Persists a new sort order for a branch's categories (drag/up-down reorder in the Console). */
  async reorderCategories(branchId: string, orderedIds: string[]): Promise<Category[]> {
    if (USE_MOCK) {
      await delay(500)
      const byId = new Map(mockCategories(branchId).map((c) => [c.id, c]))
      return orderedIds
        .map((id, index) => {
          const cat = byId.get(id)
          return cat ? { ...cat, sort_order: index + 1 } : undefined
        })
        .filter((c): c is Category => !!c)
    }
    const { data } = await api.patch<Category[]>(ENDPOINTS.MENU.CATEGORIES, { category_ids: orderedIds }, {
      params: { branch_id: branchId },
    })
    return data
  },

  // ── Extra Group Admin CRUD ─────────────────────────────────────────────────
  // Same conventions as Category/MenuItem admin CRUD: branch-scoped, mock mode
  // returns a plausible response object without mutating the underlying
  // MOCK_BRANCH_EXTRA_GROUPS array.

  async getExtraGroups(branchId: string): Promise<ExtraGroup[]> {
    if (USE_MOCK) {
      await delay(400)
      return mockExtraGroups(branchId)
    }
    const { data } = await api.get<ExtraGroup[]>(ENDPOINTS.MENU.EXTRA_GROUPS, {
      params: { branch_id: branchId },
    })
    return data
  },

  async getConsoleExtraGroups(branchId: string): Promise<ExtraGroup[]> {
    if (USE_MOCK) {
      await delay(400)
      return mockExtraGroups(branchId)
    }
    const { data } = await api.get<PaginatedResponse<ExtraGroup>>(ENDPOINTS.MENU.CONSOLE_EXTRA_GROUPS(branchId))
    return data.results
  },

  async createExtraGroup(branchId: string, payload: Partial<ExtraGroup>): Promise<ExtraGroup> {
    const scopedPayload = { ...payload, branch_id: branchId }
    if (USE_MOCK) {
      await delay(600)
      const existing = mockExtraGroups(branchId)
      const newGroup: ExtraGroup = {
        id: `grp-${Date.now()}`,
        branch_id: branchId,
        name: payload.name ?? 'New Group',
        description: payload.description,
        selection_type: payload.selection_type ?? 'multiple',
        required: payload.required ?? false,
        min_selection: payload.min_selection ?? 0,
        max_selection: payload.max_selection ?? 1,
        order: payload.order ?? existing.length + 1,
        is_active: payload.is_active ?? true,
        created_at: new Date().toISOString(),
        ...payload,
      }
      return newGroup
    }
    const { data } = await api.post<ExtraGroup>(ENDPOINTS.MENU.EXTRA_GROUPS, scopedPayload)
    return data
  },

  async updateExtraGroup(branchId: string, id: string, payload: Partial<ExtraGroup>): Promise<ExtraGroup> {
    if (USE_MOCK) {
      await delay(500)
      const existing = mockExtraGroups(branchId).find((g) => g.id === id)
      return { ...(existing as ExtraGroup), ...payload, id, branch_id: branchId }
    }
    const { data } = await api.patch<ExtraGroup>(ENDPOINTS.MENU.EXTRA_GROUP(id), payload, {
      params: { branch_id: branchId },
    })
    return data
  },

  async deleteExtraGroup(branchId: string, id: string): Promise<void> {
    if (USE_MOCK) {
      await delay(400)
      return
    }
    await api.delete(ENDPOINTS.MENU.EXTRA_GROUP(id), { params: { branch_id: branchId } })
  },

  /** Persists a new sort order for a branch's Extra Groups. */
  async reorderExtraGroups(branchId: string, orderedIds: string[]): Promise<ExtraGroup[]> {
    if (USE_MOCK) {
      await delay(500)
      const byId = new Map(mockExtraGroups(branchId).map((g) => [g.id, g]))
      return orderedIds
        .map((id, index) => {
          const grp = byId.get(id)
          return grp ? { ...grp, order: index + 1 } : undefined
        })
        .filter((g): g is ExtraGroup => !!g)
    }
    const { data } = await api.patch<ExtraGroup[]>(ENDPOINTS.MENU.EXTRA_GROUPS, { order: orderedIds }, {
      params: { branch_id: branchId },
    })
    return data
  },

  // ── Extra Admin CRUD ───────────────────────────────────────────────────────

  async getExtras(branchId: string, groupId?: string): Promise<Extra[]> {
    if (USE_MOCK) {
      await delay(400)
      const all = mockExtras(branchId)
      return groupId ? all.filter((e) => e.group_id === groupId) : all
    }
    const { data } = await api.get<Extra[]>(ENDPOINTS.MENU.EXTRAS, {
      params: { branch_id: branchId, group_id: groupId },
    })
    return data
  },

  async createExtra(branchId: string, payload: ExtraWriteRequest & { group_id: string }): Promise<Extra> {
    if (USE_MOCK) {
      await delay(600)
      const existing = mockExtras(branchId).filter((e) => e.group_id === payload.group_id)
      const { image: _image, removeImage: _removeImage, group_id, ...fields } = payload
      const newExtra: Extra = {
        id: `ext-${Date.now()}`,
        branch_id: branchId,
        group_id,
        name: fields.name ?? 'New Extra',
        description: fields.description,
        image: mockImageFromRequest(payload),
        price: fields.price ?? 0,
        available: fields.available ?? true,
        order: fields.order ?? existing.length + 1,
        created_at: new Date().toISOString(),
      }
      return newExtra
    }
    const formData = buildExtraFormData(payload, { branchId })
    const { data } = await api.post<Extra>(ENDPOINTS.MENU.EXTRAS, formData, multipartRequestConfig())
    return data
  },

  async updateExtra(branchId: string, id: string, payload: ExtraWriteRequest): Promise<Extra> {
    if (USE_MOCK) {
      await delay(500)
      const existing = mockExtras(branchId).find((e) => e.id === id)
      const { image: _image, removeImage: _removeImage, ...fields } = payload
      return {
        ...(existing as Extra),
        ...fields,
        image: mockImageFromRequest(payload, existing?.image),
        id,
        branch_id: branchId,
      }
    }
    const formData = buildExtraFormData(payload)
    const { data } = await api.patch<Extra>(ENDPOINTS.MENU.EXTRA(id), formData, {
      params: { branch_id: branchId },
      ...multipartRequestConfig(),
    })
    return data
  },

  async deleteExtra(branchId: string, id: string): Promise<void> {
    if (USE_MOCK) {
      await delay(400)
      return
    }
    await api.delete(ENDPOINTS.MENU.EXTRA(id), { params: { branch_id: branchId } })
  },

  // ── Menu Item ↔ Extra Group assignment ────────────────────────────────────

  /**
   * Attaches/detaches Extra Groups on a menu item and re-materializes the
   * item's flat `extras` field from the active extras across all currently
   * assigned groups — the exact shape FoodDetailModal/CartDrawer/checkout/
   * useCartStore already consume, so none of those need to change.
   */
  async assignExtraGroupsToItem(branchId: string, itemId: string, groupIds: string[]): Promise<MenuItem> {
    if (USE_MOCK) {
      await delay(500)
      const item = mockItems(branchId).find((i) => i.id === itemId)
      const allExtras = mockExtras(branchId)
      const materializedExtras = allExtras.filter((e) => groupIds.includes(e.group_id ?? '') && e.available)
      return {
        ...(item as MenuItem),
        id: itemId,
        branch_id: branchId,
        extra_group_ids: groupIds,
        extras: materializedExtras,
      }
    }
    const { data } = await api.patch<MenuItem>(ENDPOINTS.MENU.ITEM(itemId), { extra_group_ids: groupIds }, {
      params: { branch_id: branchId },
    })
    return data
  },
}
