'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  useAdminBranch, useAdminBranches, useAdminBranchMetrics, useConsoleAdminBranchMetrics,
  useActivateBranch, useDeactivateBranch, useMaintenanceBranch,
  useDeleteBranch, useSetDefaultBranch, useBranchAccess,
} from '@/hooks'
import { useBranchStore, useTenantStore } from '@/stores'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PreviewButton } from '@/components/admin/PreviewButton'
import { Modal } from '@/components/ui/Modal'
import type { BranchStatus } from '@/types/branch'
import toast from 'react-hot-toast'

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
  const router = useRouter()
  const tenantId = useTenantStore((s) => s.tenant?.id ?? '')
  const { data: branch, isLoading, error } = useAdminBranch(id)
  const { data: siblingBranches = [] } = useAdminBranches(tenantId)
  // const { data: metrics } = useAdminBranchMetrics(id)
  const { data: metrics } = useConsoleAdminBranchMetrics(id)
  const activate = useActivateBranch()
  const deactivate = useDeactivateBranch()
  const maintenance = useMaintenanceBranch()
  const deleteBranch = useDeleteBranch()
  const setDefault = useSetDefaultBranch()
  const adminActiveBranch = useBranchStore((s) => s.adminActiveBranch)

  const [deleteOpen, setDeleteOpen] = useState(false)

  if (isLoading) return <p className="p-6 text-gray-500">{t('loadingBranchEllipsis')}</p>
  if (error || !branch) return <p className="p-6 text-red-500">{t('branchNotFoundPeriod')}</p>

  const isOnlyBranch = siblingBranches.length <= 1
  const isActiveBranch = adminActiveBranch?.id === branch.id

  const confirmDelete = () => {
    if (deleteBranch.isPending) return
    deleteBranch.mutate(id, {
      onSuccess: () => {
        toast.success(t('branchDeletedSuccessfully'))
        setDeleteOpen(false)
        router.push('/console/branches')
      },
      onError: (err) => {
        toast.error(err instanceof Error && err.message === 'last_branch' ? t('cannotDeleteLastBranch') : t('failedToDeleteBranchRetry'))
      },
    })
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{branch.name}</h1>
            {branch.isDefault && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">{t('defaultBadge')}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">{branch.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <PreviewButton href="/restaurant" label={t('previewBranchLabel')} size="sm" />
          <span className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${STATUS_COLORS[branch.status]}`}>
            {t(BRANCH_STATUS_KEY[branch.status])}
          </span>
        </div>
      </div>

      {/* Edit / Default / Delete */}
      <div className="flex flex-wrap gap-2">
        <PermissionGuard permission="branches.update">
          <Link
            href={`/console/branches/${id}/edit`}
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            {t('editBranchLabel')}
          </Link>
        </PermissionGuard>
        {!branch.isDefault && (
          <PermissionGuard permission="branches.update">
            <button
              onClick={() => setDefault.mutate(id, { onSuccess: () => toast.success(t('defaultBranchUpdated')) })}
              disabled={setDefault.isPending}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {t('setAsDefaultLabel')}
            </button>
          </PermissionGuard>
        )}
        <PermissionGuard permission="branches.delete">
          <button
            onClick={() => setDeleteOpen(true)}
            disabled={isOnlyBranch}
            title={isOnlyBranch ? t('cannotDeleteLastBranch') : undefined}
            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('deleteBranchLabel')}
          </button>
        </PermissionGuard>
      </div>

      {/* Location */}
      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">{t('locationLabel')}</h2>
        {branch.description && <p className="text-sm text-gray-600 mb-2">{branch.description}</p>}
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

      {/* Locale */}
      {(branch.timeZone || branch.currency || branch.language) && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">{t('localeLabel')}</h2>
          {branch.timeZone && <p>{t('timeZoneColonValue', { value: branch.timeZone })}</p>}
          {branch.currency && <p>{t('currencyColonValue', { value: branch.currency })}</p>}
          {branch.language && <p>{t('languageColonValue', { value: branch.language })}</p>}
        </section>
      )}

      {/* Settings */}
      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">{t('settingsTitle')}</h2>
        <ul className="space-y-1 text-sm">
          <li>{t('orderingColonValue', { value: branch.settings.orderingEnabled !== false ? t('enabledLabel') : t('disabledLabel') })}</li>
          <li>{t('deliveryColonValue', { value: branch.settings.deliveryEnabled ? t('enabledLabel') : t('disabledLabel') })}</li>
          <li>{t('pickupColonValue', { value: branch.settings.pickupEnabled ? t('enabledLabel') : t('disabledLabel') })}</li>
          <li>{t('tableOrderingColonValue', { value: branch.settings.tableOrderingEnabled ? t('enabledLabel') : t('disabledLabel') })}</li>
          <li>{t('reservationsColonValue', { value: branch.settings.reservationsEnabled ? t('enabledLabel') : t('disabledLabel') })}</li>
          <li>{t('marketplaceVisibleColonValue', { value: branch.settings.marketplaceVisible !== false ? t('enabledLabel') : t('disabledLabel') })}</li>
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

      {/* Delete Confirmation */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title={t('deleteBranchLabel')} size="sm">
        <p className="text-[var(--fg-muted)] mb-3">{t('confirmDeleteBranch', { name: branch.name })}</p>
        {isActiveBranch && (
          <p className="text-sm text-amber-600 mb-3">{t('deleteActiveBranchWarning')}</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDeleteOpen(false)}
            className="flex-1 rounded-md border px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleteBranch.isPending}
            className="flex-1 rounded-md bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {deleteBranch.isPending ? t('deletingEllipsis') : t('deleteAction')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

export default function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  // Phase 9.4 — defense-in-depth only (see useBranchAccess()'s doc
  // comment): a direct navigation to a branch outside the session's
  // branchAccess must not reach BranchDetailContent (and therefore must
  // not fire useAdminBranch()/useAdminBranchMetrics() etc.) at all. The
  // backend remains the actual enforcement point for these endpoints.
  const hasBranchAccess = useBranchAccess(id)
  return (
    <ErrorBoundary feature="Branch Detail">
      <PermissionGuard permission="branches.view" fallback={<AccessDenied />}>
        {hasBranchAccess ? <BranchDetailContent id={id} /> : <AccessDenied />}
      </PermissionGuard>
    </ErrorBoundary>
  )
}
