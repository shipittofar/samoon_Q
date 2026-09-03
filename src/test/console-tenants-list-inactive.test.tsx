import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import en from '@/i18n/locales/en.json'
import {
  countConsoleTenantsByStatus,
  filterConsoleTenantsByStatus,
  mergeConsoleTenantsWithMemberships,
  mergeTenantsById,
} from '@/lib/console-tenant-list'
import type { Tenant } from '@/types'
import type { TenantMembership } from '@/types/rbac'

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>()
  return {
    ...actual,
    useConsoleTenants: () => ({
      data: [
        {
          id: 't-active',
          name: 'Live Kitchen',
          slug: 'live-kitchen',
          businessTypes: ['restaurant'],
          status: 'ACTIVE',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 't-inactive',
          name: 'Paused Cafe',
          slug: 'paused-cafe',
          businessTypes: ['cafe'],
          status: 'INACTIVE',
          is_active: false,
          created_at: '2024-02-01T00:00:00Z',
        },
      ] satisfies Tenant[],
      isLoading: false,
    }),
    useActivateTenant: () => ({ mutate: vi.fn(), isPending: false }),
    useSuspendTenant: () => ({ mutate: vi.fn(), isPending: false }),
    useArchiveTenant: () => ({ mutate: vi.fn(), isPending: false }),
    usePermission: () => true,
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/console/tenants',
  useSearchParams: () => new URLSearchParams(),
}))

const ACTIVE: Tenant = {
  id: 't-active',
  name: 'Live Kitchen',
  slug: 'live-kitchen',
  businessTypes: ['restaurant'],
  status: 'ACTIVE',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
}

const INACTIVE: Tenant = {
  id: 't-inactive',
  name: 'Paused Cafe',
  slug: 'paused-cafe',
  businessTypes: ['cafe'],
  status: 'INACTIVE',
  is_active: false,
  created_at: '2024-02-01T00:00:00Z',
}

const INACTIVE_MEMBERSHIP: TenantMembership = {
  tenantId: 't-membership-inactive',
  tenantName: 'Membership Only',
  tenantSlug: 'membership-only',
  tenantStatus: 'INACTIVE',
  roles: ['owner'],
  branchAccess: { scope: 'all' },
}

describe('console tenant list — include inactive', () => {
  it('mergeTenantsById keeps INACTIVE rows and does not overwrite earlier records', () => {
    const merged = mergeTenantsById([[ACTIVE], [INACTIVE, { ...ACTIVE, name: 'Should Not Win' }]])
    expect(merged).toHaveLength(2)
    expect(merged.find((t) => t.id === 't-active')?.name).toBe('Live Kitchen')
    expect(merged.some((t) => t.status === 'INACTIVE')).toBe(true)
  })

  it('mergeConsoleTenantsWithMemberships adds membership-only inactive tenants', () => {
    const merged = mergeConsoleTenantsWithMemberships([ACTIVE], [INACTIVE_MEMBERSHIP])
    expect(merged.map((t) => t.id)).toEqual(['t-active', 't-membership-inactive'])
    expect(merged.find((t) => t.id === 't-membership-inactive')?.status).toBe('INACTIVE')
  })

  it('status filter defaults to all and can isolate Inactive', () => {
    const all = filterConsoleTenantsByStatus([ACTIVE, INACTIVE], 'all')
    expect(all).toHaveLength(2)
    const onlyInactive = filterConsoleTenantsByStatus([ACTIVE, INACTIVE], 'INACTIVE')
    expect(onlyInactive).toHaveLength(1)
    expect(onlyInactive[0]!.id).toBe('t-inactive')
  })

  it('analytics counts inactive separately from closed', () => {
    const counts = countConsoleTenantsByStatus([
      ACTIVE,
      INACTIVE,
      { ...INACTIVE, id: 't-closed', status: 'CLOSED' },
    ])
    expect(counts).toEqual({ total: 3, active: 1, inactive: 1, closed: 1 })
  })
})

describe('getConsoleTenants real mode — no active-only API filter', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_USE_MOCK = 'false'
  })

  async function freshTenantServiceRealMode() {
    vi.resetModules()
    process.env.NEXT_PUBLIC_USE_MOCK = 'false'
    vi.doMock('@/services/axios.instance', () => ({
      default: {
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        put: vi.fn(),
      },
    }))
    const mod = await import('@/services/tenant.service')
    const axiosMod = await import('@/services/axios.instance')
    return {
      tenantService: mod.tenantService,
      api: axiosMod.default as unknown as { get: ReturnType<typeof vi.fn> },
    }
  }

  const RAW_ACTIVE = {
    id: 't-active',
    name: 'Live Kitchen',
    slug: 'live-kitchen',
    business_types: ['restaurant'],
    status: 'ACTIVE',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  }
  const RAW_INACTIVE = {
    id: 't-inactive',
    name: 'Paused Cafe',
    slug: 'paused-cafe',
    business_types: ['cafe'],
    status: 'INACTIVE',
    is_active: false,
    created_at: '2024-02-01T00:00:00Z',
  }

  it('does not send is_active or status query params', async () => {
    const { tenantService, api } = await freshTenantServiceRealMode()
    api.get
      .mockResolvedValueOnce({ data: { results: [RAW_ACTIVE, RAW_INACTIVE] } })
      .mockResolvedValueOnce({ data: { results: [RAW_INACTIVE] } })

    const tenants = await tenantService.getConsoleTenants()
    expect(tenants.some((t) => t.status === 'INACTIVE')).toBe(true)
    expect(api.get.mock.calls[0]?.[0]).toBe('/tenants/console-tenants/')
    expect(api.get.mock.calls[1]?.[0]).toBe('/tenants/me/')
    for (const call of api.get.mock.calls) {
      expect(call[1]?.params?.is_active).toBeUndefined()
      expect(call[1]?.params?.status).toBeUndefined()
    }
  })

  it('merges INACTIVE tenants from /tenants/me/ when console-tenants omitted them', async () => {
    const { tenantService, api } = await freshTenantServiceRealMode()
    api.get
      .mockResolvedValueOnce({ data: { results: [RAW_ACTIVE] } })
      .mockResolvedValueOnce({ data: { results: [RAW_INACTIVE] } })

    const tenants = await tenantService.getConsoleTenants()
    expect(tenants.map((t) => t.id).sort()).toEqual(['t-active', 't-inactive'])
    expect(tenants.find((t) => t.id === 't-inactive')?.status).toBe('INACTIVE')
  })

  it('getMyTenants uses /tenants/me/ and keeps INACTIVE', async () => {
    const { tenantService, api } = await freshTenantServiceRealMode()
    api.get.mockResolvedValueOnce({ data: { results: [RAW_ACTIVE, RAW_INACTIVE] } })

    const tenants = await tenantService.getMyTenants()
    expect(api.get).toHaveBeenCalledWith('/tenants/me/')
    expect(tenants.some((t) => t.status === 'INACTIVE')).toBe(true)
  })
})

function withProviders(node: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={en}>
        {node}
      </NextIntlClientProvider>
    </QueryClientProvider>
  )
}

describe('AdminTenantsPage renders inactive rows', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_USE_MOCK = 'true'
  })

  it('shows Active and Inactive status badges and both tenant names', async () => {
    const { default: AdminTenantsPage } = await import('@/app/console/tenants/page')
    render(withProviders(<AdminTenantsPage />))
    expect(screen.getByText('Live Kitchen')).toBeTruthy()
    expect(screen.getByText('Paused Cafe')).toBeTruthy()
    expect(screen.getAllByText(en.console.statusActive).length).toBeGreaterThan(0)
    expect(screen.getAllByText(en.console.statusInactive).length).toBeGreaterThan(0)
  })
})
