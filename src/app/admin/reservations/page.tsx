'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Calendar, Search, Users, Clock, Phone, Mail, Check, X,
  ChevronLeft, ChevronRight, Loader2, AlertCircle,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/utils'
import { useAdminReservations, useConfirmReservation, useCancelReservation, useBranches, useAdminBranches, useBulkConfirmReservations, useBulkCancelReservations } from '@/hooks'
import { useTenantStore } from '@/stores'
import type { AdminReservationFilters, ReservationStatus } from '@/types'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { BulkActionBar } from '@/components/admin/BulkActionBar'
import { PreviewButton } from '@/components/admin/PreviewButton'


const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'secondary'> = {
  confirmed: 'success', pending: 'warning', cancelled: 'danger', completed: 'secondary',
}

export default function AdminReservationsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all')
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [currentDate, setCurrentDate] = useState(new Date())
  const tenantId = useTenantStore((s) => s.tenant?.id ?? '')
  const { data: adminBranches = [] } = useAdminBranches(tenantId)

  const todayStr = currentDate.toISOString().split('T')[0]

  const filters = useMemo<AdminReservationFilters>(() => ({
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(branchFilter !== 'all' ? { branch_id: branchFilter } : {}),
    ...(search ? { search } : {}),
    date: todayStr,
  }), [statusFilter, branchFilter, search, todayStr])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const { data, isLoading, isError, refetch } = useAdminReservations(filters)
  const { data: branches } = useBranches()
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

  const counts = useMemo(() => ({
    all: data?.count ?? 0,
    pending: reservations.filter((r) => r.status === 'pending').length,
    confirmed: reservations.filter((r) => r.status === 'confirmed').length,
    cancelled: reservations.filter((r) => r.status === 'cancelled').length,
  }), [data, reservations])

  const getBranchName = (branchId: string) =>
    (branches ?? []).find((b) => b.id === branchId)?.name ?? '—'

  return (

    <PermissionGuard permission="reservations.view" fallback={<AccessDenied />}>
    <ErrorBoundary feature="AdminReservations">
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="py-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">Reservations</h1>
              <p className="text-[var(--fg-muted)] mt-1">Manage table bookings across all branches</p>
            </div>
            <PreviewButton href="/reservation" label="Preview Reservation Page" size="sm" />
            {/* Date navigator */}
            <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-xl p-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-[var(--fg)] px-3">{formatDate(currentDate.toISOString())}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total',     value: counts.all,       color: 'text-[var(--fg)]',      bg: 'bg-[var(--card-hover)]' },
              { label: 'Pending',   value: counts.pending,   color: 'text-amber-600',         bg: 'bg-amber-50 dark:bg-amber-950/20' },
              { label: 'Confirmed', value: counts.confirmed, color: 'text-emerald-600',        bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
              { label: 'Cancelled', value: counts.cancelled, color: 'text-red-500',            bg: 'bg-red-50 dark:bg-red-950/20' },
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
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone…"
                className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
            {adminBranches.length > 0 && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                aria-label="Filter by branch"
              >
                <option value="all">All Branches</option>
                {adminBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              {(['all', 'pending', 'confirmed', 'cancelled'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all capitalize ${statusFilter === s ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-200'}`}
                >
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-24 gap-3 text-[var(--fg-muted)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading reservations…</span>
            </div>
          )}

          {/* Error */}
          {isError && !isLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-[var(--fg-muted)]">Failed to load reservations.</p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>Retry</Button>
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
                          aria-label="Select all reservations"
                          checked={reservations.length > 0 && selectedIds.size === reservations.length}
                          onChange={toggleSelectAll}
                          className="rounded border-[var(--border)]"
                        />
                      </th>
                      {['Guest', 'Date & Time', 'Guests', 'Branch', 'Contact', 'Notes', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider whitespace-nowrap">{h}</th>
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
                          className={`hover:bg-[var(--card-hover)] transition-colors ${selectedIds.has(res.id) ? 'bg-orange-50/40 dark:bg-orange-950/10' : ''}`}
                        >
                          <td className="px-4 py-3.5">
                            <input
                              type="checkbox"
                              aria-label={`Select reservation for ${res.name}`}
                              checked={selectedIds.has(res.id)}
                              onChange={() => toggleSelect(res.id)}
                              className="rounded border-[var(--border)]"
                            />
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-medium text-[var(--fg)]">{res.name}</p>
                            {res.confirmation_code && <p className="text-xs text-orange-500 font-mono">{res.confirmation_code}</p>}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-[var(--fg)]">
                              <Calendar className="h-3.5 w-3.5 text-orange-500" />{res.date}
                            </div>
                            <div className="flex items-center gap-1.5 text-[var(--fg-muted)] mt-0.5">
                              <Clock className="h-3.5 w-3.5" />{res.time}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5 text-[var(--fg)]">
                              <Users className="h-3.5 w-3.5 text-orange-500" />{res.guests}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-[var(--fg-muted)] whitespace-nowrap">
                            {getBranchName(res.branch_id)}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                              <Phone className="h-3 w-3" />{res.phone}
                            </div>
                            {res.email && (
                              <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)] mt-0.5">
                                <Mail className="h-3 w-3" />{res.email}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-[var(--fg-muted)] max-w-32">
                            <span className="truncate block italic">{res.notes || '—'}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge variant={STATUS_BADGE[res.status] || 'secondary'} className="capitalize">
                              {res.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5">
                            {res.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button
                                  size="icon-sm"
                                  onClick={() => confirmMutation.mutate(res.id)}
                                  disabled={isConfirming || isCancelling}
                                  className="bg-emerald-500 hover:bg-emerald-600"
                                  aria-label="Confirm"
                                >
                                  {isConfirming
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Check className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                  size="icon-sm"
                                  variant="destructive"
                                  onClick={() => cancelMutation.mutate(res.id)}
                                  disabled={isConfirming || isCancelling}
                                  aria-label="Cancel"
                                >
                                  {isCancelling
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <X className="h-3.5 w-3.5" />}
                                </Button>
                              </div>
                            )}
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Empty */}
                {reservations.length === 0 && (
                  <div className="py-16 text-center">
                    <Calendar className="h-10 w-10 text-[var(--fg-subtle)] mx-auto mb-3" />
                    <p className="text-[var(--fg-muted)]">No reservations found.</p>
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
            label: 'Confirm Selected',
            onClick: () => { bulkConfirm.mutate(selectedArr); setSelectedIds(new Set()) },
            variant: 'primary',
            disabled: bulkConfirm.isPending,
          },
          {
            label: 'Cancel Selected',
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
