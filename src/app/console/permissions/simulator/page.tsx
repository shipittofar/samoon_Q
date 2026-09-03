'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { ArrowLeft, Play, ShieldCheck, ShieldX } from 'lucide-react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { useTenantRoles, usePermissionCatalog, useConsoleTenantId } from '@/hooks'
import { PERMISSION_CATEGORIES } from '@/services/permission.service'
import type { Role, P7Permission, SimulationResult } from '@/types/rbac'

function SimulatorContent() {
  const t = useTranslations('console')
  const tenantId = useConsoleTenantId() ?? ''
  const { data: roleCatalog = [] } = useTenantRoles(tenantId)
  const { data: permissionCatalog = [] } = usePermissionCatalog()
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([])
  const [result, setResult] = useState<SimulationResult | null>(null)

  const allPermissionKeys = useMemo(
    () => permissionCatalog.map((p) => p.key) as P7Permission[],
    [permissionCatalog],
  )

  function toggleRole(role: Role) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )
  }

  function runSimulation() {
    const basePerms = new Set<P7Permission>()
    for (const slug of selectedRoles) {
      const role = roleCatalog.find((r) => r.slug === slug)
      if (role) role.permissions.forEach((p) => basePerms.add(p as P7Permission))
    }

    const effective = Array.from(basePerms)
    const effectiveSet = new Set(effective)
    const deniedPerms = allPermissionKeys.filter((p) => !effectiveSet.has(p))

    setResult({
      label: selectedRoles.length > 0 ? selectedRoles.join(' + ') : t('noRolesLabel'),
      roles: selectedRoles,
      effectivePermissions: effective,
      deniedPermissions: deniedPerms,
      grantedByOverride: [],
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
      <div className="flex items-center gap-3">
        <Link href="/console/permissions"className="text-[var(--fg-subtle)] hover:text-[var(--fg-muted)] transition-colors">
          <ArrowLeft className="w-5 h-5"/>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[var(--fg)]">{t('permissionSimulatorTitle')}</h1>
          <p className="text-sm text-[var(--fg-muted)]">{t('previewUserRoleCombinationHint')}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-4">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 space-y-4">
            <h3 className="font-semibold text-[var(--fg)]">{t('simulateAsLabel')}</h3>

            <div>
              <label className="block text-xs font-medium text-[var(--fg-muted)] mb-2">{t('selectRolesLabel')}</label>
              <div className="space-y-2">
                {roleCatalog.map((rt) => (
                  <label key={rt.id} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(rt.slug as Role)}
                      onChange={() => toggleRole(rt.slug as Role)}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-sm text-[var(--fg-secondary)] group-hover:text-[var(--fg)]">{rt.name}</span>
                    <span className="text-xs text-[var(--fg-subtle)] ml-auto">
                      {t('permsCount', { count: rt.permissions.length })}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={runSimulation}
              className="w-full flex items-center justify-center gap-2 bg-[var(--info)] text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-[var(--info-hover)] transition-colors"
            >
              <Play className="w-4 h-4"/>
              {t('runSimulationLabel')}
            </button>
          </div>

          {result && (
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 space-y-3">
              <h4 className="text-sm font-semibold text-[var(--fg-secondary)]">{t('summaryLabel')}</h4>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-[var(--success-subtle)] rounded-lg p-2">
                  <div className="text-xl font-bold text-[var(--success-text)]">{result.permissionCount}</div>
                  <div className="text-xs text-[var(--success-text)]">{t('effectiveLabel')}</div>
                </div>
                <div className="bg-[var(--danger-subtle)] rounded-lg p-2">
                  <div className="text-xl font-bold text-[var(--danger-text)]">{result.deniedPermissions.length}</div>
                  <div className="text-xs text-[var(--danger-text)]">{t('deniedLabel')}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="col-span-2">
          {!result ? (
            <div className="bg-[var(--card)] rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
              <ShieldCheck className="w-12 h-12 text-[var(--fg-disabled)] mx-auto mb-3"/>
              <p className="text-[var(--fg-subtle)] text-sm">{t('selectRolesRunSimulationHint')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-[var(--info-subtle)] border border-[var(--info-border)] rounded-xl p-3 text-sm text-[var(--info-text)]">
                {t('simulatingColonLabel', { label: result.label })}
              </div>
              {categoryBreakdown.map((cat) => (
                <div key={cat.label} className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
                  <div className="bg-[var(--card-hover)] px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--fg-secondary)]">{cat.label}</span>
                    <span className="text-xs text-[var(--fg-subtle)]">
                      {cat.granted.length}/{cat.granted.length + cat.denied.length}
                    </span>
                  </div>
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {[...cat.granted, ...cat.denied].map((perm) => {
                      const granted = cat.granted.includes(perm)
                      return (
                        <div key={perm} className="flex items-center gap-2.5 px-4 py-2">
                          {granted ? (
                            <ShieldCheck className="w-4 h-4 text-[var(--success-text)] flex-shrink-0"/>
                          ) : (
                            <ShieldX className="w-4 h-4 text-[var(--fg-subtle)] flex-shrink-0"/>
                          )}
                          <span
                            className={`text-sm font-mono ${granted ? 'text-[var(--fg)]' : 'text-[var(--fg-subtle)] line-through'}`}
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
    <PermissionGuard permission="rbac.manage_roles"fallback={<AccessDenied />}>
      <SimulatorContent />
    </PermissionGuard>
  )
}
