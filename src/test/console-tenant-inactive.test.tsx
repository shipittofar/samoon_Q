import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import en from '@/i18n/locales/en.json'
import { AdminTenantSwitcher } from '@/components/admin/AdminTenantSwitcher'
import {
  ConsoleWorkspaceGate,
  resolveConsoleTenantPhase,
} from '@/components/admin/ConsoleWorkspaceGate'
import { requestConsoleTenantSwitch } from '@/hooks/console-workspace'
import { isConsoleTenantSelectable } from '@/lib/console-tenant-access'
import { authService } from '@/services/auth.service'
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

const ACTIVE: TenantMembership = {
  tenantId: 'tenant-1',
  tenantName: 'Samoon',
  tenantSlug: 'samoon',
  tenantStatus: 'ACTIVE',
  roles: ['owner'],
  branchAccess: { scope: 'all' },
}

const INACTIVE: TenantMembership = {
  tenantId: 'tenant-2',
  tenantName: 'Paused Cafe',
  tenantSlug: 'paused-cafe',
  tenantStatus: 'INACTIVE',
  roles: ['owner'],
  branchAccess: { scope: 'all' },
}

beforeEach(() => {
  useRbacStore.getState()._resetStore()
  useTenantStore.getState().reset()
  useConsoleWorkspaceStore.getState().resetWorkspace()
  vi.restoreAllMocks()
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

describe('inactive Console Tenant access', () => {
  it('1 — active Tenant is selectable', () => {
    expect(isConsoleTenantSelectable(ACTIVE)).toBe(true)
  })

  it('2 — inactive Tenant is not selectable', () => {
    expect(isConsoleTenantSelectable(INACTIVE)).toBe(false)
  })

  it('3 — clicking an inactive option does not call switchActiveTenant', async () => {
    const switchSpy = vi.spyOn(authService, 'switchActiveTenant').mockResolvedValue(undefined)
    useRbacStore.getState().setSessionMemberships([ACTIVE, INACTIVE], { tenantId: 'tenant-1' })
    useRbacStore.getState().setHasTenantMembership(true)

    render(withProviders(<AdminTenantSwitcher />))
    await userEvent.click(await screen.findByRole('button', { name: /switch tenant/i }))
    const inactiveOption = screen.getByRole('option', { name: /Paused Cafe/i })
    expect(inactiveOption).toBeDisabled()
    await userEvent.click(inactiveOption)
    expect(switchSpy).not.toHaveBeenCalled()
  })

  it('4 — programmatic switch to an inactive Tenant is rejected', async () => {
    const switchSpy = vi.spyOn(authService, 'switchActiveTenant').mockResolvedValue(undefined)
    useRbacStore.getState().setSessionMemberships([ACTIVE, INACTIVE], { tenantId: 'tenant-1' })
    await requestConsoleTenantSwitch('tenant-2')
    expect(switchSpy).not.toHaveBeenCalled()
    expect(useRbacStore.getState().activeMembership?.tenantId).toBe('tenant-1')
  })

  it('5 — active inactive Tenant is tenant_inactive, not tenant_not_found', () => {
    expect(
      resolveConsoleTenantPhase({
        hasTenantMembership: true,
        sessionMembershipCount: 2,
        activeTenantId: 'tenant-2',
        resolvedTenantId: 'tenant-2',
        tenantState: 'resolved',
        hasDashboardAccess: true,
        retryCount: 0,
        activeTenantInactive: true,
        hasSelectableTenant: true,
      }),
    ).toBe('tenant_inactive')
  })

  it('5b — phase tenant_inactive is distinct from not_found', () => {
    expect(
      resolveConsoleTenantPhase({
        hasTenantMembership: true,
        sessionMembershipCount: 1,
        activeTenantId: 'tenant-2',
        resolvedTenantId: null,
        tenantState: 'not_found',
        hasDashboardAccess: true,
        retryCount: 0,
        activeTenantInactive: true,
        hasSelectableTenant: false,
      }),
    ).toBe('tenant_inactive')
  })

  it('6 — inactive current Tenant does not render console workspace children', () => {
    useRbacStore.getState().setHasTenantMembership(true)
    useRbacStore.getState().setSessionMemberships([INACTIVE], { tenantId: 'tenant-2' })
    useTenantStore.setState({
      tenant: {
        id: 'tenant-2',
        name: 'Paused Cafe',
        slug: 'paused-cafe',
        businessTypes: [],
        status: 'INACTIVE',
        created_at: '',
      },
      tenantState: 'resolved',
    } as never)
    useRbacStore.getState().setCurrentTenantSession('tenant-2', ['owner'], ['dashboard:access'], { scope: 'all' })

    render(withProviders(
      <ConsoleWorkspaceGate>
        <div>Console Workspace</div>
      </ConsoleWorkspaceGate>,
    ))
    expect(screen.getByText(en.console.tenantInactiveTitle)).toBeTruthy()
    expect(screen.queryByText(en.console.tenantNotFoundTitle)).toBeNull()
    expect(screen.queryByText('Console Workspace')).toBeNull()
  })

  it('7 — another active Tenant remains selectable', () => {
    expect(isConsoleTenantSelectable(ACTIVE)).toBe(true)
    expect(isConsoleTenantSelectable(INACTIVE)).toBe(false)
  })

  it('8 — switching to an active Tenant still calls the mutation', async () => {
    const switchSpy = vi.spyOn(authService, 'switchActiveTenant').mockResolvedValue(undefined)
    vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: {
        id: 'u1',
        email: 'a@b.com',
        first_name: 'A',
        last_name: 'B',
        accountType: 'business',
        is_verified: true,
        created_at: '',
      },
      memberships: [ACTIVE, INACTIVE],
      activeMembership: { ...ACTIVE },
    } as never)
    useRbacStore.getState().setSessionMemberships([ACTIVE, INACTIVE], { tenantId: 'tenant-2' })
    await requestConsoleTenantSwitch('tenant-1')
    expect(switchSpy).toHaveBeenCalledWith({ tenantId: 'tenant-1' })
  })

  it('9 — genuine not_found without an inactive flag stays awaiting selection', () => {
    expect(
      resolveConsoleTenantPhase({
        hasTenantMembership: true,
        sessionMembershipCount: 2,
        activeTenantId: null,
        resolvedTenantId: null,
        tenantState: 'not_found',
        hasDashboardAccess: true,
        retryCount: 0,
        activeTenantInactive: false,
        hasSelectableTenant: true,
      }),
    ).toBe('tenant_awaiting_selection')
  })
})
