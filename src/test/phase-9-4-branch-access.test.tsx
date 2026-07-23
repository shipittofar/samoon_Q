// ============================================================
// Phase 9.4 — Branch Access Integration (Defense-in-Depth Only)
//
// canAccessBranch()/useBranchAccess() are a UX/defense-in-depth signal
// ONLY — the backend remains the sole enforcement point for every
// branch-scoped request. These tests prove: the evaluation rules
// (scope:'all' / scope:'assigned' / missing -> deny), that
// AdminBranchSwitcher never lists an inaccessible branch, and that a
// direct URL to a branch outside branchAccess never fires the
// branch-scoped data hooks (BranchAnalyticsPage never mounts its content
// component, so useAdminBranch()/useBranchAnalytics() are never called).
// ============================================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, renderHook, act } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useRbacStore, useTenantStore, useBranchStore } from '@/stores'
import { canAccessBranch } from '@/services/permission.service'
import { useBranchAccess } from '@/hooks'
import type { BranchAccess } from '@/types/rbac'
import type { Branch as AdminBranch } from '@/types/branch'

// Phase 9.4 — only useAdminBranch()/useBranchAnalytics() are stubbed (as
// pure call-spies); every other export of '@/hooks' — including the real
// useBranchAccess(), useSelectedBranch(), useBranchState(), etc. — passes
// through unchanged via `...actual`. vi.hoisted() is required here
// because the mock factory (hoisted above these imports by Vitest) closes
// over these spies; a plain `const` declared later would be in the
// temporal dead zone when the factory first runs.
const { useAdminBranchSpy, useBranchAnalyticsSpy } = vi.hoisted(() => ({
  useAdminBranchSpy: vi.fn(),
  useBranchAnalyticsSpy: vi.fn(),
}))

vi.mock('@/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks')>()
  return {
    ...actual,
    useAdminBranch: (...args: unknown[]) => {
      useAdminBranchSpy(...args)
      return { data: undefined, isLoading: false }
    },
    useBranchAnalytics: (...args: unknown[]) => {
      useBranchAnalyticsSpy(...args)
      return { data: undefined, isLoading: false }
    },
  }
})

function withIntl(node: React.ReactNode) {
  return <NextIntlClientProvider locale="en" messages={{ console: {}, common: {} }}>{node}</NextIntlClientProvider>
}

function withProviders(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{withIntl(node)}</QueryClientProvider>
}

describe('Phase 9.4 — canAccessBranch() evaluation rules (the single implementation)', () => {
  it('scope: "all" grants access to any branch id', () => {
    const access: BranchAccess = { scope: 'all' }
    expect(canAccessBranch(access, 'branch-1')).toBe(true)
    expect(canAccessBranch(access, 'branch-999')).toBe(true)
  })

  it('scope: "assigned" grants only listed branch ids', () => {
    const access: BranchAccess = { scope: 'selected', branchIds: ['branch-1'] }
    expect(canAccessBranch(access, 'branch-1')).toBe(true)
    expect(canAccessBranch(access, 'branch-2')).toBe(false)
  })

  it('a missing/null branchAccess denies by default — never an implicit allow', () => {
    expect(canAccessBranch(undefined, 'branch-1')).toBe(false)
    expect(canAccessBranch(null, 'branch-1')).toBe(false)
  })

  it('a missing/empty branchId is denied even with scope:"all"', () => {
    expect(canAccessBranch({ scope: 'all' }, undefined)).toBe(false)
    expect(canAccessBranch({ scope: 'all' }, '')).toBe(false)
  })
})

describe('Phase 9.4 — useBranchAccess() reads ONLY currentTenantSession.branchAccess', () => {
  beforeEach(() => {
    useRbacStore.getState()._resetStore()
    useTenantStore.setState({ tenant: { id: 'tenant-1' } as never, tenantState: 'resolved' } as never)
  })

  it('Owner (scope: "all") can access every branch', () => {
    useRbacStore.getState().setCurrentTenantSession('tenant-1', ['owner'], [], { scope: 'all' })
    const { result: r1 } = renderHook(() => useBranchAccess('branch-1'))
    const { result: r2 } = renderHook(() => useBranchAccess('branch-2'))
    expect(r1.current).toBe(true)
    expect(r2.current).toBe(true)
  })

  it('an assigned user (branchIds: ["branch-1"]) can access branch-1 but not branch-2', () => {
    useRbacStore.getState().setCurrentTenantSession('tenant-1', ['manager'], [], { scope: 'selected', branchIds: ['branch-1'] })
    const { result: r1 } = renderHook(() => useBranchAccess('branch-1'))
    const { result: r2 } = renderHook(() => useBranchAccess('branch-2'))
    expect(r1.current).toBe(true)
    expect(r2.current).toBe(false)
  })

  it('no currentTenantSession at all denies every branch', () => {
    const { result } = renderHook(() => useBranchAccess('branch-1'))
    expect(result.current).toBe(false)
  })

  it('a currentTenantSession scoped to a DIFFERENT tenant denies every branch (no cross-tenant leak)', () => {
    useRbacStore.getState().setCurrentTenantSession('some-other-tenant', ['owner'], [], { scope: 'all' })
    const { result } = renderHook(() => useBranchAccess('branch-1'))
    expect(result.current).toBe(false)
  })
})

describe('Phase 9.4 — AdminBranchSwitcher never renders a forbidden branch', () => {
  beforeEach(() => {
    useRbacStore.getState()._resetStore()
    useTenantStore.setState({ tenant: { id: 'tenant-1', name: 'Test Tenant' } as never, tenantState: 'resolved' } as never)
    const branches: AdminBranch[] = [
      { id: 'branch-1', name: 'Branch One', status: 'active', location: { address: '1 Main St' } } as never,
      { id: 'branch-2', name: 'Branch Two', status: 'active', location: { address: '2 Main St' } } as never,
    ]
    useBranchStore.setState({ branches, selectedBranch: null, branchState: 'ready' } as never)
  })

  it('lists only the accessible branch in the dropdown', async () => {
    useRbacStore.getState().setCurrentTenantSession('tenant-1', ['manager'], [], { scope: 'selected', branchIds: ['branch-1'] })
    const { AdminBranchSwitcher } = await import('@/components/admin/AdminBranchSwitcher')
    render(withProviders(<AdminBranchSwitcher />))
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByText('Branch One')).toBeTruthy()
    expect(screen.queryByText('Branch Two')).toBeNull()
  })

  it('lists both branches when scope is "all"', async () => {
    useRbacStore.getState().setCurrentTenantSession('tenant-1', ['owner'], [], { scope: 'all' })
    const { AdminBranchSwitcher } = await import('@/components/admin/AdminBranchSwitcher')
    render(withProviders(<AdminBranchSwitcher />))
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByText('Branch One')).toBeTruthy()
    expect(screen.getByText('Branch Two')).toBeTruthy()
  })

  it('disables the switcher entirely when branchAccess is missing (no currentTenantSession)', async () => {
    const { AdminBranchSwitcher } = await import('@/components/admin/AdminBranchSwitcher')
    render(withProviders(<AdminBranchSwitcher />))
    const button = screen.getAllByRole('button')[0] as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })
})

describe('Phase 9.4 — direct URL to an inaccessible branch never fires the branch-scoped query', () => {
  beforeEach(() => {
    useAdminBranchSpy.mockClear()
    useBranchAnalyticsSpy.mockClear()
    useRbacStore.getState()._resetStore()
    useTenantStore.setState({ tenant: { id: 'tenant-1' } as never, tenantState: 'resolved' } as never)
  })

  it('navigating to branch-2 while only branch-1 is accessible never calls useAdminBranch()/useBranchAnalytics()', async () => {
    useRbacStore.getState().setCurrentTenantSession('tenant-1', ['manager'], ['branches.view'] as never, { scope: 'selected', branchIds: ['branch-1'] })
    const { default: BranchAnalyticsPage } = await import('@/app/console/branches/[id]/analytics/page')
    await act(async () => {
      render(withIntl(<BranchAnalyticsPage params={Promise.resolve({ id: 'branch-2' })} />))
    })
    expect(useAdminBranchSpy).not.toHaveBeenCalled()
    expect(useBranchAnalyticsSpy).not.toHaveBeenCalled()
  })

  it('navigating to branch-1 (accessible) does call the branch-scoped hooks', async () => {
    useRbacStore.getState().setCurrentTenantSession('tenant-1', ['manager'], ['branches.view'] as never, { scope: 'selected', branchIds: ['branch-1'] })
    const { default: BranchAnalyticsPage } = await import('@/app/console/branches/[id]/analytics/page')
    await act(async () => {
      render(withIntl(<BranchAnalyticsPage params={Promise.resolve({ id: 'branch-1' })} />))
    })
    expect(useAdminBranchSpy).toHaveBeenCalledWith('branch-1')
    expect(useBranchAnalyticsSpy).toHaveBeenCalledWith('branch-1')
  })
})
