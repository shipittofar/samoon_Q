'use client'

/**
 * What the business can do next with a reservation (same steps the server
 * allows). Cancelling and no-show ask first: they cannot be undone.
 */
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { usePermission, useUpdateReservationStatus } from '@/hooks'
import { apiErrorMessage } from '@/services/superadmin.service'
import type { Reservation, ReservationStatus } from '@/types'

export const NEXT_RESERVATION_STATUSES: Record<ReservationStatus, readonly ReservationStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['seated', 'no_show', 'cancelled'],
  seated: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
}

const LABEL: Partial<Record<ReservationStatus, string>> = {
  confirmed: 'reservationActions.confirm',
  seated: 'reservationActions.seat',
  completed: 'reservationActions.complete',
  no_show: 'reservationActions.noShow',
  cancelled: 'reservationActions.cancel',
}

const isFinal = (s: ReservationStatus) => s === 'cancelled' || s === 'no_show'

export function ReservationActions({ reservation }: { reservation: Reservation }) {
  const t = useTranslations('console')
  const canManage = usePermission('reservations.manage')
  const update = useUpdateReservationStatus()
  const [asking, setAsking] = useState<ReservationStatus | null>(null)
  const next = NEXT_RESERVATION_STATUSES[reservation.status] ?? []
  if (!canManage || next.length === 0) return null

  const apply = (status: ReservationStatus) =>
    update.mutate(
      { id: reservation.id, status },
      {
        onError: (err) => toast.error(apiErrorMessage(err, t('failedToLoadReservations'))),
        onSettled: () => setAsking(null),
      },
    )

  return (
    <div className="flex flex-wrap gap-1.5">
      {next.map((status) => (
        <Button
          key={status}
          size="sm"
          variant={isFinal(status) ? 'ghost' : 'secondary'}
          className={isFinal(status) ? 'text-[var(--danger-text)]' : undefined}
          disabled={update.isPending}
          onClick={() => (isFinal(status) ? setAsking(status) : apply(status))}
        >
          {t(LABEL[status] ?? 'reservationActions.confirm')}
        </Button>
      ))}
      <Modal open={asking !== null} onClose={() => setAsking(null)} title={asking ? t(LABEL[asking]!) : ''} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-[var(--fg)]">
            {t('reservationActions.sure', { name: reservation.name, when: `${reservation.date} ${reservation.time}` })}
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setAsking(null)}>
              {t('reservationActions.back')}
            </Button>
            <Button size="sm" variant="destructive" loading={update.isPending} onClick={() => asking && apply(asking)}>
              {asking ? t(LABEL[asking]!) : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
