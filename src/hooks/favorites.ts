'use client'

import { useCallback } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { favoritesService } from '@/services/favorites.service'
import { useAuthStore, useTenantStore } from '@/stores'
import { STALE_TIME } from '@/constants'
import { resolveTenantSlugForApi } from '@/lib/tenant-request-context'
import type {
  FavoritesListResponse,
  FavoritesSyncMeta,
  UserFavorite,
} from '@/types/favorites'

export const favoritesKeys = {
  all: ['favorites'] as const,
  /** Domain identity: tenant.id when known. Header-scoped list must not reuse another tenant's cache. */
  list: (tenantId?: string | null) => [...favoritesKeys.all, 'list', tenantId ?? 'none'] as const,
  sync: (tenantId?: string | null) => [...favoritesKeys.all, 'sync', tenantId ?? 'none'] as const,
}

const EMPTY_FAVORITE_ITEMS: UserFavorite[] = []

export interface UseFavoritesListResult {
  favoriteItems: UserFavorite[]
  count: number
  sync: FavoritesSyncMeta | undefined
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  error: Error | null
  refetch: () => void
}

function useFavoritesTenantScope(): string {
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const headerSlug = resolveTenantSlugForApi()
  return tenantId || headerSlug || 'none'
}

function useFavoritesEnabled() {
  return useAuthStore((s) => s.isAuthenticated)
}

function favoritesListQueryOptions(enabled: boolean, tenantScope: string) {
  return {
    queryKey: favoritesKeys.list(tenantScope),
    queryFn: () => favoritesService.getFavorites(),
    enabled,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false as const,
    refetchOnReconnect: false as const,
  }
}

function invalidateFavoritesList(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: favoritesKeys.all })
}

function applyFavoritesListCache(
  qc: QueryClient,
  response: FavoritesListResponse,
  tenantScope?: string | null,
) {
  const scope =
    tenantScope ??
    useTenantStore.getState().tenant?.id ??
    resolveTenantSlugForApi() ??
    'none'
  qc.setQueryData<FavoritesListResponse>(favoritesKeys.list(scope), response)
}

function getFavoriteErrorMessage(err: unknown): string {
  const status = (err as { response?: { status?: number } } | undefined)?.response?.status
  if (status === 401) return 'Please sign in to manage favorites.'
  if (status === 404) return 'This item is no longer available.'
  if (status === 409) return 'This item is already in your favorites.'
  return 'Could not update favorites. Please try again.'
}

/** Prefetch favorites after session restore — stores full FavoritesListResponse in cache. */
export function prefetchFavoritesList(qc: QueryClient) {
  const scope =
    useTenantStore.getState().tenant?.id ?? resolveTenantSlugForApi() ?? 'none'
  return qc.prefetchQuery({
    queryKey: favoritesKeys.list(scope),
    queryFn: () => favoritesService.getFavorites(),
    staleTime: STALE_TIME,
  })
}

/**
 * Raw backend envelope from React Query cache.
 * UI components should use useFavoritesList() instead.
 */
export function useFavoritesQuery() {
  const enabled = useFavoritesEnabled()
  const tenantScope = useFavoritesTenantScope()
  return useQuery(favoritesListQueryOptions(enabled, tenantScope))
}

/**
 * Normalized favorites hook for UI — never exposes the API envelope as an array.
 */
export function useFavoritesList(): UseFavoritesListResult {
  const enabled = useFavoritesEnabled()
  const tenantScope = useFavoritesTenantScope()
  const { data, isLoading, isError, isFetching, error, refetch } = useQuery(
    favoritesListQueryOptions(enabled, tenantScope),
  )

  return {
    favoriteItems: data?.results ?? EMPTY_FAVORITE_ITEMS,
    count: data?.count ?? 0,
    sync: data?.sync,
    isLoading,
    isError,
    isFetching,
    error: (error as Error | null) ?? null,
    refetch: () => {
      void refetch()
    },
  }
}

/**
 * Multi-tab / multi-device sync — runs on window focus and reconnect only.
 * Writes the authoritative FavoritesListResponse into the list query cache.
 */
export function useFavoritesSync() {
  const enabled = useFavoritesEnabled()
  const tenantScope = useFavoritesTenantScope()
  const qc = useQueryClient()

  return useQuery({
    queryKey: favoritesKeys.sync(tenantScope),
    queryFn: async () => {
      const response = await favoritesService.refreshFavorites()
      applyFavoritesListCache(qc, response, tenantScope)
      return response
    },
    enabled,
    staleTime: STALE_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

/** Manual refresh — fetches authoritative state via sync endpoint into the list cache. */
export function useRefreshFavorites() {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => favoritesService.refreshFavorites(),
    onSuccess: (response) => {
      applyFavoritesListCache(qc, response)
    },
    onError: (err) => {
      toast.error(getFavoriteErrorMessage(err))
    },
  })

  return {
    refresh: () => mutation.mutate(),
    isRefreshing: mutation.isPending,
  }
}

export function useIsFavorite(menuItemId: string): boolean {
  const enabled = useFavoritesEnabled()
  const tenantScope = useFavoritesTenantScope()
  const { data = false } = useQuery({
    ...favoritesListQueryOptions(enabled, tenantScope),
    select: (response) => response.results.some((f) => f.menu_item.id === menuItemId),
  })
  return data
}

export function useAddFavorite() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (menuItemId: string) =>
      favoritesService.addFavorite({ menu_item_id: menuItemId }),
    onSuccess: async () => {
      await invalidateFavoritesList(qc)
    },
    onError: (err) => {
      toast.error(getFavoriteErrorMessage(err))
      void invalidateFavoritesList(qc)
    },
  })
}

export function useRemoveFavorite() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (menuItemId: string) => favoritesService.removeFavorite(menuItemId),
    onSuccess: async () => {
      await invalidateFavoritesList(qc)
    },
    onError: (err) => {
      toast.error(getFavoriteErrorMessage(err))
      void invalidateFavoritesList(qc)
    },
  })
}

/** Shared favorite-button handler: add or remove based on server cache state only. */
export function useFavoriteAction(menuItemId: string) {
  const favorited = useIsFavorite(menuItemId)
  const addFavorite = useAddFavorite()
  const removeFavorite = useRemoveFavorite()
  const isPending = addFavorite.isPending || removeFavorite.isPending

  const handleFavorite = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation()
      if (isPending) return
      if (favorited) {
        removeFavorite.mutate(menuItemId)
      } else {
        addFavorite.mutate(menuItemId)
      }
    },
    [favorited, isPending, menuItemId, addFavorite, removeFavorite],
  )

  return { favorited, isPending, handleFavorite }
}
