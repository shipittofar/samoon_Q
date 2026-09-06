/**
 * Platform Admin route security — authentication (middleware) + authorization
 * (`user.is_superuser === true` from GET /auth/me). Tenant RBAC, is_staff,
 * and platformRole must not grant /platform-admin.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import React from 'react'
import { renderWithIntl } from './test-utils'
import { useAuthStore, useRbacStore, useTenantStore } from '@/stores'
import { normalizeTenantPermissions } from '@/services/permission.service'
import { configurationService } from '@/config'
import { DEFAULT_TENANT } from '@/constants'
import { PlatformSuperuserGuard } from '@/components/auth/PlatformSuperuserGuard'
import { PlatformAdminNavLink } from '@/components/admin/PlatformAdminNavLink'
import {
  applyPlatformRoleFromSession,
  hasPlatformPermission,
  parsePlatformRole,
  usePlatformAdminStore,
} from '@/platform-admin'
import { MOCK_CREDENTIALS } from '@/services/auth.service'
import { MOCK_PLATFORM_ADMIN_USER } from '@/lib/mock-data'
import { normalizeGetMeResponse } from '@/lib/auth-me-normalizer'
import { isPlatformSuperuser } from '@/lib/platform-admin-access'
import { clearAuthenticatedClientState } from '@/lib/auth-session-teardown'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { User } from '@/types'

const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/platform-admin',
  useSearchParams: () => new URLSearchParams(),
}))

import { AuthGuard } from '@/components/auth/AuthGuard'
import PlatformAdminLayout from '@/app/platform-admin/layout'

function baseUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    email: 'user@samoon.com',
    first_name: 'Pat',
    last_name: 'User',
    accountType: 'business',
    is_verified: true,
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function setAuthenticatedUser(user: User) {
  useAuthStore.setState({
    user,
    isAuthenticated: true,
    isLoading: false,
    sessionCheckFailed: false,
  })
}

function loginAsTenantOwner() {
  setAuthenticatedUser(baseUser({ id: 'u-owner', email: 'owner@samoon.com', last_name: 'Owner' }))
  useTenantStore.getState().setTenant(DEFAULT_TENANT)
  useRbacStore.getState().setTenantRoles(DEFAULT_TENANT.id, ['owner'])
  useRbacStore.getState().setCurrentTenantSession(
    DEFAULT_TENANT.id,
    ['owner'],
    normalizeTenantPermissions(['owner']).permissions,
  )
}

describe('Platform Admin route security', () => {
  beforeEach(() => {
    mockReplace.mockClear()
    usePlatformAdminStore.getState().setPlatformRole(null)
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      sessionCheckFailed: false,
    })
    useRbacStore.getState()._resetStore()
  })

  it('store defaults to no platform role (fail closed, not platform_super_admin)', () => {
    expect(usePlatformAdminStore.getState().platformRole).toBeNull()
    expect(hasPlatformPermission(usePlatformAdminStore.getState().platformRole, 'platform.dashboard.view')).toBe(false)
  })

  it('store source does not persist platformRole and does not default to super-admin', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(__dirname, '..', 'platform-admin', 'store.ts'), 'utf-8')
    expect(src).not.toContain("from 'zustand/middleware'")
    expect(src).not.toMatch(/\bpersist\s*\(/)
    expect(src).toContain('platformRole: null')
    expect(src).not.toMatch(/platformRole:\s*'platform_super_admin'/)
  })

  it('parsePlatformRole rejects tenant roles and unknown strings', () => {
    expect(parsePlatformRole('owner')).toBeNull()
    expect(parsePlatformRole('admin')).toBeNull()
    expect(parsePlatformRole('manager')).toBeNull()
    expect(parsePlatformRole('platform_super_admin')).toBe('platform_super_admin')
    expect(parsePlatformRole(null)).toBeNull()
  })

  it('owner@samoon.com mock credentials have tenant owner but are not superuser', () => {
    expect(MOCK_CREDENTIALS['owner@samoon.com']?.p7Roles).toContain('owner')
    expect(MOCK_CREDENTIALS['owner@samoon.com']?.user.is_superuser).not.toBe(true)
  })

  it('admin@samoon.com mock credentials have tenant admin but are not superuser', () => {
    expect(MOCK_CREDENTIALS['admin@samoon.com']?.p7Roles).toContain('admin')
    expect(MOCK_CREDENTIALS['admin@samoon.com']?.user.is_superuser).not.toBe(true)
  })

  it('platform@samoon.com mock user is a Django superuser', () => {
    expect(MOCK_CREDENTIALS['platform@samoon.com']?.user.is_superuser).toBe(true)
    expect(MOCK_PLATFORM_ADMIN_USER.is_superuser).toBe(true)
  })

  it('GET /auth/me normalizer does not treat platformRole as authorization', () => {
    const withPlatform = normalizeGetMeResponse({
      user: {
        id: '1',
        email: 'p@x.com',
        first_name: 'P',
        last_name: 'A',
        accountType: 'business',
        is_verified: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      platform_role: 'platform_admin',
    })
    expect('platformRole' in withPlatform).toBe(false)
    expect(withPlatform.user.is_superuser).toBe(false)
  })

  it('applyPlatformRoleFromSession overwrites a stale client super-admin (UI store only)', () => {
    usePlatformAdminStore.getState().setPlatformRole('platform_super_admin')
    applyPlatformRoleFromSession(null)
    expect(usePlatformAdminStore.getState().platformRole).toBeNull()
    applyPlatformRoleFromSession('platform_finance')
    expect(usePlatformAdminStore.getState().platformRole).toBe('platform_finance')
  })

  it('unauthenticated user is redirected to login by AuthGuard (client second layer)', () => {
    renderWithIntl(
      <AuthGuard>
        <div>Platform Admin</div>
      </AuthGuard>,
    )
    expect(screen.queryByText('Platform Admin')).toBeNull()
    expect(mockReplace).toHaveBeenCalledWith('/login')
  })

  it('is_superuser: true → Platform Admin accessible', () => {
    setAuthenticatedUser(baseUser({ is_superuser: true }))
    renderWithIntl(
      <PlatformAdminLayout>
        <div>Platform Admin Shell</div>
      </PlatformAdminLayout>,
    )
    expect(screen.getByText('Platform Admin Shell')).toBeTruthy()
  })

  it('is_superuser: false → Platform Admin denied', () => {
    setAuthenticatedUser(baseUser({ is_superuser: false }))
    renderWithIntl(
      <PlatformAdminLayout>
        <div>Platform Admin Shell</div>
      </PlatformAdminLayout>,
    )
    expect(screen.queryByText('Platform Admin Shell')).toBeNull()
    expect(screen.getByText('Access denied')).toBeTruthy()
  })

  it('is_superuser: undefined → denied, never allowed', () => {
    setAuthenticatedUser(baseUser())
    expect(useAuthStore.getState().user?.is_superuser).toBeUndefined()
    renderWithIntl(
      <PlatformSuperuserGuard fallback={<div>Denied</div>}>
        <div>Platform Admin</div>
      </PlatformSuperuserGuard>,
    )
    expect(screen.queryByText('Platform Admin')).toBeNull()
    expect(screen.getByText('Denied')).toBeTruthy()
  })

  it('auth hydration: user unknown (loading) never allows Platform Admin', () => {
    useAuthStore.setState({
      user: undefined as unknown as null,
      isAuthenticated: true,
      isLoading: true,
      sessionCheckFailed: false,
    })
    renderWithIntl(
      <PlatformSuperuserGuard loadingFallback={<div>Loading</div>} fallback={<div>Denied</div>}>
        <div>Platform Admin</div>
      </PlatformSuperuserGuard>,
    )
    expect(screen.queryByText('Platform Admin')).toBeNull()
    expect(screen.getByText('Loading')).toBeTruthy()
  })

  it('auth hydration: isLoading does not send the user to Login', () => {
    mockReplace.mockClear()
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      sessionCheckFailed: false,
    })
    renderWithIntl(
      <PlatformAdminLayout>
        <div>Platform Admin Shell</div>
      </PlatformAdminLayout>,
    )
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.queryByText('Platform Admin Shell')).toBeNull()
  })

  it('authenticated tenant owner with is_superuser false is denied Platform Admin', () => {
    loginAsTenantOwner()
    usePlatformAdminStore.getState().setPlatformRole(null)
    renderWithIntl(
      <PlatformAdminLayout>
        <div>Platform Admin Shell</div>
      </PlatformAdminLayout>,
    )
    expect(screen.queryByText('Platform Admin Shell')).toBeNull()
    expect(screen.getByText('Access denied')).toBeTruthy()
  })

  it('authenticated tenant admin cannot enter solely via tenant permissions', () => {
    setAuthenticatedUser(baseUser({ id: 'u-admin', email: 'admin@samoon.com', is_superuser: false }))
    useRbacStore.getState().setCurrentTenantSession(
      DEFAULT_TENANT.id,
      ['admin'],
      normalizeTenantPermissions(['admin']).permissions,
    )
    renderWithIntl(
      <PlatformAdminLayout>
        <div>Platform Admin Shell</div>
      </PlatformAdminLayout>,
    )
    expect(screen.queryByText('Platform Admin Shell')).toBeNull()
    expect(screen.getByText('Access denied')).toBeTruthy()
  })

  it('is_staff: true with is_superuser: false remains denied', () => {
    setAuthenticatedUser(baseUser({ is_staff: true, is_superuser: false }))
    renderWithIntl(
      <PlatformAdminLayout>
        <div>Platform Admin Shell</div>
      </PlatformAdminLayout>,
    )
    expect(screen.queryByText('Platform Admin Shell')).toBeNull()
    expect(screen.getByText('Access denied')).toBeTruthy()
  })

  it('stale platformRole platform_super_admin MUST NOT grant access', () => {
    setAuthenticatedUser(baseUser({ is_superuser: false }))
    usePlatformAdminStore.getState().setPlatformRole('platform_super_admin')
    renderWithIntl(
      <PlatformAdminLayout>
        <div>Platform Admin Shell</div>
      </PlatformAdminLayout>,
    )
    expect(screen.queryByText('Platform Admin Shell')).toBeNull()
    expect(screen.getByText('Access denied')).toBeTruthy()
  })

  it('no platform role + is_superuser true → allowed', () => {
    setAuthenticatedUser(baseUser({ is_superuser: true }))
    usePlatformAdminStore.getState().setPlatformRole(null)
    renderWithIntl(
      <PlatformAdminLayout>
        <div>Platform Admin Shell</div>
      </PlatformAdminLayout>,
    )
    expect(screen.getByText('Platform Admin Shell')).toBeTruthy()
  })

  it('platform_finance role without is_superuser cannot access the shell', () => {
    setAuthenticatedUser(baseUser({ email: 'fin@samoon.com' }))
    usePlatformAdminStore.getState().setPlatformRole('platform_finance')
    renderWithIntl(
      <PlatformAdminLayout>
        <div>Module Workspace</div>
      </PlatformAdminLayout>,
    )
    expect(screen.queryByText('Module Workspace')).toBeNull()
    expect(screen.getByText('Access denied')).toBeTruthy()
  })

  it('/auth/me is_superuser true is stored on the auth user', () => {
    const me = normalizeGetMeResponse({
      user: {
        id: '1',
        email: 'p@x.com',
        first_name: 'P',
        last_name: 'A',
        accountType: 'business',
        is_verified: true,
        is_superuser: true,
        created_at: '2024-01-01T00:00:00Z',
      },
    })
    useAuthStore.getState().setUser(me.user)
    expect(useAuthStore.getState().user?.is_superuser).toBe(true)
    expect(isPlatformSuperuser(useAuthStore.getState().user)).toBe(true)
  })

  it('/auth/me is_superuser false is stored on the auth user', () => {
    const me = normalizeGetMeResponse({
      user: {
        id: '1',
        email: 'o@x.com',
        first_name: 'O',
        last_name: 'W',
        accountType: 'business',
        is_verified: true,
        is_superuser: false,
        created_at: '2024-01-01T00:00:00Z',
      },
    })
    useAuthStore.getState().setUser(me.user)
    expect(useAuthStore.getState().user?.is_superuser).toBe(false)
    expect(isPlatformSuperuser(useAuthStore.getState().user)).toBe(false)
  })

  it('/auth/me is_verified is preserved on the auth user', () => {
    const me = normalizeGetMeResponse({
      user: {
        id: '1',
        email: 'v@x.com',
        first_name: 'V',
        last_name: 'Erified',
        accountType: 'business',
        is_verified: true,
        is_superuser: false,
        created_at: '2024-01-01T00:00:00Z',
      },
    })
    useAuthStore.getState().setUser(me.user)
    expect(useAuthStore.getState().user?.is_verified).toBe(true)
  })

  it('logout clears the authenticated user and cannot leave Platform Admin authorized', () => {
    setAuthenticatedUser(baseUser({ is_superuser: true }))
    usePlatformAdminStore.getState().setPlatformRole('platform_super_admin')
    clearAuthenticatedClientState({ clearCredentials: false })
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(isPlatformSuperuser(useAuthStore.getState().user)).toBe(false)
    expect(usePlatformAdminStore.getState().platformRole).toBeNull()
    renderWithIntl(
      <PlatformAdminLayout>
        <div>Platform Admin Shell</div>
      </PlatformAdminLayout>,
    )
    expect(screen.queryByText('Platform Admin Shell')).toBeNull()
  })

  it('Platform Admin navigation is visible only to is_superuser === true', () => {
    setAuthenticatedUser(baseUser({ is_superuser: false }))
    const denied = renderWithIntl(<PlatformAdminNavLink />)
    expect(screen.queryByTestId('platform-admin-nav')).toBeNull()
    denied.unmount()

    setAuthenticatedUser(baseUser({ is_superuser: true }))
    renderWithIntl(<PlatformAdminNavLink />)
    expect(screen.getByTestId('platform-admin-nav')).toBeTruthy()
    expect(screen.getByTestId('platform-admin-nav').getAttribute('href')).toBe('/platform-admin')
  })

  it('existing Console tenant RBAC for owners is unchanged', () => {
    const perms = normalizeTenantPermissions(['owner']).permissions
    expect(perms).toContain('dashboard:access')
    expect(perms).toContain('settings.view')
    expect(perms).toContain('tenant.manage')
  })

  it('existing Console Settings field visibility still uses tenant canView', () => {
    expect(configurationService.canView(
      { permissions: { view: 'settings.view', edit: 'settings.manage' } } as never,
      ['settings.view'],
    )).toBe(true)
    expect(configurationService.canView(
      { permissions: { view: 'settings.view', edit: 'settings.manage' } } as never,
      ['dashboard:access'],
    )).toBe(false)
  })

  it('existing platform permission checks still honor scoped roles and *', () => {
    expect(hasPlatformPermission('platform_super_admin', 'platform.developer.manage')).toBe(true)
    expect(hasPlatformPermission('platform_owner', 'platform.anything.at.all')).toBe(true)
    expect(hasPlatformPermission('platform_finance', 'platform.subscriptions.view')).toBe(true)
    expect(hasPlatformPermission('platform_finance', 'platform.developer.manage')).toBe(false)
    expect(hasPlatformPermission(null, 'platform.dashboard.view')).toBe(false)
  })

  it('layout.tsx wraps all platform-admin routes with AuthGuard + PlatformSuperuserGuard', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(__dirname, '..', 'app', 'platform-admin', 'layout.tsx'), 'utf-8')
    expect(src).toContain('AuthGuard')
    expect(src).toContain('PlatformSuperuserGuard')
    expect(src).not.toContain('PlatformPermissionGuard')
    expect(src).not.toContain('platform.dashboard.view')
    expect(src).toContain('user.is_superuser === true')
  })

  it('Platform Homepage CMS is a platform-admin module, not tenant console content', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const studio = readFileSync(join(__dirname, '..', 'app', 'platform-admin', '[moduleId]', 'page.tsx'), 'utf-8')
    const consoleHome = readFileSync(join(__dirname, '..', 'app', 'console', 'homepage', 'page.tsx'), 'utf-8')
    const configHomepage = readFileSync(join(__dirname, '..', 'config', 'modules', 'platform-homepage.ts'), 'utf-8')
    expect(configHomepage).toContain("id: 'platform.homepage'")
    expect(studio).toContain('PlatformHomepageHeroEditor')
    expect(consoleHome).toContain('AccessDenied')
    expect(consoleHome).toContain('PLATFORM_HOMEPAGE_ADMIN_HREF')
  })
})
