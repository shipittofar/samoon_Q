'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Search, Filter, UserPlus, ChevronRight, CheckCircle, XCircle } from 'lucide-react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { StaffInviteModal } from '@/components/admin/StaffInviteModal'
import { useStaffPage, useTenantRoles, useAssignments, useConsoleTenantId } from '@/hooks'
import { StaffRoleBadges } from '@/components/admin/StaffRoleBadges'
import { groupAssignmentsByUserId } from '@/lib/assignments'
import type { StaffStatus } from '@/types/staff'

const STAFF_STATUS_KEY: Record<StaffStatus, string> = {
  active: 'statusActive',
  suspended: 'statusSuspended',
  removed: 'staffStatusRemoved',
  pending: 'statusPending',
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

function UsersContent() {
  const t = useTranslations('console')
  const tenantId = useConsoleTenantId() ?? ''
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StaffStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [inviteOpen, setInviteOpen] = useState(false)
  const pageSize = 20

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, roleFilter, statusFilter])

  const listParams = useMemo(
    () => ({
      page,
      page_size: pageSize,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(roleFilter !== 'all' ? { role: roleFilter } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    }),
    [page, debouncedSearch, roleFilter, statusFilter],
  )

  const { data: staffPage, isLoading } = useStaffPage(tenantId, listParams)
  const { data: roleCatalog = [] } = useTenantRoles(tenantId)
  const { data: assignmentPage } = useAssignments(tenantId, { page_size: 500 })
  const assignmentsByUser = groupAssignmentsByUserId(assignmentPage?.results ?? [])

  const staff = staffPage?.results ?? []
  const totalCount = staffPage?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const activeCount = staff.filter((m) => m.status === 'active').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('userManagementTitle')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('manageStaffRolesSubtitle')}</p>
        </div>
        <PermissionGuard permission="staff.manage">
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <UserPlus className="w-4 h-4" />
            {t('inviteUserLabel')}
          </button>
        </PermissionGuard>
      </div>

      <StaffInviteModal tenantId={tenantId} open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
          <div className="text-sm text-gray-500">{t('totalUsersLabel')}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          <div className="text-sm text-gray-500">{t('statusActive')}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-indigo-600">{roleCatalog.length}</div>
          <div className="text-sm text-gray-500">{t('totalRolesLabel')}</div>
        </div>
      </div>

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
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">{t('allRolesOption')}</option>
            {roleCatalog.map((rt) => (
              <option key={rt.id} value={rt.slug}>
                {rt.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StaffStatus | 'all')}
            className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">{t('allStatusOption')}</option>
            <option value="active">{t('statusActive')}</option>
            <option value="suspended">{t('statusSuspended')}</option>
            <option value="pending">{t('statusPending')}</option>
            <option value="removed">{t('staffStatusRemoved')}</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">{t('loadingStaffEllipsis')}</div>
        ) : staff.length === 0 ? (
          <div className="p-8 text-center text-gray-400">{t('noUsersMatchFilters')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('userColumnLabel')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('rolesTabLabel')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('tableHeaders.status')}</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">{t('lastSeenLabel')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs">
                        {member.firstName[0]}
                        {member.lastName[0]}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="text-gray-400 text-xs">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StaffRoleBadges assignments={assignmentsByUser.get(member.userId) ?? []} />
                  </td>
                  <td className="px-4 py-3">
                    {member.status === 'active' ? (
                      <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {t('statusActive')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400 text-xs font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        {t(STAFF_STATUS_KEY[member.status] ?? 'statusInactive')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(member.lastSeenAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/console/permissions/${member.userId}`}
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                      >
                        {t('managePermissionsLabel')}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        href={`/console/staff/${member.id}`}
                        className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-xs"
                      >
                        {t('viewStaffProfileLabel')}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Page {page} of {totalPages} ({totalCount} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 border rounded disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
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
