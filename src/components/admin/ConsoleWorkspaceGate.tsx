'use client'

/**
 * Phase Z.10 — Console Workspace Gate
 *
 * Console is an application workspace, not a tenant-gated page. Tenant
 * resolution used to be a hard precondition — AuthGuard's
 * `requireResolvedTenant` blocked ALL of Console's chrome (header,
 * sidebar, everything) until `tenantState === 'resolved'`, which meant a
 * genuinely tenant-less business owner (a brand-new signup with zero
 * memberships) could never see Console at all — only a "Tenant not
 * found" error, indistinguishable from an actual routing/subdomain bug.
 * See docs/CONSOLE_TENANT_DEPENDENCY_REDESIGN_AUDIT.md for the full
 * audit this component implements.
 *
 * This component is mounted INSIDE `<AuthGuard>` (auth-only now — no
 * `requiredPermission`/`requireResolvedTenant` on that guard for
 * Console; see src/app/console/layout.tsx), so by the time it renders
 * the user is known to be authenticated. It owns the tenant-context and
 * RBAC decision that `AuthGuard` used to make for Console specifically:
 *
 *   hasTenantMembership === null   -> still resolving the session, wait
 *   hasTenantMembership === false  -> onboarding (Console still "loads")
 *   hasTenantMembership === true:
 *     tenantState === 'loading'    -> still resolving tenant context, wait
 *     tenantState !== 'resolved'   -> a real error (the membership's own
 *                                     tenant is suspended/forbidden/etc,
 *                                     or resolution genuinely failed) —
 *                                     distinct from "no tenant at all"
 *     tenantState === 'resolved':
 *       !dashboard:access          -> AccessDenied (RBAC, unchanged)
 *       dashboard:access           -> render the full workspace (children)
 *
 * Tenant membership decides ACCESS (via RBAC below); accountType never
 * does — this component reads no accountType field at all.
 */

import { type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useTenantStore, useRbacStore } from '@/stores'
import { usePermission } from '@/hooks'
import { AccessDenied } from './AccessDenied'
import { ConsoleOnboarding } from './ConsoleOnboarding'

function TenantResolutionMessage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm space-y-2 text-center">
        <h1 className="text-lg font-semibold text-[var(--fg)]">{title}</h1>
        <p className="text-sm text-[var(--fg-muted)]">{description}</p>
      </div>
    </div>
  )
}

export function ConsoleWorkspaceGate({ children }: { children: ReactNode }) {
  const t = useTranslations('console')
  const hasTenantMembership = useRbacStore((s) => s.hasTenantMembership)
  const tenantState = useTenantStore((s) => s.tenantState)
  const hasDashboardAccess = usePermission('dashboard:access')

  // Still determining whether this session has any tenant membership at
  // all — wait rather than guess (mirrors AuthGuard's own isLoading gate).
  if (hasTenantMembership === null) return null

  if (hasTenantMembership === false) {
    return <ConsoleOnboarding />
  }

  // Has at least one membership — a tenant context should resolve
  // (subdomain resolution, or the membership-based fallback — see
  // resolveConsoleTenantFallbackSlug() in src/providers/index.tsx).
  if (tenantState === 'loading') return null

  if (tenantState !== 'resolved') {
    if (tenantState === 'not_found') {
      return <TenantResolutionMessage title={t('tenantNotFoundTitle')} description={t('tenantNotFoundDesc')} />
    }
    if (tenantState === 'forbidden') {
      return <TenantResolutionMessage title={t('tenantForbiddenTitle')} description={t('tenantForbiddenDesc')} />
    }
    return <TenantResolutionMessage title={t('tenantErrorTitle')} description={t('tenantErrorDesc')} />
  }

  if (!hasDashboardAccess) {
    return <AccessDenied />
  }

  return <>{children}</>
}
