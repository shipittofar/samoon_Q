import api from './axios.instance'
import { ENDPOINTS } from './endpoints'
import { DEFAULT_TENANT } from '@/constants'
import { MOCK_BRANCH_ITEMS, MOCK_MENU_ITEMS } from '@/lib/mock-data'
import type {
  AddFavoritePayload,
  FavoritesListResponse,
  UserFavorite,
} from '@/types/favorites'
import type { MenuItem } from '@/types'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
const delay = (ms = 800) => new Promise<void>((r) => setTimeout(r, ms))

const MOCK_DEFAULT_IDS = ['1', '8', '12']
let mockFavoriteIds = new Set<string>(MOCK_DEFAULT_IDS)
let mockSyncVersion = 1

function findMockMenuItem(menuItemId: string): MenuItem | undefined {
  return (
    MOCK_MENU_ITEMS.find((item) => item.id === menuItemId) ??
    Object.values(MOCK_BRANCH_ITEMS)
      .flat()
      .find((item) => item.id === menuItemId)
  )
}

function buildMockFavorite(menuItemId: string): UserFavorite | null {
  const item = findMockMenuItem(menuItemId)
  if (!item) return null

  return {
    id: `fav-${menuItemId}`,
    menu_item: item,
    branch: { id: item.branch_id, name: 'Main Branch', slug: 'main' },
    tenant: { id: DEFAULT_TENANT.id, name: DEFAULT_TENANT.name, slug: DEFAULT_TENANT.slug },
    favorited_at: new Date().toISOString(),
  }
}

function buildMockFavoritesResponse(): FavoritesListResponse {
  const results = [...mockFavoriteIds]
    .map((id) => buildMockFavorite(id))
    .filter((f): f is UserFavorite => f !== null)

  return {
    sync: {
      version: String(mockSyncVersion),
      updated_at: new Date().toISOString(),
    },
    count: results.length,
    results,
  }
}

function bumpMockSync() {
  mockSyncVersion += 1
}

function isUserFavorite(value: unknown): value is UserFavorite {
  if (!value || typeof value !== 'object') return false
  const favorite = value as UserFavorite
  return (
    typeof favorite.id === 'string' &&
    !!favorite.menu_item &&
    typeof favorite.menu_item.id === 'string'
  )
}

function extractFavoriteResults(payload: Record<string, unknown>): UserFavorite[] {
  for (const key of ['results', 'favorites', 'items']) {
    const value = payload[key]
    if (Array.isArray(value)) {
      return value.filter(isUserFavorite)
    }
  }
  return []
}

/** Parse any favorites API payload into the canonical list envelope. */
export function parseFavoritesPayload(data: unknown): FavoritesListResponse {
  if (!data || typeof data !== 'object') {
    return { sync: {}, count: 0, results: [] }
  }

  const payload = data as Record<string, unknown>
  const results = extractFavoriteResults(payload)
  const sync =
    payload.sync && typeof payload.sync === 'object'
      ? (payload.sync as FavoritesListResponse['sync'])
      : {}
  const count = typeof payload.count === 'number' ? payload.count : results.length

  return { sync, count, results }
}

function hasRenderableResults(response: FavoritesListResponse): boolean {
  return response.results.length > 0
}

function mergeSyncWithList(
  syncResponse: FavoritesListResponse,
  listResponse: FavoritesListResponse,
): FavoritesListResponse {
  return {
    results: listResponse.results,
    count: listResponse.count,
    sync: syncResponse.sync?.version ? syncResponse.sync : listResponse.sync,
  }
}

export const favoritesService = {
  async getFavorites(): Promise<FavoritesListResponse> {
    if (USE_MOCK) {
      await delay(300)
      return buildMockFavoritesResponse()
    }
    const { data } = await api.get<unknown>(ENDPOINTS.USERS.FAVORITES)
    return parseFavoritesPayload(data)
  },

  async syncFavorites(): Promise<FavoritesListResponse> {
    if (USE_MOCK) {
      await delay(200)
      return buildMockFavoritesResponse()
    }
    const { data } = await api.get<unknown>(ENDPOINTS.USERS.FAVORITES_SYNC)
    return parseFavoritesPayload(data)
  },

  /**
   * Authoritative refresh for UI sync.
   * Sync may return metadata-only (count/sync without results) — fall back to list fetch.
   */
  async refreshFavorites(): Promise<FavoritesListResponse> {
    if (USE_MOCK) {
      await delay(200)
      return buildMockFavoritesResponse()
    }

    const syncResponse = await this.syncFavorites()
    if (hasRenderableResults(syncResponse)) {
      return syncResponse
    }

    const listResponse = await this.getFavorites()
    return mergeSyncWithList(syncResponse, listResponse)
  },

  async addFavorite(payload: AddFavoritePayload): Promise<UserFavorite> {
    if (USE_MOCK) {
      await delay(300)
      mockFavoriteIds.add(payload.menu_item_id)
      bumpMockSync()
      const favorite = buildMockFavorite(payload.menu_item_id)
      if (!favorite) throw new Error('Menu item not found')
      return favorite
    }
    const { data } = await api.post<UserFavorite>(ENDPOINTS.USERS.FAVORITES, payload)
    return data
  },

  async removeFavorite(menuItemId: string): Promise<void> {
    if (USE_MOCK) {
      await delay(300)
      mockFavoriteIds.delete(menuItemId)
      bumpMockSync()
      return
    }
    await api.delete(ENDPOINTS.USERS.FAVORITE(menuItemId))
  },

  _resetMockStore() {
    mockFavoriteIds = new Set(MOCK_DEFAULT_IDS)
    mockSyncVersion = 1
  },
}
