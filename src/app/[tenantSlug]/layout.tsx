'use client'

import { use, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTenantStore, useCartStore } from '@/stores'
import { PUBLIC_TENANTS_QUERY_KEY } from '@/lib/public-tenant-resolution'
import type { Tenant } from '@/types'

/**
 * P8.7.7.2 — Tenant Context Layout
 * P8.7.7.11 — Clear cart on tenant switch (D-05 fix)
 *
 * Wraps all routes under /[tenantSlug]/ that do NOT have a branchSlug.
 * Loads the correct tenant into the store from the URL slug so child pages
 * (like the public tenant homepage) render with the right tenant context.
 *
 * On unmount (navigating to /, /discover, /console, etc.) resets the tenant
 * store so TenantThemeProvider drops per-tenant CSS vars and the app returns
 * to the default global theme.
 *
 * The nested [branchSlug] layout extends this by also initializing the
 * branch context — both layouts are composed by Next.js automatically.
 */
export default function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = use(params)
  const queryClient = useQueryClient()
  const loadTenant = useTenantStore((s) => s.loadTenant)
  const tenant = useTenantStore((s) => s.tenant)
  const tenantState = useTenantStore((s) => s.tenantState)
  const clearCart = useCartStore((s) => s.clearCart)

  useEffect(() => {
    if (tenantState === 'resolved' && tenant?.slug === tenantSlug) return
    if (tenant?.slug !== tenantSlug) {
      // Only clear when switching between two different resolved tenants —
      // never during bootstrap when tenant is null/loading after layout unmount.
      if (tenantState === 'resolved' && tenant?.slug) {
        clearCart()
      }
      const cachedTenants = queryClient.getQueryData<Tenant[]>(PUBLIC_TENANTS_QUERY_KEY)
      void loadTenant(tenantSlug, { cachedTenants })
    }
  }, [tenantSlug, tenant?.slug, tenantState, loadTenant, clearCart, queryClient])

  useEffect(() => {
    return () => {
      useTenantStore.getState().reset()
    }
  }, [])

  return <>{children}</>
}
