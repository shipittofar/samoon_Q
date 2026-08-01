// ============================================================
// Favorites — refresh sync + production contract tests
// ============================================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseFavoritesPayload } from '@/services/favorites.service'

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')

describe('Favorites production contract', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('service getFavorites returns FavoritesListResponse envelope', async () => {
    const { favoritesService } = await import('@/services/favorites.service')
    vi.useFakeTimers()
    const p = favoritesService.getFavorites()
    await vi.runAllTimersAsync()
    const result = await p
    vi.useRealTimers()

    expect(Array.isArray(result.results)).toBe(true)
    expect(typeof result.count).toBe('number')
    expect(result.sync).toBeDefined()
    expect(result.results.every((f) => f.menu_item && f.id)).toBe(true)
  })

  it('parseFavoritesPayload handles metadata-only sync without wiping results key', () => {
    const parsed = parseFavoritesPayload({
      sync: { version: '3' },
      count: 2,
    })

    expect(parsed.results).toEqual([])
    expect(parsed.count).toBe(2)
    expect(parsed.sync.version).toBe('3')
  })

  it('parseFavoritesPayload reads results from alternate keys', () => {
    const parsed = parseFavoritesPayload({
      sync: {},
      count: 1,
      favorites: [
        {
          id: 'fav-1',
          menu_item: { id: '1', name: 'Pizza' },
          branch: { id: 'b1', name: 'Main' },
          tenant: { id: 't1', name: 'Cafe', slug: 'cafe' },
          favorited_at: '2024-01-01T00:00:00Z',
        },
      ],
    })

    expect(parsed.results).toHaveLength(1)
    expect(parsed.results[0].menu_item.name).toBe('Pizza')
  })

  it('refreshFavorites falls back to list when sync has no renderable results', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'false')
    vi.resetModules()

    const api = (await import('@/services/axios.instance')).default
    const getSpy = vi.spyOn(api, 'get')

    getSpy.mockImplementation(async (url: string) => {
      if (url.endsWith('/sync/')) {
        return { data: { sync: { version: '9' }, count: 2 } }
      }
      return {
        data: {
          sync: { version: '9' },
          count: 2,
          results: [
            {
              id: 'fav-1',
              menu_item: { id: '1', name: 'Burger', branch_id: 'b1' },
              branch: { id: 'b1', name: 'Downtown' },
              tenant: { id: 't1', name: 'Samoon', slug: 'samoon' },
              favorited_at: '2024-01-01T00:00:00Z',
            },
            {
              id: 'fav-2',
              menu_item: { id: '2', name: 'Pasta', branch_id: 'b1' },
              branch: { id: 'b1', name: 'Downtown' },
              tenant: { id: 't1', name: 'Samoon', slug: 'samoon' },
              favorited_at: '2024-01-02T00:00:00Z',
            },
          ],
        },
      }
    })

    const { favoritesService } = await import('@/services/favorites.service')
    const refreshed = await favoritesService.refreshFavorites()

    expect(refreshed.results).toHaveLength(2)
    expect(refreshed.count).toBe(2)
    expect(refreshed.sync.version).toBe('9')
    expect(getSpy).toHaveBeenCalledTimes(2)

    getSpy.mockRestore()
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'true')
  })

  it('hooks expose favoriteItems not raw API data field', () => {
    const hooksSrc = readFileSync(join(__dirname, '..', 'hooks', 'favorites.ts'), 'utf-8')
    expect(hooksSrc).toContain('favoriteItems:')
    expect(hooksSrc).toContain('UseFavoritesListResult')
    expect(hooksSrc).not.toContain('data: query.data?.results')
    expect(hooksSrc).toContain('refreshFavorites')
  })

  it('favorites page uses FavoriteCard with full favorite data', () => {
    const pageSrc = readFileSync(
      join(__dirname, '..', 'app', 'dashboard', 'favorites', 'page.tsx'),
      'utf-8',
    )
    expect(pageSrc).toContain('FavoriteCard')
    expect(pageSrc).toContain('favorite={favorite}')
    expect(pageSrc).not.toContain('useMenuItems')
    expect(pageSrc).not.toContain("from '@/components/menu/FoodCard'")
  })

  it('no obsolete favorites state management remains', () => {
    const srcRoot = join(__dirname, '..')
    const hooksSrc = readFileSync(join(srcRoot, 'hooks', 'favorites.ts'), 'utf-8')
    const storesSrc = readFileSync(join(srcRoot, 'stores', 'index.ts'), 'utf-8')

    expect(hooksSrc).not.toContain('useFavoritesStore')
    expect(hooksSrc).not.toContain('localStorage')
    expect(hooksSrc).not.toContain('toggleFavorite')
    expect(storesSrc).not.toContain('useFavoritesStore')
    expect(storesSrc).not.toContain('samoon-favorites')
  })

  it('mutations use add/remove not toggle', () => {
    const hooksSrc = readFileSync(join(__dirname, '..', 'hooks', 'favorites.ts'), 'utf-8')
    expect(hooksSrc).toContain('addFavorite')
    expect(hooksSrc).toContain('removeFavorite')
    expect(hooksSrc).not.toContain('toggleFavorite')
    expect(hooksSrc).not.toContain('onMutate')
  })

  it('query keys use consistent favorites list cache', () => {
    const hooksSrc = readFileSync(join(__dirname, '..', 'hooks', 'favorites.ts'), 'utf-8')
    expect(hooksSrc).toContain("list: () => [...favoritesKeys.all, 'list']")
    expect(hooksSrc).toContain('favoritesKeys.list()')
    expect(hooksSrc).not.toMatch(/queryKey:\s*\['favorites'\](?!,)/)
  })
})
