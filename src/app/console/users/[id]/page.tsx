'use client'

import { useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  User,
  Shield,
  GitBranch,
  Lock,
  CheckCircle,
  XCircle,
  ShieldCheck,
  ShieldX,
  Plus,
  Trash2,
} from 'lucide-react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { useRbacStore } from '@/stores'
import {
  ROLE_TEMPLATES,
  PERMISSION_CATEGORIES,
  resolveEffectivePermissions,
} from '@/services/permission.service'
import {
  MOCK_STAFF_USER,
  MOCK_ADMIN_USER,
  MOCK_OWNER_USER,
  MOCK_CASHIER_USER,
  MOCK_KITCHEN_USER,
  MOCK_MARKETING_USER,
  MOCK_SUPPORT_USER,
  MOCK_MULTI_ROLE_USER,
  MOCK_BRANCHES,
} from '@/lib/mock-data'
import type { Role, P7Permission } from '@/types/rbac'

const MOCK_USERS_MAP = [
  { user: MOCK_OWNER_USER, p7Roles: ['owner'] as Role[], active: true, lastLogin: '2024-01-15T10:30:00Z' },
  { user: MOCK_ADMIN_USER, p7Roles: ['admin'] as Role[], active: true, lastLogin: '2024-01-14T09:15:00Z' },
  { user: MOCK_STAFF_USER, p7Roles: ['manager'] as Role[], active: true, lastLogin: '2024-01-13T14:22:00Z' },
  { user: MOCK_CASHIER_USER, p7Roles: ['cashier'] as Role[], active: true, lastLogin: '2024-01-15T08:00:00Z' },
  { user: MOCK_KITCHEN_USER, p7Roles: ['kitchen'] as Role[], active: true, lastLogin: '2024-01-14T07:45:00Z' },
  { user: MOCK_MARKETING_USER, p7Roles: ['marketing'] as Role[], active: true, lastLogin: '2024-01-10T11:30:00Z' },
  { user: MOCK_SUPPORT_USER, p7Roles: ['support'] as Role[], active: false, lastLogin: '2024-01-12T16:00:00Z' },
  { user: MOCK_MULTI_ROLE_USER, p7Roles: ['cashier', 'kitchen'] as Role[], active: true, lastLogin: '2024-01-15T09:00:00Z' },
]

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

const TABS = ['Profile', 'Roles', 'Branches', 'Permissions', 'Activity', 'Security'] as const
type Tab = (typeof TABS)[number]

function UserDetailContent({ userId }: { userId: string }) {
  const entry = MOCK_USERS_MAP.find((e) => e.user.id === userId)
  const [activeTab, setActiveTab] = useState<Tab>('Profile')
  const [localRoles, setLocalRoles] = useState<Role[]>(entry?.p7Roles ?? [])
  const [dirty, setDirty] = useState(false)
  const { userOverrides, setUserOverride } = useRbacStore()

  const override = userOverrides.find((o) => o.userId === userId && o.tenantId === 'tenant-1') ?? {
    userId,
    tenantId: 'tenant-1',
    allow: [] as P7Permission[],
    deny: [] as P7Permission[],
  }

  const effectivePermissions = useMemo(() => {
    return resolveEffectivePermissions(localRoles, override)
  }, [localRoles, override])

  if (!entry) {
    return (
      <div className="text-center py-12 text-gray-500">
        <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>User not found.</p>
        <Link href="/console/users" className="text-indigo-600 hover:underline text-sm mt-2 block">
          Back to Users
        </Link>
      </div>
    )
  }

  const { user, active, lastLogin } = entry

  function handleAddRole(role: Role) {
    if (!localRoles.includes(role)) {
      setLocalRoles([...localRoles, role])
      setDirty(true)
    }
  }

  function handleRemoveRole(role: Role) {
    setLocalRoles(localRoles.filter((r) => r !== role))
    setDirty(true)
  }

  function handleSaveRoles() {
    setDirty(false)
  }

  function handleGrantPermission(perm: P7Permission) {
    const newAllow = [...override.allow]
    const newDeny = override.deny.filter((d) => d !== perm)
    if (!newAllow.includes(perm)) newAllow.push(perm)
    setUserOverride(userId, 'tenant-1', newAllow, newDeny)
  }

  function handleDenyPermission(perm: P7Permission) {
    const newDeny = [...override.deny]
    const newAllow = override.allow.filter((a) => a !== perm)
    if (!newDeny.includes(perm)) newDeny.push(perm)
    setUserOverride(userId, 'tenant-1', newAllow, newDeny)
  }

  function handleResetPermission(perm: P7Permission) {
    setUserOverride(
      userId,
      'tenant-1',
      override.allow.filter((a) => a !== perm),
      override.deny.filter((d) => d !== perm),
    )
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Link href="/console/users" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user.first_name} {user.last_name}
          </h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {active ? (
            <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              Active
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-medium">
              <XCircle className="w-3.5 h-3.5" />
              Inactive
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab: Profile */}
      {activeTab === 'Profile' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xl">
              {user.first_name[0]}
              {user.last_name[0]}
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {user.first_name} {user.last_name}
              </div>
              <div className="text-gray-500 text-sm">{user.email}</div>
              <div className="text-gray-400 text-xs mt-1">ID: {user.id}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Phone</div>
              <div className="text-sm text-gray-700">{user.phone ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Last Login</div>
              <div className="text-sm text-gray-700">{new Date(lastLogin).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Status</div>
              <div className="text-sm text-gray-700">{active ? 'Active' : 'Inactive'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Verified</div>
              <div className="text-sm text-gray-700">{user.is_verified ? 'Yes' : 'No'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Roles */}
      {activeTab === 'Roles' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Assigned Roles</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {localRoles.map((role) => (
                <span
                  key={role}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${ROLE_COLORS[role]}`}
                >
                  {role}
                  <button
                    onClick={() => handleRemoveRole(role)}
                    className="hover:opacity-60 transition-opacity ml-1"
                    aria-label={`Remove ${role}`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
              {localRoles.length === 0 && <span className="text-gray-400 text-sm">No roles assigned</span>}
            </div>

            <h4 className="text-sm font-medium text-gray-600 mb-2">Add Role</h4>
            <div className="flex flex-wrap gap-2">
              {ROLE_TEMPLATES.filter((t) => !localRoles.includes(t.role)).map((t) => (
                <button
                  key={t.role}
                  onClick={() => handleAddRole(t.role)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {dirty && (
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={handleSaveRoles}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Save Roles
                </button>
                <button
                  onClick={() => {
                    setLocalRoles(entry.p7Roles)
                    setDirty(false)
                  }}
                  className="text-gray-500 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Branches */}
      {activeTab === 'Branches' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Branch Access</h3>
          <div className="space-y-3">
            {MOCK_BRANCHES.map((branch) => (
              <div key={branch.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <GitBranch className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{branch.name}</div>
                    <div className="text-xs text-gray-400">{branch.city}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Global roles apply</span>
                  <span
                    className={`w-2 h-2 rounded-full ${branch.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Branch-specific role overrides can be configured per assignment. Currently using tenant-wide roles.
          </p>
        </div>
      )}

      {/* Tab: Permissions */}
      {activeTab === 'Permissions' && (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-700">
            <strong>{effectivePermissions.filter((e) => e.effective).length}</strong> effective permissions •{' '}
            <strong>{override.allow.length}</strong> granted by override •{' '}
            <strong>{override.deny.length}</strong> denied by override
          </div>
          {Object.values(PERMISSION_CATEGORIES).map((cat) => {
            const catPerms = effectivePermissions.filter((e) => cat.permissions.includes(e.permission))
            if (catPerms.length === 0) return null
            return (
              <div key={cat.label} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">{cat.label}</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {catPerms.map((ep) => (
                    <div key={ep.permission} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {ep.denied ? (
                          <ShieldX className="w-4 h-4 text-red-500" />
                        ) : ep.effective ? (
                          <ShieldCheck className="w-4 h-4 text-green-500" />
                        ) : (
                          <Shield className="w-4 h-4 text-gray-300" />
                        )}
                        <span className="text-sm font-mono text-gray-700">{ep.permission}</span>
                        {ep.fromOverride && !ep.denied && (
                          <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">override</span>
                        )}
                        {ep.denied && (
                          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">denied</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleGrantPermission(ep.permission)}
                          disabled={ep.effective && !ep.denied}
                          className="p-1 rounded hover:bg-green-100 text-green-600 disabled:opacity-30 transition-colors"
                          title="Grant"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDenyPermission(ep.permission)}
                          disabled={ep.denied}
                          className="p-1 rounded hover:bg-red-100 text-red-500 disabled:opacity-30 transition-colors"
                          title="Deny"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleResetPermission(ep.permission)}
                          disabled={!ep.fromOverride && !ep.denied}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-30 transition-colors"
                          title="Reset to role default"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tab: Activity */}
      {activeTab === 'Activity' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Activity Log</h3>
          <div className="space-y-3">
            {[
              { action: 'Logged in', time: lastLogin, icon: '🔐' },
              { action: 'Permission override applied', time: '2024-01-10T14:00:00Z', icon: '🛡️' },
              { action: 'Role updated', time: '2024-01-05T09:00:00Z', icon: '👤' },
              { action: 'Account created', time: user.created_at, icon: '✨' },
            ].map((ev, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-base">{ev.icon}</span>
                <div>
                  <div className="text-gray-900 font-medium">{ev.action}</div>
                  <div className="text-gray-400 text-xs">{new Date(ev.time).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Security */}
      {activeTab === 'Security' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Security Settings
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-700">Email verified</span>
                <span className={user.is_verified ? 'text-green-600 font-medium' : 'text-red-500'}>
                  {user.is_verified ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-700">Two-factor authentication</span>
                <span className="text-gray-400">Not configured</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-700">Active sessions</span>
                <span className="text-gray-700">1 session</span>
              </div>
            </div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-red-700 mb-2">Danger Zone</h4>
            <button className="text-sm text-red-600 hover:text-red-800 font-medium border border-red-200 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors">
              Deactivate Account
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <PermissionGuard permission="staff.manage" fallback={<AccessDenied />}>
      <UserDetailContent userId={id} />
    </PermissionGuard>
  )
}
