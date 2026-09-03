'use client'

import { useTranslations } from 'next-intl'
import type { PermissionAuditEntry } from '@/types/rbac-api'

export interface PermissionAuditTableProps {
  entries: PermissionAuditEntry[]
  loading?: boolean
  compact?: boolean
}

function formatWhen(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function PermissionAuditTable({ entries, loading = false, compact = false }: PermissionAuditTableProps) {
  const t = useTranslations('console')

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded border bg-[var(--card-hover)] animate-pulse"/>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return <p className="text-sm text-[var(--fg-muted)]">{t('noPermissionAuditEntries')}</p>
  }

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-[var(--card-hover)] border-b border-[var(--border)]">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-[var(--fg-muted)]">{t('timeColumnLabel')}</th>
            <th className="text-left px-4 py-2 font-medium text-[var(--fg-muted)]">{t('actorColumnLabel')}</th>
            <th className="text-left px-4 py-2 font-medium text-[var(--fg-muted)]">{t('actionColumnLabel')}</th>
            {!compact && (
              <th className="text-left px-4 py-2 font-medium text-[var(--fg-muted)]">{t('membershipColumnLabel')}</th>
            )}
            <th className="text-left px-4 py-2 font-medium text-[var(--fg-muted)]">{t('permissionColumnLabel')}</th>
            <th className="text-left px-4 py-2 font-medium text-[var(--fg-muted)]">{t('roleColumnLabel')}</th>
            {!compact && (
              <th className="text-left px-4 py-2 font-medium text-[var(--fg-muted)]">{t('metadataColumnLabel')}</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-[var(--card-hover)]">
              <td className="px-4 py-2 text-xs text-[var(--fg-muted)] whitespace-nowrap">
                {formatWhen(entry.timestamp)}
              </td>
              <td className="px-4 py-2 text-xs">
                {entry.actorName ?? entry.actorId ?? '—'}
              </td>
              <td className="px-4 py-2 text-xs font-medium">{entry.action}</td>
              {!compact && (
                <td className="px-4 py-2 text-xs text-[var(--fg-muted)] font-mono">
                  {entry.membershipId ?? '—'}
                </td>
              )}
              <td className="px-4 py-2 text-xs font-mono">{entry.permission ?? '—'}</td>
              <td className="px-4 py-2 text-xs">{entry.role ?? '—'}</td>
              {!compact && (
                <td className="px-4 py-2 text-xs text-[var(--fg-muted)] max-w-[200px] truncate">
                  {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
