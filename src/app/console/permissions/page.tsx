'use client'

import { useState } from 'react'
import { Search, Users, Shield, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useRbacStore } from '@/stores'
import { useTenantStore } from '@/stores'
import { MOCK_RBAC_USERS, getPermissionsForRole, ROLE_PERMISSION_MAP } from '@/services/permission.service'
import Link from 'next/link'
import type { Role } from '@/types/rbac'

const ROLE_COLORS: Record<Role, string> = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-orange-100 text-orange-700',
  manager: 'bg-green-100 text-green-700',
  cashier: 'bg-cyan-100 text-cyan-700',
  waiter: 'bg-blue-100 text-blue-700',
  kitchen: 'bg-amber-100 text-amber-700',
  marketing: 'bg-pink-100 text-pink-700',
  support: 'bg-indigo-100 text-indigo-700',
}

export default function PermissionsPage() {
  const tenantId = useTenantStore((s) => s.tenant?.id ?? '')
  const tenantRoles = useRbacStore((s) => s.tenantRoles)
  const userOverrides = useRbacStore((s) => s.userOverrides)
  const [search, setSearch] = useState('')

  const filtered = MOCK_RBAC_USERS
    .filter(
      (u) =>
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      const aAssignment = a.tenantAssignments.find(
        (t) => t.tenantId === 'tenant-savor-01'
      )
      const bAssignment = b.tenantAssignments.find(
        (t) => t.tenantId === 'tenant-savor-01'
      )

      const aCount = getPermissionsForRole(aAssignment?.roles ?? []).length
      const bCount = getPermissionsForRole(bAssignment?.roles ?? []).length

      return bCount - aCount
    })

  // const filtered = MOCK_RBAC_USERS.filter(
  //   (u) =>
  //     u.email.toLowerCase().includes(search.toLowerCase()) ||
  //     `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()),
  // )

  return (
    <ErrorBoundary feature="Permission Management">
      <PermissionGuard permission="staff.manage" fallback={<AccessDenied />}>
        <main className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Permission Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Assign roles and configure per-user permission overrides for this tenant.
            </p>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* User list */}
          <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Users className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No users match your search.</p>
              </div>
            ) : (
              filtered.map((user) => {
                const sessionRoles = tenantRoles.find((t) => t.tenantId === tenantId)?.roles ?? []
                // For demo: use mock tenant assignment roles
                const mockAssignment = user.tenantAssignments.find((a) => a.tenantId === 'tenant-savor-01')
                const roles = mockAssignment?.roles ?? []
                const permissions = getPermissionsForRole(roles)
                const override = userOverrides.find(
                  (o) => o.userId === user.id && o.tenantId === tenantId,
                )
                const hasOverride = override && (override.allow.length > 0 || override.deny.length > 0)

                return (
                  <Link
                    key={user.id}
                    href={`/console/permissions/${user.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
                  >
                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600 flex-shrink-0">
                      {user.first_name[0]}{user.last_name[0]}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {user.first_name} {user.last_name}
                        </p>
                        {hasOverride && (
                          <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                            <AlertCircle className="h-3 w-3" />
                            overrides
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {roles.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">No roles assigned</span>
                        ) : (
                          roles.map((role) => (
                            <span
                              key={role}
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-700'}`}
                            >
                              {role}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Permission count */}
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 text-sm text-gray-700">
                        <Shield className="h-3.5 w-3.5 text-gray-400" />
                        <span className="font-medium">{permissions.length}</span>
                        <span className="text-gray-400 text-xs">permissions</span>
                      </div>
                      {override && (
                        <div className="flex items-center gap-2 text-xs mt-0.5">
                          {override.allow.length > 0 && (
                            <span className="text-green-600">+{override.allow.length}</span>
                          )}
                          {override.deny.length > 0 && (
                            <span className="text-red-500">−{override.deny.length}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                  </Link>
                )
              })
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              Permission from role
            </div>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              User has overrides applied
            </div>
          </div>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
