'use client'

import { useTranslations } from 'next-intl'
import type { PermissionOverride } from '@/types/rbac-api'

export interface PermissionOverrideTableProps {
  overrides: PermissionOverride[]
  loading?: boolean
  canManage?: boolean
  onAdd?: () => void
  onEdit?: (override: PermissionOverride) => void
  onDelete?: (override: PermissionOverride) => void
}

function formatWhen(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function PermissionOverrideTable({
  overrides,
  loading = false,
  canManage = false,
  onAdd,
  onEdit,
  onDelete,
}: PermissionOverrideTableProps) {
  const t = useTranslations('console')

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg border bg-[var(--card-hover)] animate-pulse"/>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {canManage && onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-[var(--card-hover)]"
        >
          {t('addOverrideLabel')}
        </button>
      )}

      {overrides.length === 0 ? (
        <p className="text-sm text-[var(--fg-muted)]">{t('noPermissionOverrides')}</p>
      ) : (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--card-hover)] border-b border-[var(--border)]">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-[var(--fg-muted)]">{t('permissionColumnLabel')}</th>
                <th className="text-left px-4 py-2 font-medium text-[var(--fg-muted)]">{t('effectColumnLabel')}</th>
                <th className="text-left px-4 py-2 font-medium text-[var(--fg-muted)]">{t('createdAtLabel')}</th>
                <th className="text-left px-4 py-2 font-medium text-[var(--fg-muted)]">{t('createdByLabel')}</th>
                {canManage && <th className="px-4 py-2"/>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {overrides.map((o) => (
                <tr key={o.id} className="hover:bg-[var(--card-hover)]">
                  <td className="px-4 py-2 font-mono text-xs">{o.permission}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        o.effect === 'allow'
                          ? 'bg-[var(--success-subtle)] text-[var(--success-text)]'
                          : 'bg-[var(--danger-subtle)] text-[var(--danger-text)]'
                      }`}
                    >
                      {o.effect === 'allow' ? t('allowEffectLabel') : t('denyEffectLabel')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-[var(--fg-muted)] text-xs">{formatWhen(o.createdAt)}</td>
                  <td className="px-4 py-2 text-[var(--fg-muted)] text-xs">{o.createdBy || '—'}</td>
                  {canManage && (
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(o)}
                            className="text-xs text-[var(--info-text)] hover:underline"
                          >
                            {t('editLabel')}
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(o)}
                            className="text-xs text-[var(--danger-text)] hover:underline"
                          >
                            {t('deleteLabel')}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
