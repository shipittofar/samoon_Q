'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Search, Filter, UserPlus, Shield, ChevronRight, CheckCircle, XCircle } from 'lucide-react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { useRbacStore } from '@/stores'
import {
  MOCK_STAFF_USER,
  MOCK_ADMIN_USER,
  MOCK_OWNER_USER,
  MOCK_CASHIER_USER,
  MOCK_KITCHEN_USER,
  MOCK_MARKETING_USER,
  MOCK_SUPPORT_USER,
  MOCK_MULTI_ROLE_USER,
} from '@/lib/mock-data'
import { ROLE_TEMPLATES } from '@/services/permission.service'
import type { Role } from '@/types/rbac'

const ROLE_COLORS: Record<Role, string> = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-red-100 text-red-800',
  manager: 'bg-orange-100 text-orange-800',
  cashier: 'bg-green-100 text-green-800',
  waiter: 'bg-blue-100 text-blue-800',
  kitchen: 'bg-yellow-100 text-yellow-800',
  marketing: 'bg-pink-100 text-pink-800',
  support: 'bg-gray-100 text-gray-800',
}

const MOCK_USERS = [
  { user: MOCK_OWNER_USER, p7Roles: ['owner'] as Role[], lastLogin: '2024-01-15T10:30:00Z', active: true },
  { user: MOCK_ADMIN_USER, p7Roles: ['admin'] as Role[], lastLogin: '2024-01-14T09:15:00Z', active: true },
  { user: MOCK_STAFF_USER, p7Roles: ['manager'] as Role[], lastLogin: '2024-01-13T14:22:00Z', active: true },
  { user: MOCK_CASHIER_USER, p7Roles: ['cashier'] as Role[], lastLogin: '2024-01-15T08:00:00Z', active: true },
  { user: MOCK_KITCHEN_USER, p7Roles: ['kitchen'] as Role[], lastLogin: '2024-01-14T07:45:00Z', active: true },
  { user: MOCK_MARKETING_USER, p7Roles: ['marketing'] as Role[], lastLogin: '2024-01-10T11:30:00Z', active: true },
  { user: MOCK_SUPPORT_USER, p7Roles: ['support'] as Role[], lastLogin: '2024-01-12T16:00:00Z', active: false },
  { user: MOCK_MULTI_ROLE_USER, p7Roles: ['cashier', 'kitchen'] as Role[], lastLogin: '2024-01-15T09:00:00Z', active: true },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function UsersContent() {
  const t = useTranslations('console')
  const { userOverrides } = useRbacStore()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const filtered = useMemo(() => {
    return MOCK_USERS.filter((entry) => {
      const name = `${entry.user.first_name} ${entry.user.last_name}`.toLowerCase()
      const email = entry.user.email.toLowerCase()
      const q = search.toLowerCase()
      if (q && !name.includes(q) && !email.includes(q)) return false
      if (roleFilter !== 'all' && !entry.p7Roles.includes(roleFilter)) return false
      if (statusFilter === 'active' && !entry.active) return false
      if (statusFilter === 'inactive' && entry.active) return false
      return true
    })
  }, [search, roleFilter, statusFilter])

  const totalActive = MOCK_USERS.filter((u) => u.active).length
  const withOverrides = MOCK_USERS.filter((u) =>
    userOverrides.some((o) => o.userId === u.user.id && (o.allow.length > 0 || o.deny.length > 0)),
  ).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('userManagementTitle')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('manageStaffRolesSubtitle')}</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
          <UserPlus className="w-4 h-4" />
          {t('inviteUserLabel')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{MOCK_USERS.length}</div>
          <div className="text-sm text-gray-500">{t('totalUsersLabel')}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">{totalActive}</div>
          <div className="text-sm text-gray-500">{t('statusActive')}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-indigo-600">{withOverrides}</div>
          <div className="text-sm text-gray-500">{t('withOverridesLabel')}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchUsersEllipsisPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}
            className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">{t('allRolesOption')}</option>
            {ROLE_TEMPLATES.map((rt) => (
              <option key={rt.role} value={rt.role}>
                {rt.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">{t('allStatusOption')}</option>
            <option value="active">{t('statusActive')}</option>
            <option value="inactive">{t('statusInactive')}</option>
          </select>
        </div>
      </div>

      {/* User list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">{t('noUsersMatchFilters')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('userColumnLabel')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('rolesTabLabel')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('tableHeaders.status')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('lastLoginLabel')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('overridesColumnLabel')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(({ user, p7Roles, lastLogin, active }) => {
                const override = userOverrides.find((o) => o.userId === user.id)
                const hasOverride = override && (override.allow.length > 0 || override.deny.length > 0)
                return (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs">
                          {user.first_name[0]}
                          {user.last_name[0]}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-gray-400 text-xs">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p7Roles.map((r) => (
                          <span key={r} className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[r]}`}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {active ? (
                        <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          {t('statusActive')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-400 text-xs font-medium">
                          <XCircle className="w-3.5 h-3.5" />
                          {t('statusInactive')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(lastLogin)}</td>
                    <td className="px-4 py-3">
                      {hasOverride ? (
                        <span className="flex items-center gap-1 text-indigo-600 text-xs font-medium">
                          <Shield className="w-3.5 h-3.5" />
                          {t('overrideCount', { count: (override?.allow.length ?? 0) + (override?.deny.length ?? 0) })}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">{t('none')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/console/users/${user.id}`}
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                      >
                        {t('manageLabel')}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <PermissionGuard permission="staff.manage" fallback={<AccessDenied />}>
      <UsersContent />
    </PermissionGuard>
  )
}
