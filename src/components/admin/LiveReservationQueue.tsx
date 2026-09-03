'use client'

import { useTranslations } from 'next-intl'
import type { LiveReservation, OperationsScope } from '@/types/realtime-operations'
import { useLiveReservations } from '@/hooks'

const STATUS_COLUMNS: LiveReservation['status'][] = ['upcoming', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show']

const STATUS_KEY: Record<LiveReservation['status'], string> = {
  upcoming: 'statusUpcoming',
  confirmed: 'statusConfirmed',
  checked_in: 'statusCheckedIn',
  completed: 'statusCompleted',
  cancelled: 'statusCancelled',
  no_show: 'statusNoShow',
}

const STATUS_COLOR: Record<LiveReservation['status'], string> = {
  upcoming: 'bg-[var(--info-subtle)] border-[var(--info-border)]',
  confirmed: 'bg-[var(--success-subtle)] border-[var(--success-border)]',
  checked_in: 'bg-[var(--success-subtle)] border-[var(--success-border)]',
  completed: 'bg-[var(--card-hover)] border-[var(--border)]',
  cancelled: 'bg-[var(--danger-subtle)] border-[var(--danger-border)]',
  no_show: 'bg-[var(--accent-subtle)] border-[var(--accent-border)]/40',
}

interface ReservationCardProps {
  reservation: LiveReservation
}

function ReservationCard({ reservation: r }: ReservationCardProps) {
  const t = useTranslations('console')
  const scheduled = new Date(r.scheduledAt)
  const timeStr = scheduled.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <div
      className={`rounded border p-3 mb-2 text-sm ${STATUS_COLOR[r.status]} ${r.isOverdue ? 'ring-2 ring-[var(--focus-ring)]' : ''}`}
    >
      <div className="font-semibold truncate">{r.guestName}</div>
      <div className="flex justify-between text-[var(--fg-muted)] text-xs mt-1">
        <span>{t('partyOfSize', { size: r.partySize })}</span>
        <span>{timeStr}</span>
      </div>
      {r.tableNumber && (
        <div className="text-xs text-[var(--fg-muted)] mt-1">{t('tableNumberLabel', { number: r.tableNumber })}</div>
      )}
      {r.waitMinutes > 0 && (
        <div className="text-xs text-[var(--fg-muted)] mt-1">{t('waitMinutesLabel', { minutes: r.waitMinutes })}</div>
      )}
      {r.isOverdue && (
        <div className="mt-1 text-xs font-semibold text-[var(--accent-text)]">{t('overdue')}</div>
      )}
    </div>
  )
}

interface LiveReservationQueueProps {
  scope: OperationsScope
  visibleStatuses?: LiveReservation['status'][]
}

export function LiveReservationQueue({
  scope,
  visibleStatuses = STATUS_COLUMNS,
}: LiveReservationQueueProps) {
  const t = useTranslations('console')
  const { data: reservations = [], isLoading, isError } = useLiveReservations(scope)

  if (isLoading) return <div className="text-sm text-[var(--fg-muted)] p-4">{t('loadingReservations')}</div>
  if (isError) return <div className="text-sm text-[var(--danger-text)] p-4">{t('failedToLoadReservations')}</div>

  const byStatus = (status: LiveReservation['status']) =>
    reservations.filter((r) => r.status === status)

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 min-w-max">
        {visibleStatuses.map((status) => {
          const col = byStatus(status)
          return (
            <div key={status} className="w-44 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                  {t(STATUS_KEY[status])}
                </span>
                <span className="text-xs bg-[var(--border)] rounded-full px-2 py-0.5">{col.length}</span>
              </div>
              <div>
                {col.length === 0 ? (
                  <div className="text-xs text-[var(--fg-subtle)] italic">{t('empty')}</div>
                ) : (
                  col.map((r) => <ReservationCard key={r.id} reservation={r} />)
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
