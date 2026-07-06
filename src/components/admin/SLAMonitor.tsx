'use client'

import { useTranslations } from 'next-intl'
import type { SLAAlert, SLAAlertType, OperationsEventPriority, OperationsScope } from '@/types/realtime-operations'
import { useSLAAlerts, useRealtimeStatistics } from '@/hooks'

const PRIORITY_COLOR: Record<OperationsEventPriority, string> = {
  low: 'bg-blue-50 border-blue-200 text-blue-800',
  normal: 'bg-gray-50 border-gray-200 text-gray-700',
  high: 'bg-orange-50 border-orange-300 text-orange-800',
  critical: 'bg-red-50 border-red-400 text-red-900',
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
        <span className="text-xs capitalize px-1.5 py-0.5 rounded bg-white bg-opacity-60">
          {t(PRIORITY_KEY[alert.priority])}
        </span>
      </div>
      <div className="text-sm">{alert.entityLabel}</div>
      <div className="text-xs mt-1 text-gray-600">{alert.message}</div>
      <div className="flex gap-4 mt-2 text-xs">
        <span>{t('elapsedMinutesLabel', { minutes: alert.elapsedMinutes })}</span>
        <span>{t('thresholdMinutesLabel', { minutes: alert.thresholdMinutes })}</span>
        <span className="text-red-600 font-semibold">{t('minutesOver', { minutes: excess })}</span>
      </div>
      <div className="mt-1 text-xs text-gray-400">
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

  if (alertsLoading) return <div className="text-sm text-gray-500 p-4">{t('loadingSlaMonitor')}</div>

  return (
    <div>
      <div className="flex gap-4 mb-4 flex-wrap text-sm">
        <span className={`rounded px-3 py-1 ${critical.length > 0 ? 'bg-red-100 text-red-700 font-semibold' : 'bg-gray-100'}`}>
          {t('criticalCount', { count: critical.length })}
        </span>
        <span className={`rounded px-3 py-1 ${high.length > 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100'}`}>
          {t('highCount', { count: high.length })}
        </span>
        <span className="bg-gray-100 rounded px-3 py-1">
          {t('activeCount', { count: active.length })}
        </span>
        {stats && (
          <>
            <span className="bg-blue-50 text-blue-700 rounded px-3 py-1">
              {t('avgPrepLabel', { minutes: stats.averageOrderPrepMinutes })}
            </span>
            <span className={`rounded px-3 py-1 ${stats.slaCompliancePercent < 90 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {t('slaComplianceLabel', { percent: stats.slaCompliancePercent })}
            </span>
          </>
        )}
      </div>

      {active.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded p-4 text-sm text-green-700 text-center">
          {t('noActiveSlaBreaches')}
        </div>
      ) : (
        <div>
          {critical.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wide text-red-600 mb-2">{t('priorityCritical')}</div>
              {critical.map((a) => <SLAAlertCard key={a.id} alert={a} />)}
            </div>
          )}
          {high.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wide text-orange-600 mb-2">{t('priorityHigh')}</div>
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
