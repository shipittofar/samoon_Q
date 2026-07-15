// ============================================================
// P10.4.11 — Remove Legacy AuthGuard Permission Fallback
//
// src/components/auth/AuthGuard.tsx previously fell through to
// `rbacService.hasPermission(user?.role ?? null, requiredPermission)` for
// any `requiredPermission` other than 'dashboard:access'. This phase
// replaced that fallback with the P7 permission engine's `usePermission()`
// hook (src/hooks/index.ts) and re-typed `requiredPermission` from the
// legacy `LegacyPermission` union to `P7Permission`. `dashboard:access`
// stays special-cased through `useHasDashboardAccess()` — unchanged by
// this phase — because `ROLE_PERMISSION_MAP` never grants that literal
// permission to any role (docs/P10.4.8_LEGACY_COMPATIBILITY_AUDIT.md
// Phase G), so routing it through the generic P7 engine would always
// return false.
//
// This file proves AuthGuard's rendering behavior is unchanged for every
// account class, and that no executable call to
// `rbacService.hasPermission(` remains anywhere in application runtime
// code (src/**, excluding src/test/**).
//
// Note: this file is .ts (not .tsx) — component trees below are built
// with React.createElement, not JSX, so the syntax is valid in a plain
// TypeScript source file.
// ============================================================
import fs from 'fs'
import path from 'path'
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { screen, cleanup } from '@testing-library/react'
import { renderWithIntl as render } from './test-utils'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { useAuthStore, useTenantStore } from '@/stores'
import { ownerService } from '@/services/owner.service'
import { staffService } from '@/services/staff.service'
import { staffAssignmentService } from '@/services/staff-assignment.service'
import { tenantService } from '@/services/tenant.service'
import type { User, Tenant } from '@/types'
import type { P7Permission } from '@/types/rbac'

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

function renderGuard(opts: {
  requiredPermission?: P7Permission
  content: string
  fallbackText?: string
}) {
  const fallbackText = opts.fallbackText ?? 'Fallback'
  // AuthGuardProps declares `children: ReactNode` as required, which makes
  // React.createElement's props-plus-rest-children overload unresolvable
  // by TypeScript here — passing `children` inside the props object is the
  // only combination that satisfies both the compiler and AuthGuard's real
  // prop contract, hence the inline rule exception below.
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
  ownerService._resetMockStore()
  staffService._resetMockStore()
  staffAssignmentService._resetMockStore()
  tenantService._resetMockList()
  useAuthStore.getState().setUser(null)
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

describe('P10.4.11 — dashboard:access permission routes resolve through the P7-aware useHasDashboardAccess(), not rbacService', () => {
  // Accounts confirmed (P10.4.9/P10.4.10) to have an active StaffAssignment
  // (or, for Owner, a structural ownership grant) — these must still pass
  // with AuthGuard's legacy fallback removed.
  const consoleCapableAccounts = [
    { email: 'owner@samoon.com', label: 'Owner' },
    { email: 'admin@samoon.com', label: 'Staff (admin role)' },
    { email: 'manager@samoon.com', label: 'Manager' },
    { email: 'cashier@samoon.com', label: 'Cashier' },
    { email: 'kitchen@samoon.com', label: 'Kitchen' },
    { email: 'support@samoon.com', label: 'Support' },
    { email: 'multirole@samoon.com', label: 'Multirole (cashier + kitchen)' },
  ]

  for (const { email, label } of consoleCapableAccounts) {
    it(`${label} (${email}): requiredPermission="dashboard:access" grants access`, async () => {
      const samoon = await samoonTenant()
      useTenantStore.getState().setTenant(samoon)
      useAuthStore.getState().setUser(userFor(email))

      renderGuard({ requiredPermission: 'dashboard:access', content: 'Console Content' })
      expect(screen.getByText('Console Content')).toBeTruthy()
      expect(screen.queryByText('Fallback')).toBeNull()
    })
  }

  it('unauthorized: an account with no Owner/StaffMember record is denied dashboard:access and sees the fallback', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('nobody@example.com'))

    renderGuard({ requiredPermission: 'dashboard:access', content: 'Console Content' })
    expect(screen.queryByText('Console Content')).toBeNull()
    expect(screen.getByText('Fallback')).toBeTruthy()
  })

  // Pre-existing fixture gap, discovered while writing this test, NOT
  // introduced or caused by this phase's AuthGuard.tsx change: unlike
  // marketing@samoon.com's mock user, its StaffMember record
  // (staff-marketing-01) has zero StaffAssignment rows in
  // staff-assignment.service.ts (the only marketing-tagged assignment,
  // assign-009 on staff-marketing-02, is status: 'revoked'). This is the
  // same class of gap P10.4.9 closed for admin@samoon.com/kitchen@samoon.com
  // — but P10.4.9's explicit scope only named those two accounts, so
  // marketing@samoon.com was never covered. Fixing it would mean editing
  // src/services/staff-assignment.service.ts, which is outside this
  // phase's explicit scope ("Modify only: src/components/auth/AuthGuard.tsx").
  // Documented in docs/P10.4.11_AUTHGUARD_MODERNIZATION.md rather than
  // silently fixed or silently dropped from coverage.
  it('KNOWN GAP (pre-existing, out of scope): marketing@samoon.com has no active StaffAssignment fixture, so dashboard:access currently resolves to false for it — unrelated to this phase\'s AuthGuard change', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('marketing@samoon.com'))

    renderGuard({ requiredPermission: 'dashboard:access', content: 'Console Content' })
    expect(screen.queryByText('Console Content')).toBeNull()
    expect(screen.getByText('Fallback')).toBeTruthy()
  })
})

describe('P10.4.11 — non-dashboard permission routes resolve through usePermission() (P7 engine)', () => {
  it('an Owner (full P7 permission set via ownership short-circuit) is granted a generic P7 permission', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('owner@samoon.com'))

    renderGuard({ requiredPermission: 'orders.view', content: 'Orders Content' })
    expect(screen.getByText('Orders Content')).toBeTruthy()
    expect(screen.queryByText('Fallback')).toBeNull()
  })

  it('unauthorized: a Cashier lacking a manager-only P7 permission is denied and sees the fallback', async () => {
    const samoon = await samoonTenant()
    useTenantStore.getState().setTenant(samoon)
    useAuthStore.getState().setUser(userFor('cashier@samoon.com'))

    // 'tenant.manage' is Owner-only in ROLE_PERMISSION_MAP (P10.2.2) — a
    // Cashier's StaffAssignment-derived permission set never includes it.
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

  // A plain substring search would false-positive on comments/JSDoc that
  // reference `rbacService.hasPermission()` for historical context (e.g.
  // this phase's own migration notes, or P10.4.9/P10.4.10's fixture
  // comments) — those are explicitly allowed ("Documentation may still
  // reference it. Only runtime code matters."). Strip comments first so
  // only genuine executable call sites can match.
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
        // rbac.service.ts is the definition itself, not a caller.
        if (file.endsWith(path.join('services', 'rbac.service.ts'))) continue
        const codeOnly = stripComments(fs.readFileSync(file, 'utf8'))
        if (codeOnly.includes('rbacService.hasPermission(')) {
          offenders.push(path.relative(ROOT, file))
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
