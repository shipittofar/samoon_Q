'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore, useTenantStore, useRbacStore } from '@/stores'
import { getPermissionsForRole } from '@/services/permission.service'

/**
 * Role-aware admin dashboard router (P8.9.4 Phase B).
 *
 * Reads the current user's P7 roles and redirects to the most meaningful
 * first screen for that role. Falls back to /console/orders for roles that
 * can manage orders, or to /console/customers as the most universal fallback.
 */
export default function AdminIndexPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const tenantId = useTenantStore((s) => s.tenant?.id)
  const tenantState = useTenantStore((s) => s.tenantState)
  const getRolesForTenant = useRbacStore((s) => s.getRolesForTenant)

  useEffect(() => {
    // AuthGuard (console/layout.tsx) already blocks rendering this page
    // unless tenantState === 'resolved' — this check is defense-in-depth
    // so the redirect decision itself never runs against an unresolved
    // or null tenant.
    if (tenantState !== 'resolved' || !tenantId) return

    const roles = getRolesForTenant(tenantId)
    const permissions = getPermissionsForRole(roles)

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
  }, [tenantId, tenantState, getRolesForTenant, router])

  // Render nothing while we determine the redirect target
  return null
}
