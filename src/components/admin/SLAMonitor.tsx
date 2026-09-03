'use client'

import { useTranslations } from 'next-intl'
import type { SLAAlert, SLAAlertType, OperationsEventPriority, OperationsScope } from '@/types/realtime-operations'
import { useSLAAlerts, useRealtimeStatistics } from '@/hooks'

const PRIORITY_COLOR: Record<OperationsEventPriority, string> = {
  low: 'bg-[var(--info-subtle)] border-[var(--info-border)] text-[var(--info-text)]',
  normal: 'bg-[var(--card-hover)] border-[var(--border)] text-[var(--fg-secondary)]',
  high: 'bg-[var(--accent-subtle)] border-[var(--accent-border)]/40 text-[var(--accent-text)]',
  critical: 'bg-[var(--danger-subtle)] border-[var(--danger)] text-[var(--danger-text)]',
}

const ALERT_TYPE_KEY: Record<SLAAlertType, string> = {
  order_prep_exceeded: 'orderPrepExceeded',
  order_delivery_exceeded: 'deliveryExceeded',
  reservation_wait_exceeded: 'reservationWaitExceeded',
  kitchen_queue_depth: 'kitchenQueueDepth',
  staff_shortage: 'staffShortage',
}

const PRIORITY_KEY: Record<OperationsEventPriority, string> = {
  low: 'priorityLow',
  normal: 'priorityNormal',
  high: 'priorityHigh',
  critical: 'priorityCritical',
}

interface SLAAlertCardProps {
  alert: SLAAlert
}

function SLAAlertCard({ alert }: SLAAlertCardProps) {
  const t = useTranslations('console')
  const raisedAgo = Math.round((Date.now() - new Date(alert.raisedAt).getTime()) / 60_000)
  const excess = alert.elapsedMinutes - alert.thresholdMinutes

  return (
    <div className={`rounded border p-3 mb-2 ${PRIORITY_COLOR[alert.priority]}`}>
      <div className="flex justify-between items-start mb-1">
        <div className="font-semibold text-sm">{t(`slaAlertTypes.${ALERT_TYPE_KEY[alert.type]}`)}</div>
        <span className="text-xs capitalize px-1.5 py-0.5 rounded bg-[var(--card)] bg-opacity-60">
          {t(PRIORITY_KEY[alert.priority])}
        </span>
      </div>
      <div className="text-sm">{alert.entityLabel}</div>
      <div className="text-xs mt-1 text-[var(--fg-muted)]">{alert.message}</div>
      <div className="flex gap-4 mt-2 text-xs">
        <span>{t('elapsedMinutesLabel', { minutes: alert.elapsedMinutes })}</span>
        <span>{t('thresholdMinutesLabel', { minutes: alert.thresholdMinutes })}</span>
        <span className="text-[var(--danger-text)] font-semibold">{t('minutesOver', { minutes: excess })}</span>
      </div>
      <div className="mt-1 text-xs text-[var(--fg-subtle)]">
        {raisedAgo < 1 ? t('raisedJustNow') : t('raisedMinutesAgo', { minutes: raisedAgo })}
      </div>
    </div>
  )
}

interface SLAMonitorProps {
  scope: OperationsScope
}

export function SLAMonitor({ scope }: SLAMonitorProps) {
  const t = useTranslations('console')
  const { data: alerts = [], isLoading: alertsLoading } = useSLAAlerts(scope)
  const { data: stats } = useRealtimeStatistics(scope)

  const active = alerts.filter((a) => a.isActive)
  const critical = active.filter((a) => a.priority === 'critical')
  const high = active.filter((a) => a.priority === 'high')

  if (alertsLoading) return <div className="text-sm text-[var(--fg-muted)] p-4">{t('loadingSlaMonitor')}</div>

  return (
    <div>
      <div className="flex gap-4 mb-4 flex-wrap text-sm">
        <span className={`rounded px-3 py-1 ${critical.length > 0 ? 'bg-[var(--danger-subtle)] text-[var(--danger-text)] font-semibold' : 'bg-[var(--card-hover)]'}`}>
          {t('criticalCount', { count: critical.length })}
        </span>
        <span className={`rounded px-3 py-1 ${high.length > 0 ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)]' : 'bg-[var(--card-hover)]'}`}>
          {t('highCount', { count: high.length })}
        </span>
        <span className="bg-[var(--card-hover)] rounded px-3 py-1">
          {t('activeCount', { count: active.length })}
        </span>
        {stats && (
          <>
            <span className="bg-[var(--info-subtle)] text-[var(--info-text)] rounded px-3 py-1">
              {t('avgPrepLabel', { minutes: stats.averageOrderPrepMinutes })}
            </span>
            <span className={`rounded px-3 py-1 ${stats.slaCompliancePercent < 90 ? 'bg-[var(--danger-subtle)] text-[var(--danger-text)]' : 'bg-[var(--success-subtle)] text-[var(--success-text)]'}`}>
              {t('slaComplianceLabel', { percent: stats.slaCompliancePercent })}
            </span>
          </>
        )}
      </div>

      {active.length === 0 ? (
        <div className="bg-[var(--success-subtle)] border border-[var(--success-border)] rounded p-4 text-sm text-[var(--success-text)] text-center">
          {t('noActiveSlaBreaches')}
        </div>
      ) : (
        <div>
          {critical.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--danger-text)] mb-2">{t('priorityCritical')}</div>
              {critical.map((a) => <SLAAlertCard key={a.id} alert={a} />)}
            </div>
          )}
          {high.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--accent-text)] mb-2">{t('priorityHigh')}</div>
              {high.map((a) => <SLAAlertCard key={a.id} alert={a} />)}
            </div>
          )}
          {active.filter((a) => a.priority !== 'critical' && a.priority !== 'high').map((a) => (
            <SLAAlertCard key={a.id} alert={a} />
          ))}
        </div>
      )}
    </div>
  )
}
