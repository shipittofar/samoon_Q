'use client'

/**
 * P8.7.5 Phase D — Admin Branch Switcher
 * Phase 3 — Branch Resolution refactor.
 *
 * Displays the active tenant name and selected branch. Allows owners/managers
 * to switch branches explicitly — there is no automatic selection here of
 * any kind (no `branches[0]`, no "first branch wins"). Branch resolution
 * itself (fetch + persisted-id validation) happens once per tenant in
 * `BranchResolutionBootstrapper` (providers/index.tsx); this component only
 * reads `branchState`/` selectedBranch`and renders the explicit empty state
 * when no branch is selected, or lets the user pick one via `selectBranch`.
 *
 * Branch switch updates `selectedBranch` in useBranchStore which propagates to:
 *   - PreviewButton (context-aware URLs)
 *   - AdminContextBar (breadcrumb display)
 *   - Any admin module that reads selectedBranch for data scoping
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Building2, GitBranch, Check, Loader2, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/utils'
import { useRbacStore } from '@/stores'
import { useBranchState, useRetryLoadBranches } from '@/hooks'
import { useConsoleWorkspace, useConsoleBranchSwitch } from '@/hooks/console-workspace'
import { getTenantDisplayName } from '@/lib/console-tenant-display'
import { canAccessBranch } from '@/services/permission.service'
import type { Branch as AdminBranch } from '@/types/branch'

export function AdminBranchSwitcher() {
  const t = useTranslations('console')
  const tCommon = useTranslations('common')
  const {
    activeTenantId,
    tenantDisplayName,
    selectedBranch,
    availableBranches,
    branchesSource,
    branchLoading,
    tenantLoading,
    tenantSwitching,
  } = useConsoleWorkspace()
  const { switchBranch, switchingToBranchId, switching } = useConsoleBranchSwitch()
  const branchState = useBranchState()
  const retryLoadBranches = useRetryLoadBranches()

  // When branches come from /auth/me membership.branches the list is already
  // authoritative; canAccessBranch() still applies branchAccess.branchIds for
  // scope:'selected' (defense-in-depth on API fallback path).
  const branchAccess = useRbacStore((s) => s.currentTenantSession?.branchAccess)
  const sessionMemberships = useRbacStore((s) => s.sessionMemberships)
  const accessibleBranches = useMemo(
    () =>
      branchesSource === 'membership'
        ? availableBranches
        : availableBranches.filter((b) => canAccessBranch(branchAccess, b.id)),
    [availableBranches, branchAccess, branchesSource],
  )

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Disable while tenant OR branch is switching — never submit Branch A during Tenant B switch.
  const pending = switching || branchLoading || tenantLoading || tenantSwitching

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Close the menu as soon as a tenant switch starts so stale options cannot be clicked.
  useEffect(() => {
    if (pending) setOpen(false)
  }, [pending])

  async function select(branch: AdminBranch) {
    if (pending) return
    // Defense-in-depth: never call switch-branch for another tenant's branch.
    if (activeTenantId && branch.tenantId !== activeTenantId) return
    if (branch.id === selectedBranch?.id) {
      setOpen(false)
      return
    }
    setOpen(false)
    await switchBranch(branch.id)
  }

  const isLoading = pending || branchState === 'loading'
  const isError = branchState === 'error'
  const isEmpty = branchState === 'empty'

  return (
    <div ref={ref} className="relative flex items-center gap-2 text-sm">
      {/* Tenant label */}
      <div className="hidden sm:flex items-center gap-1.5 text-[var(--fg-muted)]">
        <Building2 className="h-3.5 w-3.5 shrink-0"/>
        <span className="font-medium truncate max-w-[200px]">{tenantDisplayName || '—'}</span>
      </div>

      <span className="hidden sm:block text-[var(--border)] select-none">/</span>

      {/* Branch dropdown trigger */}
      <button
        type="button"
        onClick={() => !pending && setOpen((o) => !o)}
        disabled={pending || accessibleBranches.length === 0}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
          'border border-[var(--border)] bg-[var(--card)] text-[var(--fg)]',
          'hover:bg-[var(--card-hover)] disabled:opacity-50 disabled:cursor-not-allowed',
          isEmpty && !isLoading && 'border-[var(--warning)] text-[var(--warning-text)]',
          isError && 'border-[var(--danger)] text-[var(--danger-text)]',
          open && 'bg-[var(--card-hover)]',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('switchBranchAria')}
      >
        <GitBranch className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]"/>
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin"/>
        ) : isError ? (
          <>
            <AlertCircle className="h-3.5 w-3.5 shrink-0"/>
            <span className="truncate max-w-[200px]">{t('failedToLoadBranches')}</span>
          </>
        ) : (
          // No fallback to any branch's name here — explicit "no branch
          // selected"copy is the only thing shown when selectedBranch is
          // null, whether that's because branchState is ' empty'or the
          // switcher hasn't resolved yet.
          <span className="truncate max-w-[200px]">{selectedBranch?.name ?? t('selectBranch')}</span>
        )}
        <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Explicit empty-state hint — rendered inline, not swallowed silently */}
      {isEmpty && !isLoading && accessibleBranches.length > 0 && (
        <span className="hidden md:inline text-xs text-[var(--warning-text)]">
          {t('selectBranchToManageCategories')}
        </span>
      )}

      {/* Explicit retry — the only way out of 'error'within this session;
          never triggered automatically. */}
      {isError && (
        <button
          type="button"
          onClick={retryLoadBranches}
          className="text-xs font-medium text-[var(--danger-text)] underline hover:no-underline"
        >
          {tCommon('retry')}
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          aria-label={t('breadcrumbs.branches')}
          className={cn(
            'absolute top-full left-0 z-50 mt-1 min-w-[220px] rounded-xl border border-[var(--border)]',
            'bg-[var(--card)] shadow-lg py-1',
          )}
        >
          <p className="px-3 py-1.5 text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wide">
            {getTenantDisplayName(activeTenantId, { memberships: sessionMemberships })}
          </p>
          {accessibleBranches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--fg-muted)]">{t('noBranchesFoundForTenant')}</p>
          ) : (
            accessibleBranches.map((branch) => {
              const isActive = branch.id === selectedBranch?.id
              const isPending = branch.id === switchingToBranchId
              return (
                <button
                  key={branch.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={pending}
                  onClick={() => void select(branch)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                    isActive
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)]'
                      : 'text-[var(--fg)] hover:bg-[var(--card-hover)]',
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{branch.name}</p>
                    <p className="text-xs text-[var(--fg-muted)] truncate">
                      {branch.location.address || branch.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={cn(
                        'inline-block h-1.5 w-1.5 rounded-full',
                        branch.status === 'active' ? 'bg-[var(--success)]' : branch.status === 'maintenance' ? 'bg-[var(--warning)]' : 'bg-[var(--fg-subtle)]',
                      )}
                    />
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin"/>
                    ) : isActive ? (
                      <Check className="h-3.5 w-3.5 text-[var(--accent-text)]"/>
                    ) : null}
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
