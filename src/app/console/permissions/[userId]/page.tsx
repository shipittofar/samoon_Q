'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Shield, ShieldCheck, ShieldX, Plus, Minus, RotateCcw, Search, ChevronDown, ChevronRight, CheckCircle, XCircle, AlertCircle, User } from 'lucide-react'
import Link from 'next/link'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useRbacStore } from '@/stores'
import { useTenantStore } from '@/stores'
import {
  MOCK_RBAC_USERS,
  resolveEffectivePermissions,
  PERMISSION_CATEGORIES,
  ROLE_PERMISSION_MAP,
} from '@/services/permission.service'
import type { P7Permission, Role } from '@/types/rbac'

const ALL_ROLES: Role[] = ['owner', 'admin', 'manager', 'cashier', 'waiter', 'kitchen', 'marketing', 'support']

const ROLE_COLORS: Record<Role, string> = {
  owner:     'bg-purple-100 text-purple-700 border-purple-200',
  admin:     'bg-orange-100 text-orange-700 border-orange-200',
  manager:   'bg-green-100 text-green-700 border-green-200',
  cashier:   'bg-cyan-100 text-cyan-700 border-cyan-200',
  waiter:    'bg-blue-100 text-blue-700 border-blue-200',
  kitchen:   'bg-amber-100 text-amber-700 border-amber-200',
  marketing: 'bg-pink-100 text-pink-700 border-pink-200',
  support:   'bg-indigo-100 text-indigo-700 border-indigo-200',
}

export default function UserPermissionsPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.userId as string
  const tenantId = useTenantStore((s) => s.tenant?.id ?? 'tenant-savor-01')
  const { userOverrides, setUserOverride, clearUserOverride } = useRbacStore()

  const [search, setSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [pendingAllow, setPendingAllow] = useState<Set<P7Permission>>(new Set())
  const [pendingDeny, setPendingDeny] = useState<Set<P7Permission>>(new Set())
  const [pendingRoles, setPendingRoles] = useState<Role[] | null>(null)
  const [saved, setSaved] = useState(false)

  const user = MOCK_RBAC_USERS.find((u) => u.id === userId)
  const mockAssignment = user?.tenantAssignments.find((a) => a.tenantId === 'tenant-savor-01')
  const baseRoles: Role[] = mockAssignment?.roles ?? []
  const currentRoles = pendingRoles ?? baseRoles

  const savedOverride = userOverrides.find((o) => o.userId === userId && o.tenantId === tenantId)
  const currentAllow = pendingAllow.size > 0 || pendingDeny.size > 0 ? pendingAllow : new Set(savedOverride?.allow ?? [])
  const currentDeny = pendingAllow.size > 0 || pendingDeny.size > 0 ? pendingDeny : new Set(savedOverride?.deny ?? [])

  const effective = useMemo(
    () => resolveEffectivePermissions(currentRoles, { allow: [...currentAllow], deny: [...currentDeny] }),
    [currentRoles, currentAllow, currentDeny],
  )

  if (!user) {
    return (
      <main className="p-6">
        <Link href="/console/permissions" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Permissions
        </Link>
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <User className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">User not found</p>
        </div>
      </main>
    )
  }

  const toggleCategory = (key: string) =>
    setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }))

  const grantPermission = (p: P7Permission) => {
    const allow = new Set(currentAllow)
    const deny = new Set(currentDeny)
    allow.add(p)
    deny.delete(p)
    setPendingAllow(allow)
    setPendingDeny(deny)
    setSaved(false)
  }

  const denyPermission = (p: P7Permission) => {
    const allow = new Set(currentAllow)
    const deny = new Set(currentDeny)
    deny.add(p)
    allow.delete(p)
    setPendingAllow(allow)
    setPendingDeny(deny)
    setSaved(false)
  }

  const resetPermission = (p: P7Permission) => {
    const allow = new Set(currentAllow)
    const deny = new Set(currentDeny)
    allow.delete(p)
    deny.delete(p)
    setPendingAllow(allow)
    setPendingDeny(deny)
    setSaved(false)
  }

  const addRole = (role: Role) => {
    if (!currentRoles.includes(role)) {
      setPendingRoles([...currentRoles, role])
      setSaved(false)
    }
  }

  const removeRole = (role: Role) => {
    setPendingRoles(currentRoles.filter((r) => r !== role))
    setSaved(false)
  }

  const resetAllOverrides = () => {
    setPendingAllow(new Set())
    setPendingDeny(new Set())
    setPendingRoles(null)
    setSaved(false)
  }

  const saveChanges = () => {
    setUserOverride(userId, tenantId, [...currentAllow], [...currentDeny])
    setSaved(true)
  }

  const effectiveCount = effective.filter((e) => e.effective).length
  const overrideCount = currentAllow.size + currentDeny.size
  const isDirty = pendingAllow.size > 0 || pendingDeny.size > 0 || pendingRoles !== null

  const filteredCategories = Object.entries(PERMISSION_CATEGORIES).filter(([, cat]) => {
    if (!search) return true
    return (
      cat.label.toLowerCase().includes(search.toLowerCase()) ||
      cat.permissions.some((p) => p.toLowerCase().includes(search.toLowerCase()))
    )
  })

  return (
    <ErrorBoundary feature="User Permission Editor">
      <PermissionGuard permission="staff.manage" fallback={<AccessDenied />}>
        <main className="p-6 space-y-6 max-w-5xl">
          {/* Header */}
          <div>
            <Link href="/console/permissions" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3 w-fit">
              <ArrowLeft className="h-4 w-4" /> Back to Users
            </Link>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-base font-semibold text-gray-600 flex-shrink-0">
                {user.first_name[0]}{user.last_name[0]}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{user.first_name} {user.last_name}</h1>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">{effectiveCount}</div>
                  <div className="text-xs text-gray-400">effective permissions</div>
                </div>
                {overrideCount > 0 && (
                  <div className="text-right">
                    <div className="text-sm font-semibold text-amber-600">{overrideCount}</div>
                    <div className="text-xs text-gray-400">overrides</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Role assignment */}
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">Assigned Roles</h2>
                <div className="flex flex-wrap gap-1.5">
                  {currentRoles.length === 0 ? (
                    <span className="text-xs text-gray-400 italic">No roles assigned</span>
                  ) : (
                    currentRoles.map((role) => (
                      <span key={role} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${ROLE_COLORS[role]}`}>
                        {role}
                        <button
                          onClick={() => removeRole(role)}
                          className="ml-0.5 hover:opacity-60"
                          aria-label={`Remove ${role} role`}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2">Add role</p>
                  <div className="flex flex-wrap gap-1">
                    {ALL_ROLES.filter((r) => !currentRoles.includes(r)).map((role) => (
                      <button
                        key={role}
                        onClick={() => addRole(role)}
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border opacity-60 hover:opacity-100 transition-opacity ${ROLE_COLORS[role]}`}
                      >
                        <Plus className="h-2.5 w-2.5" /> {role}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="rounded-xl border border-gray-200 p-4 space-y-2">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Legend</h2>
                {[
                  { icon: <CheckCircle className="h-3.5 w-3.5 text-green-500" />, label: 'From role' },
                  { icon: <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />, label: 'Granted override' },
                  { icon: <ShieldX className="h-3.5 w-3.5 text-red-500" />, label: 'Denied override' },
                  { icon: <XCircle className="h-3.5 w-3.5 text-gray-300" />, label: 'Not granted' },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-xs text-gray-600">
                    {icon} {label}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {isDirty && (
                  <button
                    onClick={saveChanges}
                    className="w-full py-2 px-4 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
                  >
                    Save Changes
                  </button>
                )}
                {saved && !isDirty && (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 justify-center">
                    <CheckCircle className="h-3.5 w-3.5" /> Changes saved
                  </div>
                )}
                <button
                  onClick={resetAllOverrides}
                  className="w-full py-2 px-4 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset All Overrides
                </button>
                {savedOverride && (
                  <button
                    onClick={() => { clearUserOverride(userId, tenantId); setSaved(false) }}
                    className="w-full py-2 px-4 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Clear Saved Overrides
                  </button>
                )}
              </div>
            </div>

            {/* Right: Permission matrix */}
            <div className="lg:col-span-2 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search permissions…"
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div className="space-y-2">
                {filteredCategories.map(([key, cat]) => {
                  const isExpanded = expandedCategories[key] !== false // default expanded
                  const catPermissions = cat.permissions.filter((p) =>
                    !search || p.toLowerCase().includes(search.toLowerCase()),
                  )
                  const catEffective = effective.filter((e) => catPermissions.includes(e.permission))
                  const catGranted = catEffective.filter((e) => e.effective).length

                  return (
                    <div key={key} className="rounded-xl border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => toggleCategory(key)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                          <span className="text-sm font-medium text-gray-900">{cat.label}</span>
                          <span className="text-xs text-gray-400">{catGranted}/{catPermissions.length}</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-100 divide-y divide-gray-50">
                          {catPermissions.map((permission) => {
                            const result = effective.find((e) => e.permission === permission)
                            const isAllow = currentAllow.has(permission)
                            const isDeny = currentDeny.has(permission)

                            return (
                              <div key={permission} className="flex items-center justify-between px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {isDeny ? (
                                    <ShieldX className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                  ) : isAllow ? (
                                    <ShieldCheck className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                  ) : result?.fromRole ? (
                                    <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                                  )}
                                  <span className="text-xs font-mono text-gray-700">{permission}</span>
                                  {isAllow && (
                                    <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1 rounded">+override</span>
                                  )}
                                  {isDeny && (
                                    <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-1 rounded">−denied</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => grantPermission(permission)}
                                    disabled={isAllow && !result?.fromRole}
                                    title="Grant override"
                                    className="p-1 rounded hover:bg-blue-50 text-blue-500 disabled:opacity-30 transition-colors"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => denyPermission(permission)}
                                    disabled={isDeny}
                                    title="Deny override"
                                    className="p-1 rounded hover:bg-red-50 text-red-500 disabled:opacity-30 transition-colors"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  {(isAllow || isDeny) && (
                                    <button
                                      onClick={() => resetPermission(permission)}
                                      title="Reset to role default"
                                      className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </main>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
