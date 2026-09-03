'use client'

import { useTranslations } from 'next-intl'
import type { BranchStatus, BranchHealthLevel, OperationsScope } from '@/types/realtime-operations'
import { useBranchStatus } from '@/hooks'

const HEALTH_KEY: Record<BranchHealthLevel, string> = {
  healthy: 'healthHealthy',
  degraded: 'healthDegraded',
  critical: 'healthCritical',
  offline: 'healthOffline',
}

const HEALTH_COLOR: Record<BranchHealthLevel, string> = {
  healthy: 'bg-[var(--success-subtle)] border-[var(--success-border)] text-[var(--success-text)]',
  degraded: 'bg-[var(--warning-subtle)] border-[var(--warning-border)] text-[var(--warning-text)]',
  critical: 'bg-[var(--danger-subtle)] border-[var(--danger-border)] text-[var(--danger-text)]',
  offline: 'bg-[var(--card-hover)] border-[var(--border-strong)] text-[var(--fg-muted)]',
}

const HEALTH_DOT: Record<BranchHealthLevel, string> = {
  healthy: 'bg-[var(--success)]',
  degraded: 'bg-[var(--warning)]',
  critical: 'bg-[var(--danger)]',
  offline: 'bg-[var(--fg-subtle)]',
}

interface BranchCardProps {
  branch: BranchStatus
}

function BranchCard({ branch }: BranchCardProps) {
  const t = useTranslations('console')
  const updated = new Date(branch.lastUpdated)
  const minutesAgo = Math.round((Date.now() - updated.getTime()) / 60_000)

  return (
    <div className={`rounded-lg border-2 p-4 ${HEALTH_COLOR[branch.health]}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-sm">{branch.branchName}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`w-2.5 h-2.5 rounded-full ${HEALTH_DOT[branch.health]}`} />
            <span className="text-xs capitalize">{t(HEALTH_KEY[branch.health])}</span>
            {!branch.isOpen && <span className="text-xs bg-[var(--card)] text-white rounded px-1.5 ml-1">{t('closed')}</span>}
          </div>
        </div>
        {branch.notificationCount > 0 && (
          <span className="text-xs bg-[var(--card)] rounded-full px-2 py-0.5 border font-semibold">
            {t('alertsCount', { count: branch.notificationCount })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        <div className="bg-[var(--card)] bg-opacity-50 rounded p-2">
          <div className="font-bold text-base">{branch.activeOrders}</div>
          <div className="text-[var(--fg-muted)]">{t('breadcrumbs.orders')}</div>
        </div>
        <div className="bg-[var(--card)] bg-opacity-50 rounded p-2">
          <div className="font-bold text-base">{branch.pendingReservations}</div>
          <div className="text-[var(--fg-muted)]">{t('breadcrumbs.reservations')}</div>
        </div>
        <div className="bg-[var(--card)] bg-opacity-50 rounded p-2">
          <div className="font-bold text-base">{branch.staffOnline}</div>
          <div className="text-[var(--fg-muted)]">{t('breadcrumbs.staff')}</div>
        </div>
      </div>

      {branch.systemAlerts.length > 0 && (
        <div className="mt-3 space-y-1">
          {branch.systemAlerts.map((alert, i) => (
            <div key={i} className="text-xs bg-[var(--card)] bg-opacity-60 rounded px-2 py-1 text-[var(--danger-text)]">
              {alert}
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 text-xs text-[var(--fg-muted)] text-right">
        {minutesAgo < 1 ? t('updatedJustNow') : t('updatedMinutesAgo', { minutes: minutesAgo })}
      </div>
    </div>
  )
}

interface BranchStatusGridProps {
  scope: OperationsScope
}

export function BranchStatusGrid({ scope }: BranchStatusGridProps) {
  const t = useTranslations('console')
  const { data: branches = [], isLoading, isError } = useBranchStatus(scope)

  if (isLoading) return <div className="text-sm text-[var(--fg-muted)] p-4">{t('loadingBranchStatus')}</div>
  if (isError) return <div className="text-sm text-[var(--danger-text)] p-4">{t('failedToLoadBranchStatus')}</div>

  const healthCounts = {
    healthy: branches.filter((b) => b.health === 'healthy').length,
    degraded: branches.filter((b) => b.health === 'degraded').length,
    critical: branches.filter((b) => b.health === 'critical').length,
    offline: branches.filter((b) => b.health === 'offline').length,
  }

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap text-sm">
        <span className="bg-[var(--success-subtle)] text-[var(--success-text)] rounded px-3 py-1">
          {t('healthyCount', { count: healthCounts.healthy })}
        </span>
        <span className="bg-[var(--warning-subtle)] text-[var(--warning-text)] rounded px-3 py-1">
          {t('degradedCount', { count: healthCounts.degraded })}
        </span>
        <span className="bg-[var(--danger-subtle)] text-[var(--danger-text)] rounded px-3 py-1">
          {t('criticalCount', { count: healthCounts.critical })}
        </span>
        <span className="bg-[var(--card-hover)] text-[var(--fg-muted)] rounded px-3 py-1">
          {t('offlineCount', { count: healthCounts.offline })}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {branches.map((branch) => (
          <BranchCard key={branch.branchId} branch={branch} />
        ))}
      </div>
    </div>
  )
}
