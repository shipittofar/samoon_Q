// ============================================================
// Phase Z.11 — Console architecture: decouple rendering from tenant resolution
//
// Problem: the entire /console lifecycle depended on successful tenant
// resolution — a temporary API failure, network issue, or auth bootstrap
// race blocked the WHOLE console (chrome included) behind "Tenant not
// found," merging every failure mode into one blocking screen with no
// retry. Tenant availability is a DATA dependency of the workspace, not
// an authentication dependency of it.
//
// This file proves:
//   1. resolveConsoleTenantPhase() — pure state-decision coverage for
//      every required phase (membership_loading, onboarding,
//      tenant_loading, tenant_retrying, tenant_network_error,
//      tenant_not_found, tenant_access_denied, access_denied, resolved).
//   2. Authenticated + tenant API failure: the Console shell (AdminHeader)
//      still mounts alongside a retry-capable inline state — never a
//      full-page replacement, never "Tenant not found".
//   3. Retry: auto-retry fires on a delay, is capped, and a manual retry
//      button re-invokes loadTenant() with the last-attempted slug.
//   4. Successful resolution after a failure clears the error and
//      activates tenant-scoped content (children).
//   5. Genuine not_found/forbidden (has membership, but THIS tenant is
//      invalid/inaccessible) still render their own distinct messages —
//      never conflated with a transient failure.
// ============================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import en from '@/i18n/locales/en.json'
import { useAuthStore, useTenantStore, useRbacStore } from '@/stores'
import { normalizeTenantPermissions } from '@/services/permission.service'
import { tenantService } from '@/services/tenant.service'
import {
  ConsoleWorkspaceGate,
  resolveConsoleTenantPhase,
  TENANT_RETRY_DELAY_MS,
  TENANT_MAX_AUTO_RETRIES,
} from '@/components/admin/ConsoleWorkspaceGate'

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

const SAMOON = { id: 'tenant-samoon-01', slug: 'samoon', name: 'Samoon Restaurant', status: 'active' }

function seedActiveMembership() {
  useRbacStore.getState().setSessionMemberships(
    [{ tenantId: SAMOON.id, roles: ['owner'], branchAccess: { scope: 'all' } }],
    { tenantId: SAMOON.id },
  )
}

beforeEach(() => {
  useRbacStore.getState()._resetStore()
  useAuthStore.setState({ user: businessUser(), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })
  useTenantStore.setState({ tenant: null, tenantState: 'loading', lastAttemptedSlug: 'samoon' } as never)
  useRbacStore.getState().setHasTenantMembership(true)
  seedActiveMembership()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Phase Z.11 — resolveConsoleTenantPhase(): pure state coverage', () => {
  const base = {
    hasTenantMembership: true as boolean | null,
    sessionMembershipCount: 1 as number | null,
    activeTenantId: 'tenant-1' as string | null,
    resolvedTenantId: 'tenant-1' as string | null | undefined,
    tenantState: 'resolved' as const,
    hasDashboardAccess: true,
    retryCount: 0,
  }

  it('membership_loading when hasTenantMembership is null', () => {
    expect(resolveConsoleTenantPhase({ ...base, hasTenantMembership: null })).toBe('membership_loading')
  })
  it('onboarding when memberships are unknown and hasTenantMembership is false', () => {
    expect(resolveConsoleTenantPhase({ ...base, hasTenantMembership: false, sessionMembershipCount: null })).toBe('onboarding')
  })
  it('no_active_tenant when memberships array is empty', () => {
    expect(resolveConsoleTenantPhase({ ...base, sessionMembershipCount: 0, hasTenantMembership: false })).toBe('no_active_tenant')
  })
  it('tenant_awaiting_selection when memberships exist but activeMembership.tenantId is missing', () => {
    expect(resolveConsoleTenantPhase({
      ...base,
      sessionMembershipCount: 2,
      activeTenantId: null,
      tenantState: 'not_found',
    })).toBe('tenant_awaiting_selection')
  })
  it('tenant_not_found for a genuine not_found classification, regardless of retryCount', () => {
    expect(resolveConsoleTenantPhase({ ...base, tenantState: 'not_found', retryCount: 2 })).toBe('tenant_not_found')
  })
  it('tenant_access_denied for a genuine forbidden classification', () => {
    expect(resolveConsoleTenantPhase({ ...base, tenantState: 'forbidden' })).toBe('tenant_access_denied')
  })
  it('tenant_loading on the first attempt (loading, retryCount 0)', () => {
    expect(resolveConsoleTenantPhase({ ...base, tenantState: 'loading', retryCount: 0 })).toBe('tenant_loading')
  })
  it('tenant_retrying while loading after at least one retry', () => {
    expect(resolveConsoleTenantPhase({ ...base, tenantState: 'loading', retryCount: 1 })).toBe('tenant_retrying')
  })
  it('tenant_retrying while erroring, retries not yet exhausted', () => {
    expect(resolveConsoleTenantPhase({ ...base, tenantState: 'error', retryCount: 1 })).toBe('tenant_retrying')
  })
  it('tenant_network_error once auto-retries are exhausted', () => {
    expect(resolveConsoleTenantPhase({ ...base, tenantState: 'error', retryCount: TENANT_MAX_AUTO_RETRIES })).toBe('tenant_network_error')
  })
  it('access_denied when resolved but no dashboard:access', () => {
    expect(resolveConsoleTenantPhase({ ...base, tenantState: 'resolved', hasDashboardAccess: false })).toBe('access_denied')
  })
  it('resolved when resolved and dashboard:access granted', () => {
    expect(resolveConsoleTenantPhase({ ...base, tenantState: 'resolved', hasDashboardAccess: true })).toBe('resolved')
  })
  it('tenant_loading when resolved tenant id mismatches activeMembership', () => {
    expect(resolveConsoleTenantPhase({
      ...base,
      tenantState: 'resolved',
      activeTenantId: 'tenant-a',
      resolvedTenantId: 'tenant-b',
      retryCount: 0,
    })).toBe('tenant_loading')
  })
  it('tenant_retrying when tenant id mismatch persists after retry', () => {
    expect(resolveConsoleTenantPhase({
      ...base,
      tenantState: 'resolved',
      activeTenantId: 'tenant-a',
      resolvedTenantId: 'tenant-b',
      retryCount: 1,
    })).toBe('tenant_retrying')
  })
})

describe('Phase Z.11 — authenticated + tenant API failure: Console shell still renders', () => {
  const layoutSrc = readFileSync(join(__dirname, '..', 'app', 'console', 'layout.tsx'), 'utf-8')

  it('console/layout.tsx mounts AdminHeader/AdminSidebar/AdminContextBar OUTSIDE ConsoleWorkspaceGate — the shell is unconditional on tenant state', () => {
    const gateOpenIndex = layoutSrc.indexOf('<ConsoleWorkspaceGate>')
    const authGuardOpenIndex = layoutSrc.indexOf('<AuthGuard>')
    const headerIndex = layoutSrc.indexOf('<AdminHeader')
    const sidebarIndex = layoutSrc.indexOf('<AdminSidebar')
    const contextBarIndex = layoutSrc.indexOf('<AdminContextBar')

    expect(authGuardOpenIndex).toBeGreaterThanOrEqual(0)
    expect(gateOpenIndex).toBeGreaterThan(0)
    // Chrome is mounted between <AuthGuard> and <ConsoleWorkspaceGate> — i.e.
    // unconditional on tenant state, gated only on authentication.
    expect(headerIndex).toBeGreaterThan(authGuardOpenIndex)
    expect(headerIndex).toBeLessThan(gateOpenIndex)
    expect(sidebarIndex).toBeGreaterThan(authGuardOpenIndex)
    expect(sidebarIndex).toBeLessThan(gateOpenIndex)
    expect(contextBarIndex).toBeGreaterThan(authGuardOpenIndex)
    expect(contextBarIndex).toBeLessThan(gateOpenIndex)
  })

  it('only page content ({children}) is inside ConsoleWorkspaceGate, not the chrome', () => {
    const gateBlock = layoutSrc.slice(layoutSrc.indexOf('<ConsoleWorkspaceGate>'), layoutSrc.indexOf('</ConsoleWorkspaceGate>'))
    expect(gateBlock).toContain('{children}')
    expect(gateBlock).not.toContain('<AdminHeader')
    expect(gateBlock).not.toContain('<AdminSidebar')
  })

  it('ConsoleWorkspaceGate itself: tenant API failure renders an inline retry state, not a full-page "Tenant not found"', () => {
    useTenantStore.setState({ tenant: null, tenantState: 'error', lastAttemptedSlug: 'samoon' } as never)

    render(withProviders(
      <ConsoleWorkspaceGate><div>Menu Module</div></ConsoleWorkspaceGate>,
    ))

    // Tenant-scoped content withheld until resolved
    expect(screen.queryByText('Menu Module')).toBeNull()
    // Never the hard "Tenant not found" message for a network/unclassified failure
    expect(screen.queryByText(en.console.tenantNotFoundTitle)).toBeNull()
    // A retry affordance is offered instead
    expect(screen.getByText(en.console.tenantRetryCta)).toBeTruthy()
  })
})

describe('Phase Z.11 — retry behavior', () => {
  it('auto-retries after TENANT_RETRY_DELAY_MS, calling loadTenantById with activeMembership.tenantId', async () => {
    vi.useFakeTimers()
    const getTenantSpy = vi.spyOn(tenantService, 'getTenantById').mockResolvedValue(SAMOON as never)
    useTenantStore.setState({ tenant: null, tenantState: 'error', lastAttemptedSlug: 'samoon' } as never)

    render(withProviders(<ConsoleWorkspaceGate><div>Menu Module</div></ConsoleWorkspaceGate>))
    expect(screen.getByText(en.console.tenantRetryCta)).toBeTruthy()

    await vi.advanceTimersByTimeAsync(TENANT_RETRY_DELAY_MS)

    expect(getTenantSpy).toHaveBeenCalledWith(SAMOON.id)
  })

  it('manual retry button re-invokes loadTenantById immediately with activeMembership.tenantId', async () => {
    const getTenantSpy = vi.spyOn(tenantService, 'getTenantById').mockResolvedValue(SAMOON as never)
    useTenantStore.setState({ tenant: null, tenantState: 'error', lastAttemptedSlug: 'samoon' } as never)

    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(withProviders(<ConsoleWorkspaceGate><div>Menu Module</div></ConsoleWorkspaceGate>))

    await user.click(screen.getByText(en.console.tenantRetryCta))

    expect(getTenantSpy).toHaveBeenCalledWith(SAMOON.id)
  })

  it('auto-retry stops after TENANT_MAX_AUTO_RETRIES — no infinite duplicate requests', async () => {
    vi.useFakeTimers()
    const getTenantSpy = vi.spyOn(tenantService, 'getTenantById').mockRejectedValue(new Error('network error'))
    useTenantStore.setState({ tenant: null, tenantState: 'error', lastAttemptedSlug: 'samoon' } as never)

    render(withProviders(<ConsoleWorkspaceGate><div>Menu Module</div></ConsoleWorkspaceGate>))

    // Advance well past what TENANT_MAX_AUTO_RETRIES auto-retries would consume.
    for (let i = 0; i < TENANT_MAX_AUTO_RETRIES + 2; i++) {
      await vi.advanceTimersByTimeAsync(TENANT_RETRY_DELAY_MS)
    }

    // Called at most TENANT_MAX_AUTO_RETRIES times from auto-retry orchestration.
    expect(getTenantSpy.mock.calls.length).toBeLessThanOrEqual(TENANT_MAX_AUTO_RETRIES)
    // Manual retry remains available even after auto-retry is exhausted.
    expect(screen.getByText(en.console.tenantRetryCta)).toBeTruthy()
  })
})

describe('Phase Z.11 — successful resolution after a failure activates tenant-scoped content', () => {
  it('clears the error state and renders children once tenantState becomes resolved', () => {
    useTenantStore.setState({ tenant: null, tenantState: 'error', lastAttemptedSlug: 'samoon' } as never)
    const { rerender } = render(withProviders(<ConsoleWorkspaceGate><div>Menu Module</div></ConsoleWorkspaceGate>))
    expect(screen.queryByText('Menu Module')).toBeNull()

    const { roles, permissions, branchAccess } = normalizeTenantPermissions({ roles: ['owner'] }, SAMOON.id)
    useRbacStore.getState().setCurrentTenantSession(SAMOON.id, roles, permissions, branchAccess)
    useTenantStore.setState({ tenant: SAMOON as never, tenantState: 'resolved' } as never)
    seedActiveMembership()

    rerender(withProviders(<ConsoleWorkspaceGate><div>Menu Module</div></ConsoleWorkspaceGate>))

    expect(screen.getByText('Menu Module')).toBeTruthy()
    expect(screen.queryByText(en.console.tenantRetryCta)).toBeNull()
  })
})

describe('Phase Z.11 — no active tenant: distinct from not_found and onboarding', () => {
  it('renders the dedicated no-active-tenant copy when memberships array is empty', () => {
    useRbacStore.getState().setHasTenantMembership(false)
    useRbacStore.getState().setSessionMemberships([], null)

    render(withProviders(<ConsoleWorkspaceGate><div>Menu Module</div></ConsoleWorkspaceGate>))

    expect(screen.getByText(en.console.noActiveTenantTitle)).toBeTruthy()
    expect(screen.getByText(en.console.noActiveTenantDesc)).toBeTruthy()
    expect(screen.getByRole('button', { name: en.console.refreshSessionCta })).toBeTruthy()
    expect(screen.queryByText(en.console.tenantNotFoundTitle)).toBeNull()
    expect(screen.queryByText(en.console.onboardingTitle)).toBeNull()
    expect(screen.queryByText('Menu Module')).toBeNull()
  })

  it('prompts manual tenant selection when memberships exist but activeMembership.tenantId is missing', () => {
    useRbacStore.getState().setSessionMemberships(
      [{ tenantId: SAMOON.id, roles: ['owner'], branchAccess: { scope: 'all' } }],
      null,
    )
    useTenantStore.setState({ tenant: null, tenantState: 'not_found' } as never)

    render(withProviders(<ConsoleWorkspaceGate><div>Menu Module</div></ConsoleWorkspaceGate>))

    expect(screen.getByText(en.console.selectTenant)).toBeTruthy()
    expect(screen.getByText(en.console.selectTenantPromptDesc)).toBeTruthy()
    expect(screen.queryByText(en.console.noActiveTenantTitle)).toBeNull()
    expect(screen.queryByText('Menu Module')).toBeNull()
  })
})

describe('Phase Z.11 — no memberships: correct empty (onboarding) state', () => {
  it('shows onboarding, never "Tenant not found", and never leaks tenant-scoped content', () => {
    useRbacStore.getState().setHasTenantMembership(false)
    useRbacStore.getState().setSessionMemberships(null, null)
    useTenantStore.setState({ tenant: null, tenantState: 'not_found' } as never)

    render(withProviders(<ConsoleWorkspaceGate><div>Menu Module</div></ConsoleWorkspaceGate>))

    expect(screen.getByText(en.console.onboardingTitle)).toBeTruthy()
    expect(screen.queryByText(en.console.tenantNotFoundTitle)).toBeNull()
    expect(screen.queryByText('Menu Module')).toBeNull()
  })
})

describe('Phase Z.11 — invalid tenant: correct not-found / access-denied states', () => {
  it('tenant_not_found renders distinctly from a network error', () => {
    useTenantStore.setState({ tenant: null, tenantState: 'not_found', lastAttemptedSlug: 'ghost-tenant' } as never)
    render(withProviders(<ConsoleWorkspaceGate><div>Menu Module</div></ConsoleWorkspaceGate>))
    expect(screen.getByText(en.console.tenantNotFoundTitle)).toBeTruthy()
    expect(screen.queryByText(en.console.tenantRetryCta)).toBeNull()
  })

  it('tenant_access_denied (forbidden) renders distinctly from not_found', () => {
    useTenantStore.setState({ tenant: null, tenantState: 'forbidden', lastAttemptedSlug: 'suspended-tenant' } as never)
    render(withProviders(<ConsoleWorkspaceGate><div>Menu Module</div></ConsoleWorkspaceGate>))
    expect(screen.getByText(en.console.tenantForbiddenTitle)).toBeTruthy()
    expect(screen.queryByText(en.console.tenantNotFoundTitle)).toBeNull()
  })
})
