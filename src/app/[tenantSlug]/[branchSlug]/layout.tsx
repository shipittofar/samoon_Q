'use client'

/**
 * P8.7.5 — Tenant & Branch Context Layout
 *
 * Every route under /[tenantSlug]/[branchSlug]/ is wrapped by this layout.
 * It reads the slugs from URL params, loads the correct tenant context, and
 * sets the matching admin branch — so all child pages render with the right
 * tenant/branch context automatically.
 *
 * This enables context-aware previews: when an admin clicks "Preview Menu",
 * the link opens /savor/main/menu and this layout initializes the correct
 * context before the page renders.
 */

import { use, useEffect } from 'react'
import { useTenantStore, useBranchStore } from '@/stores'
import { useAdminBranches } from '@/hooks'

export default function TenantBranchLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantSlug: string; branchSlug: string }>
}) {
  const { tenantSlug, branchSlug } = use(params)

  const loadTenant = useTenantStore((s) => s.loadTenant)
  const tenant = useTenantStore((s) => s.tenant)
  const { setAdminActiveBranch } = useBranchStore()
  const { data: branches = [] } = useAdminBranches(tenant?.id ?? '')

  // Load correct tenant from URL slug
  useEffect(() => {
    if (tenant?.slug !== tenantSlug) {
      loadTenant(tenantSlug)
    }
  }, [tenantSlug, tenant?.slug, loadTenant])

  // Set active branch from URL slug once branches are loaded
  useEffect(() => {
    if (branches.length === 0) return
    const match = branches.find((b) => b.slug === branchSlug)
    if (match) setAdminActiveBranch(match)
  }, [branchSlug, branches, setAdminActiveBranch])

  return <>{children}</>
}
