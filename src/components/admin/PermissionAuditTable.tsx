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
          <div key={i} className="h-10 rounded border bg-gray-50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return <p className="text-sm text-gray-500">{t('noPermissionAuditEntries')}</p>
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-gray-600">{t('timeColumnLabel')}</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">{t('actorColumnLabel')}</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">{t('actionColumnLabel')}</th>
            {!compact && (
              <th className="text-left px-4 py-2 font-medium text-gray-600">{t('membershipColumnLabel')}</th>
            )}
            <th className="text-left px-4 py-2 font-medium text-gray-600">{t('permissionColumnLabel')}</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">{t('roleColumnLabel')}</th>
            {!compact && (
              <th className="text-left px-4 py-2 font-medium text-gray-600">{t('metadataColumnLabel')}</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                {formatWhen(entry.timestamp)}
              </td>
              <td className="px-4 py-2 text-xs">
                {entry.actorName ?? entry.actorId ?? '—'}
              </td>
              <td className="px-4 py-2 text-xs font-medium">{entry.action}</td>
              {!compact && (
                <td className="px-4 py-2 text-xs text-gray-500 font-mono">
                  {entry.membershipId ?? '—'}
                </td>
              )}
              <td className="px-4 py-2 text-xs font-mono">{entry.permission ?? '—'}</td>
              <td className="px-4 py-2 text-xs">{entry.role ?? '—'}</td>
              {!compact && (
                <td className="px-4 py-2 text-xs text-gray-500 max-w-[200px] truncate">
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
