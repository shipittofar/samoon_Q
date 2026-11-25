'use client'

/**
 * The signed-in customer's own reservations at every business, latest first.
 * Updates live (src/lib/live-updates.ts) when a business confirms or cancels.
 */
import { useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Plus, Users } from 'lucide-react'
import { Badge, Card, Skeleton } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useCancelMyReservation, useReservations } from '@/hooks'
import { apiErrorMessage } from '@/services/superadmin.service'
import type { Reservation, ReservationStatus } from '@/types'
import { formatDate } from '@/utils'

const STATUS_BADGE: Record<ReservationStatus, 'success' | 'warning' | 'danger' | 'info' | 'secondary'> = {
  pending: 'warning',
  confirmed: 'success',
  seated: 'info',
  completed: 'secondary',
  cancelled: 'danger',
  no_show: 'secondary',
}

const PAGE_SIZE = 20

/** "Business · Branch", once when both have the same name. */
const place = (r: Reservation) => [...new Set([r.business_name, r.branch_name].filter(Boolean))].join(' · ')
// Without a time, a bare date would be read as UTC and could shift a day.
const day = (r: Reservation) => `${r.date}T00:00`

export default function ReservationsPage() {
  const t = useTranslations('dashboard')
  const tn = useTranslations('notifications')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [page, setPage] = useState(1)
  const [cancelling, setCancelling] = useState<Reservation | null>(null)
  const { data, isLoading, isError, refetch } = useReservations(page)
  const cancel = useCancelMyReservation()
  const reservations = data?.results ?? []
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE))

  const confirmCancel = () => {
    if (!cancelling) return
    cancel.mutate(cancelling.id, {
      onSuccess: () => toast.success(t('reservationCancelled')),
      onError: (err) => toast.error(apiErrorMessage(err, t('reservationsLoadFailed'))),
      onSettled: () => setCancelling(null),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('reservations')}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('totalReservationsCount', { count: data?.count ?? 0 })}</p>
        </div>
        <Link href="/reservation">
          <Button leftIcon={<Plus className="h-4 w-4" />}>{t('newReservation')}</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      ) : isError ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-[var(--fg-muted)]">{t('reservationsLoadFailed')}</p>
          <Button size="sm" variant="secondary" onClick={() => refetch()}>
            {tCommon('retry')}
          </Button>
        </Card>
      ) : reservations.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-12 text-center">
          <Calendar className="mx-auto mb-4 h-12 w-12 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h2 className="mb-2 font-semibold text-[var(--fg)]">{t('noReservationsYet')}</h2>
          <p className="mb-4 text-sm text-[var(--fg-muted)]">{t('bookTableForNextVisit')}</p>
          <Link href="/reservation">
            <Button>{t('bookATable')}</Button>
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {reservations.map((res) => (
            <li key={res.id}>
              <Card className="p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[var(--fg)]">{place(res) || res.name}</p>
                      <Badge variant={STATUS_BADGE[res.status]}>{t(`reservationStatus.${res.status}`)}</Badge>
                    </div>
                    {place(res) && <p className="text-sm text-[var(--fg-muted)]">{res.name}</p>}
                    {res.confirmation_code && (
                      <p className="text-xs text-[var(--fg-muted)]">
                        {t('codeLabel')} <span className="font-mono font-semibold text-[var(--accent-text)]">{res.confirmation_code}</span>
                      </p>
                    )}
                  </div>
                  {res.can_cancel && (
                    <Button variant="ghost" size="sm" className="text-[var(--danger-text)]" onClick={() => setCancelling(res)}>
                      {t('cancelReservation')}
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm text-[var(--fg-muted)] sm:grid-cols-4">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
                    {formatDate(day(res), locale)}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
                    <span dir="ltr">{res.end_time ? `${res.time}–${res.end_time}` : res.time}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
                    {t('guestsCount', { count: res.guests })}
                  </span>
                  {res.branch_name && res.branch_name !== res.business_name && (
                    <span className="flex min-w-0 items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
                      <span className="truncate">{res.branch_name}</span>
                    </span>
                  )}
                </div>
                {res.notes && (
                  <p className="mt-3 rounded-lg bg-[var(--card-hover)] px-3 py-2 text-xs text-[var(--fg-muted)]">{res.notes}</p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm text-[var(--fg-muted)]">
          <Button variant="ghost" size="sm" disabled={page <= 1} aria-label={tn('previous')} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
          {tn('pageOfTotal', { page, total: totalPages })}
          <Button variant="ghost" size="sm" disabled={page >= totalPages} aria-label={tn('next')} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
        </div>
      )}

      <Modal open={cancelling !== null} onClose={() => setCancelling(null)} title={t('cancelReservation')} size="sm">
        {cancelling && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--fg)]">
              {t('cancelReservationConfirm', {
                place: place(cancelling) || cancelling.name,
                when: `${formatDate(day(cancelling), locale)} ${cancelling.time}`,
              })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setCancelling(null)}>
                {t('keepReservation')}
              </Button>
              <Button variant="destructive" size="sm" loading={cancel.isPending} onClick={confirmCancel}>
                {t('cancelReservation')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
