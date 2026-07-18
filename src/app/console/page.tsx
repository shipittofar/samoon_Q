'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTenantStore, useRbacStore } from '@/stores'

/**
 * Role-aware admin dashboard router (P8.9.4 Phase B).
 *
 * Reads the current user's P7 permissions and redirects to the most
 * meaningful first screen for them. Falls back to /console/orders for
 * roles that can manage orders, or to /console/customers as the most
 * universal fallback.
 *
 * Phase X.3 — reads `currentTenantSession` (the single live runtime
 * authorization source) instead of the persisted `tenantRoles` array via
 * `getRolesForTenant()`. That persisted copy can retain a stale entry for
 * a tenant across a switch — `AdminTenantSwitcher` only overwrites it
 * when the new tenant grants ≥1 role, so a zero-role switch left it
 * untouched (Phase X audit finding B5). `currentTenantSession` is always
 * freshly reseeded on every switch/login, never persisted, so it cannot
 * carry a stale grant forward.
 */
export default function AdminIndexPage() {
  const router = useRouter()
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const tenantState = useTenantStore((s) => s.tenantState)
  const currentTenantSession = useRbacStore((s) => s.currentTenantSession)

  useEffect(() => {
    // AuthGuard (console/layout.tsx) already blocks rendering this page
    // unless tenantState === 'resolved' — this check is defense-in-depth
    // so the redirect decision itself never runs against an unresolved
    // or null tenant.
    if (tenantState !== 'resolved' || !tenantId) return
    // Defensive: only trust the session if it's actually for the active
    // tenant — same guard usePermissions() applies (hooks/index.ts).
    if (!currentTenantSession || currentTenantSession.tenantId !== tenantId) return

    const permissions = currentTenantSession.permissions

    // Platform admin: tenant management is the primary workflow
    if (permissions.includes('tenant.view') && permissions.includes('tenant.manage')) {
      router.replace('/console/tenants')
      return
    }

    // Kitchen: go directly to KDS
    if (
      permissions.includes('kitchen.view') &&
      !permissions.includes('orders.manage') &&
      !permissions.includes('analytics.view') &&
      !permissions.includes('customers.view')
    ) {
      router.replace('/console/kitchen')
      return
    }

    // Marketing: analytics is the primary workflow
    if (
      permissions.includes('analytics.view') &&
      !permissions.includes('orders.manage') &&
      !permissions.includes('orders.view')
    ) {
      router.replace('/console/analytics')
      return
    }

    // Support: customers is the primary workflow
    if (
      permissions.includes('customers.view') &&
      !permissions.includes('orders.view') &&
      !permissions.includes('analytics.view')
    ) {
      router.replace('/console/customers')
      return
    }

    // Owner / Admin / Manager / Cashier / Multi-role → operational dashboard
    if (permissions.includes('orders.view')) {
      router.replace('/console/orders')
      return
    }

    // Final fallback
    router.replace('/console/customers')
  }, [tenantId, tenantState, currentTenantSession, router])

  // Render nothing while we determine the redirect target
  return null
}
