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
          <h1 className="text-2xl font-bold text-[var(--fg)]">{t('userManagementTitle')}</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">{t('manageStaffRolesSubtitle')}</p>
        </div>
        <PermissionGuard permission="staff.manage">
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 bg-[var(--info)] text-white px-4 py-2 rounded-lg hover:bg-[var(--info-hover)] transition-colors text-sm font-medium"
          >
            <UserPlus className="w-4 h-4"/>
            {t('inviteUserLabel')}
          </button>
        </PermissionGuard>
      </div>

      <StaffInviteModal tenantId={tenantId} open={inviteOpen} onClose={() => setInviteOpen(false)} />

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
          <div className="text-2xl font-bold text-[var(--fg)]">{totalCount}</div>
          <div className="text-sm text-[var(--fg-muted)]">{t('totalUsersLabel')}</div>
        </div>
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
          <div className="text-2xl font-bold text-[var(--success-text)]">{activeCount}</div>
          <div className="text-sm text-[var(--fg-muted)]">{t('statusActive')}</div>
        </div>
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
          <div className="text-2xl font-bold text-[var(--info-text)]">{roleCatalog.length}</div>
          <div className="text-sm text-[var(--fg-muted)]">{t('totalRolesLabel')}</div>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--fg-subtle)]"/>
          <input
            type="text"
            placeholder={t('searchUsersEllipsisPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--fg-subtle)]"/>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-[var(--border)] rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
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
            className="border border-[var(--border)] rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
          >
            <option value="all">{t('allStatusOption')}</option>
            <option value="active">{t('statusActive')}</option>
            <option value="suspended">{t('statusSuspended')}</option>
            <option value="pending">{t('statusPending')}</option>
            <option value="removed">{t('staffStatusRemoved')}</option>
          </select>
        </div>
      </div>

      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-[var(--fg-subtle)]">{t('loadingStaffEllipsis')}</div>
        ) : staff.length === 0 ? (
          <div className="p-8 text-center text-[var(--fg-subtle)]">{t('noUsersMatchFilters')}</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--card-hover)] border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--fg-muted)]">{t('userColumnLabel')}</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--fg-muted)]">{t('rolesTabLabel')}</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--fg-muted)]">{t('tableHeaders.status')}</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--fg-muted)]">{t('lastSeenLabel')}</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-[var(--card-hover)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--info-subtle)] flex items-center justify-center text-[var(--info-text)] font-semibold text-xs">
                        {member.firstName[0]}
                        {member.lastName[0]}
                      </div>
                      <div>
                        <div className="font-medium text-[var(--fg)]">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="text-[var(--fg-subtle)] text-xs">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StaffRoleBadges assignments={assignmentsByUser.get(member.userId) ?? []} />
                  </td>
                  <td className="px-4 py-3">
                    {member.status === 'active' ? (
                      <span className="flex items-center gap-1 text-[var(--success-text)] text-xs font-medium">
                        <CheckCircle className="w-3.5 h-3.5"/>
                        {t('statusActive')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[var(--fg-subtle)] text-xs font-medium">
                        <XCircle className="w-3.5 h-3.5"/>
                        {t(STAFF_STATUS_KEY[member.status] ?? 'statusInactive')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--fg-muted)] text-xs">{formatDate(member.lastSeenAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2 items-start">
                      <Link
                        href={`/console/permissions/${member.userId}`}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--info)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--info-hover)]"
                      >
                        {t('managePermissionsLabel')}
                        <ChevronRight className="w-3.5 h-3.5"/>
                      </Link>
                      <Link
                        href={`/console/staff/${member.id}`}
                        className="flex items-center gap-1 text-[var(--fg-muted)] hover:text-[var(--fg)] text-xs"
                      >
                        {t('viewStaffProfileLabel')}
                        <ChevronRight className="w-3.5 h-3.5"/>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--fg-muted)]">
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
    <PermissionGuard permission="staff.manage"fallback={<AccessDenied />}>
      <UsersContent />
    </PermissionGuard>
  )
}
