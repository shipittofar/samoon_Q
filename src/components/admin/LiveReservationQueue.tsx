'use client'

import type { LiveReservation, OperationsScope } from '@/types/realtime-operations'
import { useLiveReservations } from '@/hooks'

const STATUS_COLUMNS: LiveReservation['status'][] = ['upcoming', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show']

const STATUS_LABEL: Record<LiveReservation['status'], string> = {
  upcoming: 'Upcoming',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
}

const STATUS_COLOR: Record<LiveReservation['status'], string> = {
  upcoming: 'bg-blue-50 border-blue-200',
  confirmed: 'bg-green-50 border-green-200',
  checked_in: 'bg-emerald-50 border-emerald-300',
  completed: 'bg-gray-50 border-gray-200',
  cancelled: 'bg-red-50 border-red-200',
  no_show: 'bg-orange-50 border-orange-200',
}

interface ReservationCardProps {
  reservation: LiveReservation
}

function ReservationCard({ reservation: r }: ReservationCardProps) {
  const scheduled = new Date(r.scheduledAt)
  const timeStr = scheduled.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <div
      className={`rounded border p-3 mb-2 text-sm ${STATUS_COLOR[r.status]} ${r.isOverdue ? 'ring-2 ring-orange-400' : ''}`}
    >
      <div className="font-semibold truncate">{r.guestName}</div>
      <div className="flex justify-between text-gray-600 text-xs mt-1">
        <span>Party of {r.partySize}</span>
        <span>{timeStr}</span>
      </div>
      {r.tableNumber && (
        <div className="text-xs text-gray-500 mt-1">Table {r.tableNumber}</div>
      )}
      {r.waitMinutes > 0 && (
        <div className="text-xs text-gray-500 mt-1">Wait: {r.waitMinutes}m</div>
      )}
      {r.isOverdue && (
        <div className="mt-1 text-xs font-semibold text-orange-600">OVERDUE</div>
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
  const { data: reservations = [], isLoading, isError } = useLiveReservations(scope)

  if (isLoading) return <div className="text-sm text-gray-500 p-4">Loading reservations…</div>
  if (isError) return <div className="text-sm text-red-500 p-4">Failed to load reservations.</div>

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
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {STATUS_LABEL[status]}
                </span>
                <span className="text-xs bg-gray-200 rounded-full px-2 py-0.5">{col.length}</span>
              </div>
              <div>
                {col.length === 0 ? (
                  <div className="text-xs text-gray-400 italic">Empty</div>
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
