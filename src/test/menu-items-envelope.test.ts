import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeMenuItems } from '@/lib/menu-normalizers'

vi.mock('@/services/axios.instance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const tenant = {
  id: 'tenant-1',
  name: 'Samoon',
  slug: 'wma4he3d',
  is_active: true,
  status: 'ACTIVE',
}

describe('normalizeMenuItems contract', () => {
  it('rejects a response envelope instead of calling map on it', () => {
    expect(() => normalizeMenuItems({ tenant, results: [] } as never)).toThrow(
      /expected an array of menu items, received object[\s\S]*results array/,
    )
  })
})

describe('menu alias endpoints unwrap results', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'false')
  })

  async function load() {
    const api = (await import('@/services/axios.instance')).default
    const { menuService } = await import('@/services/menu.service')
    const { ENDPOINTS } = await import('@/services/endpoints')
    return { api, menuService, ENDPOINTS }
  }

  it('getRelated normalizes a partial item inside { tenant, results }', async () => {
    const { api, menuService } = await load()
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { tenant: {}, results: [{}] },
    })

    const items = await menuService.getRelated('branch-1', 'item-1')

    expect(items).toHaveLength(1)
    expect(typeof items[0]?.price).toBe('number')
  })

  it('getRelated normalizes items inside { tenant, results }', async () => {
    const { api, menuService, ENDPOINTS } = await load()
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        tenant,
        results: [{ id: 'item-2', price: '9.50', name: 'Side' }],
      },
    })

    const items = await menuService.getRelated('branch-1', 'item-1')

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.MENU.RELATED('item-1'), {
      params: { branch_id: 'branch-1' },
    })
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('item-2')
    expect(items[0]?.price).toBe(9.5)
  })

  it('getRelated returns [] for an empty results array', async () => {
    const { api, menuService } = await load()
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { tenant: {}, results: [] },
    })

    await expect(menuService.getRelated('branch-1', 'item-1')).resolves.toEqual([])
  })

  it('getFeatured passes data.results to the normalizer', async () => {
    const { api, menuService, ENDPOINTS } = await load()
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { tenant, results: [{ id: 'feat-1', price: '4.00' }] },
    })

    const items = await menuService.getFeatured('branch-1')

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.MENU.FEATURED, {
      params: { branch_id: 'branch-1' },
    })
    expect(items.map((item) => item.id)).toEqual(['feat-1'])
    expect(items[0]?.price).toBe(4)
  })

  it('getPopular passes data.results to the normalizer', async () => {
    const { api, menuService, ENDPOINTS } = await load()
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { tenant, results: [{ id: 'pop-1', price: '3.25' }] },
    })

    const items = await menuService.getPopular('branch-1')

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.MENU.POPULAR, {
      params: { branch_id: 'branch-1' },
    })
    expect(items.map((item) => item.id)).toEqual(['pop-1'])
    expect(items[0]?.price).toBe(3.25)
  })

  it('search passes data.results to the normalizer', async () => {
    const { api, menuService, ENDPOINTS } = await load()
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { tenant, results: [{ id: 'search-1', price: '11.00' }] },
    })

    const items = await menuService.search('branch-1', 'soup')

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.MENU.SEARCH, {
      params: { branch_id: 'branch-1', q: 'soup' },
    })
    expect(items.map((item) => item.id)).toEqual(['search-1'])
    expect(items[0]?.price).toBe(11)
  })

  it('getItems still normalizes the paginated branch menu body', async () => {
    const { api, menuService, ENDPOINTS } = await load()
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 'branch-item', price: '8.00' }],
        tenant,
      },
    })

    const page = await menuService.getItems('branch-1')

    expect(api.get).toHaveBeenCalledWith(ENDPOINTS.MENU.PUBLIC_ITEMS('branch-1'), {
      params: {},
    })
    expect(page.count).toBe(1)
    expect(page.results).toHaveLength(1)
    expect(page.results[0]?.id).toBe('branch-item')
    expect(page.results[0]?.price).toBe(8)
  })
})
