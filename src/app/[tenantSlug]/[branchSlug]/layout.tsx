'use client'

/**
 * P8.7.5 — Tenant & Branch Context Layout
 * P8.7.7.6.1 — Public-safe rewrite (R-01 hotfix)
 *
 * Every route under /[tenantSlug]/[branchSlug]/ is wrapped by this layout.
 * It reads the slugs from URL params, loads the correct tenant context, and
 * sets the public-facing activeBranch — so all child pages render with the
 * right tenant/branch context automatically, including for anonymous visitors.
 *
 * Uses canonical tenant → branch records (with legacy marketplace fallback) —
 * no admin APIs, no auth required. Safe for incognito, logged-out browsers,
 * and direct deep links.
 */

import { use, useEffect } from 'react'
import { useTenantStore, useBranchStore } from '@/stores'
import { usePublicBranches } from '@/hooks'
import { findPublicBranchBySlug } from '@/lib/public-branches'
import { publicBranchToLocation } from '@/lib/branch-adapters'

export default function TenantBranchLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantSlug: string; branchSlug: string }>
}) {
  const { tenantSlug, branchSlug } = use(params)

  const tenant = useTenantStore((s) => s.tenant)
  const tenantState = useTenantStore((s) => s.tenantState)
  const setActiveBranch = useBranchStore((s) => s.setActiveBranch)
  const { data: publicBranches } = usePublicBranches(tenant?.id ?? '', tenant?.settings)

  // Tenant bootstrap is owned by the parent [tenantSlug]/layout.tsx — never
  // call loadTenant(slug) here; that duplicated GET /tenants/{slug}/ after
  // bootstrap and violated the id-only post-bootstrap contract.

  // Set public activeBranch from tenant branch relation once tenant is loaded
  useEffect(() => {
    if (tenantState !== 'resolved' || !tenant || tenant.slug !== tenantSlug) return
    const match = findPublicBranchBySlug(publicBranches ?? [], branchSlug)
    if (match?.id) {
      setActiveBranch(publicBranchToLocation(match, tenant.id))
    }
  }, [tenantSlug, branchSlug, tenant, tenantState, setActiveBranch, publicBranches])

  return <>{children}</>
}
