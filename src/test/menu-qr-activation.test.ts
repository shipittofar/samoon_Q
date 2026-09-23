import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/axios.instance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const BRANCH_ID = '21e55d4d-2195-40cb-aa8e-7ec015040ef1'
const TENANT_ID = 'tenant-should-not-be-in-menu-qr-path'

const ENABLED = {
  code: 'menuqr01',
  url: 'https://api.example.com/qr/menuqr01',
  is_active: true,
  destination: 'menu',
}

describe('menu QR activation request', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'false')
  })

  it('POSTs an empty JSON object to the branch-scoped menu enable endpoint', async () => {
    const api = (await import('@/services/axios.instance')).default
    const { qrManagementService } = await import('@/services/qr-management.service')
    const { ENDPOINTS } = await import('@/services/endpoints')

    vi.mocked(api.post).mockResolvedValueOnce({ data: ENABLED })

    const qr = await qrManagementService.enableMenuQr(BRANCH_ID)

    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith(ENDPOINTS.MENU.QR_ENABLE(BRANCH_ID), {})
    expect(ENDPOINTS.MENU.QR_ENABLE(BRANCH_ID)).toBe(`/menu/branches/${BRANCH_ID}/qr/enable/`)
    expect(ENDPOINTS.MENU.QR_ENABLE(BRANCH_ID)).not.toContain(TENANT_ID)
    expect(ENDPOINTS.MENU.QR_ENABLE(BRANCH_ID)).not.toContain('/qr/menu/')
    expect(qr).toEqual(ENABLED)
    expect(api.patch).not.toHaveBeenCalled()
  })

  it('disable still POSTs to the menu disable endpoint without changing the URL contract', async () => {
    const api = (await import('@/services/axios.instance')).default
    const { qrManagementService } = await import('@/services/qr-management.service')
    const { ENDPOINTS } = await import('@/services/endpoints')

    vi.mocked(api.post).mockResolvedValueOnce({
      data: { ...ENABLED, is_active: false },
    })

    const qr = await qrManagementService.disableMenuQr(BRANCH_ID)

    expect(api.post).toHaveBeenCalledWith(`/menu/branches/${BRANCH_ID}/qr/disable/`, {})
    expect(qr.is_active).toBe(false)
    expect(qr.code).toBe(ENABLED.code)
    expect(qr.url).toBe(ENABLED.url)
  })

  it('GET and regenerate use the branch menu QR routes', async () => {
    const api = (await import('@/services/axios.instance')).default
    const { qrManagementService } = await import('@/services/qr-management.service')

    vi.mocked(api.get).mockResolvedValueOnce({ data: ENABLED })
    await qrManagementService.getMenuQr(BRANCH_ID)
    expect(api.get).toHaveBeenCalledWith(`/menu/branches/${BRANCH_ID}/qr/`)

    vi.mocked(api.post).mockResolvedValueOnce({
      data: { ...ENABLED, code: 'menuqr02', url: 'https://api.example.com/qr/menuqr02' },
    })
    await qrManagementService.regenerateMenuQr(BRANCH_ID)
    expect(api.post).toHaveBeenCalledWith(`/menu/branches/${BRANCH_ID}/qr/regenerate/`, {})
  })

  it('rejects with the backend error body when enable fails', async () => {
    const api = (await import('@/services/axios.instance')).default
    const { qrManagementService } = await import('@/services/qr-management.service')
    const body = { detail: 'Menu QR cannot be enabled for this branch.' }

    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 400, data: body } })

    await expect(qrManagementService.enableMenuQr(BRANCH_ID)).rejects.toMatchObject({
      response: { status: 400, data: body },
    })
  })
})
