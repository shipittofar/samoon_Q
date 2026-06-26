'use client'

/**
 * P8.7.5 Phase D — Admin Branch Switcher
 *
 * Displays the active tenant name and active branch. Allows owners/managers
 * to switch branches instantly. Branch switch updates adminActiveBranch in
 * useBranchStore which propagates to:
 *   - PreviewButton (context-aware URLs)
 *   - AdminContextBar (breadcrumb display)
 *   - Any admin module that reads adminActiveBranch for data scoping
 */

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Building2, GitBranch, Check, Loader2 } from 'lucide-react'
import { cn } from '@/utils'
import { useTenantStore, useBranchStore } from '@/stores'
import { useAdminBranches } from '@/hooks'
import type { Branch as AdminBranch } from '@/types/branch'

export function AdminBranchSwitcher() {
  const tenant = useTenantStore((s) => s.tenant)
  const { adminActiveBranch, setAdminActiveBranch } = useBranchStore()
  const { data: branches = [], isLoading } = useAdminBranches(tenant?.id ?? '')

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Auto-select first branch when branches load and none is selected
  useEffect(() => {
    if (branches.length > 0 && !adminActiveBranch) {
      setAdminActiveBranch(branches[0])
    }
  }, [branches, adminActiveBranch, setAdminActiveBranch])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function select(branch: AdminBranch) {
    setAdminActiveBranch(branch)
    setOpen(false)
  }

  const activeBranch = adminActiveBranch ?? branches[0] ?? null

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
          open && 'bg-[var(--card-hover)]',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch branch"
      >
        <GitBranch className="h-3.5 w-3.5 shrink-0 text-orange-500" />
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <span className="truncate max-w-[120px]">{activeBranch?.name ?? 'Select branch'}</span>
        )}
        <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          aria-label="Branches"
          className={cn(
            'absolute top-full left-0 z-50 mt-1 min-w-[220px] rounded-xl border border-[var(--border)]',
            'bg-[var(--card)] shadow-lg py-1',
          )}
        >
          <p className="px-3 py-1.5 text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wide">
            {tenant?.name}
          </p>
          {branches.map((branch) => {
            const isActive = branch.id === activeBranch?.id
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
          })}
        </div>
      )}
    </div>
  )
}
