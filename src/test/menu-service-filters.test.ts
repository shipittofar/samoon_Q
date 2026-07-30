import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/axios.instance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('menuService.getItems — real API mode forwards filters', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'false')
  })

  it('sends category and search query params to the branch-scoped items endpoint', async () => {
    const api = (await import('@/services/axios.instance')).default
    const { menuService } = await import('@/services/menu.service')
    const { ENDPOINTS } = await import('@/services/endpoints')

    vi.mocked(api.get).mockResolvedValueOnce({
      data: { count: 0, next: null, previous: null, results: [] },
    })

    await menuService.getItems('branch-rest-01', {
      category: 'cat-1',
      search: 'burger',
      sort: 'popular',
      min_price: 5,
      available: true,
      page: 2,
      page_size: 12,
    })

    expect(api.get).toHaveBeenCalledWith(
      ENDPOINTS.MENU.PUBLIC_ITEMS('branch-rest-01'),
      {
        params: {
          category: 'cat-1',
          search: 'burger',
          sort: 'popular',
          min_price: 5,
          available: true,
          page: 2,
          page_size: 12,
        },
      },
    )
  })
})
