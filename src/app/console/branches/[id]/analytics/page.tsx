'use client'

import { use } from 'react'
import { useAdminBranch, useBranchAnalytics } from '@/hooks'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import Link from 'next/link'

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function BranchAnalyticsContent({ id }: { id: string }) {
  const { data: branch, isLoading: branchLoading } = useAdminBranch(id)
  const { data: analytics, isLoading: analyticsLoading } = useBranchAnalytics(id)

  if (branchLoading || analyticsLoading) return <p className="p-6 text-gray-500">Loading analytics…</p>
  if (!branch) return <p className="p-6 text-red-500">Branch not found.</p>

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{branch.name} — Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">{branch.location.city}</p>
        </div>
        <Link
          href={`/console/branches/${id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Branch
        </Link>
      </div>

      {analytics && (
        <>
          {/* Revenue */}
          <section className="rounded-lg border p-4">
            <h2 className="mb-3 font-semibold">Revenue ({analytics.revenue.period})</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Total Revenue" value={`$${analytics.revenue.totalRevenue.toFixed(2)}`} />
              <MetricCard label="Total Orders" value={analytics.revenue.totalOrders} />
              <MetricCard label="Avg Order Value" value={`$${analytics.revenue.averageOrderValue.toFixed(2)}`} />
              <MetricCard label="Revenue Change" value={`${analytics.revenue.revenueChangePct > 0 ? '+' : ''}${analytics.revenue.revenueChangePct}%`} />
            </div>
          </section>

          {/* Orders */}
          <section className="rounded-lg border p-4">
            <h2 className="mb-3 font-semibold">Orders ({analytics.orders.period})</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricCard label="Total Orders" value={analytics.orders.totalOrders} />
              <MetricCard label="Delivered" value={analytics.orders.ordersByStatus.delivered ?? 0} />
              <MetricCard label="Cancelled" value={analytics.orders.ordersByStatus.cancelled ?? 0} />
              <MetricCard label="Pending" value={analytics.orders.ordersByStatus.pending ?? 0} />
              <MetricCard label="Preparing" value={analytics.orders.ordersByStatus.preparing ?? 0} />
              <MetricCard label="Avg Order Value" value={`$${analytics.orders.averageOrderValue.toFixed(2)}`} />
            </div>
          </section>

          {/* Reservations */}
          <section className="rounded-lg border p-4">
            <h2 className="mb-3 font-semibold">Reservations ({analytics.reservations.period})</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Total" value={analytics.reservations.totalReservations} />
              <MetricCard label="Upcoming" value={analytics.reservations.upcomingReservations} />
              <MetricCard label="Cancelled" value={analytics.reservations.cancelledReservations} />
              <MetricCard label="Occupancy Rate" value={`${(analytics.reservations.occupancyRate * 100).toFixed(0)}%`} />
            </div>
          </section>
        </>
      )}

      {!analytics && (
        <p className="text-gray-500">No analytics available for this branch.</p>
      )}
    </div>
  )
}

export default function BranchAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <ErrorBoundary feature="Branch Analytics">
      <PermissionGuard permission="branches.view" fallback={<AccessDenied />}>
        <BranchAnalyticsContent id={id} />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
