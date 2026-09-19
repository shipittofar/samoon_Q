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
import { qrManagementService } from '@/services/qr-management.service'
import { tenantQrQueryKey, branchQrQueryKey, matchesQrListFilters } from '@/lib/qr-management'
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
      destination: 'menu',
    })
    expect(after.code).toBe(before!.code)
    expect(after.url).toBe(before!.url)
    expect(after.destination).toBe('menu')
  })

  it('does not allow tenant QR to target a branch destination', async () => {
    await qrManagementService.getTenantQr('tenant-samoon-01')
    await expect(
      qrManagementService.setTenantQrDestination('tenant-samoon-01', { destination: 'menu' }),
    ).rejects.toMatchObject({ response: { status: 400 } })
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
    expect(getByText(/printed copies will need to be replaced/i)).toBeTruthy()
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
    const { getByTestId } = renderQrPanel(
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
    await waitFor(() => expect(setDest).toHaveBeenCalledWith('branch-rest-01', { destination: 'menu' }))
    await waitFor(() => expect(getByTestId('qr-destination-select')).toHaveValue('menu'))
    expect(getByTestId('qr-code-value').textContent).toBe(before!.code)
    expect(getByTestId('qr-resolver-url').textContent).toBe(before!.url)
  })

  it('tenant destination stays read-only', async () => {
    const { queryByTestId, getByTestId } = renderQrPanel(
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
  })

  it('invalidate keys exist for tenant and branch QR', () => {
    expect(tenantQrQueryKey('t1')).toEqual(['tenant-qr', 't1'])
    expect(branchQrQueryKey('b1')).toEqual(['branch-qr', 'b1'])
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
    expect(src).toContain('qrManagementService.getBranchQr')
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

