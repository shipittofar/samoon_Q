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
          <div key={i} className="h-10 rounded-lg border bg-[var(--card-hover)] animate-pulse"/>
        ))}
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-[var(--fg-muted)]">{t('noEffectivePermissionsData')}</p>
  }

  const rows = buildUserPermissionRows(data, roleNames)
  const overrideByPermission = new Map(overrides.map((o) => [o.permission, o]))

  if (rows.length === 0) {
    return <p className="text-sm text-[var(--fg-muted)]">{t('noPermissionOverrides')}</p>
  }

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[var(--card-hover)] border-b border-[var(--border)]">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-[var(--fg-muted)]">{t('permissionColumnLabel')}</th>
            <th className="text-left px-4 py-2 font-medium text-[var(--fg-muted)]">{t('sourceColumnLabel')}</th>
            <th className="text-left px-4 py-2 font-medium text-[var(--fg-muted)]">{t('statusColumnLabel')}</th>
            <th className="text-left px-4 py-2 font-medium text-[var(--fg-muted)]">{t('actionColumnLabel')}</th>
            {canManage && <th className="px-4 py-2"/>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((row) => {
            const existingOverride = overrideByPermission.get(row.permission)
            return (
              <tr key={`${row.permission}-${row.source}`} className="hover:bg-[var(--card-hover)]">
                <td className="px-4 py-2 font-mono text-xs text-[var(--fg)]">{row.permission}</td>
                <td className="px-4 py-2 text-xs text-[var(--fg-secondary)]">
                  {row.source === 'role' ? (
                    <span>{t('roleColonName', { name: row.sourceLabel })}</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-[var(--warning-subtle)] text-[var(--warning-text)]">
                      {t('overrideSourceLabel')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs">
                  {row.status === 'inherited' ? (
                    <span className="text-[var(--fg-muted)]">{t('inheritedStatusLabel')}</span>
                  ) : row.status === 'deny' ? (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-[var(--danger-subtle)] text-[var(--danger-text)]">
                      {t('denyEffectLabel')}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-[var(--success-subtle)] text-[var(--success-text)]">
                      {t('allowEffectLabel')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs">
                  {row.action === 'deny' ? (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-[var(--danger-subtle)] text-[var(--danger-text)]">
                      {t('denyEffectLabel')}
                    </span>
                  ) : row.action === 'allow' ? (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-[var(--success-subtle)] text-[var(--success-text)]">
                      {t('allowEffectLabel')}
                    </span>
                  ) : (
                    <span className="text-[var(--fg-subtle)]">—</span>
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
                              className="text-xs text-[var(--success-text)] hover:underline disabled:opacity-50"
                            >
                              {t('allowOverrideActionLabel')}
                            </button>
                          )}
                          {existingOverride.effect !== 'deny' && onDeny && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => onDeny(row.permission)}
                              className="text-xs text-[var(--danger-text)] hover:underline disabled:opacity-50"
                            >
                              {t('denyOverrideActionLabel')}
                            </button>
                          )}
                          {onRemoveOverride && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => onRemoveOverride(existingOverride)}
                              className="text-xs text-[var(--fg-muted)] hover:underline disabled:opacity-50"
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
                              className="text-xs text-[var(--success-text)] hover:underline disabled:opacity-50"
                            >
                              {t('allowOverrideActionLabel')}
                            </button>
                          )}
                          {onDeny && (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => onDeny(row.permission)}
                              className="text-xs text-[var(--danger-text)] hover:underline disabled:opacity-50"
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
