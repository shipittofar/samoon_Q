'use client'

/**
 * Console Tenant Switcher — membership-driven (GET /auth/me).
 *
 * Lists every tenant in `sessionMemberships`, highlights the active tenant
 * from `activeMembership.tenantId`, and switches via the backend
 * `POST /auth/switch-tenant/` contract followed by a session refresh.
 */

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Layers, Check, Loader2, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/utils'
import { membershipLabel } from '@/lib/console-workspace'
import {
  useConsoleWorkspace,
  useConsoleSessionRefresh,
  useConsoleTenantSwitch,
} from '@/hooks/console-workspace'

const switcherButtonClass =
  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors border border-[var(--border)] bg-[var(--card)] text-[var(--fg)]'

export function AdminTenantSwitcher() {
  const t = useTranslations('console')
  const {
    activeTenantId,
    activeMembershipRecord,
    selectedTenant,
    availableTenants,
    tenantLoading,
  } = useConsoleWorkspace()
  const { refresh, refreshing } = useConsoleSessionRefresh()
  const { switchTenant, switchingToTenantId, switching } = useConsoleTenantSwitch()

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const pending = switching || refreshing || tenantLoading

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  if (availableTenants.length === 0) {
    return (
      <div ref={ref} className="flex items-center gap-1.5">
        <div
          className={cn(
            switcherButtonClass,
            'cursor-default text-[var(--fg-muted)]',
          )}
          aria-label={t('noActiveTenantSwitcherLabel')}
        >
          <Layers className="h-3.5 w-3.5 shrink-0 text-orange-500/70" />
          <span className="truncate max-w-[140px]">{t('noActiveTenantSwitcherLabel')}</span>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={pending}
          className={cn(
            switcherButtonClass,
            'hover:bg-[var(--card-hover)] disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          aria-label={t('refreshSessionAria')}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{t('refreshSessionCta')}</span>
        </button>
      </div>
    )
  }

  const activeLabel = activeTenantId
    ? (selectedTenant?.name ??
      activeMembershipRecord?.tenantName ??
      membershipLabel(
        activeMembershipRecord ??
          availableTenants.find((m) => m.tenantId === activeTenantId) ?? {
            tenantId: activeTenantId,
            roles: [],
            branchAccess: { scope: 'all' },
          },
      ))
    : t('selectTenant')

  async function handleOptionSelect(tenantId: string) {
    if (pending) return
    if (tenantId === activeTenantId) {
      setOpen(false)
      return
    }
    setOpen(false)
    await switchTenant(tenantId)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !pending && setOpen((o) => !o)}
        disabled={pending}
        className={cn(
          switcherButtonClass,
          'hover:bg-[var(--card-hover)] disabled:opacity-50 disabled:cursor-not-allowed',
          open && 'bg-[var(--card-hover)]',
          !activeTenantId && 'text-[var(--fg-muted)]',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('switchTenantAria')}
      >
        <Layers className={cn('h-3.5 w-3.5 shrink-0', activeTenantId ? 'text-orange-500' : 'text-orange-500/70')} />
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <span className="truncate max-w-[220px]">{activeLabel}</span>
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
          {availableTenants.map((membership) => {
            const isActive = membership.tenantId === activeTenantId
            const isPending = membership.tenantId === switchingToTenantId
            return (
              <button
                key={membership.tenantId}
                type="button"
                role="option"
                aria-selected={isActive}
                disabled={pending}
                onClick={() => void handleOptionSelect(membership.tenantId)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                  isActive
                    ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400'
                    : 'text-[var(--fg)] hover:bg-[var(--card-hover)]',
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{membershipLabel(membership)}</p>
                  <p className="text-xs text-[var(--fg-muted)] truncate">
                    {membership.roles.join(', ')}
                  </p>
                </div>
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : isActive ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
