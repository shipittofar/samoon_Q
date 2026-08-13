'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Search, Shield, ChevronDown, ChevronRight, CheckCircle, XCircle, User, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { StaffRoleBadges } from '@/components/admin/StaffRoleBadges'
import { useTenantRoles, usePermissionCatalog, useStaffPage, useAssignments, useConsoleTenantId } from '@/hooks'
import { groupAssignmentsByUserId } from '@/lib/assignments'

export default function PermissionsPage() {
  const t = useTranslations('console')
  const tenantId = useConsoleTenantId() ?? ''
  const { data: roles = [], isLoading: rolesLoading } = useTenantRoles(tenantId)
  const { data: catalog = [], isLoading: catalogLoading } = usePermissionCatalog()
  const { data: staffPage, isLoading: staffLoading } = useStaffPage(tenantId, { page_size: 100 })
  const { data: assignmentPage } = useAssignments(tenantId, { page_size: 500 })
  const assignmentsByUser = groupAssignmentsByUserId(assignmentPage?.results ?? [])
  const staff = staffPage?.results ?? []
  const [search, setSearch] = useState('')
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null)
  const [expandedResources, setExpandedResources] = useState<Record<string, boolean>>({})

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

  const filteredCatalog = catalog.filter(
    (p) =>
      !search ||
      p.key.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.resource.toLowerCase().includes(search.toLowerCase()),
  )

  const filteredRoles = roles.filter(
    (role) =>
      !search ||
      role.name.toLowerCase().includes(search.toLowerCase()) ||
      role.slug.toLowerCase().includes(search.toLowerCase()) ||
      role.permissions.some((p) => p.toLowerCase().includes(search.toLowerCase())),
  )

  const filteredStaff = staff.filter(
    (m) =>
      !search ||
      m.firstName.toLowerCase().includes(search.toLowerCase()) ||
      m.lastName.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()),
  )

  if (rolesLoading || catalogLoading || staffLoading) {
    return (
      <PermissionGuard permission="rbac.manage_roles" fallback={<AccessDenied />}>
        <main className="p-6">{t('loadingStaffEllipsis')}</main>
      </PermissionGuard>
    )
  }

  return (
    <ErrorBoundary feature="Permission Management">
      <PermissionGuard permission="rbac.manage_roles" fallback={<AccessDenied />}>
        <main className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('permissionManagementTitle')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('staffAccessManagementHint')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('permissionCatalogHint')}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{catalog.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">{t('totalPermissionsLabel')}</div>
            </div>
            <div className="rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{roles.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">{t('totalRolesLabel')}</div>
            </div>
            <div className="rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {Object.keys(permissionCategories).length}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{t('permissionResourcesLabel')}</div>
            </div>
            <div className="rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {roles.length > 0
                  ? Math.round(
                      roles.reduce((a, r) => a + r.permissions.length, 0) / roles.length,
                    )
                  : 0}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{t('avgPermissionsPerRoleLabel')}</div>
            </div>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPermissionsEllipsisPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5 text-gray-500" />
              {t('userRbacManagementSectionTitle')}
            </h2>
            <p className="text-sm text-gray-500">{t('staffAccessManagementHint')}</p>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {filteredStaff.length === 0 ? (
                <p className="p-6 text-sm text-gray-500 text-center">{t('noUsersMatchFilters')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">{t('userColumnLabel')}</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">{t('rolesTabLabel')}</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">
                        {t('managePermissionsLabel')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStaff.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {member.firstName} {member.lastName}
                          </div>
                          <div className="text-xs text-gray-400">{member.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <StaffRoleBadges assignments={assignmentsByUser.get(member.userId) ?? []} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/console/permissions/${member.userId}`}
                            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                          >
                            {t('managePermissionsLabel')}
                            <ChevronRightIcon className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-500" />
              {t('rolesAndPermissionsLabel')}
            </h2>
            {filteredRoles.map((role) => {
              const isExpanded = expandedRoleId === role.id
              return (
                <div key={role.id} className="rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedRoleId(isExpanded ? null : role.id)}
                    className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <span className="font-semibold text-gray-900">{role.name}</span>
                      {role.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">
                        {role.permissions.length} {t('permissionsLowercaseLabel')}
                      </span>
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
                        const granted = cat.permissions.filter((p) => role.permissions.includes(p))
                        if (granted.length === 0 && search) return null
                        const catExpanded = expandedResources[`${role.id}:${catKey}`] !== false
                        return (
                          <div key={catKey}>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedResources((prev) => ({
                                  ...prev,
                                  [`${role.id}:${catKey}`]: !catExpanded,
                                }))
                              }
                              className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-gray-50"
                            >
                              <span className="text-xs font-medium text-gray-700">
                                {cat.label} ({granted.length}/{cat.permissions.length})
                              </span>
                              {catExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                              )}
                            </button>
                            {catExpanded && (
                              <div className="px-5 pb-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
                                {cat.permissions.map((p) => {
                                  const hasIt = role.permissions.includes(p)
                                  return (
                                    <div key={p} className="flex items-center gap-1.5">
                                      {hasIt ? (
                                        <CheckCircle className="h-3 w-3 text-green-500" />
                                      ) : (
                                        <XCircle className="h-3 w-3 text-gray-200" />
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
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t('permissionCatalogTitle')}</h2>
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
              {filteredCatalog.length === 0 ? (
                <p className="p-6 text-sm text-gray-500 text-center">{t('noPermissionsInCatalog')}</p>
              ) : (
                filteredCatalog.map((perm) => (
                  <div key={perm.key} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <code className="text-xs font-mono text-gray-800">{perm.key}</code>
                    <span className="text-xs text-gray-500">{perm.description || perm.resource}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
