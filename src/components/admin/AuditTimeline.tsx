'use client'

import { useMemo } from 'react'
import type { AuditLog, AuditTimelineItem, AuditSeverity } from '@/types/audit-log'

const SEVERITY_STYLES: Record<AuditSeverity, string> = {
  info:     'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  warning:  'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
}

const SEVERITY_DOT: Record<AuditSeverity, string> = {
  info:     'bg-blue-400',
  warning:  'bg-amber-400',
  critical: 'bg-red-500',
}

interface AuditLogEntryProps {
  log: AuditLog
}

function AuditLogEntry({ log }: AuditLogEntryProps) {
  const changedFields = log.changeset.changedFields ?? []
  return (
    <div className="flex gap-3 group">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <span className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[log.severity]}`} />
        <span className="w-px flex-1 bg-[var(--border)] group-last:hidden mt-1" />
      </div>

      {/* Content */}
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${SEVERITY_STYLES[log.severity]}`}>
            {log.severity}
          </span>
          <span className="text-xs font-mono text-[var(--fg-muted)] bg-[var(--card-hover)] px-1.5 py-0.5 rounded">
            {log.action}
          </span>
          {log.scope.branchId && (
            <span className="text-xs text-[var(--fg-subtle)] bg-[var(--card-hover)] px-1.5 py-0.5 rounded">
              {log.scope.branchId}
            </span>
          )}
        </div>

        <p className="mt-1 text-sm text-[var(--fg)]">
          <span className="font-medium">{log.actor.name}</span>
          {' — '}
          {log.description}
        </p>

        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--fg-muted)]">
            Target: <span className="font-medium text-[var(--fg)]">{log.target.displayName}</span>
          </span>
          {changedFields.length > 0 && (
            <span className="text-xs text-[var(--fg-muted)]">
              Changed: {changedFields.join(', ')}
            </span>
          )}
          <span className="text-xs text-[var(--fg-subtle)]">
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
          {log.metadata.correlationId && (
            <span className="text-xs font-mono text-[var(--fg-subtle)]">
              #{log.metadata.correlationId}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

interface AuditTimelineProps {
  items: AuditTimelineItem[]
  isLoading?: boolean
  emptyMessage?: string
}

export function AuditTimeline({ items, isLoading = false, emptyMessage = 'No audit events found.' }: AuditTimelineProps) {
  const totalEvents = useMemo(() => items.reduce((n, g) => n + g.events.length, 0), [items])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse space-y-2">
            <div className="h-4 w-24 bg-[var(--card-hover)] rounded" />
            <div className="space-y-2 pl-5">
              <div className="h-3 w-full bg-[var(--card-hover)] rounded" />
              <div className="h-3 w-2/3 bg-[var(--card-hover)] rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (totalEvents === 0) {
    return (
      <div className="py-12 text-center text-[var(--fg-muted)] text-sm">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {items.map((group) => (
        <div key={group.date}>
          <h3 className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider mb-3">
            {new Date(group.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            <span className="ml-2 normal-case font-normal">({group.events.length} events)</span>
          </h3>
          <div>
            {group.events.map((log) => (
              <AuditLogEntry key={log.id} log={log} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default AuditTimeline
