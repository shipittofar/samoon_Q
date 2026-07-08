'use client'

import { use } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('console')
  const { data: branch, isLoading: branchLoading } = useAdminBranch(id)
  const { data: analytics, isLoading: analyticsLoading } = useBranchAnalytics(id)

  if (branchLoading || analyticsLoading) return <p className="p-6 text-gray-500">{t('loadingAnalyticsEllipsis')}</p>
  if (!branch) return <p className="p-6 text-red-500">{t('branchNotFoundPeriod')}</p>

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('nameEmdashAnalytics', { name: branch.name })}</h1>
          <p className="mt-1 text-sm text-gray-500">{branch.location.city}</p>
        </div>
        <Link
          href={`/console/branches/${id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          {t('backArrowToBranch')}
        </Link>
      </div>

      {analytics && (
        <>
          {/* Revenue */}
          <section className="rounded-lg border p-4">
            <h2 className="mb-3 font-semibold">{t('revenuePeriodLabel', { period: analytics.revenue.period })}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label={t('totalRevenue')} value={`$${analytics.revenue.totalRevenue.toFixed(2)}`} />
              <MetricCard label={t('totalOrders')} value={analytics.revenue.totalOrders} />
              <MetricCard label={t('avgOrderValue')} value={`$${analytics.revenue.averageOrderValue.toFixed(2)}`} />
              <MetricCard label={t('revenueChangeLabel')} value={`${analytics.revenue.revenueChangePct > 0 ? '+' : ''}${analytics.revenue.revenueChangePct}%`} />
            </div>
          </section>

          {/* Orders */}
          <section className="rounded-lg border p-4">
            <h2 className="mb-3 font-semibold">{t('breadcrumbs.orders')} ({analytics.orders.period})</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricCard label={t('totalOrders')} value={analytics.orders.totalOrders} />
              <MetricCard label={t('deliveredLabel')} value={analytics.orders.ordersByStatus.delivered ?? 0} />
              <MetricCard label={t('statusCancelled')} value={analytics.orders.ordersByStatus.cancelled ?? 0} />
              <MetricCard label={t('statusPending')} value={analytics.orders.ordersByStatus.pending ?? 0} />
              <MetricCard label={t('preparingLabel')} value={analytics.orders.ordersByStatus.preparing ?? 0} />
              <MetricCard label={t('avgOrderValue')} value={`$${analytics.orders.averageOrderValue.toFixed(2)}`} />
            </div>
          </section>

          {/* Reservations */}
          <section className="rounded-lg border p-4">
            <h2 className="mb-3 font-semibold">{t('breadcrumbs.reservations')} ({analytics.reservations.period})</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label={t('totalLabel')} value={analytics.reservations.totalReservations} />
              <MetricCard label={t('statusUpcoming')} value={analytics.reservations.upcomingReservations} />
              <MetricCard label={t('statusCancelled')} value={analytics.reservations.cancelledReservations} />
              <MetricCard label={t('occupancyRate')} value={`${(analytics.reservations.occupancyRate * 100).toFixed(0)}%`} />
            </div>
          </section>
        </>
      )}

      {!analytics && (
        <p className="text-gray-500">{t('noAnalyticsAvailableForBranch')}</p>
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
