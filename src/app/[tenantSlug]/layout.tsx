'use client'

import { use, useEffect } from 'react'
import { useTenantStore, useCartStore } from '@/stores'

/**
 * P8.7.7.2 — Tenant Context Layout
 * P8.7.7.11 — Clear cart on tenant switch (D-05 fix)
 *
 * Wraps all routes under /[tenantSlug]/ that do NOT have a branchSlug.
 * Loads the correct tenant into the store from the URL slug so child pages
 * (like the public tenant homepage) render with the right tenant context.
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
  const loadTenant = useTenantStore((s) => s.loadTenant)
  const tenant = useTenantStore((s) => s.tenant)
  const clearCart = useCartStore((s) => s.clearCart)

  useEffect(() => {
    if (tenant?.slug !== tenantSlug) {
      clearCart()
      loadTenant(tenantSlug)
    }
  }, [tenantSlug, tenant?.slug, loadTenant, clearCart])

  return <>{children}</>
}
