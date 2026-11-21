'use client'

/**
 * P8.7.5 Phase H — Admin Context Bar
 *
 * Renders above the breadcrumbs in AdminLayout. Shows the active tenant and
 * branch so every admin page is always context-aware. Embeds the
 * AdminBranchSwitcher (branch dropdown) and AdminTenantSwitcher (tenant dropdown
 * for platform admins).
 *
 * Phase 1 — both selectors stay skeleton until workspace + tenant + branches
 * have settled; branch never appears before tenant resolution.
 */

import { AdminBranchSwitcher } from './AdminBranchSwitcher'
import { AdminTenantSwitcher } from './AdminTenantSwitcher'
import { useConsoleSelectorsReady } from '@/hooks/console-workspace'
import { cn } from '@/utils'
import { SuperuserModeBadge } from '@/components/superadmin/SuperuserNav'

function ConsoleSelectorSkeleton() {
  return (
    <div
      className="flex items-center gap-3 flex-wrap"
      aria-busy="true"
      aria-label="Loading workspace context"
    >
      <div className={cn('h-8 w-36 rounded-lg border border-[var(--border)] bg-[var(--card-hover)] animate-pulse')} />
      <div className={cn('h-8 w-44 rounded-lg border border-[var(--border)] bg-[var(--card-hover)] animate-pulse')} />
    </div>
  )
}

export function AdminContextBar() {
  const selectorsReady = useConsoleSelectorsReady()

  if (!selectorsReady) {
    return <ConsoleSelectorSkeleton />
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <SuperuserModeBadge />
      <AdminTenantSwitcher />
      <AdminBranchSwitcher />
    </div>
  )
}
