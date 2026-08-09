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
          <div key={i} className="h-12 rounded-lg border bg-gray-50 animate-pulse" />
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
          className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
        >
          {t('addOverrideLabel')}
        </button>
      )}

      {overrides.length === 0 ? (
        <p className="text-sm text-gray-500">{t('noPermissionOverrides')}</p>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">{t('permissionColumnLabel')}</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">{t('effectColumnLabel')}</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">{t('createdAtLabel')}</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">{t('createdByLabel')}</th>
                {canManage && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {overrides.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs">{o.permission}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        o.effect === 'allow'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {o.effect === 'allow' ? t('allowEffectLabel') : t('denyEffectLabel')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{formatWhen(o.createdAt)}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{o.createdBy || '—'}</td>
                  {canManage && (
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(o)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            {t('editLabel')}
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(o)}
                            className="text-xs text-red-600 hover:underline"
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
