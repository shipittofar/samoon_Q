'use client'

import { use } from 'react'
import { useTranslations } from 'next-intl'
import { useAdminBranch, useAdminBranchMetrics, useActivateBranch, useDeactivateBranch, useMaintenanceBranch } from '@/hooks'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PreviewButton } from '@/components/admin/PreviewButton'
import type { BranchStatus } from '@/types/branch'

const STATUS_COLORS: Record<BranchStatus, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  maintenance: 'bg-amber-100 text-amber-800',
}

const BRANCH_STATUS_KEY: Record<BranchStatus, string> = {
  active: 'statusActive',
  inactive: 'statusInactive',
  maintenance: 'maintenanceLabel',
}

function BranchDetailContent({ id }: { id: string }) {
  const t = useTranslations('console')
  const { data: branch, isLoading, error } = useAdminBranch(id)
  const { data: metrics } = useAdminBranchMetrics(id)
  const activate = useActivateBranch()
  const deactivate = useDeactivateBranch()
  const maintenance = useMaintenanceBranch()

  if (isLoading) return <p className="p-6 text-gray-500">{t('loadingBranchEllipsis')}</p>
  if (error || !branch) return <p className="p-6 text-red-500">{t('branchNotFoundPeriod')}</p>

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{branch.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{branch.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <PreviewButton href="/restaurant" label={t('previewBranchLabel')} size="sm" />
          <span className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${STATUS_COLORS[branch.status]}`}>
            {t(BRANCH_STATUS_KEY[branch.status])}
          </span>
        </div>
      </div>

      {/* Location */}
      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">{t('locationLabel')}</h2>
        <p>{branch.location.address}</p>
        <p>{branch.location.city}, {branch.location.country}</p>
        {branch.location.postalCode && <p>{t('postalColonValue', { code: branch.location.postalCode })}</p>}
      </section>

      {/* Contact */}
      {(branch.contact.phone_number || branch.contact.email || branch.contact.website) && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">{t('contactLabel')}</h2>
          {branch.contact.phone_number && <p>{t('phoneColonValue', { value: branch.contact.phone_number })}</p>}
          {branch.contact.email && <p>{t('emailColonValue', { value: branch.contact.email })}</p>}
          {branch.contact.website && <p>{t('websiteColonValue', { value: branch.contact.website })}</p>}
        </section>
      )}

      {/* Settings */}
      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">{t('settingsTitle')}</h2>
        <ul className="space-y-1 text-sm">
          <li>{t('deliveryColonValue', { value: branch.settings.deliveryEnabled ? t('enabledLabel') : t('disabledLabel') })}</li>
          <li>{t('pickupColonValue', { value: branch.settings.pickupEnabled ? t('enabledLabel') : t('disabledLabel') })}</li>
          <li>{t('tableOrderingColonValue', { value: branch.settings.tableOrderingEnabled ? t('enabledLabel') : t('disabledLabel') })}</li>
          <li>{t('reservationsColonValue', { value: branch.settings.reservationsEnabled ? t('enabledLabel') : t('disabledLabel') })}</li>
          {branch.settings.maxCapacity !== undefined && (
            <li>{t('maxCapacityColonValue', { value: branch.settings.maxCapacity })}</li>
          )}
        </ul>
      </section>

      {/* Business Hours */}
      {branch.businessHours.length > 0 && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">{t('businessHoursLabel')}</h2>
          <ul className="space-y-1 text-sm">
            {branch.businessHours.map((h) => (
              <li key={h.day} className="flex gap-4">
                <span className="w-24 font-medium">{h.day}</span>
                <span>{h.isClosed ? t('closedLabel') : `${h.open} – ${h.close}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Metrics */}
      {metrics && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">{t('metricsPeriodLabel', { period: metrics.period })}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div><p className="text-xs text-gray-500">{t('customerTableHeaders.orders')}</p><p className="font-semibold">{metrics.totalOrders}</p></div>
            <div><p className="text-xs text-gray-500">{t('revenueLabel')}</p><p className="font-semibold">${metrics.totalRevenue.toFixed(2)}</p></div>
            <div><p className="text-xs text-gray-500">{t('breadcrumbs.customers')}</p><p className="font-semibold">{metrics.totalCustomers}</p></div>
            <div><p className="text-xs text-gray-500">{t('breadcrumbs.reservations')}</p><p className="font-semibold">{metrics.totalReservations}</p></div>
            <div><p className="text-xs text-gray-500">{t('breadcrumbs.staff')}</p><p className="font-semibold">{metrics.staffCount}</p></div>
            <div><p className="text-xs text-gray-500">{t('customerTableHeaders.avgOrder')}</p><p className="font-semibold">${metrics.averageOrderValue.toFixed(2)}</p></div>
          </div>
        </section>
      )}

      {/* Status Actions */}
      <PermissionGuard permission="branches.manage" fallback={<AccessDenied />}>
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">{t('statusActionsLabel')}</h2>
          <div className="flex flex-wrap gap-2">
            {branch.status !== 'active' && (
              <button
                onClick={() => activate.mutate(id)}
                disabled={activate.isPending}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                {t('activateLabel')}
              </button>
            )}
            {branch.status !== 'maintenance' && (
              <button
                onClick={() => maintenance.mutate(id)}
                disabled={maintenance.isPending}
                className="rounded-md bg-amber-500 px-3 py-1.5 text-sm text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {t('setMaintenanceLabel')}
              </button>
            )}
            {branch.status !== 'inactive' && (
              <button
                onClick={() => deactivate.mutate(id)}
                disabled={deactivate.isPending}
                className="rounded-md bg-gray-500 px-3 py-1.5 text-sm text-white hover:bg-gray-600 disabled:opacity-50"
              >
                {t('deactivateLabel')}
              </button>
            )}
          </div>
        </section>
      </PermissionGuard>
    </div>
  )
}

export default function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <ErrorBoundary feature="Branch Detail">
      <PermissionGuard permission="branches.view" fallback={<AccessDenied />}>
        <BranchDetailContent id={id} />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
