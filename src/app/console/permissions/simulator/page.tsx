'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Play, ShieldCheck, ShieldX, Info } from 'lucide-react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { useRbacStore } from '@/stores'
import {
  ROLE_TEMPLATES,
  PERMISSION_CATEGORIES,
  ALL_PERMISSIONS,
  applyOverrides,
} from '@/services/permission.service'
import type { Role, P7Permission, SimulationResult } from '@/types/rbac'

function SimulatorContent() {
  const { userOverrides } = useRbacStore()
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([])
  const [applyUserOverrideId, setApplyUserOverrideId] = useState<string>('')
  const [result, setResult] = useState<SimulationResult | null>(null)

  function toggleRole(role: Role) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }

  function runSimulation() {
    const basePerms = new Set<P7Permission>()
    for (const role of selectedRoles) {
      const tmpl = ROLE_TEMPLATES.find((t) => t.role === role)
      if (tmpl) tmpl.permissions.forEach((p) => basePerms.add(p))
    }

    const override = applyUserOverrideId
      ? userOverrides.find((o) => o.userId === applyUserOverrideId)
      : undefined

    const effective = override
      ? applyOverrides(Array.from(basePerms), override)
      : Array.from(basePerms)

    const effectiveSet = new Set(effective)
    const grantedByOverride = override ? override.allow.filter((p) => effectiveSet.has(p)) : []
    const deniedPerms = ALL_PERMISSIONS.filter((p) => !effectiveSet.has(p))

    setResult({
      label: selectedRoles.length > 0 ? selectedRoles.join(' + ') : 'No roles',
      roles: selectedRoles,
      effectivePermissions: effective,
      deniedPermissions: deniedPerms,
      grantedByOverride,
      permissionCount: effective.length,
    })
  }

  const categoryBreakdown = useMemo(() => {
    if (!result) return []
    const effectiveSet = new Set(result.effectivePermissions)
    return Object.values(PERMISSION_CATEGORIES).map((cat) => ({
      label: cat.label,
      granted: cat.permissions.filter((p: P7Permission) => effectiveSet.has(p)),
      denied: cat.permissions.filter((p: P7Permission) => !effectiveSet.has(p)),
    }))
  }, [result])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/console/permissions" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Permission Simulator</h1>
          <p className="text-sm text-gray-500">Preview what a user would see under any role combination</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Simulate As</h3>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Select Roles</label>
              <div className="space-y-2">
                {ROLE_TEMPLATES.map((t) => (
                  <label key={t.role} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(t.role)}
                      onChange={() => toggleRole(t.role)}
                      className="accent-indigo-600"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">{t.label}</span>
                    <span className="text-xs text-gray-400 ml-auto">{t.permissions.length} perms</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Apply User Override (optional)</label>
              <select
                value={applyUserOverrideId}
                onChange={(e) => setApplyUserOverrideId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">None</option>
                {userOverrides
                  .filter((o) => o.allow.length > 0 || o.deny.length > 0)
                  .map((o) => (
                    <option key={o.userId} value={o.userId}>
                      User {o.userId} ({o.allow.length} grant, {o.deny.length} deny)
                    </option>
                  ))}
              </select>
            </div>

            <button
              onClick={runSimulation}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 transition-colors"
            >
              <Play className="w-4 h-4" />
              Run Simulation
            </button>
          </div>

          {result && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-green-50 rounded-lg p-2">
                  <div className="text-xl font-bold text-green-700">{result.permissionCount}</div>
                  <div className="text-xs text-green-600">Effective</div>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <div className="text-xl font-bold text-red-600">{result.deniedPermissions.length}</div>
                  <div className="text-xs text-red-500">Denied</div>
                </div>
              </div>
              {result.grantedByOverride.length > 0 && (
                <div className="flex items-start gap-1.5 text-xs text-indigo-600 bg-indigo-50 rounded-lg p-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  {result.grantedByOverride.length} permission(s) granted via user override
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results panel */}
        <div className="col-span-2">
          {!result ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
              <ShieldCheck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Select roles and run simulation to preview permissions</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm text-indigo-700">
                Simulating: <strong>{result.label}</strong>
              </div>
              {categoryBreakdown.map((cat) => (
                <div key={cat.label} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">{cat.label}</span>
                    <span className="text-xs text-gray-400">
                      {cat.granted.length}/{cat.granted.length + cat.denied.length}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {[...cat.granted, ...cat.denied].map((perm) => {
                      const granted = cat.granted.includes(perm)
                      return (
                        <div key={perm} className="flex items-center gap-2.5 px-4 py-2">
                          {granted ? (
                            <ShieldCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <ShieldX className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          )}
                          <span
                            className={`text-sm font-mono ${granted ? 'text-gray-800' : 'text-gray-400 line-through'}`}
                          >
                            {perm}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PermissionSimulatorPage() {
  return (
    <PermissionGuard permission="staff.manage" fallback={<AccessDenied />}>
      <SimulatorContent />
    </PermissionGuard>
  )
}
