'use client'

import { use } from 'react'
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
  order:     (id) => `/admin/orders/${id}`,
  customer:  (id) => `/admin/customers/${id}`,
  staff:     (id) => `/admin/staff/${id}`,
  tenant:    (id) => `/admin/tenants/${id}`,
  branch:    (id) => `/admin/branches/${id}`,
  vendor:    (id) => `/admin/vendors/${id}`,
  promotion: (id) => `/admin/promotions/${id}`,
  reservation: (id) => `/admin/reservations/${id}`,
}

function TargetLink({ type, id }: { type: string; id: string }) {
  const hrefFn = TARGET_HREF[type]
  if (!hrefFn) return <p className="text-xs text-gray-400 font-mono">{id}</p>
  return (
    <Link href={hrefFn(id)} className="text-xs text-blue-600 font-mono hover:underline">
      {id}
    </Link>
  )
}

function AuditLogDetailContent({ id }: { id: string }) {
  const { data: log, isLoading, isError } = useAuditLog(id)
  const { data: timelineItems } = useAuditTimeline({ actorId: id, pageSize: 10 })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading audit log…
      </div>
    )
  }

  if (isError || !log) {
    return (
      <div className="flex items-center gap-2 text-red-600 p-4">
        <AlertCircle className="w-5 h-5" />
        <p>Audit log not found or failed to load.</p>
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
      <Link href="/admin/audit-logs" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-3.5 h-3.5" />
        Audit Logs
      </Link>

      {/* Header card */}
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${log.severity === 'critical' ? 'bg-red-50' : log.severity === 'warning' ? 'bg-amber-50' : 'bg-blue-50'}`}>
              <SeverityIcon className={`w-5 h-5 ${log.severity === 'critical' ? 'text-red-500' : log.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'}`} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{log.action}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{log.description}</p>
            </div>
          </div>
          <Badge variant={SEVERITY_BADGE[log.severity]} className="capitalize">{log.severity}</Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t text-sm">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">Timestamp</p>
              <p className="font-medium text-gray-800">{new Date(log.timestamp).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">Actor</p>
              <p className="font-medium text-gray-800">{log.actor?.name ?? '—'}</p>
              <p className="text-xs text-gray-400">{log.actor?.roles?.join(', ') ?? ''}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Tag className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">Target</p>
              <p className="font-medium text-gray-800 capitalize">{log.target?.type ?? '—'}</p>
              {log.target?.id && (
                <TargetLink type={log.target.type} id={log.target.id} />
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-400 text-xs">Log ID</p>
              <p className="font-mono text-xs text-gray-600 break-all">{log.id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Changeset */}
      {changedKeys.length > 0 && (
        <div className="bg-white border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Changes</h2>
          <div className="divide-y text-sm">
            {changedKeys.map((key) => (
              <div key={key} className="py-2 grid grid-cols-3 gap-4">
                <span className="font-mono text-gray-600">{key}</span>
                <span className="text-red-500 line-through">{JSON.stringify((log.changeset.before ?? {})[key] ?? null)}</span>
                <span className="text-green-600">{JSON.stringify((log.changeset.after ?? {})[key] ?? null)}</span>
              </div>
            ))}
          </div>
          {changedKeys.length === 0 && (
            <p className="text-gray-400 text-sm">No field-level changes recorded.</p>
          )}
        </div>
      )}

      {/* Metadata */}
      {log.metadata && Object.keys(log.metadata).length > 0 && (
        <div className="bg-white border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Metadata</h2>
          <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto text-gray-700">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </div>
      )}

      {/* Recent actor activity */}
      {(timelineItems ?? []).flatMap((t) => t.events).length > 0 && (
        <div className="bg-white border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity by {log.actor?.name}</h2>
          <div className="space-y-2">
            {(timelineItems ?? []).flatMap((t) => t.events).slice(0, 5).map((event) => (
              <div key={event.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant={SEVERITY_BADGE[event.severity]} className="text-xs capitalize">{event.severity}</Badge>
                  <span className="text-gray-700">{event.action}</span>
                </div>
                <span className="text-gray-400 text-xs">{new Date(event.timestamp).toLocaleTimeString()}</span>
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
      <PermissionGuard permission="audit.view" fallback={<AccessDenied />}>
        <div className="min-h-screen bg-gray-50">
          <div className="pt-16">
            <AuditLogDetailContent id={id} />
          </div>
        </div>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
