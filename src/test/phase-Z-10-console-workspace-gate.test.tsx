// ============================================================
// Phase Z.10 — Console Tenant Dependency Redesign
//
// Console is an application workspace, not a tenant-gated page. Before
// this phase, AuthGuard's `requireResolvedTenant` blocked ALL of
// Console's chrome until `tenantState === 'resolved'` — a business owner
// with ZERO tenant memberships (a brand-new signup) could never see
// Console at all, only a "Tenant not found" error indistinguishable from
// a real routing bug. See docs/CONSOLE_TENANT_DEPENDENCY_REDESIGN_AUDIT.md.
//
// This file proves the three required scenarios:
//   1. Business owner WITH a tenant: Console loads, tenant switcher
//      appears, permissions work (dashboard:access-gated content renders).
//   2. Business user WITHOUT a tenant: Console loads (not blocked),
//      onboarding state appears instead of "Tenant not found".
//   3. Public tenant storefront: subdomain-based tenant resolution
//      ([tenantSlug]/layout.tsx) is untouched by this phase.
// ============================================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import en from '@/i18n/locales/en.json'
import { useAuthStore, useTenantStore, useRbacStore } from '@/stores'
import { authService } from '@/services/auth.service'
import { normalizeTenantPermissions } from '@/services/permission.service'
import { ConsoleWorkspaceGate } from '@/components/admin/ConsoleWorkspaceGate'
import { AdminTenantSwitcher } from '@/components/admin/AdminTenantSwitcher'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/console',
  useSearchParams: () => new URLSearchParams(),
}))

function withProviders(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={en}>{node}</NextIntlClientProvider>
    </QueryClientProvider>
  )
}

function businessUser() {
  return {
    id: 'u1', email: 'owner@example.com', first_name: 'Test', last_name: 'Owner',
    accountType: 'business' as const, is_verified: true, created_at: new Date().toISOString(),
  }
}

const SAMOON = { id: 'tenant-samoon-01', slug: 'samoon', name: 'Samoon Restaurant' }

beforeEach(() => {
  useRbacStore.getState()._resetStore()
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, sessionCheckFailed: false })
  useTenantStore.setState({ tenant: null, tenantState: 'loading' } as never)
})

describe('Phase Z.10 — Scenario 1: business owner WITH a tenant', () => {
  it('business owner WITH a tenant: Console loads (children render) and dashboard:access-gated content is visible — permissions work', () => {
    useAuthStore.setState({ user: businessUser(), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })
    useTenantStore.setState({ tenant: SAMOON as never, tenantState: 'resolved' } as never)
    const { roles, permissions, branchAccess } = normalizeTenantPermissions({ roles: ['owner', 'admin'] }, SAMOON.id)
    useRbacStore.getState().setCurrentTenantSession(SAMOON.id, roles, permissions, branchAccess)
    useRbacStore.getState().setHasTenantMembership(true)
    useRbacStore.getState().setSessionMemberships([{ tenantId: SAMOON.id, roles: ['owner', 'admin'], branchAccess: { scope: 'all' } }], { tenantId: SAMOON.id })

    render(withProviders(
      <ConsoleWorkspaceGate><div>Console Workspace</div></ConsoleWorkspaceGate>,
    ))

    expect(screen.getByText('Console Workspace')).toBeTruthy()
  })

  it('the tenant switcher (tenant.view-gated, owner role) appears in the workspace', async () => {
    useAuthStore.setState({ user: businessUser(), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })
    useTenantStore.setState({ tenant: SAMOON as never, tenantState: 'resolved' } as never)
    const { roles, permissions, branchAccess } = normalizeTenantPermissions({ roles: ['owner'] }, SAMOON.id)
    useRbacStore.getState().setCurrentTenantSession(SAMOON.id, roles, permissions, branchAccess)
    useRbacStore.getState().setHasTenantMembership(true)
    useRbacStore.getState().setSessionMemberships([{ tenantId: SAMOON.id, roles: ['owner'], branchAccess: { scope: 'all' } }], { tenantId: SAMOON.id })

    render(withProviders(
      <ConsoleWorkspaceGate><AdminTenantSwitcher /></ConsoleWorkspaceGate>,
    ))

    const trigger = await screen.findByRole('button', { name: /switchTenantAria|Switch tenant/i })
    expect(trigger).toBeTruthy()
  })

  it('a business owner WITHOUT dashboard:access (no role/session set) sees AccessDenied, not the workspace — RBAC unchanged', () => {
    useAuthStore.setState({ user: businessUser(), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })
    useTenantStore.setState({ tenant: SAMOON as never, tenantState: 'resolved' } as never)
    useRbacStore.getState().setHasTenantMembership(true)
    useRbacStore.getState().setSessionMemberships([{ tenantId: SAMOON.id, roles: ['owner'], branchAccess: { scope: 'all' } }], { tenantId: SAMOON.id })
    // No currentTenantSession set — no permission grant.

    render(withProviders(
      <ConsoleWorkspaceGate><div>Console Workspace</div></ConsoleWorkspaceGate>,
    ))

    expect(screen.queryByText('Console Workspace')).toBeNull()
    expect(screen.getByText('Access denied')).toBeTruthy()
  })
})

describe('Phase Z.10 — Scenario 2: business user WITHOUT a tenant', () => {
  it('/console loads (does not block on tenant resolution) and shows the onboarding state, not "Tenant not found"', () => {
    useAuthStore.setState({ user: businessUser(), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })
    // tenantState left at its default 'loading' / never resolves — exactly
    // what happens for a zero-membership user (no subdomain match, no
    // membership to fall back to).
    useRbacStore.getState().setHasTenantMembership(false)

    render(withProviders(
      <ConsoleWorkspaceGate><div>Console Workspace</div></ConsoleWorkspaceGate>,
    ))

    expect(screen.getByText(en.console.onboardingTitle)).toBeTruthy()
    expect(screen.queryByText('Console Workspace')).toBeNull()
    expect(screen.queryByText(en.console.tenantNotFoundTitle)).toBeNull()
  })

  it('renders nothing yet (waits) while hasTenantMembership is still unknown (null) — no premature onboarding flash', () => {
    useAuthStore.setState({ user: businessUser(), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })
    // hasTenantMembership defaults to null after _resetStore() in beforeEach.

    render(withProviders(
      <ConsoleWorkspaceGate><div>Console Workspace</div></ConsoleWorkspaceGate>,
    ))

    expect(screen.queryByText('Console Workspace')).toBeNull()
    expect(screen.queryByText(en.console.onboardingTitle)).toBeNull()
  })
})

describe('Phase Z.10 — a real tenant-resolution failure (has membership, but the specific tenant is unusable) is distinct from onboarding', () => {
  it('hasTenantMembership true + tenantState "not_found" shows the tenant error, not onboarding', () => {
    useAuthStore.setState({ user: businessUser(), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })
    useTenantStore.setState({ tenant: null, tenantState: 'not_found', lastAttemptedSlug: 'ghost' } as never)
    useRbacStore.getState().setHasTenantMembership(true)
    useRbacStore.getState().setSessionMemberships([{ tenantId: 't1', roles: ['owner'], branchAccess: { scope: 'all' } }], { tenantId: 't1' })

    render(withProviders(
      <ConsoleWorkspaceGate><div>Console Workspace</div></ConsoleWorkspaceGate>,
    ))

    expect(screen.getByText(en.console.tenantNotFoundTitle)).toBeTruthy()
    expect(screen.queryByText(en.console.onboardingTitle)).toBeNull()
    expect(screen.queryByText('Console Workspace')).toBeNull()
  })
})

describe('Phase Z.10 — tenant selection cases (activeMembership vs memberships)', () => {
  it('Case 1: activeMembership.tenantId resolves and workspace renders when tenant is loaded', () => {
    useAuthStore.setState({ user: businessUser(), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })
    useTenantStore.setState({ tenant: SAMOON as never, tenantState: 'resolved' } as never)
    const { roles, permissions, branchAccess } = normalizeTenantPermissions({ roles: ['owner'] }, SAMOON.id)
    useRbacStore.getState().setCurrentTenantSession(SAMOON.id, roles, permissions, branchAccess)
    useRbacStore.getState().setHasTenantMembership(true)
    useRbacStore.getState().setSessionMemberships(
      [{ tenantId: SAMOON.id, roles: ['owner'], branchAccess: { scope: 'all' } }],
      { tenantId: SAMOON.id },
    )

    render(withProviders(
      <ConsoleWorkspaceGate><div>Console Workspace</div></ConsoleWorkspaceGate>,
    ))

    expect(screen.getByText('Console Workspace')).toBeTruthy()
  })

  it('Case 2: memberships exist without activeMembership.tenantId — switch requests backend then refreshes session', async () => {
    useAuthStore.setState({ user: businessUser(), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })
    useTenantStore.setState({ tenant: null, tenantState: 'not_found' } as never)
    useRbacStore.getState().setHasTenantMembership(true)
    const memberships = [
      { tenantId: SAMOON.id, tenantName: 'Samoon Restaurant', tenantSlug: 'samoon', roles: ['owner'], branchAccess: { scope: 'all' } },
      { tenantId: 'tenant-b-02', tenantName: 'Other Business', tenantSlug: 'other-business', roles: ['manager'], branchAccess: { scope: 'all' } },
    ]
    useRbacStore.getState().setSessionMemberships(memberships, null)

    const switchSpy = vi.spyOn(authService, 'switchActiveTenant').mockResolvedValue(undefined)
    const getMeSpy = vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: businessUser(),
      memberships,
      activeMembership: { tenantId: SAMOON.id },
    } as never)

    const user = userEvent.setup()
    render(withProviders(<AdminTenantSwitcher />))

    await user.click(screen.getByRole('button', { name: /switchTenantAria|Switch tenant/i }))
    await user.click(screen.getByText('Other Business'))

    await waitFor(() => {
      expect(switchSpy).toHaveBeenCalledWith({ tenantId: 'tenant-b-02' })
      expect(getMeSpy).toHaveBeenCalled()
    })

    switchSpy.mockRestore()
    getMeSpy.mockRestore()
  })

  it('Case 3: empty memberships — no-active-tenant state with refresh', () => {
    useAuthStore.setState({ user: businessUser(), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })
    useTenantStore.setState({ tenant: null, tenantState: 'not_found' } as never)
    useRbacStore.getState().setHasTenantMembership(false)
    useRbacStore.getState().setSessionMemberships([], null)

    render(withProviders(
      <ConsoleWorkspaceGate><div>Console Workspace</div></ConsoleWorkspaceGate>,
    ))

    expect(screen.getByText(en.console.noActiveTenantTitle)).toBeTruthy()
    expect(screen.getByText(en.console.noActiveTenantDesc)).toBeTruthy()
    expect(screen.getByRole('button', { name: en.console.refreshSessionCta })).toBeTruthy()
    expect(screen.queryByText(en.console.onboardingTitle)).toBeNull()
    expect(screen.queryByText('Console Workspace')).toBeNull()
  })

  it('Case 3 switcher: empty memberships show disabled no-tenant label and refresh', () => {
    useRbacStore.getState().setHasTenantMembership(false)
    useRbacStore.getState().setSessionMemberships([], null)

    render(withProviders(<AdminTenantSwitcher />))

    expect(screen.getByText(en.console.noActiveTenantSwitcherLabel)).toBeTruthy()
    expect(screen.getByRole('button', { name: en.console.refreshSessionAria })).toBeTruthy()
    expect(screen.queryByText(en.console.selectTenant)).toBeNull()
  })

  it('refresh re-fetches /auth/me when memberships are empty', async () => {
    useAuthStore.setState({ user: businessUser(), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })
    useTenantStore.setState({ tenant: null, tenantState: 'not_found' } as never)
    useRbacStore.getState().setHasTenantMembership(false)
    useRbacStore.getState().setSessionMemberships([], null)

    const getMeSpy = vi.spyOn(authService, 'getMe').mockResolvedValue({
      user: businessUser(),
      memberships: [{ tenantId: SAMOON.id, roles: ['owner'], branchAccess: { scope: 'all' } }],
      activeMembership: { tenantId: SAMOON.id },
    } as never)

    const user = userEvent.setup()
    render(withProviders(
      <ConsoleWorkspaceGate><div>Console Workspace</div></ConsoleWorkspaceGate>,
    ))

    await user.click(screen.getByRole('button', { name: en.console.refreshSessionCta }))

    await waitFor(() => {
      expect(getMeSpy).toHaveBeenCalled()
      expect(useRbacStore.getState().activeMembership?.tenantId).toBe(SAMOON.id)
    })

    getMeSpy.mockRestore()
  })
})

describe('Phase Z.10 — Scenario 3: public tenant storefront (subdomain resolution) is untouched', () => {
  const src = readFileSync(join(__dirname, '..', 'app', '[tenantSlug]', 'layout.tsx'), 'utf-8')

  it('[tenantSlug]/layout.tsx still resolves tenant via loadTenant from the URL segment', () => {
    expect(src).toContain('loadTenant(tenantSlug')
  })

  it('[tenantSlug]/layout.tsx resets tenant store on unmount so theme does not persist', () => {
    expect(src).toContain('useTenantStore.getState().reset()')
  })

  it('middleware.ts still resolves the tenant slug from the subdomain for storefront routes', async () => {
    const middlewareSrc = readFileSync(join(__dirname, '..', 'middleware.ts'), 'utf-8')
    expect(middlewareSrc).toContain('resolveTenantSlug')
    expect(middlewareSrc).toMatch(/hostname\.split\(['"]\.['"]\)/)
  })
})
