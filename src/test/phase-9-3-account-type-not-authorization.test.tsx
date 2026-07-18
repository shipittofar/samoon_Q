// ============================================================
// Phase 9.3 — User.role removed, replaced by accountType (UX hint only)
//
// `accountType` ('customer' | 'business') answers "what experience should
// this account start with before tenant context exists" — it must NEVER
// grant Console access by itself. This file proves that:
//   - a customer accountType does not automatically get console access
//   - a business accountType WITHOUT a tenant membership does not either
//   - a tenant membership with real RBAC roles grants console access
//     regardless of accountType
// Authorization remains entirely `TenantMembership.roles` /
// `CurrentTenantSession.permissions`, unchanged by this phase.
// ============================================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { useAuthStore, useTenantStore, useRbacStore } from '@/stores'
import { normalizeTenantPermissions } from '@/services/permission.service'
import type { User } from '@/types'

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

import { AuthGuard } from '@/components/auth/AuthGuard'

function userWith(accountType: User['accountType']): User {
  return {
    id: 'u1',
    email: 'user@example.com',
    first_name: 'Test',
    last_name: 'User',
    accountType,
    is_verified: true,
    created_at: new Date().toISOString(),
  }
}

describe('Phase 9.3 — accountType is not an authorization signal', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    useRbacStore.getState()._resetStore()
    useTenantStore.setState({ tenant: null, tenantState: 'resolved' } as never)
  })

  it('customer accountType does NOT automatically get console access', () => {
    useAuthStore.setState({ user: userWith('customer'), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })
    // No currentTenantSession set — no tenant role.
    render(<AuthGuard requiredPermission="dashboard:access">{<div>Console</div>}</AuthGuard>)
    expect(screen.queryByText('Console')).toBeNull()
    // Phase X.3 — permission denial renders in place (permissionDeniedFallback/
    // fallback), it no longer redirects; see AuthGuard.tsx and the
    // phase-X-3-console-context-stabilization.test.tsx suite for the
    // dedicated coverage of that behavior.
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('business accountType WITHOUT a tenant membership does NOT get console access', () => {
    useAuthStore.setState({ user: userWith('business'), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })
    // Still no currentTenantSession — holding a 'business' accountType
    // alone must not substitute for a real tenant role grant.
    render(<AuthGuard requiredPermission="dashboard:access">{<div>Console</div>}</AuthGuard>)
    expect(screen.queryByText('Console')).toBeNull()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('a tenant membership with roles:["manager"] GETS console access, regardless of accountType', () => {
    useAuthStore.setState({ user: userWith('customer'), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })
    const { roles, permissions, branchAccess } = normalizeTenantPermissions({ roles: ['manager'] }, 'tenant-1')
    useRbacStore.getState().setCurrentTenantSession('tenant-1', roles, permissions, branchAccess)
    useTenantStore.setState({ tenant: { id: 'tenant-1' } as never, tenantState: 'resolved' } as never)

    render(<AuthGuard requiredPermission="dashboard:access">{<div>Console</div>}</AuthGuard>)
    expect(screen.getByText('Console')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('a customer accountType WITH a real tenant membership still gets console access — accountType never overrides a real grant either', () => {
    useAuthStore.setState({ user: userWith('customer'), isAuthenticated: true, isLoading: false, sessionCheckFailed: false })
    const { roles, permissions, branchAccess } = normalizeTenantPermissions({ roles: ['owner'] }, 'tenant-1')
    useRbacStore.getState().setCurrentTenantSession('tenant-1', roles, permissions, branchAccess)
    useTenantStore.setState({ tenant: { id: 'tenant-1' } as never, tenantState: 'resolved' } as never)

    render(<AuthGuard requiredPermission="dashboard:access">{<div>Console</div>}</AuthGuard>)
    expect(screen.getByText('Console')).toBeTruthy()
  })
})
