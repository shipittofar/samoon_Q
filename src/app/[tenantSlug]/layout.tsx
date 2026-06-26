'use client'

import { use, useEffect } from 'react'
import { useTenantStore } from '@/stores'

/**
 * P8.7.7.2 — Tenant Context Layout
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

  useEffect(() => {
    if (tenant?.slug !== tenantSlug) {
      loadTenant(tenantSlug)
    }
  }, [tenantSlug, tenant?.slug, loadTenant])

  return <>{children}</>
}
