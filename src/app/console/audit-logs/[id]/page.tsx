'use client'

import { use } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import {
  ArrowLeft, AlertCircle, Info, AlertTriangle, Clock, User,
  Tag, FileText, Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useAuditLog, useAuditTimeline } from '@/hooks'
import { useConsoleTenantId } from '@/hooks/console-workspace'
import type { AuditSeverity } from '@/types/audit-log'

const SEVERITY_ICON: Record<AuditSeverity, React.ElementType> = {
  info:     Info,
  warning:  AlertTriangle,
  critical: AlertCircle,
}

const SEVERITY_BADGE: Record<AuditSeverity, 'info' | 'warning' | 'danger'> = {
  info:     'info',
  warning:  'warning',
  critical: 'danger',
}

const TARGET_HREF: Record<string, (id: string) => string> = {
  order:     (id) => `/console/orders/${id}`,
  customer:  (id) => `/console/customers/${id}`,
  staff:     (id) => `/console/staff/${id}`,
  tenant:    (id) => `/console/tenants/${id}`,
  branch:    (id) => `/console/branches/${id}`,
  vendor:    (id) => `/console/vendors/${id}`,
  promotion: (id) => `/console/promotions/${id}`,
  reservation: (id) => `/console/reservations/${id}`,
}

function TargetLink({ type, id }: { type: string; id: string }) {
  const hrefFn = TARGET_HREF[type]
  if (!hrefFn) return <p className="text-xs text-[var(--fg-subtle)] font-mono">{id}</p>
  return (
    <Link href={hrefFn(id)} className="text-xs text-[var(--info-text)] font-mono hover:underline">
      {id}
    </Link>
  )
}

function AuditLogDetailContent({ id }: { id: string }) {
  const t = useTranslations('console')
  const tenantId = useConsoleTenantId()
  const { data: log, isLoading, isError } = useAuditLog(id)
  const { data: timelineItems } = useAuditTimeline({
    ...(tenantId ? { tenantId } : {}),
    actorId: id,
    pageSize: 10,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--fg-muted)]">
        <Loader2 className="w-5 h-5 animate-spin mr-2"/>
        {t('loadingAuditLogEllipsis')}
      </div>
    )
  }

  if (isError || !log) {
    return (
      <div className="flex items-center gap-2 text-[var(--danger-text)] p-4">
        <AlertCircle className="w-5 h-5"/>
        <p>{t('auditLogNotFoundOrFailed')}</p>
      </div>
    )
  }

  const SeverityIcon = SEVERITY_ICON[log.severity]
  const beforeKeys = Object.keys(log.changeset?.before ?? {})
  const afterKeys = Object.keys(log.changeset?.after ?? {})
  const changedKeys = [...new Set([...beforeKeys, ...afterKeys])]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link href="/console/audit-logs"className="inline-flex items-center gap-1 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft className="w-3.5 h-3.5"/>
        {t('breadcrumbs.auditLogs')}
      </Link>

      {/* Header card */}
      <div className="bg-[var(--card)] border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${log.severity === 'critical' ? 'bg-[var(--danger-subtle)]' : log.severity === 'warning' ? 'bg-[var(--warning-subtle)]' : 'bg-[var(--info-subtle)]'}`}>
              <SeverityIcon className={`w-5 h-5 ${log.severity === 'critical' ? 'text-[var(--danger-text)]' : log.severity === 'warning' ? 'text-[var(--rating)]' : 'text-[var(--info-text)]'}`} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--fg)]">{log.action}</h1>
              <p className="text-sm text-[var(--fg-muted)] mt-0.5">{log.description}</p>
            </div>
          </div>
          <Badge variant={SEVERITY_BADGE[log.severity]} className="capitalize">{log.severity}</Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t text-sm">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-[var(--fg-subtle)] mt-0.5 shrink-0"/>
            <div>
              <p className="text-[var(--fg-subtle)] text-xs">{t('timestampLabel')}</p>
              <p className="font-medium text-[var(--fg)]">{new Date(log.timestamp).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-[var(--fg-subtle)] mt-0.5 shrink-0"/>
            <div>
              <p className="text-[var(--fg-subtle)] text-xs">{t('actorColumnLabel')}</p>
              <p className="font-medium text-[var(--fg)]">{log.actor?.name ?? '—'}</p>
              <p className="text-xs text-[var(--fg-subtle)]">{log.actor?.roles?.join(', ') ?? ''}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Tag className="w-4 h-4 text-[var(--fg-subtle)] mt-0.5 shrink-0"/>
            <div>
              <p className="text-[var(--fg-subtle)] text-xs">{t('targetLabel')}</p>
              <p className="font-medium text-[var(--fg)] capitalize">{log.target?.type ?? '—'}</p>
              {log.target?.id && (
                <TargetLink type={log.target.type} id={log.target.id} />
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-[var(--fg-subtle)] mt-0.5 shrink-0"/>
            <div>
              <p className="text-[var(--fg-subtle)] text-xs">{t('logIdLabel')}</p>
              <p className="font-mono text-xs text-[var(--fg-muted)] break-all">{log.id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Changeset */}
      {changedKeys.length > 0 && (
        <div className="bg-[var(--card)] border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-[var(--fg-secondary)] mb-4">{t('changesLabel')}</h2>
          <div className="divide-y text-sm">
            {changedKeys.map((key) => (
              <div key={key} className="py-2 grid grid-cols-3 gap-4">
                <span className="font-mono text-[var(--fg-muted)]">{key}</span>
                <span className="text-[var(--danger-text)] line-through">{JSON.stringify((log.changeset.before ?? {})[key] ?? null)}</span>
                <span className="text-[var(--success-text)]">{JSON.stringify((log.changeset.after ?? {})[key] ?? null)}</span>
              </div>
            ))}
          </div>
          {changedKeys.length === 0 && (
            <p className="text-[var(--fg-subtle)] text-sm">{t('noFieldLevelChangesRecorded')}</p>
          )}
        </div>
      )}

      {/* Metadata */}
      {log.metadata && Object.keys(log.metadata).length > 0 && (
        <div className="bg-[var(--card)] border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-[var(--fg-secondary)] mb-4">{t('metadataLabel')}</h2>
          <pre className="text-xs bg-[var(--card-hover)] p-3 rounded-lg overflow-x-auto text-[var(--fg-secondary)]">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </div>
      )}

      {/* Recent actor activity */}
      {(timelineItems ?? []).flatMap((tl) => tl.events).length > 0 && (
        <div className="bg-[var(--card)] border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-[var(--fg-secondary)] mb-4">{t('recentActivityByName', { name: log.actor?.name ?? '' })}</h2>
          <div className="space-y-2">
            {(timelineItems ?? []).flatMap((tl) => tl.events).slice(0, 5).map((event) => (
              <div key={event.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant={SEVERITY_BADGE[event.severity]} className="text-xs capitalize">{event.severity}</Badge>
                  <span className="text-[var(--fg-secondary)]">{event.action}</span>
                </div>
                <span className="text-[var(--fg-subtle)] text-xs">{new Date(event.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AuditLogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <ErrorBoundary feature="Audit Log Detail">
      <PermissionGuard permission="audit.view"fallback={<AccessDenied />}>
        <div className="min-h-screen bg-[var(--card-hover)]">
          <div className="pt-16">
            <AuditLogDetailContent id={id} />
          </div>
        </div>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
