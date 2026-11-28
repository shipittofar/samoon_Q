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
      <PermissionGuard permission="rbac.manage_roles"fallback={<AccessDenied />}>
        <main className="p-6">{t('loadingStaffEllipsis')}</main>
      </PermissionGuard>
    )
  }

  return (
    <ErrorBoundary feature="Permission Management">
      <PermissionGuard permission="rbac.manage_roles"fallback={<AccessDenied />}>
        <main className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--fg)]">{t('permissionManagementTitle')}</h1>
            <p className="text-sm text-[var(--fg-muted)] mt-1">{t('staffAccessManagementHint')}</p>
            <p className="text-xs text-[var(--fg-subtle)] mt-1">{t('permissionCatalogHint')}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-[var(--border)] p-4 text-center">
              <div className="text-2xl font-bold text-[var(--fg)]">{catalog.length}</div>
              <div className="text-xs text-[var(--fg-subtle)] mt-0.5">{t('totalPermissionsLabel')}</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4 text-center">
              <div className="text-2xl font-bold text-[var(--fg)]">{roles.length}</div>
              <div className="text-xs text-[var(--fg-subtle)] mt-0.5">{t('totalRolesLabel')}</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4 text-center">
              <div className="text-2xl font-bold text-[var(--fg)]">
                {Object.keys(permissionCategories).length}
              </div>
              <div className="text-xs text-[var(--fg-subtle)] mt-0.5">{t('permissionResourcesLabel')}</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4 text-center">
              <div className="text-2xl font-bold text-[var(--fg)]">
                {roles.length > 0
                  ? Math.round(
                      roles.reduce((a, r) => a + r.permissions.length, 0) / roles.length,
                    )
                  : 0}
              </div>
              <div className="text-xs text-[var(--fg-subtle)] mt-0.5">{t('avgPermissionsPerRoleLabel')}</div>
            </div>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-subtle)]"/>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPermissionsEllipsisPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5 text-[var(--fg-muted)]"/>
              {t('userRbacManagementSectionTitle')}
            </h2>
            <p className="text-sm text-[var(--fg-muted)]">{t('staffAccessManagementHint')}</p>
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
              {filteredStaff.length === 0 ? (
                <p className="p-6 text-sm text-[var(--fg-muted)] text-center">{t('noUsersMatchFilters')}</p>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--card-hover)] border-b border-[var(--border)]">
                      <th className="text-left px-4 py-3 font-medium text-[var(--fg-muted)]">{t('userColumnLabel')}</th>
                      <th className="text-left px-4 py-3 font-medium text-[var(--fg-muted)]">{t('rolesTabLabel')}</th>
                      <th className="text-right px-4 py-3 font-medium text-[var(--fg-muted)]">
                        {t('managePermissionsLabel')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredStaff.map((member) => (
                      <tr key={member.id} className="hover:bg-[var(--card-hover)]">
                        <td className="px-4 py-3">
                          <div className="font-medium text-[var(--fg)]">
                            {member.firstName} {member.lastName}
                          </div>
                          <div className="text-xs text-[var(--fg-subtle)]">{member.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <StaffRoleBadges assignments={assignmentsByUser.get(member.userId) ?? []} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/console/permissions/${member.userId}`}
                            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--info)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--info-hover)]"
                          >
                            {t('managePermissionsLabel')}
                            <ChevronRightIcon className="w-3.5 h-3.5"/>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-[var(--fg-muted)]"/>
              {t('rolesAndPermissionsLabel')}
            </h2>
            {filteredRoles.map((role) => {
              const isExpanded = expandedRoleId === role.id
              return (
                <div key={role.id} className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedRoleId(isExpanded ? null : role.id)}
                    className="w-full flex items-center justify-between px-5 py-4 bg-[var(--card-hover)] hover:bg-[var(--card-hover)] transition-colors"
                  >
                    <div>
                      <span className="font-semibold text-[var(--fg)]">{role.name}</span>
                      {role.description && (
                        <p className="text-xs text-[var(--fg-muted)] mt-0.5">{role.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-[var(--fg-secondary)]">
                        {role.permissions.length} {t('permissionsLowercaseLabel')}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-[var(--fg-subtle)]"/>
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[var(--fg-subtle)]"/>
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="divide-y divide-[var(--border)] bg-[var(--card)]">
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
                              className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-[var(--card-hover)]"
                            >
                              <span className="text-xs font-medium text-[var(--fg-secondary)]">
                                {cat.label} ({granted.length}/{cat.permissions.length})
                              </span>
                              {catExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-[var(--fg-subtle)]"/>
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-[var(--fg-subtle)]"/>
                              )}
                            </button>
                            {catExpanded && (
                              <div className="px-5 pb-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
                                {cat.permissions.map((p) => {
                                  const hasIt = role.permissions.includes(p)
                                  return (
                                    <div key={p} className="flex items-center gap-1.5">
                                      {hasIt ? (
                                        <CheckCircle className="h-3 w-3 text-[var(--success-text)]"/>
                                      ) : (
                                        <XCircle className="h-3 w-3 text-[var(--fg-disabled)]"/>
                                      )}
                                      <span
                                        className={`text-[10px] font-mono ${hasIt ? 'text-[var(--fg-secondary)]' : 'text-[var(--fg-subtle)]'}`}
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
            <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
              {filteredCatalog.length === 0 ? (
                <p className="p-6 text-sm text-[var(--fg-muted)] text-center">{t('noPermissionsInCatalog')}</p>
              ) : (
                filteredCatalog.map((perm) => (
                  <div key={perm.key} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <code className="text-xs font-mono text-[var(--fg)]">{perm.key}</code>
                    <span className="text-xs text-[var(--fg-muted)]">{perm.description || perm.resource}</span>
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
