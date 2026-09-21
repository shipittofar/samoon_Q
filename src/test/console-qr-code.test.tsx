import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithIntl } from '@/test/test-utils'
import { QrCodeDisplay } from '@/components/qr/QrCodeDisplay'
import { CopyUrlWidget } from '@/components/marketplace/CopyUrlWidget'
import { QrManagementPanel } from '@/components/qr/QrManagementPanel'
import { isEncodableQrUrl, isHttpQrUrl } from '@/lib/qr-url'
import { encodeQrSvg } from '@/lib/qr-svg'
import { DEFAULT_BRANCH_CHECKOUT } from '@/lib/branch-checkout'
import { getApiErrorCode, getApiErrorMessage } from '@/api/errors'
import { qrManagementService } from '@/services/qr-management.service'
import { tenantQrQueryKey, branchQrQueryKey, menuQrQueryKey, reservationQrQueryKey, matchesQrListFilters } from '@/lib/qr-management'
import type { Tenant } from '@/types'
import type { Branch } from '@/types/branch'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { ReactElement } from 'react'

const ROOT = join(__dirname, '..')
const QR_URL = 'https://api.example.com/qr/abc12345'
const PUBLIC_TENANT = 'https://site.example.com/samoon'
const PUBLIC_BRANCH = 'https://site.example.com/samoon/main'

vi.mock('@/lib/qr-svg', () => ({
  encodeQrSvg: vi.fn(async (url: string) => `<svg data-payload="${url}"></svg>`),
}))

beforeEach(() => {
  vi.mocked(encodeQrSvg).mockClear()
})

describe('QrCode types', () => {
  it('Tenant accepts qr.code and qr.url', () => {
    const tenant: Tenant = {
      id: 't1',
      name: 'Samoon',
      slug: 'samoon',
      businessTypes: ['restaurant'],
      status: 'ACTIVE',
      created_at: '2024-01-01T00:00:00.000Z',
      qr: { code: 'abc12345', url: QR_URL },
    }
    expect(tenant.qr?.code).toBe('abc12345')
    expect(tenant.qr?.url).toBe(QR_URL)
  })

  it('Branch accepts qr.code and qr.url', () => {
    const branch: Branch = {
      id: 'b1',
      tenantId: 't1',
      name: 'Main',
      slug: 'main',
      status: 'active',
      type: 'physical',
      location: { address: '1 St', city: 'NY', country: 'US' },
      contact: {},
      businessHours: [],
      checkout: DEFAULT_BRANCH_CHECKOUT,
      marketplaceVisible: true,
      reservationsEnabled: false,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
      qr: { code: 'abc12345', url: QR_URL },
    }
    expect(branch.qr?.code).toBe('abc12345')
    expect(branch.qr?.url).toBe(QR_URL)
  })

  it('allows qr to be null', () => {
    const tenant: Tenant = {
      id: 't1',
      name: 'Samoon',
      slug: 'samoon',
      businessTypes: ['restaurant'],
      status: 'ACTIVE',
      created_at: '2024-01-01T00:00:00.000Z',
      qr: null,
    }
    expect(tenant.qr).toBeNull()
  })
})

describe('isHttpQrUrl', () => {
  it('accepts absolute http(s) QR URLs', () => {
    expect(isHttpQrUrl(QR_URL)).toBe(true)
    expect(isHttpQrUrl('http://api.example.com/qr/abc')).toBe(true)
  })

  it('rejects missing values and slug-like paths', () => {
    expect(isHttpQrUrl(undefined)).toBe(false)
    expect(isHttpQrUrl(null)).toBe(false)
    expect(isHttpQrUrl('')).toBe(false)
    expect(isHttpQrUrl('bi32b4if')).toBe(false)
    expect(isHttpQrUrl('/qr/bi32b4if')).toBe(false)
    expect(isHttpQrUrl('/samoon')).toBe(false)
    expect(isHttpQrUrl('/samoon/main')).toBe(false)
  })

  it('isEncodableQrUrl accepts resolver paths and rejects storefront slugs', () => {
    expect(isEncodableQrUrl(QR_URL)).toBe(true)
    expect(isEncodableQrUrl('/qr/bi32b4if')).toBe(true)
    expect(isEncodableQrUrl('/samoon')).toBe(false)
    expect(isEncodableQrUrl('/samoon/main')).toBe(false)
  })
})

describe('QrCodeDisplay', () => {
  it('encodes the exact qr.url', async () => {
    const { getByTestId } = renderWithIntl(<QrCodeDisplay url={QR_URL} />)
    await waitFor(() => expect(getByTestId('qr-code-svg')).toBeTruthy())
    expect(encodeQrSvg).toHaveBeenCalledWith(QR_URL)
    expect(getByTestId('qr-code-svg').innerHTML).toContain(QR_URL)
    expect(getByTestId('qr-code-display').getAttribute('data-qr-url')).toBe(QR_URL)
  })

  it('encodes a relative /qr/<code> resolver URL', async () => {
    const { getByTestId } = renderWithIntl(<QrCodeDisplay url="/qr/abc12345" />)
    await waitFor(() => expect(getByTestId('qr-code-svg')).toBeTruthy())
    expect(encodeQrSvg).toHaveBeenCalledWith('/qr/abc12345')
  })

  it('does not encode public slug paths', async () => {
    renderWithIntl(<QrCodeDisplay url={QR_URL} />)
    await waitFor(() => expect(encodeQrSvg).toHaveBeenCalled())
    expect(encodeQrSvg).not.toHaveBeenCalledWith('/samoon')
    expect(encodeQrSvg).not.toHaveBeenCalledWith('/samoon/main')
    expect(encodeQrSvg).not.toHaveBeenCalledWith(PUBLIC_TENANT)
    expect(encodeQrSvg).not.toHaveBeenCalledWith(PUBLIC_BRANCH)
  })

  it('does not crash when qr is missing', () => {
    const { getByTestId } = renderWithIntl(<QrCodeDisplay url={null} />)
    expect(getByTestId('qr-code-missing')).toBeTruthy()
    expect(encodeQrSvg).not.toHaveBeenCalled()
  })
})

describe('CopyUrlWidget QR', () => {
  it('encodes qrUrl and not the displayed public URL', async () => {
    const { getByTestId, queryByText } = renderWithIntl(
      <CopyUrlWidget
        url={PUBLIC_TENANT}
        qrUrl={QR_URL}
        qrTitle="Business QR Code"
      />,
    )
    await waitFor(() => expect(getByTestId('qr-code-svg')).toBeTruthy())
    expect(encodeQrSvg).toHaveBeenCalledWith(QR_URL)
    expect(encodeQrSvg).not.toHaveBeenCalledWith(PUBLIC_TENANT)
    expect(queryByText('QR code generation available in the mobile app.')).toBeNull()
  })

  it('shows empty QR state without encoding a slug when qrUrl is missing', () => {
    const { getByTestId } = renderWithIntl(
      <CopyUrlWidget url={PUBLIC_TENANT} qrUrl={null} />,
    )
    expect(getByTestId('qr-code-missing')).toBeTruthy()
    expect(encodeQrSvg).not.toHaveBeenCalled()
  })
})

describe('Console QR surfaces', () => {
  it('tenant detail shows a QR section bound to tenant.qr.url', () => {
    const src = readFileSync(join(ROOT, 'app/console/tenants/[tenantId]/page.tsx'), 'utf8')
    expect(src).toContain('TenantQrSection')
    expect(src).toContain('QrManagementPanel')
    expect(src).toContain('entityId={tenant.id}')
    expect(src).toContain('businessQrTitle')
    expect(src).not.toMatch(/encodeQrSvg\(.*slug/)
  })

  it('branch detail shows a QR section bound to branch.qr.url', () => {
    const src = readFileSync(join(ROOT, 'app/console/branches/[id]/page.tsx'), 'utf8')
    expect(src).toContain('branchQrTitle')
    expect(src).toContain('QrManagementPanel')
    expect(src).toContain('entityId={branch.id}')
    expect(src).not.toContain('qrUrl={`${APP_URL}')
  })

  it('settings General tab hosts tenant QR management', () => {
    const src = readFileSync(join(ROOT, 'app/console/settings/page.tsx'), 'utf8')
    expect(src).toContain('QrManagementPanel')
    expect(src).toContain('businessQrTitle')
    expect(src).not.toContain('qrUrl={tenant?.qr?.url}')
    const widget = readFileSync(join(ROOT, 'components/marketplace/CopyUrlWidget.tsx'), 'utf8')
    expect(widget).not.toContain('qrCodeMobileNote')
  })
})

function renderQrPanel(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    qc,
    ...renderWithIntl(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>),
  }
}

describe('QR management service', () => {
  beforeEach(() => {
    qrManagementService._resetMock()
  })

  it('regenerate creates a new code and url', async () => {
    const before = await qrManagementService.getTenantQr('tenant-samoon-01')
    expect(before?.code).toBeTruthy()
    const after = await qrManagementService.regenerateTenantQr('tenant-samoon-01')
    expect(after.code).not.toBe(before!.code)
    expect(after.url).not.toBe(before!.url)
    expect(after.url).toContain(after.code)
  })

  it('destination change keeps the same code and url', async () => {
    const before = await qrManagementService.getBranchQr('branch-rest-01')
    expect(before?.code).toBeTruthy()
    const after = await qrManagementService.setBranchQrDestination('branch-rest-01', {
      destination_type: 'menu',
    })
    expect(after.code).toBe(before!.code)
    expect(after.url).toBe(before!.url)
    expect(after.destination).toBe('menu')
  })

  it('sends destination_type for every branch destination enum', async () => {
    const before = await qrManagementService.getBranchQr('branch-rest-01')
    for (const destination_type of ['tenant', 'branch', 'menu', 'reservation'] as const) {
      const after = await qrManagementService.setBranchQrDestination('branch-rest-01', {
        destination_type,
      })
      expect(after.destination).toBe(destination_type)
      expect(after.code).toBe(before!.code)
      expect(after.url).toBe(before!.url)
    }
  })

  it('rejects a missing destination_type field', async () => {
    await qrManagementService.getBranchQr('branch-rest-01')
    await expect(
      qrManagementService.setBranchQrDestination('branch-rest-01', {} as { destination_type: 'menu' }),
    ).rejects.toMatchObject({
      response: {
        status: 400,
        data: { destination_type: ['This field is required.'] },
      },
    })
  })

  it('tenant destination_type is coerced to tenant without changing the QR', async () => {
    const before = await qrManagementService.getTenantQr('tenant-samoon-01')
    const after = await qrManagementService.setTenantQrDestination('tenant-samoon-01', {
      destination_type: 'menu',
    })
    expect(after.destination).toBe('tenant')
    expect(after.code).toBe(before!.code)
    expect(after.url).toBe(before!.url)
  })

  it('manages independent menu and reservation QR entities', async () => {
    const menu = await qrManagementService.getMenuQr('branch-rest-01')
    const reservation = await qrManagementService.getReservationQr('tenant-samoon-01')
    expect(menu?.destination).toBe('menu')
    expect(reservation?.destination).toBe('reservation')
    expect(menu?.url).not.toBe(reservation?.url)
    const disabled = await qrManagementService.disableMenuQr('branch-rest-01')
    expect(disabled.is_active).toBe(false)
    const enabled = await qrManagementService.enableMenuQr('branch-rest-01')
    expect(enabled.is_active).toBe(true)
    const regenerated = await qrManagementService.regenerateReservationQr('tenant-samoon-01')
    expect(regenerated.code).not.toBe(reservation!.code)
    await expect(
      qrManagementService.setMenuQrDestination('branch-rest-01', { destination_type: 'branch' }),
    ).rejects.toMatchObject({
      response: { data: { code: 'qr_invalid_destination' } },
    })
  })
})

describe('QrManagementPanel', () => {
  beforeEach(() => {
    qrManagementService._resetMock()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    })
  })

  it('tenant panel renders active QR from qr.url', async () => {
    const { getByTestId, getByText } = renderQrPanel(
      <QrManagementPanel
        scope="tenant"
        entityId="tenant-samoon-01"
        canManage
        title="Business QR Code"
        description="Scan to open the public business page."
        sectionAria="Business QR code"
      />,
    )
    await waitFor(() => expect(getByTestId('qr-code-display')).toBeTruthy())
    expect(getByTestId('qr-status').getAttribute('data-qr-active')).toBe('true')
    expect(getByText('Active')).toBeTruthy()
    expect(getByTestId('qr-code-display').getAttribute('data-qr-url')).toContain('/qr/')
    expect(encodeQrSvg).toHaveBeenCalled()
    const encoded = vi.mocked(encodeQrSvg).mock.calls[0]?.[0]
    expect(encoded).toBe(getByTestId('qr-resolver-url').textContent)
    expect(encoded).not.toBe(PUBLIC_TENANT)
  })

  it('tenant disable requires confirmation then updates status', async () => {
    const user = userEvent.setup()
    const { getByRole, getByTestId, getByText } = renderQrPanel(
      <QrManagementPanel
        scope="tenant"
        entityId="tenant-samoon-01"
        canManage
        title="Business QR Code"
        description="Scan to open the public business page."
        sectionAria="Business QR code"
      />,
    )
    await waitFor(() => expect(getByRole('button', { name: 'Disable QR' })).toBeTruthy())
    await user.click(getByRole('button', { name: 'Disable QR' }))
    expect(getByText(/stop resolving publicly/i)).toBeTruthy()
    await user.click(getByRole('button', { name: /^Disable$/ }))
    await waitFor(() => expect(getByTestId('qr-status').getAttribute('data-qr-active')).toBe('false'))
    expect(getByText('Disabled')).toBeTruthy()
    expect(getByTestId('qr-code-display')).toBeTruthy()
  })

  it('tenant enable mutation is called from the disabled state', async () => {
    const user = userEvent.setup()
    await qrManagementService.getTenantQr('tenant-samoon-01')
    await qrManagementService.disableTenantQr('tenant-samoon-01')
    const enable = vi.spyOn(qrManagementService, 'enableTenantQr')
    const { getByRole, getByTestId } = renderQrPanel(
      <QrManagementPanel
        scope="tenant"
        entityId="tenant-samoon-01"
        canManage
        title="Business QR Code"
        description="Scan to open the public business page."
        sectionAria="Business QR code"
      />,
    )
    await waitFor(() => expect(getByRole('button', { name: 'Enable QR' })).toBeTruthy())
    await user.click(getByRole('button', { name: 'Enable QR' }))
    await waitFor(() => expect(enable).toHaveBeenCalledWith('tenant-samoon-01'))
    await waitFor(() => expect(getByTestId('qr-status').getAttribute('data-qr-active')).toBe('true'))
  })

  it('regenerate confirmation replaces the displayed QR url', async () => {
    const user = userEvent.setup()
    const before = await qrManagementService.getTenantQr('tenant-samoon-01')
    const { getByRole, getByTestId, getByText, qc } = renderQrPanel(
      <QrManagementPanel
        scope="tenant"
        entityId="tenant-samoon-01"
        canManage
        title="Business QR Code"
        description="Scan to open the public business page."
        sectionAria="Business QR code"
      />,
    )
    await waitFor(() => expect(getByTestId('qr-code-value').textContent).toBe(before!.code))
    await user.click(getByRole('button', { name: 'Regenerate QR' }))
    expect(getByText(/stop working, including printed copies/i)).toBeTruthy()
    await user.click(getByRole('button', { name: /^Regenerate$/ }))
    await waitFor(() => expect(getByTestId('qr-code-value').textContent).not.toBe(before!.code))
    const afterUrl = getByTestId('qr-resolver-url').textContent
    expect(afterUrl).not.toBe(before!.url)
    expect(getByTestId('qr-code-display').getAttribute('data-qr-url')).toBe(afterUrl)
    await waitFor(() => {
      const cached = qc.getQueryData(tenantQrQueryKey('tenant-samoon-01')) as { code: string }
      expect(cached.code).not.toBe(before!.code)
    })
  })

  it('branch destination change keeps the QR code', async () => {
    const user = userEvent.setup()
    const before = await qrManagementService.getBranchQr('branch-rest-01')
    const setDest = vi.spyOn(qrManagementService, 'setBranchQrDestination')
    const { getByTestId, getByRole, getByText } = renderQrPanel(
      <QrManagementPanel
        scope="branch"
        entityId="branch-rest-01"
        tenantId="tenant-samoon-01"
        canManage
        title="This location's QR Code"
        description="Scan to open this branch's public page."
        sectionAria="Branch public page and QR code"
      />,
    )
    await waitFor(() => expect(getByTestId('qr-destination-select')).toBeTruthy())
    expect(getByTestId('qr-code-value').textContent).toBe(before!.code)
    await user.selectOptions(getByTestId('qr-destination-select'), 'menu')
    expect(getByText('Change QR destination?')).toBeTruthy()
    expect(getByText(/affect all printed copies/i)).toBeTruthy()
    expect(setDest).not.toHaveBeenCalled()
    await user.click(getByRole('button', { name: 'Change destination' }))
    await waitFor(() =>
      expect(setDest).toHaveBeenCalledWith('branch-rest-01', { destination_type: 'menu' }),
    )
    await waitFor(() => expect(getByTestId('qr-destination-select')).toHaveValue('menu'))
    expect(getByTestId('qr-code-value').textContent).toBe(before!.code)
    expect(getByTestId('qr-resolver-url').textContent).toBe(before!.url)
    expect(getByTestId('qr-code-display').getAttribute('data-qr-url')).toBe(before!.url)
  })

  it('destination cancel does not PATCH or change cache', async () => {
    const user = userEvent.setup()
    const before = await qrManagementService.getBranchQr('branch-rest-01')
    const setDest = vi.spyOn(qrManagementService, 'setBranchQrDestination')
    const { getByTestId, getByRole, qc } = renderQrPanel(
      <QrManagementPanel
        scope="branch"
        entityId="branch-rest-01"
        tenantId="tenant-samoon-01"
        canManage
        title="This location's QR Code"
        description="Scan to open this branch's public page."
        sectionAria="Branch public page and QR code"
      />,
    )
    await waitFor(() => expect(getByTestId('qr-destination-select')).toBeTruthy())
    await user.selectOptions(getByTestId('qr-destination-select'), 'reservation')
    expect(setDest).not.toHaveBeenCalled()
    await user.click(getByRole('button', { name: 'Cancel' }))
    expect(setDest).not.toHaveBeenCalled()
    expect(getByTestId('qr-destination-select')).toHaveValue(before!.destination)
    expect(qc.getQueryData(branchQrQueryKey('branch-rest-01'))).toMatchObject({
      destination: before!.destination,
      url: before!.url,
    })
  })

  it('regenerate cancel does not call the API', async () => {
    const user = userEvent.setup()
    const regenerate = vi.spyOn(qrManagementService, 'regenerateTenantQr')
    const { getByRole } = renderQrPanel(
      <QrManagementPanel
        scope="tenant"
        entityId="tenant-samoon-01"
        canManage
        title="Business QR Code"
        description="Scan to open the public business page."
        sectionAria="Business QR code"
      />,
    )
    await waitFor(() => expect(getByRole('button', { name: 'Regenerate QR' })).toBeTruthy())
    await user.click(getByRole('button', { name: 'Regenerate QR' }))
    expect(regenerate).not.toHaveBeenCalled()
    await user.click(getByRole('button', { name: 'Cancel' }))
    expect(regenerate).not.toHaveBeenCalled()
  })

  it('tenant destination stays read-only', async () => {
    const { queryByTestId, getByTestId, queryByRole } = renderQrPanel(
      <QrManagementPanel
        scope="tenant"
        entityId="tenant-samoon-01"
        canManage
        title="Business QR Code"
        description="Scan to open the public business page."
        sectionAria="Business QR code"
      />,
    )
    await waitFor(() => expect(getByTestId('qr-destination')).toBeTruthy())
    expect(queryByTestId('qr-destination-select')).toBeNull()
    expect(getByTestId('qr-destination').textContent).toBe('Business page')
    expect(queryByRole('option', { name: 'Menu' })).toBeNull()
    expect(queryByRole('option', { name: 'Reservations' })).toBeNull()
    expect(queryByRole('option', { name: 'This location' })).toBeNull()
  })

  it('menu QR renders qr.url, status, and download control', async () => {
    const qr = await qrManagementService.getMenuQr('branch-rest-01')
    const { getByTestId, getByRole, queryByTestId } = renderQrPanel(
      <QrManagementPanel
        scope="menu"
        entityId="branch-rest-01"
        canManage
        title="Menu QR Code"
        description="Scan to open the public menu."
        sectionAria="Menu QR code"
      />,
    )
    await waitFor(() => expect(getByTestId('qr-code-display')).toBeTruthy())
    expect(getByTestId('qr-status').getAttribute('data-qr-active')).toBe('true')
    expect(getByTestId('qr-resolver-url').textContent).toBe(qr!.url)
    expect(getByTestId('qr-code-display').getAttribute('data-qr-url')).toBe(qr!.url)
    expect(encodeQrSvg).toHaveBeenCalledWith(qr!.url)
    expect(queryByTestId('qr-destination-select')).toBeNull()
    expect(getByTestId('qr-destination').textContent).toBe('Menu')
    await waitFor(() => expect(getByRole('button', { name: 'Download QR code as SVG' })).toBeTruthy())
  })

  it('reservation QR renders independently of booking records', async () => {
    const qr = await qrManagementService.getReservationQr('tenant-samoon-01')
    const { getByTestId, queryByTestId } = renderQrPanel(
      <QrManagementPanel
        scope="reservation"
        entityId="tenant-samoon-01"
        canManage
        title="Reservation QR Code"
        description="Scan to open the public reservation page."
        sectionAria="Reservation QR code"
      />,
    )
    await waitFor(() => expect(getByTestId('qr-code-display')).toBeTruthy())
    expect(getByTestId('qr-resolver-url').textContent).toBe(qr!.url)
    expect(getByTestId('qr-code-display').getAttribute('data-qr-url')).toBe(qr!.url)
    expect(queryByTestId('qr-destination-select')).toBeNull()
    expect(getByTestId('qr-destination').textContent).toBe('Reservations')
  })

  it('menu disable requires confirmation then updates status', async () => {
    const user = userEvent.setup()
    const { getByRole, getByTestId } = renderQrPanel(
      <QrManagementPanel
        scope="menu"
        entityId="branch-rest-01"
        canManage
        title="Menu QR Code"
        description="Scan to open the public menu."
        sectionAria="Menu QR code"
      />,
    )
    await waitFor(() => expect(getByRole('button', { name: 'Disable QR' })).toBeTruthy())
    await user.click(getByRole('button', { name: 'Disable QR' }))
    await user.click(getByRole('button', { name: /^Disable$/ }))
    await waitFor(() => expect(getByTestId('qr-status').getAttribute('data-qr-active')).toBe('false'))
  })

  it('menu enable mutation is called from the disabled state', async () => {
    const user = userEvent.setup()
    await qrManagementService.getMenuQr('branch-rest-01')
    await qrManagementService.disableMenuQr('branch-rest-01')
    const enable = vi.spyOn(qrManagementService, 'enableMenuQr')
    const { getByRole, getByTestId } = renderQrPanel(
      <QrManagementPanel
        scope="menu"
        entityId="branch-rest-01"
        canManage
        title="Menu QR Code"
        description="Scan to open the public menu."
        sectionAria="Menu QR code"
      />,
    )
    await waitFor(() => expect(getByRole('button', { name: 'Enable QR' })).toBeTruthy())
    await user.click(getByRole('button', { name: 'Enable QR' }))
    await waitFor(() => expect(enable).toHaveBeenCalledWith('branch-rest-01'))
    await waitFor(() => expect(getByTestId('qr-status').getAttribute('data-qr-active')).toBe('true'))
  })

  it('failed destination mutation does not corrupt cached QR state', async () => {
    const user = userEvent.setup()
    const before = await qrManagementService.getBranchQr('branch-rest-01')
    const setDest = vi.spyOn(qrManagementService, 'setBranchQrDestination').mockRejectedValueOnce({
      response: { status: 500, data: { message: 'server error' } },
    })
    const { getByTestId, getByRole, qc } = renderQrPanel(
      <QrManagementPanel
        scope="branch"
        entityId="branch-rest-01"
        tenantId="tenant-samoon-01"
        canManage
        title="This location's QR Code"
        description="Scan to open this branch's public page."
        sectionAria="Branch public page and QR code"
      />,
    )
    await waitFor(() => expect(getByTestId('qr-destination-select')).toBeTruthy())
    await user.selectOptions(getByTestId('qr-destination-select'), 'menu')
    await user.click(getByRole('button', { name: 'Change destination' }))
    await waitFor(() => expect(setDest).toHaveBeenCalled())
    await waitFor(() => {
      const cached = qc.getQueryData(branchQrQueryKey('branch-rest-01')) as { destination: string; url: string }
      expect(cached.destination).toBe(before!.destination)
      expect(cached.url).toBe(before!.url)
    })
  })

  it('invalidate keys exist for tenant and branch QR', () => {
    expect(tenantQrQueryKey('t1')).toEqual(['tenant-qr', 't1'])
    expect(branchQrQueryKey('b1')).toEqual(['branch-qr', 'b1'])
    expect(menuQrQueryKey('b1')).toEqual(['menu-qr', 'b1'])
    expect(reservationQrQueryKey('t1')).toEqual(['reservation-qr', 't1'])
  })
})

describe('QR destination error messages', () => {
  it('reads nested qr_invalid_destination without using the generic 400 fallback', () => {
    const err = {
      response: {
        status: 400,
        data: {
          error: { code: 'qr_invalid_destination', message: 'Invalid QR destination type.' },
        },
      },
    }
    expect(getApiErrorCode(err)).toBe('qr_invalid_destination')
    expect(getApiErrorMessage(err, 'That destination is not allowed for this QR.')).toBe(
      'Invalid QR destination type.',
    )
  })

  it('reads DRF destination_type field errors', () => {
    const err = {
      response: {
        status: 400,
        data: { destination_type: ['This field is required.'] },
      },
    }
    expect(getApiErrorCode(err)).toBeUndefined()
    expect(getApiErrorMessage(err, 'Could not update the QR destination.')).toBe(
      'destination_type: This field is required.',
    )
  })

  it('does not treat a generic 400 as qr_invalid_destination', () => {
    const err = {
      response: {
        status: 400,
        data: { message: 'Something else went wrong.' },
      },
    }
    expect(getApiErrorCode(err)).not.toBe('qr_invalid_destination')
    expect(getApiErrorMessage(err, 'Could not update the QR destination.')).toBe(
      'Something else went wrong.',
    )
  })
})

describe('QR management console page and edit surfaces', () => {
  it('registers /console/qr on shared admin routes and nav', async () => {
    const { ADMIN_QR_ROUTES, RESTAURANT_MODULE } = await import('@/modules/registry')
    expect(ADMIN_QR_ROUTES).toContain('/console/qr')
    expect(RESTAURANT_MODULE.routes).toContain('/console/qr')
    expect(RESTAURANT_MODULE.adminNavItems?.some((item) => item.href === '/console/qr')).toBe(true)
    expect(RESTAURANT_MODULE.adminNavItems?.find((item) => item.href === '/console/qr')?.icon).toBe('QrCode')
  })

  it('sidebar maps the QR icon and localized nav label', () => {
    const sidebar = readFileSync(join(ROOT, 'components/admin/AdminSidebar.tsx'), 'utf8')
    expect(sidebar).toContain('QrCode')
    expect(sidebar).toContain('item.labelKey ? t(item.labelKey) : item.label')
    const breadcrumbs = readFileSync(join(ROOT, 'components/admin/AdminBreadcrumbs.tsx'), 'utf8')
    expect(breadcrumbs).toContain("qr:           'qr'")
  })

  it('QR management page reuses QrManagementPanel and qrManagementService', () => {
    const src = readFileSync(join(ROOT, 'app/console/qr/page.tsx'), 'utf8')
    expect(src).toContain('QrManagementPanel')
    expect(src).toContain('scope="tenant"')
    expect(src).toContain('scope="branch"')
    expect(src).toContain('scope="menu"')
    expect(src).toContain('scope="reservation"')
    expect(src).toContain('qrManagementService.getBranchQr')
    expect(src).toContain('qrManagementService.getMenuQr')
    expect(src).toContain('qrManagementService.getReservationQr')
    expect(src).toContain('useTenantQr')
    expect(src).toContain('branchQrQueryKey')
    expect(src).not.toMatch(/encodeQrSvg\(.*slug/)
    expect(src).not.toContain('qrUrl={`${APP_URL}')
  })

  it('Edit Tenant hosts tenant QrManagementPanel with tenant id', () => {
    const src = readFileSync(join(ROOT, 'app/console/tenants/[tenantId]/edit/page.tsx'), 'utf8')
    expect(src).toContain('QrManagementPanel')
    expect(src).toContain('scope="tenant"')
    expect(src).toContain('entityId={tenant.id}')
    expect(src).toContain('businessQrTitle')
    expect(src).not.toMatch(/encodeQrSvg\(.*slug/)
  })

  it('Edit Branch hosts branch QrManagementPanel like Edit Tenant', () => {
    const src = readFileSync(join(ROOT, 'app/console/branches/[id]/edit/page.tsx'), 'utf8')
    expect(src).toContain('QrManagementPanel')
    expect(src).toContain('scope="branch"')
    expect(src).toContain('entityId={branch.id}')
    expect(src).toContain('branchQrTitle')
    expect(src).not.toContain('qrUrl={`${APP_URL}')
  })

  it('Console Menu hosts menu QrManagementPanel for the selected branch', () => {
    const src = readFileSync(join(ROOT, 'app/console/menu/page.tsx'), 'utf8')
    expect(src).toContain('QrManagementPanel')
    expect(src).toContain('scope="menu"')
    expect(src).toContain('entityId={adminBranchId}')
    expect(src).toContain('menuQrTitle')
  })

  it('Console Reservations list hosts reservation page QR, not booking detail', () => {
    const list = readFileSync(join(ROOT, 'app/console/reservations/page.tsx'), 'utf8')
    const detail = readFileSync(join(ROOT, 'app/console/reservations/[id]/page.tsx'), 'utf8')
    expect(list).toContain('QrManagementPanel')
    expect(list).toContain('scope="reservation"')
    expect(list).toContain('reservationQrTitle')
    expect(detail).not.toContain('QrManagementPanel')
  })

  it('filters tenant vs branch records client-side', () => {
    const records = [
      { kind: 'tenant' as const, id: 't1', name: 'Restaurant A', isActive: true },
      { kind: 'branch' as const, id: 'b1', name: 'Main Branch', isActive: false },
    ]
    expect(records.filter((r) => matchesQrListFilters(r, '', 'tenant', 'all')).map((r) => r.id)).toEqual(['t1'])
    expect(records.filter((r) => matchesQrListFilters(r, 'main', 'all', 'all')).map((r) => r.id)).toEqual(['b1'])
    expect(records.filter((r) => matchesQrListFilters(r, '', 'all', 'disabled')).map((r) => r.id)).toEqual(['b1'])
    expect(records.filter((r) => matchesQrListFilters(r, '', 'all', 'active')).map((r) => r.id)).toEqual(['t1'])
  })
})

