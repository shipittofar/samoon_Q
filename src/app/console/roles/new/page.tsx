'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Search, ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { useRbacStore } from '@/stores'
import { ROLE_TEMPLATES, PERMISSION_CATEGORIES, ALL_PERMISSIONS } from '@/services/permission.service'
import type { P7Permission, Role } from '@/types/rbac'

const ROLE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
]

function RoleBuilderContent() {
  const t = useTranslations('console')
  const router = useRouter()
  const { addCustomRole } = useRbacStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(ROLE_COLORS[0])
  const [selectedPerms, setSelectedPerms] = useState<Set<P7Permission>>(new Set())
  const [cloneFrom, setCloneFrom] = useState<Role | ''>('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(Object.values(PERMISSION_CATEGORIES).map((c) => c.label)))
  const [saved, setSaved] = useState(false)

  function handleClone(role: Role) {
    setCloneFrom(role)
    const tmpl = ROLE_TEMPLATES.find((t) => t.role === role)
    if (tmpl) {
      setSelectedPerms(new Set(tmpl.permissions))
    }
  }

  function togglePerm(perm: P7Permission) {
    setSelectedPerms((prev) => {
      const next = new Set(prev)
      if (next.has(perm)) next.delete(perm)
      else next.add(perm)
      return next
    })
  }

  function toggleCategory(cat: readonly P7Permission[]) {
    const allSelected = cat.every((p) => selectedPerms.has(p))
    setSelectedPerms((prev) => {
      const next = new Set(prev)
      if (allSelected) cat.forEach((p) => next.delete(p))
      else cat.forEach((p) => next.add(p))
      return next
    })
  }

  function toggleExpanded(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const filteredCategories = useMemo(() => {
    if (!search) return Object.values(PERMISSION_CATEGORIES)
    const q = search.toLowerCase()
    return Object.values(PERMISSION_CATEGORIES).map((cat) => ({
      ...cat,
      permissions: cat.permissions.filter((p: P7Permission) => p.toLowerCase().includes(q)),
    })).filter((cat) => cat.permissions.length > 0)
  }, [search])

  function handleSave() {
    if (!name.trim()) return
    const now = new Date().toISOString()
    addCustomRole({
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      color,
      permissions: Array.from(selectedPerms),
      tenantId: 'tenant-1',
      createdBy: 'current-user',
      createdAt: now,
      updatedAt: now,
      enabled: true,
      clonedFrom: cloneFrom || undefined,
    })
    setSaved(true)
    setTimeout(() => router.push('/console/roles'), 1200)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/console/roles" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('roleBuilderTitle')}</h1>
          <p className="text-sm text-gray-500">{t('createCustomRoleHint')}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Role metadata */}
        <div className="col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">{t('roleDetailsLabel')}</h3>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('nameStarLabel')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('seniorCashierPlaceholder')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('descriptionLabel')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('describeRoleResponsibilitiesPlaceholder')}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">{t('colorLabel')}</label>
              <div className="flex flex-wrap gap-2">
                {ROLE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-gray-500 scale-110' : 'hover:scale-105'}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">{t('cloneFromRoleLabel')}</label>
              <div className="flex flex-wrap gap-1.5">
                {ROLE_TEMPLATES.map((rt) => (
                  <button
                    key={rt.role}
                    onClick={() => handleClone(rt.role)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      cloneFrom === rt.role
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                  >
                    <Copy className="w-2.5 h-2.5" />
                    {rt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <div className="text-sm font-semibold text-indigo-700 mb-1">
              {t('permissionsSelectedCount', { selected: selectedPerms.size, total: ALL_PERMISSIONS.length })}
            </div>
            <div className="text-xs text-indigo-600">
              {name ? (
                t('roleColonName', { name })
              ) : (
                t('setNameToSaveLabel')
              )}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={!name.trim() || saved}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {saved ? t('savedRedirectingEllipsis') : t('saveRoleLabel')}
          </button>
        </div>

        {/* Right: Permission picker */}
        <div className="col-span-2 space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('searchPermissionsEllipsisPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredCategories.map((cat) => {
                const isExpanded = expanded.has(cat.label)
                const allSelected = cat.permissions.every((p) => selectedPerms.has(p))
                const someSelected = cat.permissions.some((p) => selectedPerms.has(p))
                return (
                  <div key={cat.label} className="border border-gray-100 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                      <button
                        onClick={() => toggleExpanded(cat.label)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        {cat.label}
                        <span className="text-xs text-gray-400 font-normal">
                          ({cat.permissions.filter((p) => selectedPerms.has(p)).length}/{cat.permissions.length})
                        </span>
                      </button>
                      <button
                        onClick={() => toggleCategory(cat.permissions)}
                        className={`text-xs font-medium px-2 py-0.5 rounded transition-colors ${
                          allSelected
                            ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                            : someSelected
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {allSelected ? t('deselectAllLabel') : t('selectAllLabel')}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="divide-y divide-gray-50">
                        {cat.permissions.map((perm) => (
                          <label
                            key={perm}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPerms.has(perm)}
                              onChange={() => togglePerm(perm)}
                              className="accent-indigo-600"
                            />
                            <span className="text-sm font-mono text-gray-700">{perm}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminRolesNewPage() {
  return (
    <PermissionGuard permission="staff.manage" fallback={<AccessDenied />}>
      <RoleBuilderContent />
    </PermissionGuard>
  )
}
