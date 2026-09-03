'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionAuditTable } from '@/components/admin/PermissionAuditTable'
import { usePermissionAudit, useConsoleTenantId } from '@/hooks'

export default function RbacAuditPage() {
  return (
    <ErrorBoundary feature="RBAC Audit">
      <PermissionGuard permission="audit.view"fallback={<AccessDenied />}>
        <RbacAuditContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}

function RbacAuditContent() {
  const t = useTranslations('console')
  const tenantId = useConsoleTenantId() ?? ''
  const searchParams = useSearchParams()

  const [actionFilter, setActionFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('')
  const [membershipFilter, setMembershipFilter] = useState(
    searchParams.get('membership_id') ?? '',
  )
  const [page, setPage] = useState(1)
  const pageSize = 25

  useEffect(() => {
    setMembershipFilter(searchParams.get('membership_id') ?? '')
    setPage(1)
  }, [searchParams])

  const listParams = useMemo(
    () => ({
      page,
      page_size: pageSize,
      ordering: '-timestamp' as const,
      ...(actionFilter !== 'all' ? { action: actionFilter } : {}),
      ...(actorFilter.trim() ? { actor_id: actorFilter.trim() } : {}),
      ...(membershipFilter.trim() ? { membership_id: membershipFilter.trim() } : {}),
    }),
    [page, actionFilter, actorFilter, membershipFilter],
  )

  const { data, isLoading } = usePermissionAudit(tenantId, listParams)
  const entries = data?.results ?? []
  const totalCount = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--fg)]">{t('rbacAuditPageTitle')}</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">{t('rbacAuditPageHint')}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={actorFilter}
          onChange={(e) => {
            setActorFilter(e.target.value)
            setPage(1)
          }}
          placeholder={t('filterByActorPlaceholder')}
          className="border border-[var(--border)] rounded-lg text-sm px-3 py-2"
        />
        <input
          type="text"
          value={membershipFilter}
          onChange={(e) => {
            setMembershipFilter(e.target.value)
            setPage(1)
          }}
          placeholder={t('filterByMembershipPlaceholder')}
          className="border border-[var(--border)] rounded-lg text-sm px-3 py-2"
        />
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value)
            setPage(1)
          }}
          className="border border-[var(--border)] rounded-lg text-sm px-3 py-2"
        >
          <option value="all">{t('allActionsOption')}</option>
          <option value="permission_granted">{t('actionPermissionGranted')}</option>
          <option value="permission_denied">{t('actionPermissionDenied')}</option>
          <option value="permission_reset">{t('actionPermissionReset')}</option>
          <option value="override_cleared">{t('actionOverrideCleared')}</option>
        </select>
      </div>

      <PermissionAuditTable entries={entries} loading={isLoading} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--fg-muted)]">
            {t('paginationSummary', { page, totalPages, count: totalCount })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="border rounded-md px-3 py-1 disabled:opacity-50"
            >
              {t('previousPageLabel')}
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="border rounded-md px-3 py-1 disabled:opacity-50"
            >
              {t('nextPageLabel')}
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
