import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test/test-utils'
import { QrCodeDisplay } from '@/components/qr/QrCodeDisplay'
import { CopyUrlWidget } from '@/components/marketplace/CopyUrlWidget'
import { isHttpQrUrl } from '@/lib/qr-url'
import { encodeQrSvg } from '@/lib/qr-svg'
import { DEFAULT_BRANCH_CHECKOUT } from '@/lib/branch-checkout'
import type { Tenant } from '@/types'
import type { Branch } from '@/types/branch'
import { readFileSync } from 'fs'
import { join } from 'path'

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
})

describe('QrCodeDisplay', () => {
  it('encodes the exact qr.url', async () => {
    const { getByTestId } = renderWithIntl(<QrCodeDisplay url={QR_URL} />)
    await waitFor(() => expect(getByTestId('qr-code-svg')).toBeTruthy())
    expect(encodeQrSvg).toHaveBeenCalledWith(QR_URL)
    expect(getByTestId('qr-code-svg').innerHTML).toContain(QR_URL)
    expect(getByTestId('qr-code-display').getAttribute('data-qr-url')).toBe(QR_URL)
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
    expect(src).toContain('tenant.qr?.url')
    expect(src).toContain('businessQrTitle')
    expect(src).not.toMatch(/encodeQrSvg\(.*slug/)
  })

  it('branch detail shows a QR section bound to branch.qr.url', () => {
    const src = readFileSync(join(ROOT, 'app/console/branches/[id]/page.tsx'), 'utf8')
    expect(src).toContain('branchQrTitle')
    expect(src).toContain('branch.qr?.url')
    expect(src).not.toContain('qrUrl={`${APP_URL}')
  })

  it('settings General tab passes tenant.qr.url into CopyUrlWidget', () => {
    const src = readFileSync(join(ROOT, 'app/console/settings/page.tsx'), 'utf8')
    expect(src).toContain('qrUrl={tenant?.qr?.url}')
    expect(src).toContain('businessQrTitle')
    const widget = readFileSync(join(ROOT, 'components/marketplace/CopyUrlWidget.tsx'), 'utf8')
    expect(widget).not.toContain('qrCodeMobileNote')
  })
})
