'use client'

import { use } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  User,
  Phone,
  Mail,
  Hash,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { Badge } from '@/components/ui'
import { useAdminReservation } from '@/hooks'
import { ReservationDuration } from '@/components/admin/ReservationDuration'
import { ReservationActions } from '@/components/admin/ReservationActions'
import type { ReservationStatus } from '@/types'

const STATUS_CONFIG: Partial<Record<
  ReservationStatus,
  { labelKey: string; badge: 'warning' | 'info' | 'success' | 'danger' }
>> = {
  pending:   { labelKey: 'statusPending',   badge: 'warning' },
  confirmed: { labelKey: 'statusConfirmed', badge: 'success' },
  cancelled: { labelKey: 'statusCancelled', badge: 'danger'  },
  completed: { labelKey: 'statusCompleted', badge: 'info'    },
  seated:    { labelKey: 'statusSeated',    badge: 'success' },
  no_show:   { labelKey: 'statusNoShow',    badge: 'danger'  },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] rounded-lg border p-5">
      <h2 className="text-sm font-semibold text-[var(--fg-secondary)] mb-4 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
      <Icon className="w-4 h-4 text-[var(--fg-subtle)] shrink-0"/>
      <span className="text-[var(--fg-muted)] w-32 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function ReservationDetailContent({ id }: { id: string }) {
  const t = useTranslations('console')
  const { data: reservation, isLoading, isError } = useAdminReservation(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-[var(--fg-muted)] text-sm">
        <Loader2 className="w-4 h-4 animate-spin"/>
        {t('loadingReservation')}
      </div>
    )
  }

  if (isError || !reservation) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <XCircle className="w-8 h-8 text-[var(--danger-text)]"/>
        <p className="text-sm text-[var(--fg-muted)]">{t('reservationNotFoundOrFailedToLoad')}</p>
        <Link href="/console/reservations"className="text-sm text-[var(--info-text)] hover:underline">
          {t('backToReservations')}
        </Link>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[reservation.status]
  const statusLabel = statusCfg ? t(statusCfg.labelKey) : reservation.status

  return (
    <div className="min-h-screen bg-[var(--card-hover)]">
      {/* Header */}
      <div className="bg-[var(--card)] border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/console/reservations"className="text-[var(--fg-subtle)] hover:text-[var(--fg)]">
            <ArrowLeft className="w-5 h-5"/>
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <h1 className="text-lg font-semibold">{t('breadcrumbs.reservation')}</h1>
            <Badge variant={statusCfg?.badge ?? 'info'}>{statusLabel}</Badge>
          </div>
          <span className="text-xs text-[var(--fg-subtle)]">{new Date(reservation.created_at).toLocaleString()}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <ReservationActions reservation={reservation} />

        {/* Booking Details */}
        <Section title={t('bookingDetails')}>
          <InfoRow icon={Calendar} label={t('date')} value={reservation.date} />
          <InfoRow icon={Clock} label={t('time')} value={<span dir="ltr">{reservation.end_time ? `${reservation.time}–${reservation.end_time}` : reservation.time}</span>} />
          <div className="py-2"><ReservationDuration reservation={reservation} /></div>
          <InfoRow icon={Users} label={t('reservationTableHeaders.guests')} value={reservation.guests} />
          <InfoRow icon={Hash} label={t('reservationTableHeaders.branch')} value={reservation.branch_name ?? reservation.branch?.name ?? reservation.branch_id} />
          {reservation.confirmation_code && (
            <InfoRow icon={CheckCircle} label={t('confirmation')} value={
              <span className="font-mono text-[var(--success-text)]">{reservation.confirmation_code}</span>
            } />
          )}
          {reservation.notes && (
            <InfoRow icon={Hash} label={t('notes')} value={reservation.notes} />
          )}
        </Section>

        {/* Guest Info */}
        <Section title={t('guestInformation')}>
          <InfoRow icon={User} label={t('name')} value={reservation.name} />
          <InfoRow icon={Phone} label={t('phone_number')} value={reservation.phone_number} />
          {reservation.email && <InfoRow icon={Mail} label={t('email')} value={reservation.email} />}
          {(reservation.customer_id ?? reservation.user?.id) && (
            <div className="mt-3 pt-3 border-t text-xs text-[var(--fg-muted)]">
              <Link href={`/console/customers/${reservation.customer_id ?? reservation.user?.id}`} className="text-[var(--info-text)] hover:underline">
                {t('viewCustomerProfileArrow')}
              </Link>
            </div>
          )}
        </Section>

        {/* Audit link */}
        <div className="text-center">
          <Link
            href={`/console/audit-logs?resource=reservation&resourceId=${reservation.id}`}
            className="text-xs text-[var(--info-text)] hover:underline inline-flex items-center gap-1"
          >
            <Hash className="w-3 h-3"/>
            {t('viewAuditLogsForThisReservation')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <ErrorBoundary feature="Reservation Detail">
      <PermissionGuard permission="reservations.view"fallback={<AccessDenied />}>
        <ReservationDetailContent id={id} />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
