'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import {
  Calendar, Search, Users, Clock, Phone, Mail, Check, X,
  ChevronLeft, ChevronRight, Loader2, AlertCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/utils'
import { useAdminReservations, useConfirmReservation, useCancelReservation, useAdminBranches, useBulkConfirmReservations, useBulkCancelReservations, useConsoleTenantId, usePermission } from '@/hooks'
import type { AdminReservationFilters, ReservationStatus } from '@/types'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { BulkActionBar } from '@/components/admin/BulkActionBar'
import { ReservationActions } from '@/components/admin/ReservationActions'
import { PreviewButton } from '@/components/admin/PreviewButton'
import { QrManagementPanel } from '@/components/qr/QrManagementPanel'
import { APP_URL } from '@/constants'


const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'secondary'> = {
  confirmed: 'success', pending: 'warning', cancelled: 'danger', completed: 'secondary', seated: 'success', no_show: 'danger',
}

const STATUS_KEY: Record<string, string> = {
  confirmed: 'statusConfirmed', pending: 'statusPending', cancelled: 'statusCancelled', completed: 'statusCompleted',
  seated: 'statusSeated', no_show: 'statusNoShow',
}

const PAGE_SIZE = 50

export default function AdminReservationsPage() {
  const t = useTranslations('console')
  const tCommon = useTranslations('common')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all')
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [currentDate, setCurrentDate] = useState(new Date())
  const tenantId = useConsoleTenantId() ?? ''
  const canManageReservationQr = usePermission('reservations.manage')
  const { data: adminBranches = [] } = useAdminBranches(tenantId)

  // The business's calendar day, not UTC's.
  const todayStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
  const [page, setPage] = useState(1)

  const filters = useMemo<AdminReservationFilters>(() => ({
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(branchFilter !== 'all' ? { branch_id: branchFilter } : {}),
    ...(search ? { search } : {}),
    date: todayStr,
    page,
    page_size: PAGE_SIZE,
  }), [statusFilter, branchFilter, search, todayStr, page])
  useEffect(() => setPage(1), [statusFilter, branchFilter, search, todayStr])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const { data, isLoading, isError, refetch } = useAdminReservations(filters)
  const confirmMutation = useConfirmReservation()
  const cancelMutation = useCancelReservation()
  const bulkConfirm = useBulkConfirmReservations()
  const bulkCancelRes = useBulkCancelReservations()

  const reservations = data?.results ?? []

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds((prev) => prev.size === reservations.length ? new Set() : new Set(reservations.map((r) => r.id)))
  }

  const selectedArr = Array.from(selectedIds)

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE))

  const counts = useMemo(() => {
    const of = (s: ReservationStatus) => data?.counts?.[s] ?? reservations.filter((r) => r.status === s).length
    return {
      all: data?.counts ? Object.values(data.counts).reduce((sum, n) => sum + (n ?? 0), 0) : data?.count ?? 0,
      pending: of('pending'),
      confirmed: of('confirmed'),
      cancelled: of('cancelled'),
    }
  }, [data, reservations])

  const getBranchName = (branchId: string) =>
    adminBranches.find((b) => b.id === branchId)?.name ?? '—'

  return (

    <PermissionGuard permission="reservations.view"fallback={<AccessDenied />}>
    <ErrorBoundary feature="AdminReservations">
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="py-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">{t('breadcrumbs.reservations')}</h1>
              <p className="text-[var(--fg-muted)] mt-1">{t('reservationsPageSubtitle')}</p>
            </div>
            <Link href="/console/reservations/settings"><Button variant="secondary" size="sm">{t('reservationRules.open')}</Button></Link>
            <PreviewButton href="/reservation"label={t('previewReservationPage')} size="sm"/>
            {/* Date navigator */}
            <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-xl p-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })}
              >
                <ChevronLeft className="h-4 w-4"/>
              </Button>
              <span className="text-sm font-medium text-[var(--fg)] px-3">{formatDate(currentDate.toISOString())}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })}
              >
                <ChevronRight className="h-4 w-4"/>
              </Button>
            </div>
          </div>

          {tenantId ? (
            <div className="mb-6">
              <QrManagementPanel
                scope="reservation"
                entityId={tenantId}
                canManage={canManageReservationQr}
                publicUrl={`${APP_URL}/reservation`}
                publicUrlLabel={t('currentPublicPageLabel')}
                title={t('reservationQrTitle')}
                description={t('reservationQrDescription')}
                sectionAria={t('reservationQrSectionAria')}
              />
            </div>
          ) : null}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: t('totalLabel'),       value: counts.all,       color: 'text-[var(--fg)]',      bg: 'bg-[var(--card-hover)]' },
              { label: t('statusPending'),   value: counts.pending,   color: 'text-[var(--warning-text)]',         bg: 'bg-[var(--warning-subtle)]' },
              { label: t('statusConfirmed'), value: counts.confirmed, color: 'text-[var(--success-text)]',        bg: 'bg-[var(--success-subtle)]' },
              { label: t('statusCancelled'), value: counts.cancelled, color: 'text-[var(--danger-text)]',            bg: 'bg-[var(--danger-subtle)]' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-4 border border-[var(--border)]`}>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-sm text-[var(--fg-muted)]">{label}</p>
              </div>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"/>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchReservationsPlaceholder')}
                className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40"
              />
            </div>
            {adminBranches.length > 0 && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40"
                aria-label={t('filterByBranchAria')}
              >
                <option value="all">{t('allBranches')}</option>
                {adminBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'pending', 'confirmed', 'cancelled'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all capitalize ${statusFilter === s ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent-text)]' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent-border)]/50'}`}
                >
                  {s === 'all' ? t('allStatuses') : t(STATUS_KEY[s])}
                </button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-24 gap-3 text-[var(--fg-muted)]">
              <Loader2 className="h-5 w-5 animate-spin"/>
              <span className="text-sm">{t('loadingReservations')}</span>
            </div>
          )}

          {/* Error */}
          {isError && !isLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertCircle className="h-8 w-8 text-[var(--danger-text)]"/>
              <p className="text-sm text-[var(--fg-muted)]">{t('failedToLoadReservations')}</p>
              <Button variant="secondary"size="sm"onClick={() => refetch()}>{tCommon('retry')}</Button>
            </div>
          )}

          {/* Table */}
          {!isLoading && !isError && (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--card-hover)]">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          aria-label={t('selectAllReservationsAria')}
                          checked={reservations.length > 0 && selectedIds.size === reservations.length}
                          onChange={toggleSelectAll}
                          className="rounded border-[var(--border)]"
                        />
                      </th>
                      {['guest', 'dateTime', 'guests', 'branch', 'contact', 'notes', 'status', 'actions'].map((h) => (
                        <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider whitespace-nowrap">{t(`reservationTableHeaders.${h}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {reservations.map((res, i) => {
                      const isConfirming = confirmMutation.isPending && confirmMutation.variables === res.id
                      const isCancelling = cancelMutation.isPending && cancelMutation.variables === res.id
                      return (
                        <motion.tr
                          key={res.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.04 }}
                          className={`hover:bg-[var(--card-hover)] transition-colors ${selectedIds.has(res.id) ? 'bg-[var(--accent-subtle)]/40' : ''}`}
                        >
                          <td className="px-4 py-3.5">
                            <input
                              type="checkbox"
                              aria-label={t('selectReservationForAria', { name: res.name })}
                              checked={selectedIds.has(res.id)}
                              onChange={() => toggleSelect(res.id)}
                              className="rounded border-[var(--border)]"
                            />
                          </td>
                          <td className="px-4 py-3.5">
                            <Link href={`/console/reservations/${res.id}`} className="font-medium text-[var(--fg)] hover:underline">{res.name}</Link>
                            {res.confirmation_code && <p className="text-xs text-[var(--accent-text)] font-mono">{res.confirmation_code}</p>}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-[var(--fg)]">
                              <Calendar className="h-3.5 w-3.5 text-[var(--accent-text)]"/>{res.date}
                            </div>
                            <div className="flex items-center gap-1.5 text-[var(--fg-muted)] mt-0.5">
                              <Clock className="h-3.5 w-3.5"/><span dir="ltr">{res.end_time ? `${res.time}–${res.end_time}` : res.time}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5 text-[var(--fg)]">
                              <Users className="h-3.5 w-3.5 text-[var(--accent-text)]"/>{res.guests}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-[var(--fg-muted)] whitespace-nowrap">
                            {getBranchName(res.branch_id)}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                              <Phone className="h-3 w-3"/>{res.phone_number}
                            </div>
                            {res.email && (
                              <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)] mt-0.5">
                                <Mail className="h-3 w-3"/>{res.email}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-[var(--fg-muted)] max-w-32">
                            <span className="truncate block italic">{res.notes || '—'}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge variant={STATUS_BADGE[res.status] || 'secondary'} className="capitalize">
                              {STATUS_KEY[res.status] ? t(STATUS_KEY[res.status]) : res.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5">
                            {res.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button
                                  size="icon-sm"
                                  onClick={() => confirmMutation.mutate(res.id)}
                                  disabled={isConfirming || isCancelling}
                                  className="bg-[var(--success)] hover:bg-[var(--success-hover)]"
                                  aria-label={t('confirm')}
                                >
                                  {isConfirming
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin"/>
                                    : <Check className="h-3.5 w-3.5"/>}
                                </Button>
                                <Button
                                  size="icon-sm"
                                  variant="destructive"
                                  onClick={() => cancelMutation.mutate(res.id)}
                                  disabled={isConfirming || isCancelling}
                                  aria-label={t('cancel')}
                                >
                                  {isCancelling
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin"/>
                                    : <X className="h-3.5 w-3.5"/>}
                                </Button>
                              </div>
                            )}
                            {res.status !== 'pending' && <ReservationActions reservation={res} />}
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Empty */}
                {reservations.length === 0 && (
                  <div className="py-16 text-center">
                    <Calendar className="h-10 w-10 text-[var(--fg-subtle)] mx-auto mb-3"/>
                    <p className="text-[var(--fg-muted)]">{t('noReservationsFound')}</p>
                  </div>
                )}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
                    <span className="text-xs text-[var(--fg-muted)]">{t('pageOfTotalCount', { page, totalPages, count: data?.count ?? 0 })}</span>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('previousLabel')}</Button>
                      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t('nextLabel')}</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
      <BulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        actions={[
          {
            label: t('confirmSelected'),
            onClick: () => { bulkConfirm.mutate(selectedArr); setSelectedIds(new Set()) },
            variant: 'primary',
            disabled: bulkConfirm.isPending,
          },
          {
            label: t('cancelSelected'),
            onClick: () => { bulkCancelRes.mutate(selectedArr); setSelectedIds(new Set()) },
            variant: 'danger',
            disabled: bulkCancelRes.isPending,
          },
        ]}
      />
    </ErrorBoundary>

    </PermissionGuard>

  )
}
