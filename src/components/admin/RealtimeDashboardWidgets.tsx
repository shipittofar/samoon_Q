'use client'

import { useTranslations } from 'next-intl'
import { useWebSocketStatus, useRealtimeStatistics, useSLAAlerts, useBranchStatus } from '@/hooks'
import type { OperationsScope } from '@/types/realtime-operations'

// ── RealtimeConnectionStatus ─────────────────────────────────────────────────

export function RealtimeConnectionStatus() {
  const t = useTranslations('console')
  const status = useWebSocketStatus()
  const connected = status === 'connected'
  const connecting = status === 'connecting' || status === 'reconnecting'

  const label = connected ? t('connectionLive') : connecting ? t('connectionConnecting') : t('connectionOffline')
  const color = connected
    ? 'bg-[var(--success)]'
    : connecting
    ? 'bg-[var(--warning)] animate-pulse'
    : 'bg-[var(--danger)]'

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[var(--fg-muted)]">{label}</span>
    </div>
  )
}

// ── ActiveUsersCounter ───────────────────────────────────────────────────────

interface ActiveUsersCounterProps {
  scope: OperationsScope
}

export function ActiveUsersCounter({ scope }: ActiveUsersCounterProps) {
  const t = useTranslations('console')
  const { data: stats } = useRealtimeStatistics(scope)
  return (
    <div className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
      <span>{t('activeStaffLabel')}</span>
      <strong>{stats?.activeStaff ?? '—'}</strong>
    </div>
  )
}

// ── EventsPerMinute ───────────────────────────────────────────────────────────

interface EventsPerMinuteProps {
  scope: OperationsScope
}

export function EventsPerMinute({ scope }: EventsPerMinuteProps) {
  const t = useTranslations('console')
  const { data: stats } = useRealtimeStatistics(scope)
  return (
    <div className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
      <span>{t('eventsPerMinuteLabel')}</span>
      <strong>{stats?.eventsPerMinute ?? '—'}</strong>
    </div>
  )
}

// ── SystemHealthBadge ─────────────────────────────────────────────────────────

interface SystemHealthBadgeProps {
  scope: OperationsScope
}

export function SystemHealthBadge({ scope }: SystemHealthBadgeProps) {
  const t = useTranslations('console')
  const { data: branches = [] } = useBranchStatus(scope)
  const { data: alerts = [] } = useSLAAlerts(scope)

  const criticalAlerts = alerts.filter((a) => a.isActive && a.priority === 'critical').length
  const criticalBranches = branches.filter((b) => b.health === 'critical').length

  const isHealthy = criticalAlerts === 0 && criticalBranches === 0
  const isDegraded = !isHealthy && criticalAlerts < 3 && criticalBranches < 2

  const label = isHealthy ? t('healthHealthy') : isDegraded ? t('healthDegraded') : t('priorityCritical')
  const color = isHealthy
    ? 'bg-[var(--success-subtle)] text-[var(--success-text)] border-[var(--success-border)]'
    : isDegraded
    ? 'bg-[var(--warning-subtle)] text-[var(--warning-text)] border-[var(--warning-border)]'
    : 'bg-[var(--danger-subtle)] text-[var(--danger-text)] border-[var(--danger)]'

  return (
    <span className={`text-xs rounded border px-2 py-0.5 font-medium ${color}`}>
      {t('systemLabel', { label })}
    </span>
  )
}

// ── BranchContextIndicator ────────────────────────────────────────────────────

interface BranchContextIndicatorProps {
  branchId?: string
  branchName?: string
}

export function BranchContextIndicator({ branchId, branchName }: BranchContextIndicatorProps) {
  const t = useTranslations('console')
  if (!branchId) {
    return (
      <span className="text-xs bg-[var(--chart-5)]/10 text-[var(--chart-5)] border border-[var(--chart-5)]/30 rounded px-2 py-0.5">
        {t('allBranches')}
      </span>
    )
  }
  return (
    <span className="text-xs bg-[var(--info-subtle)] text-[var(--info-text)] border border-[var(--info-border)] rounded px-2 py-0.5">
      {branchName ?? branchId}
    </span>
  )
}
