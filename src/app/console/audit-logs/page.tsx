'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Search, Download, AlertCircle, Loader2, RefreshCw, Filter } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { AuditTimeline } from '@/components/admin/AuditTimeline'
import { useAuditLogs, useAuditTimeline, useAuditStatistics, useExportAuditLogs } from '@/hooks'
import { useConsoleTenantId } from '@/hooks/console-workspace'
import { AUDIT_DOMAINS } from '@/services/audit-event-registry'
import type { AuditFilter, AuditSeverity, AuditTargetType } from '@/types/audit-log'

const SEVERITY_BADGE: Record<AuditSeverity, 'info' | 'warning' | 'danger'> = {
  info: 'info',
  warning: 'warning',
  critical: 'danger',
}

type ViewMode = 'timeline' | 'table'

const VIEW_MODE_KEY: Record<ViewMode, string> = {
  timeline: 'viewModeTimeline',
  table: 'viewModeTable',
}

function AuditLogsContent() {
  const t = useTranslations('console')
  const [view, setView] = useState<ViewMode>('timeline')
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState<AuditSeverity | 'all'>('all')
  const [domain, setDomain] = useState<string>('all')
  const [targetType, setTargetType] = useState<AuditTargetType | 'all'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const tenantId = useConsoleTenantId()

  const filter = useMemo<AuditFilter>(() => ({
    ...(tenantId ? { tenantId } : {}),
    ...(severity !== 'all' ? { severity } : {}),
    ...(search ? { search } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(targetType !== 'all' ? { targetType } : {}),
    page,
    pageSize: 20,
    sortBy: 'timestamp',
    sortOrder: 'desc',
  }), [tenantId, severity, search, dateFrom, dateTo, targetType, page])

  const { data: logsPage, isLoading: logsLoading, isError: logsError, refetch } = useAuditLogs(filter)
  const { data: timeline, isLoading: timelineLoading } = useAuditTimeline(filter)
  const { data: stats } = useAuditStatistics(filter)
  const exportMutation = useExportAuditLogs()

  const logs = logsPage?.results ?? []

  const handleExport = () => {
    exportMutation.mutate(
      { filter, format: 'csv', includeChangeset: true },
      {
        onSuccess: (csv) => {
          const blob = new Blob([csv], { type: 'text/csv' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
          a.click()
          URL.revokeObjectURL(url)
        },
      },
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="py-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">{t('breadcrumbs.auditLogs')}</h1>
              <p className="text-[var(--fg-muted)] mt-1">{t('auditLogsSubtitle')}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={() => refetch()}
              >
                {t('refreshLabel')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="h-3.5 w-3.5" />}
                onClick={handleExport}
                disabled={exportMutation.isPending}
              >
                {exportMutation.isPending ? t('exportingEllipsis') : t('exportCsvLabel')}
              </Button>
            </div>
          </div>

          {/* Statistics Cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: t('totalEventsLabel'), value: stats.totalEvents, color: 'text-[var(--fg)]', bg: 'bg-[var(--card-hover)]' },
                { label: t('criticalLabel'), value: stats.criticalEvents, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20' },
                { label: t('warningsLabel'), value: stats.warningEvents, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20' },
                { label: t('infoLabel'), value: stats.infoEvents, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`${bg} rounded-xl p-4 border border-[var(--border)]`}>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-sm text-[var(--fg-muted)]">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 mb-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--fg-muted)]">
              <Filter className="h-4 w-4" />
              {t('filtersLabel')}
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  placeholder={t('searchActorTargetActionEllipsisPlaceholder')}
                  className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>
              <select
                value={severity}
                onChange={(e) => { setSeverity(e.target.value as AuditSeverity | 'all'); setPage(1) }}
                className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                aria-label={t('filterBySeverityAria')}
              >
                <option value="all">{t('allSeveritiesOption')}</option>
                <option value="info">{t('infoLabel')}</option>
                <option value="warning">{t('warningLabel')}</option>
                <option value="critical">{t('criticalLabel')}</option>
              </select>
              <select
                value={domain}
                onChange={(e) => { setDomain(e.target.value); setPage(1) }}
                className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                aria-label={t('filterByDomainAria')}
              >
                <option value="all">{t('allDomainsOption')}</option>
                {AUDIT_DOMAINS.map((d) => (
                  <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                  className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  aria-label={t('fromDateAria')}
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                  className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  aria-label={t('toDateAria')}
                />
              </div>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2 mb-4">
            {(['timeline', 'table'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-xl text-sm font-medium border-2 transition-all capitalize ${
                  view === v
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600'
                    : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-200'
                }`}
              >
                {t(VIEW_MODE_KEY[v])}
              </button>
            ))}
          </div>

          {/* Loading */}
          {(logsLoading || timelineLoading) && (
            <div className="flex items-center justify-center py-24 gap-3 text-[var(--fg-muted)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{t('loadingAuditLogsEllipsis')}</span>
            </div>
          )}

          {/* Error */}
          {logsError && !logsLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-[var(--fg-muted)]">{t('failedToLoadAuditLogs')}</p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>{t('retryLabel')}</Button>
            </div>
          )}

          {/* Timeline View */}
          {!logsLoading && !logsError && view === 'timeline' && (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
              <AuditTimeline items={timeline ?? []} isLoading={timelineLoading} />
            </div>
          )}

          {/* Table View */}
          {!logsLoading && !logsError && view === 'table' && (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--card-hover)]">
                      {[t('timestampLabel'), t('actionColumnLabel'), t('severityLabel'), t('actorColumnLabel'), t('targetLabel'), t('breadcrumbs.branches'), t('descriptionLabel')].map((h) => (
                        <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-[var(--card-hover)] transition-colors">
                        <td className="px-4 py-3 text-xs text-[var(--fg-muted)] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[var(--fg)]">{log.action}</td>
                        <td className="px-4 py-3">
                          <Badge variant={SEVERITY_BADGE[log.severity]} className="capitalize text-xs">
                            {log.severity}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-[var(--fg)]">{log.actor.name}</td>
                        <td className="px-4 py-3 text-sm text-[var(--fg-muted)]">{log.target.displayName}</td>
                        <td className="px-4 py-3 text-xs text-[var(--fg-muted)]">{log.scope.branchId ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-[var(--fg-muted)] max-w-48">
                          <span className="truncate block">{log.description}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {logs.length === 0 && (
                  <div className="py-16 text-center">
                    <p className="text-[var(--fg-muted)]">{t('noAuditEventsMatchFilters')}</p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {logsPage && logsPage.totalPages > 1 && (
                <div className="border-t border-[var(--border)] px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-[var(--fg-muted)]">
                    {t('pageOfTotalCount', { page: logsPage.page, totalPages: logsPage.totalPages, count: logsPage.count })}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      {t('previousLabel')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= logsPage.totalPages}
                    >
                      {t('nextLabel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AuditLogsPage() {
  return (
    <ErrorBoundary feature="AuditLogs">
      <PermissionGuard permission="audit.view" fallback={<AccessDenied />}>
        <AuditLogsContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
