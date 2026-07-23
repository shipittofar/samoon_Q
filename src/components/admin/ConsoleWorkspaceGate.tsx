'use client'

/**
 * Phase Z.11 — Console Workspace Gate (tenant resolution decoupled from
 * Console rendering)
 *
 * Previous architecture (Phase Z.10): `ConsoleWorkspaceGate` decided
 * whether to render the ENTIRE console workspace — chrome included — or
 * a full-page replacement (onboarding / tenant error / access denied).
 * That closed the "zero memberships -> hard error" bug, but it still
 * meant a TEMPORARY tenant loading failure (network blip, 5xx, timeout)
 * unmounted the whole console, including the header and sidebar, and
 * merged every non-'resolved' tenantState into a single blocking screen.
 * Tenant availability is a DATA dependency of the workspace, not an
 * authentication dependency of it — a transient failure fetching tenant
 * data must never look like the user got logged out or hit a dead route.
 *
 * `console/layout.tsx` now renders the chrome (AdminHeader,
 * AdminContextBar, AdminSidebar) unconditionally once authenticated —
 * this component only decides what appears INSIDE `<main>`, and never
 * unmounts the shell around it. See
 * docs/CONSOLE_ARCHITECTURE_TENANT_DECOUPLING_AUDIT.md.
 *
 * State model (maps directly onto the required states):
 *   auth_loading         -> not reached here; AuthGuard's own fallback
 *   authenticated,
 *   membership_loading    <- hasTenantMembership === null
 *   onboarding             <- hasTenantMembership === false
 *   tenant_loading         <- tenantState === 'loading', first attempt
 *   tenant_retrying        <- tenantState === 'loading' | 'error', retryCount > 0 and not yet exhausted
 *   tenant_network_error   <- tenantState === 'error', auto-retry exhausted (manual retry only)
 *   tenant_not_found       <- tenantState === 'not_found' (genuinely no such tenant)
 *   tenant_access_denied   <- tenantState === 'forbidden' (tenant exists, membership's access to it is denied/suspended)
 *   access_denied          <- tenantState === 'resolved', !dashboard:access (RBAC, unchanged)
 *   resolved                <- tenantState === 'resolved', dashboard:access granted -> render children
 *
 * `tenant_not_found`/`tenant_access_denied` are reached ONLY via the
 * store's own explicit classification (`TenantNotFoundError`/
 * `TenantForbiddenError` — src/services/tenant.service.ts,
 * src/stores/index.ts `loadTenant()`) — never for a network failure,
 * timeout, or loading delay. Those always classify as `'error'`, which
 * this component treats as retryable, not as "not found."
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/utils'
import { useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'
import { useTenantStore, useRbacStore } from '@/stores'
import { usePermission, useConsoleSessionRefresh } from '@/hooks'
import type { TenantLifecycle } from '@/types'
import { AccessDenied } from './AccessDenied'
import { ConsoleOnboarding } from './ConsoleOnboarding'

/** Auto-retry cadence for a transient tenant-loading failure. */
export const TENANT_RETRY_DELAY_MS = 4000
/** Auto-retries stop after this many attempts; manual retry remains available indefinitely. */
export const TENANT_MAX_AUTO_RETRIES = 3

export type ConsoleTenantPhase =
  | 'membership_loading'
  | 'onboarding'
  | 'no_active_tenant'
  | 'tenant_awaiting_selection'
  | 'tenant_loading'
  | 'tenant_retrying'
  | 'tenant_network_error'
  | 'tenant_not_found'
  | 'tenant_access_denied'
  | 'access_denied'
  | 'resolved'

/**
 * Pure phase decision — no timers, no store reads. Unit-testable directly.
 * `retryCount === 0` on a 'loading'/'error' tenantState means "first
 * attempt, never yet retried" (tenant_loading); `retryCount > 0` means an
 * auto- or manual retry has already fired at least once (tenant_retrying),
 * until `retryCount` reaches `TENANT_MAX_AUTO_RETRIES`, at which point a
 * still-failing 'error' state settles into `tenant_network_error` (no
 * more automatic retries, manual retry still offered).
 */
export function resolveConsoleTenantPhase(params: {
  hasTenantMembership: boolean | null
  sessionMembershipCount: number | null
  activeTenantId: string | null | undefined
  tenantState: TenantLifecycle
  hasDashboardAccess: boolean
  retryCount: number
}): ConsoleTenantPhase {
  const {
    hasTenantMembership,
    sessionMembershipCount,
    activeTenantId,
    tenantState,
    hasDashboardAccess,
    retryCount,
  } = params

  if (hasTenantMembership === null) return 'membership_loading'
  if (sessionMembershipCount === null) {
    return hasTenantMembership === false ? 'onboarding' : 'membership_loading'
  }
  if (sessionMembershipCount === 0) return 'no_active_tenant'

  const awaitingActiveMembership = !activeTenantId && tenantState === 'not_found'

  if (awaitingActiveMembership) return 'tenant_awaiting_selection'

  if (tenantState === 'not_found') return 'tenant_not_found'
  if (tenantState === 'forbidden') return 'tenant_access_denied'

  if (tenantState === 'loading') {
    return retryCount > 0 ? 'tenant_retrying' : 'tenant_loading'
  }
  if (tenantState === 'error') {
    return retryCount > 0 && retryCount < TENANT_MAX_AUTO_RETRIES ? 'tenant_retrying' : 'tenant_network_error'
  }

  // tenantState === 'resolved'
  return hasDashboardAccess ? 'resolved' : 'access_denied'
}

/**
 * Auto-retry orchestration. Schedules exactly one retry at a time
 * (`timerRef` guards re-scheduling), stops after `TENANT_MAX_AUTO_RETRIES`,
 * clears itself the moment `tenantState` leaves `'error'`, and resets
 * `retryCount` to 0 on a successful resolution so a LATER unrelated
 * failure (e.g. after a tenant switch) gets its own fresh retry budget.
 * Re-attempts the exact slug the last `loadTenant()` call used
 * (`useTenantStore.lastAttemptedSlug`), whichever caller originally chose
 * it (subdomain resolution or the Console membership-based fallback).
 */
function retryLastTenantResolution() {
  const { lastAttemptedTenantId, lastAttemptedSlug, loadTenantById, loadTenant } = useTenantStore.getState()
  if (lastAttemptedTenantId) return loadTenantById(lastAttemptedTenantId)
  return loadTenant(lastAttemptedSlug)
}

function useTenantAutoRetry(tenantState: TenantLifecycle) {
  const [retryCount, setRetryCount] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runRetry = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setRetryCount((c) => c + 1)
    void retryLastTenantResolution()
  }, [])

  useEffect(() => {
    if (tenantState === 'resolved') {
      setRetryCount(0)
    }
    if (tenantState !== 'error' && timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (tenantState === 'error' && retryCount < TENANT_MAX_AUTO_RETRIES && !timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        setRetryCount((c) => c + 1)
        void retryLastTenantResolution()
      }, TENANT_RETRY_DELAY_MS)
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [tenantState, retryCount])

  return { retryCount, retryNow: runRetry }
}

function InlineCenteredState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 px-4 text-center">
      {children}
    </div>
  )
}

function TenantMessage({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <InlineCenteredState>
      <h2 className="text-lg font-semibold text-[var(--fg)]">{title}</h2>
      <p className="max-w-sm text-sm text-[var(--fg-muted)]">{description}</p>
      {action}
    </InlineCenteredState>
  )
}

export function ConsoleWorkspaceGate({ children }: { children: ReactNode }) {
  const t = useTranslations('console')
  const hasTenantMembership = useRbacStore((s) => s.hasTenantMembership)
  const sessionMemberships = useRbacStore((s) => s.sessionMemberships)
  const activeTenantId = useRbacStore((s) => s.activeMembership?.tenantId)
  const tenantState = useTenantStore((s) => s.tenantState)
  const hasDashboardAccess = usePermission('dashboard:access')
  const { retryCount, retryNow } = useTenantAutoRetry(tenantState)
  const { refresh, refreshing } = useConsoleSessionRefresh()

  const sessionMembershipCount =
    sessionMemberships === null ? null : sessionMemberships.length

  const phase = resolveConsoleTenantPhase({
    hasTenantMembership,
    sessionMembershipCount,
    activeTenantId,
    tenantState,
    hasDashboardAccess,
    retryCount,
  })

  const sessionRefreshButton = (
    <button
      type="button"
      onClick={() => void refresh()}
      disabled={refreshing}
      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
      {t('refreshSessionCta')}
    </button>
  )

  switch (phase) {
    case 'membership_loading':
      return null
    case 'onboarding':
      return <ConsoleOnboarding />
    case 'no_active_tenant':
      return (
        <TenantMessage
          title={t('noActiveTenantTitle')}
          description={t('noActiveTenantDesc')}
          action={sessionRefreshButton}
        />
      )
    case 'tenant_awaiting_selection':
      return (
        <TenantMessage
          title={t('selectTenant')}
          description={t('selectTenantPromptDesc')}
        />
      )
    case 'tenant_not_found':
      return <TenantMessage title={t('tenantNotFoundTitle')} description={t('tenantNotFoundDesc')} />
    case 'tenant_access_denied':
      return <TenantMessage title={t('tenantForbiddenTitle')} description={t('tenantForbiddenDesc')} />
    case 'tenant_loading':
    case 'tenant_retrying':
      return (
        <InlineCenteredState>
          <RefreshCw className="h-6 w-6 animate-spin text-[var(--fg-muted)]" aria-hidden="true" />
          <p className="text-sm text-[var(--fg-muted)]">
            {phase === 'tenant_retrying' ? t('tenantRetrying', { attempt: retryCount }) : t('tenantLoading')}
          </p>
        </InlineCenteredState>
      )
    case 'tenant_network_error':
      return (
        <InlineCenteredState>
          <p className="text-sm text-[var(--fg-muted)]">{t('tenantErrorDesc')}</p>
          <button
            type="button"
            onClick={retryNow}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('tenantRetryCta')}
          </button>
        </InlineCenteredState>
      )
    case 'access_denied':
      return <AccessDenied />
    case 'resolved':
      return <>{children}</>
  }
}
