import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithIntl } from '@/test/test-utils'
import { qrManagementService } from '@/services/qr-management.service'
import { encodeQrSvg } from '@/lib/qr-svg'
import QrManagementPage from '@/app/console/qr/page'

vi.mock('@/lib/qr-svg', () => ({
  encodeQrSvg: vi.fn(async (url: string) => `<svg data-payload="${url}"></svg>`),
}))

vi.mock('@/components/auth/PermissionGuard', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/components/common/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>()
  return {
    ...actual,
    useConsoleTenantId: () => 'tenant-samoon-01',
    useAdminBranches: () => ({
      data: [
        {
          id: 'branch-rest-01',
          tenantId: 'tenant-samoon-01',
          name: 'Main Branch',
          slug: 'main',
        },
      ],
      isLoading: false,
      error: null,
    }),
    usePermission: () => true,
  }
})

vi.mock('@/stores', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores')>()
  const tenant = { id: 'tenant-samoon-01', name: 'Restaurant A', slug: 'samoon' }
  const useTenantStore = Object.assign(
    (selector?: (state: { tenant: typeof tenant }) => unknown) =>
      typeof selector === 'function' ? selector({ tenant }) : { tenant },
    { getState: () => ({ tenant, applyResolvedTenant: vi.fn() }) },
  )
  return {
    ...actual,
    useTenantStore,
  }
})

describe('QR Management page', () => {
  beforeEach(() => {
    qrManagementService._resetMock()
    vi.mocked(encodeQrSvg).mockClear()
  })

  it('renders tenant and branch QR records from qr.url', async () => {
    vi.spyOn(qrManagementService, 'getTenantQr').mockResolvedValue({
      code: 'abc11111',
      url: 'https://api.example.com/qr/abc11111',
      is_active: true,
      destination: 'tenant',
    })
    vi.spyOn(qrManagementService, 'getBranchQr').mockResolvedValue({
      code: 'abc22222',
      url: 'https://api.example.com/qr/abc22222',
      is_active: true,
      destination: 'branch',
    })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { getByTestId, getAllByTestId, getAllByRole } = renderWithIntl(
      <QueryClientProvider client={qc}>
        <QrManagementPage />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(getByTestId('qr-management-page')).toBeTruthy())
    await waitFor(() => expect(getByTestId('qr-record-tenant-tenant-samoon-01')).toBeTruthy())
    await waitFor(() => expect(getByTestId('qr-record-branch-branch-rest-01')).toBeTruthy())

    await waitFor(() => expect(getAllByTestId('qr-code-display').length).toBeGreaterThanOrEqual(2), {
      timeout: 5000,
    })
    const displays = getAllByTestId('qr-code-display')
    expect(displays.length).toBeGreaterThanOrEqual(2)
    for (const el of displays) {
      expect(el.getAttribute('data-qr-url') ?? '').toContain('/qr/')
    }
    expect(encodeQrSvg).toHaveBeenCalled()
    const encoded = vi.mocked(encodeQrSvg).mock.calls.map((call) => call[0] as string)
    expect(encoded.every((url) => url.includes('/qr/'))).toBe(true)
    expect(encoded.some((url) => url.includes('samoon/main'))).toBe(false)

    await waitFor(() => expect(getAllByRole('button', { name: 'Disable QR' }).length).toBeGreaterThanOrEqual(2))
    await waitFor(() => expect(getAllByRole('button', { name: 'Regenerate QR' }).length).toBeGreaterThanOrEqual(2))
  }, 15000)
})
