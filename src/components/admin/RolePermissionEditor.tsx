'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, ChevronDown, ChevronRight } from 'lucide-react'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { usePermissionCatalog, useRolePermissions, useReplaceRolePermissions } from '@/hooks'
import { getApiErrorMessage } from '@/api/errors'
import toast from 'react-hot-toast'

export interface RolePermissionEditorProps {
  roleId: string
  tenantId: string
  roleName?: string
  readOnly?: boolean
}

export function RolePermissionEditor({
  roleId,
  tenantId,
  roleName,
  readOnly = false,
}: RolePermissionEditorProps) {
  const t = useTranslations('console')
  const { data: catalog = [], isLoading: catalogLoading } = usePermissionCatalog()
  const { data: rolePerms, isLoading: rolePermsLoading } = useRolePermissions(roleId)
  const replacePerms = useReplaceRolePermissions(roleId, tenantId)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (rolePerms && !initialized) {
      setSelectedIds(new Set(rolePerms.permissionIds))
      setInitialized(true)
    }
  }, [rolePerms, initialized])

  useEffect(() => {
    setInitialized(false)
    setSelectedIds(new Set())
  }, [roleId])

  const categories = useMemo(() => {
    const byResource: Record<string, { label: string; items: typeof catalog }> = {}
    for (const entry of catalog) {
      const key = entry.resource || 'general'
      if (!byResource[key]) byResource[key] = { label: entry.resource || 'General', items: [] }
      byResource[key].items.push(entry)
    }
    return byResource
  }, [catalog])

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories
    const q = search.toLowerCase()
    const next: typeof categories = {}
    for (const [key, cat] of Object.entries(categories)) {
      const items = cat.items.filter(
        (p) =>
          p.key.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.resource.toLowerCase().includes(q),
      )
      if (items.length > 0) next[key] = { label: cat.label, items }
    }
    return next
  }, [categories, search])

  function togglePerm(id: string) {
    if (readOnly) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleCategory(items: typeof catalog) {
    if (readOnly) return
    const ids = items.map((p) => p.id ?? p.key)
    const allSelected = ids.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleSave() {
    setConfirmOpen(true)
  }

  function handleConfirmSave() {
    const permission_ids = catalog
      .filter((p) => selectedIds.has(p.id ?? p.key))
      .map((p) => p.id ?? p.key)
    replacePerms.mutate(
      { permission_ids },
      {
        onSuccess: () => {
          toast.success(t('rolePermissionsSaved'))
          setConfirmOpen(false)
        },
        onError: (err) => toast.error(getApiErrorMessage(err, t('failedToSaveRolePermissions'))),
      },
    )
  }

  const loading = catalogLoading || rolePermsLoading

  if (loading) {
    return <p className="text-sm text-gray-500">{t('loadingEllipsis')}</p>
  }

  return (
    <div className="space-y-4">
      {roleName && (
        <p className="text-sm text-gray-600">
          {t('editingRolePermissionsLabel', { name: roleName })}
        </p>
      )}

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPermissionsEllipsisPlaceholder')}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg"
          />
        </div>
        <div className="flex gap-2">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set(catalog.map((p) => p.id ?? p.key)))}
                className="text-xs border rounded-md px-3 py-1.5 hover:bg-gray-50"
              >
                {t('selectAllLabel')}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs border rounded-md px-3 py-1.5 hover:bg-gray-50"
              >
                {t('clearAllLabel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={replacePerms.isPending}
                className="text-xs bg-indigo-600 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
              >
                {replacePerms.isPending ? t('savingEllipsis') : t('saveRolePermissionsLabel')}
              </button>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        {t('permissionsSelectedCount', { selected: selectedIds.size, total: catalog.length })}
      </p>

      <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
        {Object.entries(filteredCategories).map(([key, cat]) => {
          const ids = cat.items.map((p) => p.id ?? p.key)
          const selectedCount = ids.filter((id) => selectedIds.has(id)).length
          const isExpanded = expanded.has(key)
          const allSelected = ids.length > 0 && selectedCount === ids.length
          return (
            <div key={key} className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                <button
                  type="button"
                  onClick={() => toggleExpanded(key)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  {cat.label}
                  <span className="text-xs text-gray-400">({selectedCount}/{ids.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.items)}
                  disabled={readOnly}
                  className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
                >
                  {allSelected ? t('deselectAllLabel') : t('selectAllLabel')}
                </button>
              </div>
              {isExpanded && (
                <div className="divide-y divide-gray-50">
                  {cat.items.map((perm) => {
                    const id = perm.id ?? perm.key
                    return (
                      <label
                        key={id}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(id)}
                          onChange={() => togglePerm(id)}
                          disabled={readOnly}
                          className="accent-indigo-600"
                        />
                        <span className="text-sm font-mono text-gray-700">{perm.key}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('replaceRolePermissionsTitle')}
        description={t('replaceRolePermissionsConfirm')}
        confirmLabel={t('replaceRolePermissionsLabel')}
        destructive
        pending={replacePerms.isPending}
        onConfirm={handleConfirmSave}
      />
    </div>
  )
}
