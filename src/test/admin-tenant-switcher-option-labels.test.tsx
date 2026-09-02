import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import en from '@/i18n/locales/en.json'
import { AdminTenantSwitcher } from '@/components/admin/AdminTenantSwitcher'
import { getTenantSelectorOptionLabel } from '@/lib/console-tenant-display'
import { normalizeGetMeResponse } from '@/lib/auth-me-normalizer'
import { useRbacStore, useTenantStore } from '@/stores'
import { useConsoleWorkspaceStore } from '@/stores/console-workspace'
import type { TenantMembership } from '@/types/rbac'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/console',
  useSearchParams: () => new URLSearchParams(),
}))

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

const ME_WIRE = {
  user: {
    id: 'u1',
    email: 'owner@samoon.com',
    first_name: 'Olivia',
    last_name: 'Owner',
    accountType: 'business' as const,
    is_verified: true,
    created_at: '2024-01-01T00:00:00.000Z',
  },
  memberships: [
    {
      tenantId: 'tenant-a',
      tenantName: 'Samoon Restaurant',
      tenantSlug: 'samoon-restaurant',
      roles: ['owner'],
      branchAccess: { scope: 'all' },
    },
    {
      tenantId: 'tenant-b',
      tenantName: 'Brew Cafe',
      tenantSlug: 'brew-cafe',
      roles: ['manager'],
      branchAccess: { scope: 'all' },
    },
  ],
}

const SLUG_ONLY_A: TenantMembership = {
  tenantId: 'tenant-a',
  tenantSlug: 'tenant-a',
  roles: ['owner'],
  branchAccess: { scope: 'all' },
}

const SLUG_ONLY_B: TenantMembership = {
  tenantId: 'tenant-b',
  tenantSlug: 'tenant-b',
  roles: ['manager'],
  branchAccess: { scope: 'all' },
}

async function openSwitcher() {
  const user = userEvent.setup()
  const trigger = await screen.findByRole('button', { name: /switch tenant/i })
  await waitFor(() => expect(trigger).not.toBeDisabled())
  await user.click(trigger)
  return user
}

function optionLabels(): string[] {
  return screen.getAllByRole('option').map((el) => {
    const title = el.querySelector('p.font-medium')
    return (title?.textContent ?? el.textContent ?? '').trim()
  })
}

describe('getTenantSelectorOptionLabel', () => {
  it('prefers tenantName over slug', () => {
    expect(
      getTenantSelectorOptionLabel({
        tenantId: 'tenant-a',
        tenantSlug: 'samoon-restaurant',
        tenantName: 'Samoon Restaurant',
      }),
    ).toBe('Samoon Restaurant')
  })

  it('falls back to slug then id when tenantName is absent', () => {
    expect(
      getTenantSelectorOptionLabel({ tenantId: 'tenant-a', tenantSlug: 'tenant-a' }),
    ).toBe('tenant-a')
    expect(getTenantSelectorOptionLabel({ tenantId: 'tenant-a' })).toBe('tenant-a')
  })
})

describe('AdminTenantSwitcher option labels from /auth/me tenantName', () => {
  beforeEach(() => {
    useRbacStore.getState()._resetStore()
    useTenantStore.setState({
      tenant: null,
      tenantState: 'not_found',
      isLoading: false,
    } as never)
    useConsoleWorkspaceStore.setState({
      workspacePhase: 'ready',
      _bootstrapped: true,
      _switching: false,
      workspaceError: null,
    } as never)
  })

  function seedFromMeWire() {
    const me = normalizeGetMeResponse(ME_WIRE)
    useRbacStore.getState().setSessionMemberships(me.memberships ?? [], null)
    return me
  }

  it('1 — /auth/me membership with tenantName renders the name, not the slug', async () => {
    const me = seedFromMeWire()
    expect(me.memberships?.[0]?.tenantName).toBe('Samoon Restaurant')
    expect(useRbacStore.getState().sessionMemberships?.[0]?.tenantName).toBe('Samoon Restaurant')

    render(withProviders(<AdminTenantSwitcher />))
    await openSwitcher()

    const labels = optionLabels()
    expect(labels).toContain('Samoon Restaurant')
    expect(labels).not.toContain('samoon-restaurant')
  })

  it('2 — multiple memberships render independent tenantNames', async () => {
    seedFromMeWire()
    render(withProviders(<AdminTenantSwitcher />))
    await openSwitcher()

    const labels = optionLabels()
    expect(labels).toContain('Samoon Restaurant')
    expect(labels).toContain('Brew Cafe')
    expect(labels).not.toContain('samoon-restaurant')
    expect(labels).not.toContain('brew-cafe')
  })

  it('3 — names still render when useTenantStore.tenant is null', async () => {
    seedFromMeWire()
    expect(useTenantStore.getState().tenant).toBeNull()
    render(withProviders(<AdminTenantSwitcher />))
    await openSwitcher()

    expect(optionLabels()).toEqual(expect.arrayContaining(['Samoon Restaurant', 'Brew Cafe']))
  })

  it('4 — selected Tenant A must not overwrite membership B tenantName', async () => {
    const me = normalizeGetMeResponse(ME_WIRE)
    useRbacStore.getState().setSessionMemberships(me.memberships ?? [], { tenantId: 'tenant-a' })
    useTenantStore.setState({
      tenant: {
        id: 'tenant-a',
        name: 'Samoon Restaurant',
        slug: 'samoon-restaurant',
        businessTypes: [],
        status: 'ACTIVE',
        created_at: '',
      },
      tenantState: 'resolved',
      isLoading: false,
    } as never)

    render(withProviders(<AdminTenantSwitcher />))
    await openSwitcher()

    const labels = optionLabels()
    expect(labels).toContain('Samoon Restaurant')
    expect(labels).toContain('Brew Cafe')
    expect(labels.filter((l) => l === 'Brew Cafe')).toHaveLength(1)
  })

  it('slug is only used when tenantName is missing', async () => {
    useRbacStore.getState().setSessionMemberships([SLUG_ONLY_A, SLUG_ONLY_B], null)
    render(withProviders(<AdminTenantSwitcher />))
    await openSwitcher()
    expect(optionLabels()).toEqual(expect.arrayContaining(['tenant-a', 'tenant-b']))
  })
})
