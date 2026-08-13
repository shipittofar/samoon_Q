'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Shield, ChevronDown, ChevronRight, Search, CheckCircle, XCircle, Lock } from 'lucide-react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useTenantRoles, usePermissionCatalog, usePermission, useConsoleTenantId } from '@/hooks'
import type { RoleCatalogEntry } from '@/types/rbac-api'

const ROLE_COLORS: Record<string, { badge: string; ring: string; header: string }> = {
  owner: { badge: 'bg-purple-100 text-purple-700', ring: 'ring-purple-200', header: 'bg-purple-50 border-purple-100' },
  admin: { badge: 'bg-orange-100 text-orange-700', ring: 'ring-orange-200', header: 'bg-orange-50 border-orange-100' },
  manager: { badge: 'bg-green-100 text-green-700', ring: 'ring-green-200', header: 'bg-green-50 border-green-100' },
  cashier: { badge: 'bg-cyan-100 text-cyan-700', ring: 'ring-cyan-200', header: 'bg-cyan-50 border-cyan-100' },
  waiter: { badge: 'bg-blue-100 text-blue-700', ring: 'ring-blue-200', header: 'bg-blue-50 border-blue-100' },
  kitchen: { badge: 'bg-amber-100 text-amber-700', ring: 'ring-amber-200', header: 'bg-amber-50 border-amber-100' },
  marketing: { badge: 'bg-pink-100 text-pink-700', ring: 'ring-pink-200', header: 'bg-pink-50 border-pink-100' },
  support: { badge: 'bg-indigo-100 text-indigo-700', ring: 'ring-indigo-200', header: 'bg-indigo-50 border-indigo-100' },
}

const DEFAULT_ROLE_COLORS = {
  badge: 'bg-gray-100 text-gray-700',
  ring: 'ring-gray-200',
  header: 'bg-gray-50 border-gray-100',
}

function roleColors(slug: string) {
  return ROLE_COLORS[slug] ?? DEFAULT_ROLE_COLORS
}

export default function RolesPage() {
  const t = useTranslations('console')
  const tenantId = useConsoleTenantId() ?? ''
  const canManageRoles = usePermission('rbac.manage_roles')
  const { data: roles = [], isLoading: rolesLoading } = useTenantRoles(tenantId)
  const { data: catalog = [], isLoading: catalogLoading } = usePermissionCatalog()
  const [search, setSearch] = useState('')
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  const permissionCategories = useMemo(() => {
    const byResource: Record<string, { label: string; permissions: string[] }> = {}
    for (const entry of catalog) {
      const key = entry.resource || 'general'
      if (!byResource[key]) {
        byResource[key] = { label: entry.resource || 'General', permissions: [] }
      }
      byResource[key].permissions.push(entry.key)
    }
    return byResource
  }, [catalog])

  const filteredRoles = roles.filter(
    (role) =>
      !search ||
      role.name.toLowerCase().includes(search.toLowerCase()) ||
      (role.description?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      role.slug.toLowerCase().includes(search.toLowerCase()),
  )

  const toggleRole = (roleId: string) =>
    setExpandedRoleId((r) => (r === roleId ? null : roleId))
  const toggleCategory = (key: string) =>
    setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }))

  const totalPermissions = catalog.length
  const systemRoleCount = roles.filter((r) => r.isSystemRole).length
  const customRoleCount = roles.length - systemRoleCount

  if (rolesLoading || catalogLoading) {
    return (
      <PermissionGuard permission="rbac.manage_roles" fallback={<AccessDenied />}>
        <main className="p-6">{t('loadingStaffEllipsis')}</main>
      </PermissionGuard>
    )
  }

  return (
    <ErrorBoundary feature="Role Management">
      <PermissionGuard permission="rbac.manage_roles" fallback={<AccessDenied />}>
        <main className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('roleManagementTitle')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('viewSystemRolesHint')}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: t('totalRolesLabel'), value: roles.length },
              { label: t('systemRolesLabel'), value: systemRoleCount },
              { label: t('customRolesLabel'), value: customRoleCount },
              { label: t('totalPermissionsLabel'), value: totalPermissions },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchRolesEllipsisPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div className="space-y-3">
            {filteredRoles.map((template: RoleCatalogEntry) => {
              const colors = roleColors(template.slug)
              const isExpanded = expandedRoleId === template.id

              return (
                <div key={template.id} className={`rounded-xl border overflow-hidden ring-1 ${colors.ring}`}>
                  <button
                    onClick={() => toggleRole(template.id)}
                    className={`w-full flex items-center justify-between px-5 py-4 text-left border-b ${colors.header} transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-gray-500 flex-shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                            {template.name}
                          </span>
                          {template.isSystemRole && (
                            <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              <Lock className="w-3 h-3" />
                              {t('protectedRoleLabel')}
                            </span>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-xs text-gray-500 mt-0.5 text-left">{template.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {canManageRoles && template.editable && !template.isSystemRole ? (
                        <Link
                          href={`/console/roles/${template.id}`}
                          className="text-xs text-indigo-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t('editPermissionsLabel')}
                        </Link>
                      ) : template.isSystemRole ? (
                        <span className="text-xs text-gray-400">{t('readOnlyLabel')}</span>
                      ) : null}
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">{template.permissions.length}</div>
                        <div className="text-[10px] text-gray-400">{t('permissionsLowercaseLabel')}</div>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-gray-100 bg-white">
                      {Object.entries(permissionCategories).map(([catKey, cat]) => {
                        const granted = cat.permissions.filter((p) => template.permissions.includes(p))
                        if (granted.length === 0 && !search) return null

                        const isCatExpanded = expandedCategories[`${template.id}:${catKey}`] !== false
                        const allGranted = granted.length === cat.permissions.length && cat.permissions.length > 0

                        return (
                          <div key={catKey}>
                            <button
                              onClick={() => toggleCategory(`${template.id}:${catKey}`)}
                              className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                {isCatExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                                )}
                                <span className="text-xs font-medium text-gray-700">{cat.label}</span>
                                <span className="text-[10px] text-gray-400">
                                  {granted.length}/{cat.permissions.length}
                                </span>
                              </div>
                              {allGranted && (
                                <span className="text-[10px] text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                                  {t('fullAccessLabel')}
                                </span>
                              )}
                            </button>

                            {isCatExpanded && (
                              <div className="px-5 pb-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
                                {cat.permissions.map((p) => {
                                  const hasIt = template.permissions.includes(p)
                                  return (
                                    <div key={p} className="flex items-center gap-1.5">
                                      {hasIt ? (
                                        <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                                      ) : (
                                        <XCircle className="h-3 w-3 text-gray-200 flex-shrink-0" />
                                      )}
                                      <span
                                        className={`text-[10px] font-mono ${hasIt ? 'text-gray-700' : 'text-gray-300'}`}
                                      >
                                        {p}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
