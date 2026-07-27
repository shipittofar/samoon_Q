'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { usePlatformTenants, useConsoleTenants, useActivateTenant, useSuspendTenant, useArchiveTenant } from '@/hooks'
import type { Tenant } from '@/types'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PreviewButton } from '@/components/admin/PreviewButton'

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-700 bg-green-50',
  trial: 'text-blue-700 bg-blue-50',
  suspended: 'text-amber-700 bg-amber-50',
  churned: 'text-gray-500 bg-gray-100',
  archived: 'text-red-700 bg-red-50',
}

const TENANT_STATUS_KEY: Record<string, string> = {
  active: 'statusActive',
  trial: 'tenantStatusTrial',
  suspended: 'statusSuspended',
  churned: 'tenantStatusChurned',
  archived: 'tenantStatusArchived',
}

function TenantAnalyticsSummary({ tenants }: { tenants: Tenant[] }) {
  const t = useTranslations('console')
  const total = tenants.length
  const active = tenants.filter((tn) => tn.status === 'active').length
  const suspended = tenants.filter((tn) => tn.status === 'suspended').length
  const byType: Record<string, number> = {}
  tenants.forEach((tn) => {
    const bt = tn.businessTypes?.[0] ?? 'unknown'
    byType[bt] = (byType[bt] ?? 0) + 1
  })

  return (
    <section aria-label={t('tenantAnalyticsAria')} className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div className="border rounded-lg p-4 text-center" aria-label={t('totalTenantsAria')}>
        <p className="text-2xl font-bold">{total}</p>
        <p className="text-xs text-gray-500 mt-1">{t('totalTenantsLabel')}</p>
      </div>
      <div className="border rounded-lg p-4 text-center" aria-label={t('activeTenantsAria')}>
        <p className="text-2xl font-bold text-green-700">{active}</p>
        <p className="text-xs text-gray-500 mt-1">{t('statusActive')}</p>
      </div>
      <div className="border rounded-lg p-4 text-center" aria-label={t('suspendedTenantsAria')}>
        <p className="text-2xl font-bold text-amber-700">{suspended}</p>
        <p className="text-xs text-gray-500 mt-1">{t('statusSuspended')}</p>
      </div>
      <div className="border rounded-lg p-4 text-center" aria-label={t('businessTypeDistributionAria')}>
        <p className="text-xs font-semibold text-gray-700 mb-1">{t('byTypeLabel')}</p>
        {Object.entries(byType).map(([bt, count]) => (
          <p key={bt} className="text-xs text-gray-600">
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

  const statusClass = STATUS_COLORS[tenant.status] ?? 'text-gray-500 bg-gray-100'

  return (
    <tr>
      <td className="px-4 py-3">
        <Link
          href={`/console/tenants/${tenant.id}`}
          className="font-medium text-accent hover:underline"
        >
          {tenant.name}
        </Link>
        <p className="text-xs text-gray-500 font-mono">{tenant.slug}</p>
      </td>
      <td className="px-4 py-3 text-sm">
        {tenant.businessTypes?.[0]?.replace(/_/g, ' ') ?? '—'}
      </td>
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}>
          {t(TENANT_STATUS_KEY[tenant.status] ?? 'statusInactive')}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {new Date(tenant.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-sm space-x-2">
        {tenant.status !== 'active' && tenant.status !== 'archived' && (
          <button
            type="button"
            onClick={() => activate.mutate(tenant.id)}
            disabled={activate.isPending}
            className="text-green-700 hover:underline disabled:opacity-40"
            aria-label={t('activateNameAria', { name: tenant.name })}
          >
            {t('activateLabel')}
          </button>
        )}
        {tenant.status === 'active' && (
          <button
            type="button"
            onClick={() => suspend.mutate(tenant.id)}
            disabled={suspend.isPending}
            className="text-amber-700 hover:underline disabled:opacity-40"
            aria-label={t('suspendNameAria', { name: tenant.name })}
          >
            {t('suspendLabel')}
          </button>
        )}
        {tenant.status !== 'archived' && (
          <button
            type="button"
            onClick={() => archive.mutate(tenant.id)}
            disabled={archive.isPending}
            className="text-red-600 hover:underline disabled:opacity-40"
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
  const { data: tenants = [], isLoading } = useConsoleTenants()

  return (
    <ErrorBoundary feature="Tenant Management">
    <PermissionGuard permission="tenant.view" fallback={<AccessDenied />}>
    <main aria-label={t('tenantManagementAria')} className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('tenantsTitle')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('manageAndProvisionTenantsSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <PreviewButton href="/" label={t('previewPublicSiteLabel')} size="sm" />
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
        <p className="text-gray-500">{t('loadingTenantsEllipsis')}</p>
      ) : (
        <>
          <TenantAnalyticsSummary tenants={tenants} />

          <section aria-label={t('tenantListAria')}>
            <table className="w-full border rounded-lg overflow-hidden text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('nameSlashSlugLabel')}</th>
                  <th className="px-4 py-3 font-medium">{t('businessTypeLabel')}</th>
                  <th className="px-4 py-3 font-medium">{t('tableHeaders.status')}</th>
                  <th className="px-4 py-3 font-medium">{t('createdLabel')}</th>
                  <th className="px-4 py-3 font-medium">{t('tableHeaders.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tenants.map((tn) => (
                  <TenantRow key={tn.id} tenant={tn} />
                ))}
              </tbody>
            </table>
            {tenants.length === 0 && (
              <p className="text-center text-gray-400 py-8">{t('noTenantsFound')}</p>
            )}
          </section>
        </>
      )}
    </main>

    </PermissionGuard>
    </ErrorBoundary>

  )
}
