// ============================================================
// P10.4.11 — AuthGuard permission resolution (Phase 2 rewrite)
//
// Phase 2 (RBAC unification) removed AuthGuard's dependence on
// Owner/StaffAssignment ownership data entirely. `usePermission()` (and by
// extension `useHasDashboardAccess()`) now read exclusively from
// `useRbacStore.currentTenantSession` — there is no ownership/StaffMember
// resolution left in the render path AuthGuard exercises. This file's
// account-fixture-driven tests are rewritten to seed `currentTenantSession`
// directly instead of relying on Owner/StaffAssignment mock data; the
// legacy-isolation checks (no `rbacService.hasPermission(` calls) are kept
// as-is since they remain valid.
// ============================================================
import fs from 'fs'
import path from 'path'
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { screen, cleanup } from '@testing-library/react'
import { renderWithIntl as render } from './test-utils'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { useAuthStore, useTenantStore, useRbacStore } from '@/stores'
import { tenantService } from '@/services/tenant.service'
import { normalizeTenantPermissions } from '@/services/permission.service'
import type { User, Tenant } from '@/types'
import type { P7Permission } from '@/types/rbac'
import type { Role } from '@/types/rbac'

const ROOT = path.resolve(__dirname, '..', '..')

function userFor(email: string | null): User | null {
  if (!email) return null
  return {
    id: 'test-user-' + email,
    email,
    first_name: 'Test',
    last_name: 'User',
    role: 'customer',
    is_verified: true,
    created_at: new Date().toISOString(),
  }
}

async function samoonTenant(): Promise<Tenant> {
  const tenants = await tenantService.getTenants()
  const tenant = tenants.find((t) => t.id === 'tenant-samoon-01')
  if (!tenant) throw new Error('tenant-samoon-01 not found in fixtures')
  return tenant
}

function seedSession(tenantId: string, roles: Role[]) {
  const { permissions } = normalizeTenantPermissions(roles)
  useRbacStore.getState().setCurrentTenantSession(tenantId, roles, permissions)
}

function renderGuard(opts: {
  requiredPermission?: P7Permission
  content: string
  fallbackText?: string
}) {
  const fallbackText = opts.fallbackText ?? 'Fallback'
  return render(
    // eslint-disable-next-line react/no-children-prop
    React.createElement(AuthGuard, {
      requiredPermission: opts.requiredPermission,
      fallback: React.createElement('div', null, fallbackText),
      children: React.createElement('div', null, opts.content),
    }),
  )
}

beforeEach(() => {
  tenantService._resetMockList()
  useAuthStore.getState().setUser(null)
  useRbacStore.getState().clearCurrentTenantSession()
})

afterEach(() => {
  cleanup()
})

describe('P10.4.11 — public routes (no requiredPermission)', () => {
  it('unauthenticated: renders fallback, not children (AuthGuard still gates on isAuthenticated)', () => {
    useAuthStore.getState().setUser(null)
    renderGuard({ content: 'Protected Content' })
    expect(screen.queryByText('Protected Content')).toBeNull()
    expect(screen.getByText('Fallback')).toBeTruthy()
  })
})

describe('P10.4.11 — protected routes (authenticated, no requiredPermission)', () => {
  it('authenticated with no requiredPermission: renders children — auth alone is sufficient', () => {
    useAuthStore.getState().setUser(userFor('owner@samoon.com'))
    renderGuard({ content: 'Protected Content' })
    expect(screen.getByText('Protected Content')).toBeTruthy()
    expect(screen.queryByText('Fallback')).toBeNull()
  })
})

describe('P10.4.11 — dashboard:access permission routes resolve through currentTenantSession, not ownership data', () => {
  const consoleCapableRoles: { role: Role; label: string }[] = [
    { role: 'owner', label: 'Owner' },
    { role: 'admin', label: 'Admin' },
    { role: 'manager', label: 'Manager' },
    { role: 'cashier', label: 'Cashier' },
    { role: 'kitchen', label: 'Kitchen' },
    { role: 'support', label: 'Support' },
  ]

  for (const { role, label } of consoleCapableRoles) {
    it(`${label}: requiredPermission="dashboard:access" grants access once currentTenantSession carries the role`, async () => {
      const samoon = await samoonTenant()
      useTenantStore.getState().setTenant(samoon)
      useAuthStore.getState().setUser(userFor(`${role}@samoon.com`))
      seedSession(samoon.id, [role])

      renderGuard({ requiredPermission: 'dashboard:access', content: 'Console Content' })
      expect(screen.getByText('Console Content')).toBeTruthy()
      expect(screen.queryByText('Fallback')).toBeNull()
    })
  }

  it('unauthorized: an authenticated user with no currentTenantSession is denied dashboard:access and sees the fallback', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('nobody@example.com'))
    // No seedSession call — no ownership/staff record should be able to grant access.

    renderGuard({ requiredPermission: 'dashboard:access', content: 'Console Content' })
    expect(screen.queryByText('Console Content')).toBeNull()
    expect(screen.getByText('Fallback')).toBeTruthy()
  })
})

describe('P10.4.11 — non-dashboard permission routes resolve through usePermission() (P7 engine)', () => {
  it('an Owner (full P7 permission set) is granted a generic P7 permission', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('owner@samoon.com'))
    seedSession(samoon.id, ['owner'])

    renderGuard({ requiredPermission: 'orders.view', content: 'Orders Content' })
    expect(screen.getByText('Orders Content')).toBeTruthy()
    expect(screen.queryByText('Fallback')).toBeNull()
  })

  it('unauthorized: a Cashier lacking a manager-only P7 permission is denied and sees the fallback', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('cashier@samoon.com'))
    seedSession(samoon.id, ['cashier'])

    // 'tenant.manage' is Owner-only in ROLE_PERMISSION_MAP — a Cashier's
    // permission set never includes it.
    renderGuard({ requiredPermission: 'tenant.manage', content: 'Owner-Only Content' })
    expect(screen.queryByText('Owner-Only Content')).toBeNull()
    expect(screen.getByText('Fallback')).toBeTruthy()
  })
})

describe('P10.4.11 — legacy isolation: zero executable rbacService.hasPermission( calls in application runtime code', () => {
  const RUNTIME_ROOTS = ['app', 'components', 'hooks', 'services', 'stores', 'lib', 'utils', 'providers']

  function collectTsFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        collectTsFiles(full, out)
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push(full)
      }
    }
    return out
  }

  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
  }

  it('AuthGuard.tsx source contains no executable rbacService.hasPermission( call and no LegacyPermission type reference', () => {
    const rawSrc = fs.readFileSync(
      path.join(ROOT, 'src/components/auth/AuthGuard.tsx'),
      'utf8',
    )
    const codeOnly = stripComments(rawSrc)
    expect(codeOnly).not.toContain('rbacService.hasPermission(')
    expect(codeOnly).not.toContain('LegacyPermission')
    expect(rawSrc).not.toContain("import { rbacService }")
  })

  it('AuthGuard.tsx now types requiredPermission as P7Permission and calls usePermission()', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/components/auth/AuthGuard.tsx'),
      'utf8',
    )
    expect(src).toContain('requiredPermission?: P7Permission')
    expect(src).toContain('usePermission(')
  })

  it('no file under src/{app,components,hooks,services,stores,lib,utils,providers} executes rbacService.hasPermission( — the only remaining occurrences are its own definition and historical comments', () => {
    const offenders: string[] = []
    for (const root of RUNTIME_ROOTS) {
      const dir = path.join(ROOT, 'src', root)
      if (!fs.existsSync(dir)) continue
      for (const file of collectTsFiles(dir)) {
        if (file.endsWith(path.join('services', 'rbac.service.ts'))) continue
        const codeOnly = stripComments(fs.readFileSync(file, 'utf8'))
        if (codeOnly.includes('rbacService.hasPermission(')) {
          offenders.push(path.relative(ROOT, file))
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('AuthGuard.tsx has no ownership-resolution import', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/components/auth/AuthGuard.tsx'),
      'utf8',
    )
    expect(src).not.toContain('ownership-resolution.service')
  })
})
