'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  useAdminBranch, useAdminBranches, useAdminBranchMetrics, useConsoleAdminBranchMetrics,
  useActivateBranch, useDeactivateBranch, useMaintenanceBranch,
  useDeleteBranch, useSetDefaultBranch, useBranchAccess, useConsoleDeleteBranch,
  useConsoleTenantId,
} from '@/hooks'
import { useConsoleWorkspace } from '@/hooks/console-workspace'
import { useRbacStore } from '@/stores'
import { CopyUrlWidget } from '@/components/marketplace/CopyUrlWidget'
import { QrCodeDisplay } from '@/components/qr/QrCodeDisplay'
import { APP_URL } from '@/constants'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PreviewButton } from '@/components/admin/PreviewButton'
import { Modal } from '@/components/ui/Modal'
import type { BranchStatus } from '@/types/branch'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<BranchStatus, string> = {
  active: 'bg-[var(--success-subtle)] text-[var(--success-text)]',
  inactive: 'bg-[var(--card-hover)] text-[var(--fg)]',
  maintenance: 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
}

const BRANCH_STATUS_KEY: Record<BranchStatus, string> = {
  active: 'statusActive',
  inactive: 'statusInactive',
  maintenance: 'maintenanceLabel',
}

function BranchDetailContent({ id }: { id: string }) {
  const t = useTranslations('console')
  const router = useRouter()
  const tenantId = useConsoleTenantId() ?? ''
  const tenantSlug = useRbacStore((s) => {
    const memberships = s.sessionMemberships
    if (!tenantId || !memberships) return undefined
    return memberships.find((m) => m.tenantId === tenantId)?.tenantSlug
  })
  const { selectedBranch } = useConsoleWorkspace()
  const { data: branch, isLoading, error } = useAdminBranch(id)
  const { data: siblingBranches = [] } = useAdminBranches(tenantId)
  // const { data: metrics } = useAdminBranchMetrics(id)
  const { data: metrics } = useConsoleAdminBranchMetrics(id)
  const activate = useActivateBranch()
  const deactivate = useDeactivateBranch()
  const maintenance = useMaintenanceBranch()
  // const deleteBranch = useDeleteBranch()
  const deleteBranch = useConsoleDeleteBranch()
  const setDefault = useSetDefaultBranch()
  const adminActiveBranch = selectedBranch

  const [deleteOpen, setDeleteOpen] = useState(false)

  if (isLoading) return <p className="p-6 text-[var(--fg-muted)]">{t('loadingBranchEllipsis')}</p>
  if (error || !branch) return <p className="p-6 text-[var(--danger-text)]">{t('branchNotFoundPeriod')}</p>

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
              <span className="rounded-full bg-[var(--info-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--info-text)]">{t('defaultBadge')}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{branch.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <PreviewButton href="/restaurant"label={t('previewBranchLabel')} size="sm"/>
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
            className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-[var(--card-hover)] transition-colors"
          >
            {t('editBranchLabel')}
          </Link>
        </PermissionGuard>
        {!branch.isDefault && (
          <PermissionGuard permission="branches.update">
            <button
              onClick={() => setDefault.mutate(id, { onSuccess: () => toast.success(t('defaultBranchUpdated')) })}
              disabled={setDefault.isPending}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-[var(--card-hover)] transition-colors disabled:opacity-50"
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
            className="rounded-md border border-[var(--danger-border)] px-3 py-1.5 text-sm font-medium text-[var(--danger-text)] hover:bg-[var(--danger-subtle)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('deleteBranchLabel')}
          </button>
        </PermissionGuard>
      </div>

      <section aria-label={t('branchQrSectionAria')} className="rounded-lg border p-4">
        <h2 className="mb-1 font-semibold">{t('branchQrTitle')}</h2>
        <p className="text-sm text-[var(--fg-muted)] mb-4">{t('branchQrDescription')}</p>
        {tenantSlug ? (
          <CopyUrlWidget
            url={`${APP_URL}/${tenantSlug}/${branch.slug}`}
            label={t('currentPublicPageLabel')}
            qrUrl={branch.qr?.url}
            qrTitle=""
          />
        ) : (
          <QrCodeDisplay url={branch.qr?.url} title="" />
        )}
      </section>

      {/* Location */}
      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">{t('locationLabel')}</h2>
        {branch.description && <p className="text-sm text-[var(--fg-muted)] mb-2">{branch.description}</p>}
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
          <li>{t('orderingColonValue', { value: branch.checkout.orderingEnabled ? t('enabledLabel') : t('disabledLabel') })}</li>
          <li>{t('deliveryColonValue', { value: branch.checkout.orderTypes.delivery ? t('enabledLabel') : t('disabledLabel') })}</li>
          <li>{t('pickupColonValue', { value: branch.checkout.orderTypes.pickup ? t('enabledLabel') : t('disabledLabel') })}</li>
          <li>{t('tableOrderingColonValue', { value: branch.checkout.orderTypes.dineIn ? t('enabledLabel') : t('disabledLabel') })}</li>
          <li>{t('reservationsColonValue', { value: branch.reservationsEnabled ? t('enabledLabel') : t('disabledLabel') })}</li>
          <li>{t('marketplaceVisibleColonValue', { value: branch.marketplaceVisible !== false ? t('enabledLabel') : t('disabledLabel') })}</li>
          {branch.maxCapacity !== undefined && (
            <li>{t('maxCapacityColonValue', { value: branch.maxCapacity })}</li>
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
            <div><p className="text-xs text-[var(--fg-muted)]">{t('customerTableHeaders.orders')}</p><p className="font-semibold">{metrics.totalOrders}</p></div>
            <div><p className="text-xs text-[var(--fg-muted)]">{t('revenueLabel')}</p><p className="font-semibold">${metrics.totalRevenue.toFixed(2)}</p></div>
            <div><p className="text-xs text-[var(--fg-muted)]">{t('breadcrumbs.customers')}</p><p className="font-semibold">{metrics.totalCustomers}</p></div>
            <div><p className="text-xs text-[var(--fg-muted)]">{t('breadcrumbs.reservations')}</p><p className="font-semibold">{metrics.totalReservations}</p></div>
            <div><p className="text-xs text-[var(--fg-muted)]">{t('breadcrumbs.staff')}</p><p className="font-semibold">{metrics.staffCount}</p></div>
            <div><p className="text-xs text-[var(--fg-muted)]">{t('customerTableHeaders.avgOrder')}</p><p className="font-semibold">${metrics.averageOrderValue.toFixed(2)}</p></div>
          </div>
        </section>
      )}

      {/* Status Actions */}
      <PermissionGuard permission="branches.manage"fallback={<AccessDenied />}>
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">{t('statusActionsLabel')}</h2>
          <div className="flex flex-wrap gap-2">
            {branch.status !== 'active' && (
              <button
                onClick={() => activate.mutate(id)}
                disabled={activate.isPending}
                className="rounded-md bg-[var(--success)] px-3 py-1.5 text-sm text-[var(--success-fg)] hover:bg-[var(--success-hover)] disabled:opacity-50"
              >
                {t('activateLabel')}
              </button>
            )}
            {branch.status !== 'maintenance' && (
              <button
                onClick={() => maintenance.mutate(id)}
                disabled={maintenance.isPending}
                className="rounded-md bg-[var(--warning)] px-3 py-1.5 text-sm text-[var(--warning-fg)] hover:bg-[var(--warning-hover)] disabled:opacity-50"
              >
                {t('setMaintenanceLabel')}
              </button>
            )}
            {branch.status !== 'inactive' && (
              <button
                onClick={() => deactivate.mutate(id)}
                disabled={deactivate.isPending}
                className="rounded-md bg-[var(--card)] border border-[var(--border-strong)] px-3 py-1.5 text-sm text-[var(--fg)] hover:bg-[var(--card-hover)] disabled:opacity-50"
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
          <p className="text-sm text-[var(--warning-text)] mb-3">{t('deleteActiveBranchWarning')}</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDeleteOpen(false)}
            className="flex-1 rounded-md border px-3 py-2 text-sm hover:bg-[var(--card-hover)] transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleteBranch.isPending}
            className="flex-1 rounded-md bg-[var(--danger)] px-3 py-2 text-sm font-medium text-[var(--danger-fg)] hover:bg-[var(--danger-hover)] disabled:opacity-50 transition-colors"
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
      <PermissionGuard permission="branches.view"fallback={<AccessDenied />}>
        {hasBranchAccess ? <BranchDetailContent id={id} /> : <AccessDenied />}
      </PermissionGuard>
    </ErrorBoundary>
  )
}
