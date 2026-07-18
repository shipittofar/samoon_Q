'use client'

/**
 * P8.7.5 Phase E — Admin Tenant Switcher
 *
 * Visible only to platform admins (users with `tenant.view` permission).
 * Allows switching between all provisioned tenants without session logout.
 * Switching a tenant calls `useTenantStore.loadTenant(slug)` which re-initializes
 * RBAC, feature flags, and all dependent contexts.
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Layers, Check, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/utils'
import { useTenantStore, useBranchStore, useCartStore, useDineInStore, useFavoritesStore, useRecentlyViewedStore, useRbacStore, useAuthStore } from '@/stores'
import { useMyTenants, usePermission } from '@/hooks'
import { featureFlagsService } from '@/services/feature-flags.service'
import { getMockRoles, normalizeTenantPermissions, hasAnyTenantAccess } from '@/services/permission.service'
import { useQueryClient } from '@tanstack/react-query'

const STATUS_DOT: Record<string, string> = {
  active:    'bg-green-500',
  trial:     'bg-blue-400',
  suspended: 'bg-red-400',
  churned:   'bg-gray-400',
  archived:  'bg-gray-300',
}

export function AdminTenantSwitcher() {
  const t = useTranslations('console')
  const canViewTenants = usePermission('tenant.view')
  const tenant = useTenantStore((s) => s.tenant)
  const loadTenant = useTenantStore((s) => s.loadTenant)
  const setFeatureFlags = useTenantStore((s) => s.setFeatureFlags)
  const setFeatureFlagsInitialized = useTenantStore((s) => s.setFeatureFlagsInitialized)
  const setAdminActiveBranch = useBranchStore((s) => s.setAdminActiveBranch)
  const { data: tenants = [], isLoading } = useMyTenants()
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()

  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Phase X.3 — never list (or allow a switch into) a tenant this user has
  // no real membership for. useMyTenants() itself is still backed by an
  // unscoped placeholder (tenantService.getMyTenants() — a backend
  // contract gap tracked separately, see the Phase X audit and Phase Z.1's
  // FRONTEND_CONTRACT_ALIGNMENT_REPORT.md) — this filter is the
  // frontend's own defense-in-depth on top of that, using the same mock
  // membership data switchTenant() already fetches roles from below. The
  // active tenant always stays listed/highlighted even if its own
  // membership lookup were ever to disagree, since the user is already
  // legitimately inside it.
  const accessibleTenants = useMemo(
    () => tenants.filter((tn) => tn.id === tenant?.id || (user && hasAnyTenantAccess(user.id, tn.id))),
    [tenants, user, tenant?.id],
  )

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Only platform admins with tenant.view permission see this
  if (!canViewTenants) return null

  async function switchTenant(slug: string) {
    // Phase X.3 — in-flight guard: without this, two rapid clicks (e.g. on
    // different tenants before the first switch's dropdown-close commits)
    // can start two overlapping switches, each doing its own qc.clear() /
    // loadTenant() / setCurrentTenantSession() — whichever resolves last
    // silently wins, regardless of which tenant the user actually meant to
    // land on (Phase X audit finding B3).
    if (switching) return
    if (slug === tenant?.slug) { setOpen(false); return }
    const currentUser = useAuthStore.getState().user
    // Phase X.3 — defense-in-depth: reject a switch into a tenant this
    // user has no real membership for, even if this were ever called
    // directly rather than through the already-filtered dropdown list
    // below (Phase X audit finding B1 — this is exactly the condition
    // that previously produced a permission-empty session and, via
    // AuthGuard's old redirect-on-denial behavior, an apparent logout).
    const targetTenant = tenants.find((tn) => tn.slug === slug)
    if (!targetTenant || !currentUser || !hasAnyTenantAccess(currentUser.id, targetTenant.id)) {
      setOpen(false)
      return
    }
    setSwitching(true)
    setOpen(false)
    setAdminActiveBranch(null)
    // Phase 2 (RBAC unification) — the previous implementation fell back to
    // the ORIGIN tenant's roles when the new tenant had no explicit
    // assignment for this user. That is permission inheritance across a
    // tenant switch — never correct: a user's access in tenant A implies
    // nothing about tenant B. Clear the session immediately so there is no
    // window where stale tenant-A permissions could be read as valid.
    useRbacStore.getState().clearCurrentTenantSession()
    // Clear all client-side state that is tenant-scoped
    useCartStore.getState().clearCart()
    useDineInStore.getState().clearTable()
    useFavoritesStore.getState().setFavorites([])
    useRecentlyViewedStore.getState().clear()
    // Clear React Query cache so no tenant A data bleeds into tenant B
    qc.clear()
    await loadTenant(slug)
    const newTenant = useTenantStore.getState().tenant
    if (newTenant) {
      setFeatureFlags(featureFlagsService.resolve(newTenant))
      setFeatureFlagsInitialized(true)
      // Fetch the new tenant's session permissions fresh. getMockRoles() is
      // the mock stand-in for a real per-(user,tenant) role-assignment
      // endpoint — an empty result means zero access to this tenant, full
      // stop, never a fallback to whatever the previous tenant granted.
      if (currentUser) {
        const roles = getMockRoles(currentUser.id, newTenant.id)
        const { permissions, branchAccess } = normalizeTenantPermissions({ roles }, newTenant.id)
        useRbacStore.getState().setCurrentTenantSession(newTenant.id, roles, permissions, branchAccess)
        if (roles.length > 0) useRbacStore.getState().setTenantRoles(newTenant.id, roles)
      }
    }
    setSwitching(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isLoading || switching}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
          'border border-[var(--border)] bg-[var(--card)] text-[var(--fg)]',
          'hover:bg-[var(--card-hover)] disabled:opacity-50 disabled:cursor-not-allowed',
          open && 'bg-[var(--card-hover)]',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('switchTenantAria')}
      >
        <Layers className="h-3.5 w-3.5 shrink-0 text-orange-500" />
        {switching ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <span className="truncate max-w-[120px]">{tenant?.name ?? t('selectTenant')}</span>
        )}
        <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('breadcrumbs.tenants')}
          className={cn(
            'absolute top-full left-0 z-50 mt-1 min-w-[220px] rounded-xl border border-[var(--border)]',
            'bg-[var(--card)] shadow-lg py-1',
          )}
        >
          <p className="px-3 py-1.5 text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wide">
            {t('platformTenants')}
          </p>
          {accessibleTenants.map((t) => {
            const isActive = t.id === tenant?.id
            return (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => switchTenant(t.slug)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors',
                  isActive
                    ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400'
                    : 'text-[var(--fg)] hover:bg-[var(--card-hover)]',
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.name}</p>
                  <p className="text-xs text-[var(--fg-muted)] truncate capitalize">
                    {t.businessTypes.join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn('inline-block h-1.5 w-1.5 rounded-full', STATUS_DOT[t.status] ?? 'bg-gray-400')} />
                  {isActive && <Check className="h-3.5 w-3.5 text-orange-500" />}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
