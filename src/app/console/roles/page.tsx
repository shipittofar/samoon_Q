'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Shield, ChevronDown, ChevronRight, Lock, Search, CheckCircle, XCircle } from 'lucide-react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ROLE_TEMPLATES, PERMISSION_CATEGORIES, ALL_PERMISSIONS } from '@/services/permission.service'
import type { Role } from '@/types/rbac'

const ROLE_COLORS: Record<Role, { badge: string; ring: string; header: string }> = {
  owner:     { badge: 'bg-purple-100 text-purple-700', ring: 'ring-purple-200', header: 'bg-purple-50 border-purple-100' },
  admin:     { badge: 'bg-orange-100 text-orange-700', ring: 'ring-orange-200', header: 'bg-orange-50 border-orange-100' },
  manager:   { badge: 'bg-green-100 text-green-700',   ring: 'ring-green-200',  header: 'bg-green-50 border-green-100' },
  cashier:   { badge: 'bg-cyan-100 text-cyan-700',     ring: 'ring-cyan-200',   header: 'bg-cyan-50 border-cyan-100' },
  waiter:    { badge: 'bg-blue-100 text-blue-700',     ring: 'ring-blue-200',   header: 'bg-blue-50 border-blue-100' },
  kitchen:   { badge: 'bg-amber-100 text-amber-700',   ring: 'ring-amber-200',  header: 'bg-amber-50 border-amber-100' },
  marketing: { badge: 'bg-pink-100 text-pink-700',     ring: 'ring-pink-200',   header: 'bg-pink-50 border-pink-100' },
  support:   { badge: 'bg-indigo-100 text-indigo-700', ring: 'ring-indigo-200', header: 'bg-indigo-50 border-indigo-100' },
}

export default function RolesPage() {
  const t = useTranslations('console')
  const [search, setSearch] = useState('')
  const [expandedRole, setExpandedRole] = useState<Role | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  const filteredRoles = ROLE_TEMPLATES.filter(
    (t) =>
      !search ||
      t.label.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()),
  )

  const toggleRole = (role: Role) => setExpandedRole((r) => (r === role ? null : role))
  const toggleCategory = (key: string) =>
    setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <ErrorBoundary feature="Role Management">
      <PermissionGuard permission="staff.manage" fallback={<AccessDenied />}>
        <main className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('roleManagementTitle')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('viewSystemRolesHint')}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: t('totalRolesLabel'), value: ROLE_TEMPLATES.length },
              { label: t('systemRolesLabel'), value: ROLE_TEMPLATES.filter((r) => r.system).length },
              { label: t('totalPermissionsLabel'), value: ALL_PERMISSIONS.length },
              { label: t('avgPermissionsPerRoleLabel'), value: Math.round(ROLE_TEMPLATES.reduce((a, r) => a + r.permissions.length, 0) / ROLE_TEMPLATES.length) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Search */}
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

          {/* Role cards */}
          <div className="space-y-3">
            {filteredRoles.map((template) => {
              const colors = ROLE_COLORS[template.role]
              const isExpanded = expandedRole === template.role

              return (
                <div key={template.role} className={`rounded-xl border overflow-hidden ring-1 ${colors.ring}`}>
                  {/* Role header */}
                  <button
                    onClick={() => toggleRole(template.role)}
                    className={`w-full flex items-center justify-between px-5 py-4 text-left border-b ${colors.header} transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-gray-500 flex-shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                            {template.label}
                          </span>
                          {template.system && (
                            <span className="flex items-center gap-0.5 text-[10px] text-gray-400 border border-gray-200 bg-white px-1.5 py-0.5 rounded-full">
                              <Lock className="h-2.5 w-2.5" /> {t('systemLowercaseLabel')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 text-left">{template.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
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

                  {/* Permission breakdown by category */}
                  {isExpanded && (
                    <div className="divide-y divide-gray-100 bg-white">
                      {Object.entries(PERMISSION_CATEGORIES).map(([catKey, cat]) => {
                        const granted = cat.permissions.filter((p) => template.permissions.includes(p))
                        if (granted.length === 0 && !search) return null

                        const isCatExpanded = expandedCategories[`${template.role}:${catKey}`] !== false
                        const allGranted = granted.length === cat.permissions.length

                        return (
                          <div key={catKey}>
                            <button
                              onClick={() => toggleCategory(`${template.role}:${catKey}`)}
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
                                      <span className={`text-[10px] font-mono ${hasIt ? 'text-gray-700' : 'text-gray-300'}`}>
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
