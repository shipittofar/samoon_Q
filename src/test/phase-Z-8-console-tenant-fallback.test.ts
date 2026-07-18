// ============================================================
// Phase Z.8 — Console tenant resolution fallback
//
// Bug report: an authenticated business owner/admin with a fully valid
// /auth/me membership (roles: ["owner","admin"], branchAccess: {scope:
// "all"}) saw Console render "Tenant not found" — NOT an RBAC failure.
//
// Root cause: TenantBootstrapper (src/providers/index.tsx) resolves the
// tenant purely from the request's subdomain
// (docs/modules/TENANT_RESOLUTION_STRATEGY.md), by design, for the
// public storefront. It has no path back to the authenticated user's own
// `memberships`. A business owner/admin reaching /console from the
// platform's own domain (there is no tenant subdomain to be on before
// logging in) gets no slug at all, TenantBootstrapper falls back to
// `loadTenant('default')`, and a real backend 404s on a tenant literally
// named "default" — AuthGuard's `requireResolvedTenant` fails before
// `dashboard:access` is ever evaluated.
//
// Fix: `resolveConsoleTenantFallbackSlug()` (src/providers/index.tsx)
// decides, purely, whether the current route needs its tenant
// re-resolved from the authenticated session's own membership, and
// which slug to use — wired into `AuthBootstrapper`'s
// `applyPendingAuthSession()` so a /console visit with no usable
// host-resolved tenant re-resolves via `useTenantStore.loadTenant(slug)`
// using the membership's own `tenantSlug`, then seeds RBAC against the
// tenant that actually results.
// ============================================================
import { describe, it, expect } from 'vitest'
import { resolveConsoleTenantFallbackSlug } from '@/providers'
import { DEFAULT_TENANT } from '@/constants'
import type { TenantMembership } from '@/types/rbac'

describe('Phase Z.8 — resolveConsoleTenantFallbackSlug()', () => {
  const membership: TenantMembership = {
    tenantId: 'af09e508-0ea1-413d-8eee-24a02403ba0c',
    tenantSlug: '2cum17xs',
    roles: ['owner', 'admin'],
    branchAccess: { scope: 'all' },
  }
  const sessionInput = { memberships: [membership], activeMembership: { tenantId: membership.tenantId } as TenantMembership }

  it('reproduces the exact reported scenario: no resolved tenant, on /console, membership present → falls back to the membership tenantSlug', () => {
    const slug = resolveConsoleTenantFallbackSlug('/console', null, sessionInput)
    expect(slug).toBe('2cum17xs')
  })

  it('current tenant resolved only to the generic DEFAULT_TENANT placeholder → still falls back (never the right thing to render Console against)', () => {
    const slug = resolveConsoleTenantFallbackSlug('/console', { id: 'default', slug: DEFAULT_TENANT.slug }, sessionInput)
    expect(slug).toBe('2cum17xs')
  })

  it('not on a /console route → no fallback, even with an unresolved tenant', () => {
    expect(resolveConsoleTenantFallbackSlug('/menu', null, sessionInput)).toBeNull()
    expect(resolveConsoleTenantFallbackSlug('/dashboard', null, sessionInput)).toBeNull()
    expect(resolveConsoleTenantFallbackSlug(null, null, sessionInput)).toBeNull()
  })

  it('current tenant already resolved to a real, non-default tenant → no fallback (never clobbers a legitimately-resolved subdomain tenant)', () => {
    const slug = resolveConsoleTenantFallbackSlug('/console', { id: 'tenant-real-01', slug: 'a-real-subdomain' }, sessionInput)
    expect(slug).toBeNull()
  })

  it('no session input (unauthenticated / no membership) → no fallback', () => {
    expect(resolveConsoleTenantFallbackSlug('/console', null, null)).toBeNull()
  })

  it('session has memberships but no tenantSlug on the resolved membership → no fallback (nothing to load by)', () => {
    const noSlug = { memberships: [{ tenantId: 't1', roles: ['owner'], branchAccess: { scope: 'all' as const } }] }
    expect(resolveConsoleTenantFallbackSlug('/console', null, noSlug)).toBeNull()
  })

  it('console sub-route (e.g. /console/orders) also triggers the fallback', () => {
    const slug = resolveConsoleTenantFallbackSlug('/console/orders', null, sessionInput)
    expect(slug).toBe('2cum17xs')
  })
})
