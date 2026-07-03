'use client'

import { use } from 'react'
import Link from 'next/link'
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
import type { ReservationStatus } from '@/types'

const STATUS_CONFIG: Record<
  ReservationStatus,
  { label: string; badge: 'warning' | 'info' | 'success' | 'danger' }
> = {
  pending:   { label: 'Pending',   badge: 'warning' },
  confirmed: { label: 'Confirmed', badge: 'success' },
  cancelled: { label: 'Cancelled', badge: 'danger'  },
  completed: { label: 'Completed', badge: 'info'    },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="text-gray-500 w-32 shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function ReservationDetailContent({ id }: { id: string }) {
  const { data: reservation, isLoading, isError } = useAdminReservation(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading reservation…
      </div>
    )
  }

  if (isError || !reservation) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <XCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-gray-600">Reservation not found or failed to load.</p>
        <Link href="/console/reservations" className="text-sm text-blue-600 hover:underline">
          Back to reservations
        </Link>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[reservation.status] ?? { label: reservation.status, badge: 'info' as const }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/console/reservations" className="text-gray-400 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <h1 className="text-lg font-semibold">Reservation</h1>
            <Badge variant={statusCfg.badge}>{statusCfg.label}</Badge>
          </div>
          <span className="text-xs text-gray-400">{new Date(reservation.created_at).toLocaleString()}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Booking Details */}
        <Section title="Booking Details">
          <InfoRow icon={Calendar} label="Date" value={reservation.date} />
          <InfoRow icon={Clock} label="Time" value={reservation.time} />
          <InfoRow icon={Users} label="Guests" value={reservation.guests} />
          <InfoRow icon={Hash} label="Branch" value={reservation.branch?.name ?? reservation.branch_id} />
          {reservation.confirmation_code && (
            <InfoRow icon={CheckCircle} label="Confirmation" value={
              <span className="font-mono text-green-700">{reservation.confirmation_code}</span>
            } />
          )}
          {reservation.notes && (
            <InfoRow icon={Hash} label="Notes" value={reservation.notes} />
          )}
        </Section>

        {/* Guest Info */}
        <Section title="Guest Information">
          <InfoRow icon={User} label="Name" value={reservation.name} />
          <InfoRow icon={Phone} label="Phone" value={reservation.phone} />
          {reservation.email && <InfoRow icon={Mail} label="Email" value={reservation.email} />}
          {reservation.user && (
            <div className="mt-3 pt-3 border-t text-xs text-gray-500">
              <Link href={`/console/customers/${reservation.user.id}`} className="text-blue-600 hover:underline">
                View customer profile →
              </Link>
            </div>
          )}
        </Section>

        {/* Audit link */}
        <div className="text-center">
          <Link
            href={`/console/audit-logs?resource=reservation&resourceId=${reservation.id}`}
            className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            <Hash className="w-3 h-3" />
            View audit logs for this reservation
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
      <PermissionGuard permission="reservations.view" fallback={<AccessDenied />}>
        <ReservationDetailContent id={id} />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
