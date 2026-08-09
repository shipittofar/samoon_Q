'use client'

import { useTranslations } from 'next-intl'
import type { EffectivePermissionsResponse, PermissionOverride } from '@/types/rbac-api'
import { buildUserPermissionRows } from '@/lib/user-permission-rows'

export interface UserPermissionControlTableProps {
  data?: EffectivePermissionsResponse
  loading?: boolean
  roleNames?: string[]
  overrides?: PermissionOverride[]
  canManage?: boolean
  onAllow?: (permissionKey: string) => void
  onDeny?: (permissionKey: string) => void
  onRemoveOverride?: (override: PermissionOverride) => void
  pending?: boolean
}

export function UserPermissionControlTable({
  data,
  loading = false,
  roleNames = [],
  overrides = [],
  canManage = false,
  onAllow,
  onDeny,
  onRemoveOverride,
  pending = false,
}: UserPermissionControlTableProps) {
  const t = useTranslations('console')

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded-lg border bg-gray-50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-gray-500">{t('noEffectivePermissionsData')}</p>
  }

  const rows = buildUserPermissionRows(data, roleNames)
  const overrideByPermission = new Map(overrides.map((o) => [o.permission, o]))

  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">{t('noPermissionOverrides')}</p>
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-gray-600">{t('permissionColumnLabel')}</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">{t('sourceColumnLabel')}</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">{t('statusColumnLabel')}</th>
            <th className="text-left px-4 py-2 font-medium text-gray-600">{t('actionColumnLabel')}</th>
            {canManage && <th className="px-4 py-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => {
            const existingOverride = overrideByPermission.get(row.permission)
            return (
              <tr key={`${row.permission}-${row.source}`} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-gray-800">{row.permission}</td>
                <td className="px-4 py-2 text-xs text-gray-700">
                  {row.source === 'role' ? (
                    <span>{t('roleColonName', { name: row.sourceLabel })}</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800">
                      {t('overrideSourceLabel')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs">
                  {row.status === 'inherited' ? (
                    <span className="text-gray-500">{t('inheritedStatusLabel')}</span>
                  ) : row.status === 'deny' ? (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-800">
                      {t('denyEffectLabel')}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">
                      {t('allowEffectLabel')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs">
                  {row.action === 'deny' ? (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-800">
                      {t('denyEffectLabel')}
                    </span>
                  ) : row.action === 'allow' ? (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800">
                      {t('allowEffectLabel')}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                {canManage && (
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {existingOverride ? (
                        <>
                          {existingOverride.effect !== 'allow' && onAllow && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => onAllow(row.permission)}
                              className="text-xs text-green-700 hover:underline disabled:opacity-50"
                            >
                              {t('allowOverrideActionLabel')}
                            </button>
                          )}
                          {existingOverride.effect !== 'deny' && onDeny && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => onDeny(row.permission)}
                              className="text-xs text-red-700 hover:underline disabled:opacity-50"
                            >
                              {t('denyOverrideActionLabel')}
                            </button>
                          )}
                          {onRemoveOverride && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => onRemoveOverride(existingOverride)}
                              className="text-xs text-gray-600 hover:underline disabled:opacity-50"
                            >
                              {t('removeOverrideActionLabel')}
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {onAllow && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => onAllow(row.permission)}
                              className="text-xs text-green-700 hover:underline disabled:opacity-50"
                            >
                              {t('allowOverrideActionLabel')}
                            </button>
                          )}
                          {onDeny && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => onDeny(row.permission)}
                              className="text-xs text-red-700 hover:underline disabled:opacity-50"
                            >
                              {t('denyOverrideActionLabel')}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
