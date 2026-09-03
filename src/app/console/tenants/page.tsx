'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useConsoleTenants, useActivateTenant, useSuspendTenant, useArchiveTenant } from '@/hooks'
import type { Tenant } from '@/types'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PreviewButton } from '@/components/admin/PreviewButton'
import {
  countConsoleTenantsByStatus,
  filterConsoleTenantsByStatus,
  mergeConsoleTenantsWithMemberships,
  type ConsoleTenantStatusFilter,
} from '@/lib/console-tenant-list'
import {
  isTenantOperational,
  isTenantVisible,
  normalizeTenantStatus,
} from '@/lib/tenant-state'
import { tenantStatusLabelKey } from '@/lib/provision-result-display'
import { useRbacStore } from '@/stores'

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-[var(--success-text)] bg-[var(--success-subtle)]',
  INACTIVE: 'text-[var(--fg-muted)] bg-[var(--card-hover)]',
  CLOSED: 'text-[var(--warning-text)] bg-[var(--warning-subtle)]',
}

function TenantAnalyticsSummary({ tenants }: { tenants: Tenant[] }) {
  const t = useTranslations('console')
  const { total, active, inactive, closed } = countConsoleTenantsByStatus(tenants)
  const byType: Record<string, number> = {}
  tenants.forEach((tn) => {
    const bt = tn.businessTypes?.[0] ?? 'unknown'
    byType[bt] = (byType[bt] ?? 0) + 1
  })

  return (
    <section aria-label={t('tenantAnalyticsAria')} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      <div className="border rounded-lg p-4 text-center"aria-label={t('totalTenantsAria')}>
        <p className="text-2xl font-bold">{total}</p>
        <p className="text-xs text-[var(--fg-muted)] mt-1">{t('totalTenantsLabel')}</p>
      </div>
      <div className="border rounded-lg p-4 text-center"aria-label={t('activeTenantsAria')}>
        <p className="text-2xl font-bold text-[var(--success-text)]">{active}</p>
        <p className="text-xs text-[var(--fg-muted)] mt-1">{t('statusActive')}</p>
      </div>
      <div className="border rounded-lg p-4 text-center"aria-label={t('inactiveTenantsAria')}>
        <p className="text-2xl font-bold text-[var(--fg-muted)]">{inactive}</p>
        <p className="text-xs text-[var(--fg-muted)] mt-1">{t('statusInactive')}</p>
      </div>
      <div className="border rounded-lg p-4 text-center"aria-label={t('suspendedTenantsAria')}>
        <p className="text-2xl font-bold text-[var(--warning-text)]">{closed}</p>
        <p className="text-xs text-[var(--fg-muted)] mt-1">{t('statusClosed')}</p>
      </div>
      <div className="border rounded-lg p-4 text-center"aria-label={t('businessTypeDistributionAria')}>
        <p className="text-xs font-semibold text-[var(--fg-secondary)] mb-1">{t('byTypeLabel')}</p>
        {Object.entries(byType).map(([bt, count]) => (
          <p key={bt} className="text-xs text-[var(--fg-muted)]">
            {bt.replace(/_/g, ' ')}: {count}
          </p>
        ))}
      </div>
    </section>
  )
}

function TenantRow({ tenant }: { tenant: Tenant }) {
  const t = useTranslations('console')
  const activate = useActivateTenant()
  const suspend = useSuspendTenant()
  const archive = useArchiveTenant()

  const statusClass = STATUS_COLORS[normalizeTenantStatus(tenant.status)] ?? 'text-[var(--fg-muted)] bg-[var(--card-hover)]'
  const operational = isTenantOperational(tenant)
  const visible = isTenantVisible(tenant)

  return (
    <tr>
      <td className="px-4 py-3">
        <Link
          href={`/console/tenants/${tenant.id}`}
          className="font-medium text-accent hover:underline"
        >
          {tenant.name}
        </Link>
        <p className="text-xs text-[var(--fg-muted)] font-mono">{tenant.slug}</p>
        <Link
          href={`/console/tenants/${tenant.id}/edit`}
          className="text-xs text-accent hover:underline"
        >
          {t('editTenantSettingsLabel')}
        </Link>
      </td>
      <td className="px-4 py-3 text-sm">
        {tenant.businessTypes?.[0]?.replace(/_/g, ' ') ?? '—'}
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}>
          {t(tenantStatusLabelKey(tenant.status))}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-[var(--fg-muted)]">
        {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : '—'}
      </td>
      <td className="px-4 py-3 text-sm space-x-2">
        {!operational && (
          <button
            type="button"
            onClick={() => activate.mutate(tenant.id)}
            disabled={activate.isPending}
            className="text-[var(--success-text)] hover:underline disabled:opacity-40"
            aria-label={t('activateNameAria', { name: tenant.name })}
          >
            {t('activateLabel')}
          </button>
        )}
        {operational && (
          <button
            type="button"
            onClick={() => suspend.mutate(tenant.id)}
            disabled={suspend.isPending}
            className="text-[var(--warning-text)] hover:underline disabled:opacity-40"
            aria-label={t('suspendNameAria', { name: tenant.name })}
          >
            {t('suspendLabel')}
          </button>
        )}
        {visible && (
          <button
            type="button"
            onClick={() => archive.mutate(tenant.id)}
            disabled={archive.isPending}
            className="text-[var(--danger-text)] hover:underline disabled:opacity-40"
            aria-label={t('archiveNameAria', { name: tenant.name })}
          >
            {t('archiveTitle')}
          </button>
        )}
      </td>
    </tr>
  )
}

export default function AdminTenantsPage() {
  const t = useTranslations('console')
  const { data: fetchedTenants = [], isLoading } = useConsoleTenants()
  const memberships = useRbacStore((s) => s.sessionMemberships)
  const [statusFilter, setStatusFilter] = useState<ConsoleTenantStatusFilter>('all')

  const tenants = useMemo(
    () => mergeConsoleTenantsWithMemberships(fetchedTenants, memberships),
    [fetchedTenants, memberships],
  )
  const visibleTenants = useMemo(
    () => filterConsoleTenantsByStatus(tenants, statusFilter),
    [tenants, statusFilter],
  )

  return (
    <ErrorBoundary feature="Tenant Management">
    <PermissionGuard permission="tenant.view"fallback={<AccessDenied />}>
    <main aria-label={t('tenantManagementAria')} className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('tenantsTitle')}</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">{t('manageAndProvisionTenantsSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <PreviewButton href="/"label={t('previewPublicSiteLabel')} size="sm"/>
          <Link
          href="/console/tenants/new"
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-hover"
          aria-label={t('createNewTenantAria')}
        >
          + {t('newTenantLabel')}
        </Link>
        </div>
      </div>

      {isLoading ? (
        <p className="text-[var(--fg-muted)]">{t('loadingTenantsEllipsis')}</p>
      ) : (
        <>
          <TenantAnalyticsSummary tenants={tenants} />

          <section aria-label={t('tenantListAria')}>
            <div className="flex items-center justify-end mb-3">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-[var(--fg-muted)]">{t('tableHeaders.status')}</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ConsoleTenantStatusFilter)}
                  aria-label={t('filterAria')}
                  className="border border-[var(--border)] rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] bg-[var(--card)]"
                >
                  <option value="all">{t('allStatusOption')}</option>
                  <option value="ACTIVE">{t('statusActive')}</option>
                  <option value="INACTIVE">{t('statusInactive')}</option>
                  <option value="CLOSED">{t('statusClosed')}</option>
                </select>
              </label>
            </div>
            <table className="w-full border rounded-lg overflow-hidden text-sm">
              <thead className="bg-[var(--card-hover)] text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('nameSlashSlugLabel')}</th>
                  <th className="px-4 py-3 font-medium">{t('businessTypeLabel')}</th>
                  <th className="px-4 py-3 font-medium">{t('tableHeaders.status')}</th>
                  <th className="px-4 py-3 font-medium">{t('createdLabel')}</th>
                  <th className="px-4 py-3 font-medium">{t('tableHeaders.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visibleTenants.map((tn) => (
                  <TenantRow key={tn.id} tenant={tn} />
                ))}
              </tbody>
            </table>
            {visibleTenants.length === 0 && (
              <p className="text-center text-[var(--fg-subtle)] py-8">{t('noTenantsFound')}</p>
            )}
          </section>
        </>
      )}
    </main>

    </PermissionGuard>
    </ErrorBoundary>

  )
}
