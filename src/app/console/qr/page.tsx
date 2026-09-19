'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueries } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { QrManagementPanel } from '@/components/qr/QrManagementPanel'
import { useAdminBranches, useConsoleTenantId, usePermission } from '@/hooks'
import { useTenantQr } from '@/hooks/qr-management'
import { useTenantStore } from '@/stores'
import { tenantService } from '@/services/tenant.service'
import { qrManagementService } from '@/services/qr-management.service'
import {
  branchQrQueryKey,
  matchesQrListFilters,
  type QrListEntry,
  type QrListStatusFilter,
  type QrListTypeFilter,
} from '@/lib/qr-management'
import { APP_URL, STALE_TIME } from '@/constants'
import type { Tenant } from '@/types'
import type { Branch } from '@/types/branch'

function WorkspaceQrCard({
  entry,
  tenant,
  canManage,
  viewHref,
}: {
  entry: QrListEntry
  tenant: Tenant
  canManage: boolean
  viewHref: string
}) {
  const t = useTranslations('console')
  const typeLabel = entry.kind === 'tenant' ? t('qrTypeTenant') : t('qrTypeBranch')

  return (
    <article
      className="space-y-3"
      data-testid={`qr-record-${entry.kind}-${entry.id}`}
      data-qr-kind={entry.kind}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-muted)]">{typeLabel}</p>
          <h2 className="text-lg font-semibold truncate">{entry.name}</h2>
        </div>
        <Link
          href={viewHref}
          className="text-sm text-[var(--info-text)] hover:underline shrink-0 min-h-[44px] inline-flex items-center"
          aria-label={t('qrViewEntityAria', { name: entry.name })}
        >
          {t('viewLabel')}
        </Link>
      </div>
      {entry.kind === 'tenant' ? (
        <QrManagementPanel
          scope="tenant"
          entityId={entry.id}
          canManage={canManage}
          publicUrl={`${APP_URL}/${tenant.slug}`}
          publicUrlLabel={t('currentPublicPageLabel')}
          title={t('businessQrTitle')}
          description={t('businessQrDescription')}
          sectionAria={t('businessQrSectionAria')}
        />
      ) : (
        <QrManagementPanel
          scope="branch"
          entityId={entry.id}
          tenantId={tenant.id}
          canManage={canManage}
          publicUrl={entry.slug ? `${APP_URL}/${tenant.slug}/${entry.slug}` : undefined}
          publicUrlLabel={t('currentPublicPageLabel')}
          title={t('branchQrTitle')}
          description={t('branchQrDescription')}
          sectionAria={t('branchQrSectionAria')}
        />
      )}
    </article>
  )
}

function QrManagementContent() {
  const t = useTranslations('console')
  const tenantId = useConsoleTenantId()
  const storeTenant = useTenantStore((s) => s.tenant)
  const alignedTenant = storeTenant?.id === tenantId ? storeTenant : null
  const canManageTenant = usePermission('tenant.manage')
  const canManageBranch = usePermission('branches.update')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<QrListTypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<QrListStatusFilter>('all')

  const { data: fetchedTenant, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantService.getTenantById(tenantId!),
    enabled: Boolean(tenantId) && !alignedTenant,
  })
  const tenant = alignedTenant ?? fetchedTenant
  const { data: branches = [], isLoading: branchesLoading } = useAdminBranches(tenantId ?? '')
  const tenantQr = useTenantQr(tenantId)
  const branchQrQueries = useQueries({
    queries: branches.map((branch) => ({
      queryKey: branchQrQueryKey(branch.id),
      queryFn: () => qrManagementService.getBranchQr(branch.id),
      staleTime: STALE_TIME,
      enabled: Boolean(branch.id),
    })),
  })

  const tenantActive = tenantQr.data?.is_active ?? null
  const branchActiveKey = branchQrQueries.map((query) => String(query.data?.is_active ?? '')).join('|')

  const records = useMemo(() => {
    const list: QrListEntry[] = []
    if (tenant && tenantId) {
      list.push({
        kind: 'tenant',
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        isActive: tenantActive,
      })
    }
    const actives = branchActiveKey.split('|')
    branches.forEach((branch: Branch, index) => {
      const raw = actives[index]
      list.push({
        kind: 'branch',
        id: branch.id,
        name: branch.name,
        slug: branch.slug,
        isActive: raw === 'true' ? true : raw === 'false' ? false : null,
      })
    })
    return list
  }, [tenant, tenantId, tenantActive, branches, branchActiveKey])

  const visible = useMemo(
    () => records.filter((entry) => matchesQrListFilters(entry, search, typeFilter, statusFilter)),
    [records, search, typeFilter, statusFilter],
  )

  if (!tenantId) {
    return (
      <main aria-label={t('qrManagementAria')} className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">{t('qrManagementTitle')}</h1>
        <p className="text-sm text-[var(--fg-muted)]">{t('noTenantSelected')}</p>
      </main>
    )
  }

  if ((tenantLoading && !alignedTenant) || branchesLoading) {
    return (
      <main aria-label={t('qrManagementAria')} className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">{t('qrManagementTitle')}</h1>
        <p className="text-sm text-[var(--fg-muted)]">{t('qrLoading')}</p>
      </main>
    )
  }

  if (!tenant) {
    return (
      <main aria-label={t('qrManagementAria')} className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">{t('qrManagementTitle')}</h1>
        <p className="text-sm text-[var(--danger-text)]">{t('tenantNotFoundPeriod')}</p>
      </main>
    )
  }

  return (
    <main aria-label={t('qrManagementAria')} data-testid="qr-management-page" className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('qrManagementTitle')}</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">{t('qrManagementSubtitle')}</p>
      </div>

      <div className="flex flex-col gap-3 mb-6 lg:flex-row lg:items-end">
        <label className="flex-1 text-sm">
          <span className="block text-[var(--fg-muted)] mb-1">{t('qrSearchLabel')}</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('qrSearchPlaceholder')}
            className="w-full border border-[var(--border)] rounded-lg text-sm px-3 py-2 bg-[var(--card)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </label>
        <label className="text-sm">
          <span className="block text-[var(--fg-muted)] mb-1">{t('qrFilterTypeLabel')}</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as QrListTypeFilter)}
            aria-label={t('qrFilterTypeLabel')}
            className="w-full lg:w-44 border border-[var(--border)] rounded-lg text-sm px-3 py-2 bg-[var(--card)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <option value="all">{t('qrFilterTypeAll')}</option>
            <option value="tenant">{t('qrFilterTypeTenant')}</option>
            <option value="branch">{t('qrFilterTypeBranch')}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-[var(--fg-muted)] mb-1">{t('qrFilterStatusLabel')}</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as QrListStatusFilter)}
            aria-label={t('qrFilterStatusLabel')}
            className="w-full lg:w-44 border border-[var(--border)] rounded-lg text-sm px-3 py-2 bg-[var(--card)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <option value="all">{t('qrFilterStatusAll')}</option>
            <option value="active">{t('qrActive')}</option>
            <option value="disabled">{t('qrDisabled')}</option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)]" data-testid="qr-management-empty">
          {records.length === 0 ? t('qrEmptyWorkspace') : t('qrEmptyFiltered')}
        </p>
      ) : (
        <div className="space-y-8">
          {visible.map((entry) => (
            <WorkspaceQrCard
              key={`${entry.kind}-${entry.id}`}
              entry={entry}
              tenant={tenant}
              canManage={entry.kind === 'tenant' ? canManageTenant : canManageBranch}
              viewHref={
                entry.kind === 'tenant'
                  ? `/console/tenants/${entry.id}`
                  : `/console/branches/${entry.id}`
              }
            />
          ))}
        </div>
      )}
    </main>
  )
}

export default function QrManagementPage() {
  return (
    <ErrorBoundary feature="QR Management">
      <PermissionGuard permissions={['tenant.view', 'branches.view']} mode="any" fallback={<AccessDenied />}>
        <QrManagementContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
