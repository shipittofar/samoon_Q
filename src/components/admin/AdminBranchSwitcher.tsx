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
 * reads `branchState`/`selectedBranch` and renders the explicit empty state
 * when no branch is selected, or lets the user pick one via `selectBranch`.
 *
 * Branch switch updates `selectedBranch` in useBranchStore which propagates to:
 *   - PreviewButton (context-aware URLs)
 *   - AdminContextBar (breadcrumb display)
 *   - Any admin module that reads selectedBranch for data scoping
 */

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Building2, GitBranch, Check, Loader2, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/utils'
import { useTenantStore, useBranchStore } from '@/stores'
import { BRANCH_SCOPED_QUERY_KEYS } from '@/hooks'
import type { Branch as AdminBranch } from '@/types/branch'
import { useQueryClient } from '@tanstack/react-query'

export function AdminBranchSwitcher() {
  const t = useTranslations('console')
  const tenant = useTenantStore((s) => s.tenant)
  const selectedBranch = useBranchStore((s) => s.selectedBranch)
  const branchState = useBranchStore((s) => s.branchState)
  const branches = useBranchStore((s) => s.branches)
  const selectBranch = useBranchStore((s) => s.selectBranch)
  const qc = useQueryClient()

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function select(branch: AdminBranch) {
    if (branch.id === selectedBranch?.id) { setOpen(false); return }
    selectBranch(branch)
    setOpen(false)
    // Invalidate every branch-scoped admin query (shared allowlist, kept in
    // sync with the query keys themselves — see hooks/index.ts) so stale
    // branch data from the previous selection is never shown.
    for (const key of BRANCH_SCOPED_QUERY_KEYS) {
      qc.invalidateQueries({ queryKey: [key] })
    }
  }

  const isLoading = branchState === 'loading'
  const isError = branchState === 'error'
  const isEmpty = branchState === 'empty'

  return (
    <div ref={ref} className="relative flex items-center gap-2 text-sm">
      {/* Tenant label */}
      <div className="hidden sm:flex items-center gap-1.5 text-[var(--fg-muted)]">
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium truncate max-w-[120px]">{tenant?.name ?? '—'}</span>
      </div>

      <span className="hidden sm:block text-[var(--border)] select-none">/</span>

      {/* Branch dropdown trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isLoading || branches.length === 0}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
          'border border-[var(--border)] bg-[var(--card)] text-[var(--fg)]',
          'hover:bg-[var(--card-hover)] disabled:opacity-50 disabled:cursor-not-allowed',
          isEmpty && !isLoading && 'border-amber-400 text-amber-600 dark:text-amber-400',
          isError && 'border-red-400 text-red-600 dark:text-red-400',
          open && 'bg-[var(--card-hover)]',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('switchBranchAria')}
      >
        <GitBranch className="h-3.5 w-3.5 shrink-0 text-orange-500" />
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isError ? (
          <>
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[120px]">{t('failedToLoadBranches')}</span>
          </>
        ) : (
          // No fallback to any branch's name here — explicit "no branch
          // selected" copy is the only thing shown when selectedBranch is
          // null, whether that's because branchState is 'empty' or the
          // switcher hasn't resolved yet.
          <span className="truncate max-w-[120px]">{selectedBranch?.name ?? t('selectBranch')}</span>
        )}
        <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Explicit empty-state hint — rendered inline, not swallowed silently */}
      {isEmpty && !isLoading && branches.length > 0 && (
        <span className="hidden md:inline text-xs text-amber-600 dark:text-amber-400">
          {t('selectBranchToManageCategories')}
        </span>
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
            {tenant?.name}
          </p>
          {branches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--fg-muted)]">{t('noBranchesFoundForTenant')}</p>
          ) : (
            branches.map((branch) => {
              const isActive = branch.id === selectedBranch?.id
              return (
                <button
                  key={branch.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => select(branch)}
                  className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors',
                    isActive
                      ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400'
                      : 'text-[var(--fg)] hover:bg-[var(--card-hover)]',
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{branch.name}</p>
                    <p className="text-xs text-[var(--fg-muted)] truncate">{branch.location.address}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={cn(
                        'inline-block h-1.5 w-1.5 rounded-full',
                        branch.status === 'active' ? 'bg-green-500' : branch.status === 'maintenance' ? 'bg-amber-500' : 'bg-gray-400',
                      )}
                    />
                    {isActive && <Check className="h-3.5 w-3.5 text-orange-500" />}
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
