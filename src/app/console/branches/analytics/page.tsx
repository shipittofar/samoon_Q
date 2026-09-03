'use client'

import { useTranslations } from 'next-intl'
import { useAdminBranches, useConsoleTenantId } from '@/hooks'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import Link from 'next/link'

const BRANCH_STATUS_KEY: Record<string, string> = {
  active: 'statusActive',
  maintenance: 'maintenanceLabel',
  inactive: 'statusInactive',
}

function BranchAnalyticsRow({ id, name, city, status, t }: { id: string; name: string; city: string; status: string; t: ReturnType<typeof useTranslations> }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4 font-medium">{name}</td>
      <td className="py-2 pr-4 text-[var(--fg-muted)]">{city}</td>
      <td className="py-2 pr-4">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
          status === 'active' ? 'bg-[var(--success-subtle)] text-[var(--success-text)]' :
          status === 'maintenance' ? 'bg-[var(--warning-subtle)] text-[var(--warning-text)]' :
          'bg-[var(--card-hover)] text-[var(--fg)]'
        }`}>
          {t(BRANCH_STATUS_KEY[status] ?? 'statusInactive')}
        </span>
      </td>
      <td className="py-2">
        <Link
          href={`/console/branches/${id}/analytics`}
          className="text-sm text-[var(--info-text)] hover:underline"
        >
          {t('viewAnalyticsLabel')}
        </Link>
      </td>
    </tr>
  )
}

function BranchAnalyticsOverviewContent() {
  const t = useTranslations('console')
  const tenantId = useConsoleTenantId() ?? ''
  const { data: branches = [], isLoading } = useAdminBranches(tenantId)

  const active = branches.filter((b) => b.status === 'active')
  const maintenance = branches.filter((b) => b.status === 'maintenance')
  const inactive = branches.filter((b) => b.status === 'inactive')

  if (isLoading) return <p className="p-6 text-[var(--fg-muted)]">{t('loadingBranchesEllipsis')}</p>

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('branchAnalyticsTitle')}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('selectBranchToViewAnalyticsHint')}</p>
        </div>
        <Link href="/console/branches"className="text-sm text-[var(--info-text)] hover:underline">
          {t('backArrowBranchManagement')}
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-[var(--fg-muted)]">{t('statusActive')}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--success-text)]">{active.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-[var(--fg-muted)]">{t('maintenanceLabel')}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--warning-text)]">{maintenance.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-[var(--fg-muted)]">{t('statusInactive')}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--fg-subtle)]">{inactive.length}</p>
        </div>
      </div>

      {/* Branch table */}
      {branches.length > 0 && (
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">{t('allBranchesLabel')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[var(--fg-muted)]">
                  <th className="pb-2 pr-4">{t('nameLabel')}</th>
                  <th className="pb-2 pr-4">{t('cityLabel')}</th>
                  <th className="pb-2 pr-4">{t('tableHeaders.status')}</th>
                  <th className="pb-2">{t('breadcrumbs.analytics')}</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <BranchAnalyticsRow
                    key={b.id}
                    id={b.id}
                    name={b.name}
                    city={b.location.city}
                    status={b.status}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {branches.length === 0 && (
        <p className="text-[var(--fg-muted)]">{t('noBranchesFoundPeriod')}</p>
      )}
    </div>
  )
}

export default function BranchAnalyticsOverviewPage() {
  return (
    <ErrorBoundary feature="Branch Analytics">
      <PermissionGuard permission="branches.view"fallback={<AccessDenied />}>
        <BranchAnalyticsOverviewContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
