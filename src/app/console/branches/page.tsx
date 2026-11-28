'use client'

import { useTranslations } from 'next-intl'
import { useAdminBranches, useConsoleTenantId } from '@/hooks'
import { branchManagementService } from '@/services/branch.service'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import Link from 'next/link'
import { PreviewButton } from '@/components/admin/PreviewButton'
import type { Branch } from '@/types/branch'

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-[var(--fg-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function BranchTable({ branches, t }: { branches: Branch[]; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[var(--fg-muted)]">
            <th className="pb-2 pr-4">{t('nameLabel')}</th>
            <th className="pb-2 pr-4">{t('tableHeaders.type')}</th>
            <th className="pb-2 pr-4">{t('cityLabel')}</th>
            <th className="pb-2">{t('tableHeaders.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {branches.map((b) => (
            <tr key={b.id} className="border-b last:border-0">
              <td className="py-2 pr-4 font-medium">
                {b.name}
                {b.isDefault && (
                  <span className="ms-2 rounded-full bg-[var(--info-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--info-text)]">{t('defaultBadge')}</span>
                )}
              </td>
              <td className="py-2 pr-4 capitalize">{b.type}</td>
              <td className="py-2 pr-4">{b.location.city}</td>
              <td className="py-2 flex gap-3">
                <Link href={`/console/branches/${b.id}`} className="text-[var(--info-text)] hover:underline">
                  {t('viewLabel')}
                </Link>
                <PermissionGuard permission="branches.update">
                  <Link href={`/console/branches/${b.id}/edit`} className="text-[var(--info-text)] hover:underline">
                    {t('editBranchLabel')}
                  </Link>
                </PermissionGuard>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BranchList({ tenantId }: { tenantId: string }) {
  const t = useTranslations('console')
  const { data: branches = [], isLoading, error } = useAdminBranches(tenantId)

  if (isLoading) return <p className="text-[var(--fg-muted)]">{t('loadingBranchesEllipsis')}</p>
  if (error) return <p className="text-[var(--danger-text)]">{t('failedToLoadBranches')}</p>

  const analytics = branchManagementService.computeAnalytics(branches)
  const active = branches.filter((b) => b.status === 'active')
  const maintenance = branches.filter((b) => b.status === 'maintenance')
  const inactive = branches.filter((b) => b.status === 'inactive')

  return (
    <div className="space-y-6">
      {/* Analytics summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label={t('totalLabel')} value={analytics.totalBranches} />
        <StatCard label={t('statusActive')} value={analytics.activeBranches} />
        <StatCard label={t('maintenanceLabel')} value={analytics.maintenanceBranches} />
        <StatCard label={t('statusInactive')} value={analytics.inactiveBranches} />
        <StatCard label={t('staffAssignedLabel')} value={analytics.totalStaffAssigned} />
        <StatCard label={t('physicalLabel')} value={analytics.byType.physical} />
      </div>

      {/* Active branches */}
      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('activeBranchesLabel')}</h2>
          <BranchTable branches={active} t={t} />
        </section>
      )}

      {/* Maintenance branches */}
      {maintenance.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[var(--warning-text)]">{t('underMaintenanceLabel')}</h2>
          <BranchTable branches={maintenance} t={t} />
        </section>
      )}

      {/* Inactive branches */}
      {inactive.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[var(--fg-subtle)]">{t('inactiveBranchesLabel')}</h2>
          <BranchTable branches={inactive} t={t} />
        </section>
      )}

      {branches.length === 0 && (
        <p className="text-[var(--fg-muted)]">{t('noBranchesFoundForTenant')}</p>
      )}
    </div>
  )
}

function BranchManagementContent() {
  const t = useTranslations('console')
  const tenantId = useConsoleTenantId() ?? ''

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">{t('branchManagementTitle')}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <PreviewButton href="/restaurant"label={t('previewBranchLabel')} size="sm"/>
        <PermissionGuard permission="branches.create">
          <Link
            href="/console/branches/new"
            className="rounded-md bg-[var(--info)] px-4 py-2 text-sm font-medium text-[var(--info-fg)] hover:bg-[var(--info-hover)]"
          >
            {t('addBranchLabel')}
          </Link>
        </PermissionGuard>
        </div>
      </div>

      <BranchList tenantId={tenantId} />
    </div>
  )
}

export default function BranchManagementPage() {
  return (
    <ErrorBoundary feature="Branch Management">
      <PermissionGuard permission="branches.view"fallback={<AccessDenied />}>
        <BranchManagementContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
