'use client'

/**
 * Make one reservation shorter or longer. Longer only as far as the time after
 * it is free (the server decides; max_duration_minutes is what it allows now).
 */
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { usePermission, useUpdateReservationDuration } from '@/hooks'
import { apiErrorMessage } from '@/services/superadmin.service'
import type { Reservation } from '@/types'

const STEP = 15
const MIN = 5
const OPEN_STATUSES: Reservation['status'][] = ['pending', 'confirmed', 'seated']

/** "19:00" + 90 → "20:30" (wraps past midnight). */
export function endTime(start: string, minutes: number): string {
  const [h, m] = start.split(':').map(Number)
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function ReservationDuration({ reservation }: { reservation: Reservation }) {
  const t = useTranslations('console.reservationDuration')
  const canManage = usePermission('reservations.manage')
  const update = useUpdateReservationDuration()
  const current = reservation.duration_minutes ?? 0
  const max = reservation.max_duration_minutes ?? current
  const [minutes, setMinutes] = useState(current)
  useEffect(() => setMinutes(current), [current])
  if (!canManage || !current || !OPEN_STATUSES.includes(reservation.status)) return null

  const ok = Number.isInteger(minutes) && minutes >= MIN && minutes <= max
  const save = () =>
    update.mutate(
      { id: reservation.id, minutes },
      {
        onSuccess: () => toast.success(t('saved')),
        onError: (err) => {
          const code = (err as { response?: { data?: { error?: { code?: string } } } }).response?.data?.error?.code
          toast.error(code === 'reservation_duration_unavailable' ? t('notFree') : apiErrorMessage(err, t('failed')))
        },
      },
    )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <Button size="sm" variant="secondary" aria-label={t('shorter')} disabled={minutes <= MIN} onClick={() => setMinutes((m) => Math.max(MIN, m - STEP))}>
          <Minus className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="w-32">
          <Input
            label={t('minutes')}
            type="number"
            dir="ltr"
            min={MIN}
            max={max}
            value={Number.isNaN(minutes) ? '' : minutes}
            onChange={(e) => setMinutes(e.target.valueAsNumber)}
          />
        </div>
        <Button size="sm" variant="secondary" aria-label={t('longer')} disabled={minutes >= max} onClick={() => setMinutes((m) => Math.min(max, (m || 0) + STEP))}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button size="sm" loading={update.isPending} disabled={!ok || minutes === current} onClick={save}>
          {t('save')}
        </Button>
      </div>
      <p className="text-xs text-[var(--fg-muted)]">
        {ok && <span dir="ltr">{`${reservation.time}–${endTime(reservation.time, minutes)}`}</span>}
        {ok && ' · '}
        {max > current
          ? t('freeUntil', { time: endTime(reservation.time, max), minutes: max })
          : t('noFreeTime')}
      </p>
    </div>
  )
}
