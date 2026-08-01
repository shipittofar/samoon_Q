import type { MenuItem } from '@/types'

export interface FavoriteBranchRef {
  id: string
  name: string
  slug?: string
}

export interface FavoriteTenantRef {
  id: string
  name: string
  slug: string
}

/** Single favorite record nested in list/sync responses. */
export interface UserFavorite {
  id: string
  menu_item: MenuItem
  branch: FavoriteBranchRef
  tenant: FavoriteTenantRef
  favorited_at: string
}

export interface FavoritesSyncMeta {
  version?: string
  updated_at?: string
}

/** Authoritative GET /users/favorites/ and GET /users/favorites/sync/ response. */
export interface FavoritesListResponse {
  sync: FavoritesSyncMeta
  count: number
  results: UserFavorite[]
}

export interface AddFavoritePayload {
  menu_item_id: string
}
