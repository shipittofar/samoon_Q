'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Plus, Search, Edit2, Trash2, Eye, EyeOff, ArrowUp, ArrowDown,
  Loader2, AlertCircle, Tag, ChevronDown, ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/ui/Table'
import { formatCurrency } from '@/utils'
import {
  useExtraGroups, useConsoleExtraGroups, useCreateExtraGroup, useUpdateExtraGroup, useDeleteExtraGroup, useReorderExtraGroups,
  useExtras, useCreateExtra, useUpdateExtra, useDeleteExtra,
  usePermission, useSelectedBranch, useBranchState, useIsBranchReady,
} from '@/hooks'
import type { Extra, ExtraGroup, ExtraGroupSelectionType } from '@/types'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'

// ── Group form ─────────────────────────────────────────────────────────────────
// Mirrors the CategoryForm/formToPayload pattern in console/categories/page.tsx —
// no parallel form-handling pattern introduced.

interface GroupForm {
  name: string
  description: string
  selection_type: ExtraGroupSelectionType
  required: boolean
  min_selection: string
  max_selection: string
  is_active: boolean
}

const EMPTY_GROUP_FORM: GroupForm = {
  name: '', description: '', selection_type: 'multiple', required: false,
  min_selection: '0', max_selection: '1', is_active: true,
}

function groupToForm(group: ExtraGroup): GroupForm {
  return {
    name: group.name,
    description: group.description ?? '',
    selection_type: group.selection_type,
    required: group.required,
    min_selection: String(group.min_selection),
    max_selection: String(group.max_selection),
    is_active: group.is_active,
  }
}

function groupFormToPayload(form: GroupForm): Partial<ExtraGroup> {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    selection_type: form.selection_type,
    required: form.required,
    min_selection: parseInt(form.min_selection, 10) || 0,
    max_selection: parseInt(form.max_selection, 10) || 1,
    is_active: form.is_active,
  }
}

/** Empty name, duplicate name within the branch, or an inconsistent min/max selection. */
function validateGroupForm(form: GroupForm, existingGroups: ExtraGroup[], excludeId?: string): string | null {
  if (!form.name.trim()) return 'nameRequired'
  const nameLower = form.name.trim().toLowerCase()
  if (existingGroups.some((g) => g.id !== excludeId && g.name.trim().toLowerCase() === nameLower)) return 'duplicateName'
  const min = parseInt(form.min_selection, 10)
  const max = parseInt(form.max_selection, 10)
  if (!Number.isFinite(min) || min < 0) return 'invalidLimits'
  if (!Number.isFinite(max) || max < 1) return 'invalidLimits'
  if (min > max) return 'invalidLimits'
  if (form.required && min < 1) return 'invalidLimits'
  return null
}

// ── Extra form ──────────────────────────────────────────────────────────────────

interface ExtraForm {
  name: string
  description: string
  image: string
  price: string
  order: string
  available: boolean
}

const EMPTY_EXTRA_FORM: ExtraForm = {
  name: '', description: '', image: '', price: '', order: '', available: true,
}

function extraToForm(extra: Extra): ExtraForm {
  return {
    name: extra.name,
    description: extra.description ?? '',
    image: extra.image ?? '',
    price: String(extra.price),
    order: extra.order !== undefined ? String(extra.order) : '',
    available: extra.available,
  }
}

function extraFormToPayload(form: ExtraForm): Partial<Extra> {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    image: form.image.trim() || undefined,
    price: parseFloat(form.price) || 0,
    order: form.order ? parseInt(form.order, 10) : undefined,
    available: form.available,
  }
}

/** Empty name, duplicate name within the branch, or a negative price. */
function validateExtraForm(form: ExtraForm, existingExtras: Extra[], excludeId?: string): string | null {
  if (!form.name.trim()) return 'nameRequired'
  const nameLower = form.name.trim().toLowerCase()
  if (existingExtras.some((e) => e.id !== excludeId && e.name.trim().toLowerCase() === nameLower)) return 'duplicateName'
  const price = parseFloat(form.price)
  if (!Number.isFinite(price) || price < 0) return 'negativePrice'
  return null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminExtrasPage() {
  const t = useTranslations('console')
  const tCommon = useTranslations('common')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [groupCreateOpen, setGroupCreateOpen] = useState(false)
  const [groupCreateForm, setGroupCreateForm] = useState<GroupForm>(EMPTY_GROUP_FORM)
  const [groupCreateError, setGroupCreateError] = useState<string | null>(null)

  const [editGroup, setEditGroup] = useState<ExtraGroup | null>(null)
  const [groupEditForm, setGroupEditForm] = useState<GroupForm>(EMPTY_GROUP_FORM)
  const [groupEditError, setGroupEditError] = useState<string | null>(null)

  const [deleteGroupTarget, setDeleteGroupTarget] = useState<ExtraGroup | null>(null)

  const [extraCreateGroupId, setExtraCreateGroupId] = useState<string | null>(null)
  const [extraCreateForm, setExtraCreateForm] = useState<ExtraForm>(EMPTY_EXTRA_FORM)
  const [extraCreateError, setExtraCreateError] = useState<string | null>(null)

  const [editExtra, setEditExtra] = useState<Extra | null>(null)
  const [extraEditForm, setExtraEditForm] = useState<ExtraForm>(EMPTY_EXTRA_FORM)
  const [extraEditError, setExtraEditError] = useState<string | null>(null)

  const [deleteExtraTarget, setDeleteExtraTarget] = useState<Extra | null>(null)

  // Extras are managed one branch at a time, same as console/menu and console/categories.
  const adminBranch = useSelectedBranch()
  const branchState = useBranchState()
  // Phase 3 — '' (not undefined): see console/menu/page.tsx's comment on
  // the same pattern — undefined would let useExtraGroups()/useExtras()
  // silently fall back to the unrelated customer-storefront active branch.
  const adminBranchId = useIsBranchReady() ? adminBranch?.id ?? '' : ''

  const { data: groups, isLoading: groupsLoading, isError: groupsError, refetch: refetchGroups } = useConsoleExtraGroups(adminBranchId)
  const { data: extras, isLoading: extrasLoading, isError: extrasError, refetch: refetchExtras } = useExtras(adminBranchId)

  const canCreate = usePermission('extras.create')
  const canUpdate = usePermission('extras.update')
  const canDelete = usePermission('extras.delete')

  const createGroupMutation = useCreateExtraGroup(adminBranchId ?? '')
  const updateGroupMutation = useUpdateExtraGroup(adminBranchId ?? '')
  const deleteGroupMutation = useDeleteExtraGroup(adminBranchId ?? '')
  const reorderGroupsMutation = useReorderExtraGroups(adminBranchId ?? '')

  const createExtraMutation = useCreateExtra(adminBranchId ?? '')
  const updateExtraMutation = useUpdateExtra(adminBranchId ?? '')
  const deleteExtraMutation = useDeleteExtra(adminBranchId ?? '')

  // const isLoading = groupsLoading || extrasLoading

  // Gate on settled data, not raw isLoading flags alone. Two parallel queries
  // (groups + extras) can finish while one observer still reports isLoading on
  // a remount/refresh; OR-ing those flags then blocks the UI until an unrelated
  // local setState (e.g. opening the create dialog) forces a re-render.
  // Categories avoids this by using a single query — see console/categories/page.tsx.
  
  // #+ch001 #+ch001 #+ch001
  const isLoading =
    !!adminBranchId &&
    ((groups === undefined && groupsLoading) || (extras === undefined && extrasLoading))
  const isError = groupsError || extrasError

  const allGroups: ExtraGroup[] = useMemo(
    () => [...(groups ?? [])].sort((a, b) => a.order - b.order),
    [groups],
  )
  const allExtras: Extra[] = useMemo(() => extras ?? [], [extras])

  const extrasByGroup = useMemo(() => {
    const map = new Map<string, Extra[]>()
    for (const extra of allExtras) {
      const key = extra.group_id ?? ''
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(extra)
    }
    for (const list of map.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    return map
  }, [allExtras])

  const matchesSearch = useCallback(
    (text: string) => !search || text.toLowerCase().includes(search.toLowerCase()),
    [search],
  )
  const matchesStatus = useCallback(
    (active: boolean) => statusFilter === 'all' || (statusFilter === 'active' ? active : !active),
    [statusFilter],
  )

  const filteredGroups = useMemo(() => allGroups.filter((group) => {
    const groupExtras = extrasByGroup.get(group.id) ?? []
    const groupMatches = matchesSearch(group.name) && matchesStatus(group.is_active)
    const anyExtraMatches = groupExtras.some((e) => matchesSearch(e.name) && matchesStatus(e.available))
    return groupMatches || anyExtraMatches
  }), [allGroups, extrasByGroup, matchesSearch, matchesStatus])

  const toggleExpanded = (groupId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  // ── Group handlers ────────────────────────────────────────────────────────

  const openGroupCreate = () => {
    setGroupCreateForm(EMPTY_GROUP_FORM)
    setGroupCreateError(null)
    setGroupCreateOpen(true)
  }

  const submitGroupCreate = () => {
    if (createGroupMutation.isPending) return
    const validationError = validateGroupForm(groupCreateForm, allGroups)
    if (validationError) { setGroupCreateError(validationError); return }
    setGroupCreateError(null)
    createGroupMutation.mutate(groupFormToPayload(groupCreateForm), {
      onSuccess: () => { setGroupCreateOpen(false); setGroupCreateForm(EMPTY_GROUP_FORM) },
    })
  }

  const openGroupEdit = (group: ExtraGroup) => {
    setEditGroup(group)
    setGroupEditForm(groupToForm(group))
    setGroupEditError(null)
  }

  const submitGroupEdit = () => {
    if (!editGroup || updateGroupMutation.isPending) return
    const validationError = validateGroupForm(groupEditForm, allGroups, editGroup.id)
    if (validationError) { setGroupEditError(validationError); return }
    setGroupEditError(null)
    updateGroupMutation.mutate({ id: editGroup.id, payload: groupFormToPayload(groupEditForm) }, {
      onSuccess: () => setEditGroup(null),
    })
  }

  const toggleGroupActive = (group: ExtraGroup) => {
    updateGroupMutation.mutate({ id: group.id, payload: { is_active: !group.is_active } })
  }

  const confirmDeleteGroup = () => {
    if (!deleteGroupTarget || deleteGroupMutation.isPending) return
    deleteGroupMutation.mutate(deleteGroupTarget.id, {
      onSuccess: () => setDeleteGroupTarget(null),
    })
  }

  const moveGroup = (group: ExtraGroup, direction: -1 | 1) => {
    const index = allGroups.findIndex((g) => g.id === group.id)
    const swapWith = allGroups[index + direction]
    if (!swapWith) return
    const reordered = [...allGroups]
    reordered[index] = swapWith
    reordered[index + direction] = group
    reorderGroupsMutation.mutate(reordered.map((g) => g.id))
  }

  // ── Extra handlers ────────────────────────────────────────────────────────

  const openExtraCreate = (groupId: string) => {
    setExtraCreateGroupId(groupId)
    setExtraCreateForm(EMPTY_EXTRA_FORM)
    setExtraCreateError(null)
  }

  const submitExtraCreate = () => {
    if (!extraCreateGroupId || createExtraMutation.isPending) return
    const groupExtras = extrasByGroup.get(extraCreateGroupId) ?? []
    const validationError = validateExtraForm(extraCreateForm, groupExtras)
    if (validationError) { setExtraCreateError(validationError); return }
    setExtraCreateError(null)
    createExtraMutation.mutate(
      { ...extraFormToPayload(extraCreateForm), group_id: extraCreateGroupId },
      { onSuccess: () => { setExtraCreateGroupId(null); setExtraCreateForm(EMPTY_EXTRA_FORM) } },
    )
  }

  const openExtraEdit = (extra: Extra) => {
    setEditExtra(extra)
    setExtraEditForm(extraToForm(extra))
    setExtraEditError(null)
  }

  const submitExtraEdit = () => {
    if (!editExtra || updateExtraMutation.isPending) return
    const groupExtras = extrasByGroup.get(editExtra.group_id ?? '') ?? []
    const validationError = validateExtraForm(extraEditForm, groupExtras, editExtra.id)
    if (validationError) { setExtraEditError(validationError); return }
    setExtraEditError(null)
    updateExtraMutation.mutate({ id: editExtra.id, payload: extraFormToPayload(extraEditForm) }, {
      onSuccess: () => setEditExtra(null),
    })
  }

  const toggleExtraAvailable = (extra: Extra) => {
    updateExtraMutation.mutate({ id: extra.id, payload: { available: !extra.available } })
  }

  const confirmDeleteExtra = () => {
    if (!deleteExtraTarget || deleteExtraMutation.isPending) return
    deleteExtraMutation.mutate(deleteExtraTarget.id, {
      onSuccess: () => setDeleteExtraTarget(null),
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <PermissionGuard permission="extras.view" fallback={<AccessDenied />}>
    <ErrorBoundary feature="AdminExtras">
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="py-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">{t('extrasManagement')}</h1>
                <Badge variant="secondary">{t('extraGroupsCount', { count: allGroups.length })}</Badge>
              </div>
              <p className="text-[var(--fg-muted)] mt-1">
                {adminBranch ? t('extrasPageSubtitle', { branch: adminBranch.name }) : t('selectBranchToManageExtras')}
              </p>
            </div>
            {canCreate && (
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openGroupCreate} disabled={!adminBranchId}>
                {t('addExtraGroup')}
              </Button>
            )}
          </div>

          {/* Branch resolution state — distinct copy per state, never collapsed together */}
          {branchState === 'loading' && (
            <EmptyState
              icon={<Loader2 className="h-8 w-8 animate-spin" />}
              title={t('loadingBranchesEllipsis')}
            />
          )}
          {branchState === 'error' && (
            <EmptyState
              icon={<AlertCircle className="h-8 w-8" />}
              title={t('failedToLoadBranches')}
            />
          )}
          {branchState === 'empty' && (
            <EmptyState
              icon={<Tag className="h-8 w-8" />}
              title={t('selectBranchToManageExtras')}
              description={t('extrasPageNoBranchHint')}
            />
          )}

          {/* Search + Filters */}
          {branchState === 'ready' && adminBranchId && (
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('searchExtrasPlaceholder')}
                  className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                />
              </div>
              <div className="flex gap-2">
                {(['all', 'active', 'inactive'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all ${statusFilter === f ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-200'}`}
                  >
                    {t(`extrasStatusFilter.${f}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {adminBranchId && isLoading && (
            <div className="flex items-center justify-center py-24 gap-3 text-[var(--fg-muted)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{t('loadingExtras')}</span>
            </div>
          )}

          {/* Error */}
          {adminBranchId && isError && !isLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-[var(--fg-muted)]">{t('failedToLoadExtras')}</p>
              <Button variant="secondary" size="sm" onClick={() => { refetchGroups(); refetchExtras() }}>{tCommon('retry')}</Button>
            </div>
          )}

          {/* Empty (no groups at all for this branch) */}
          {adminBranchId && !isLoading && !isError && allGroups.length === 0 && (
            <EmptyState
              icon={<Tag className="h-8 w-8" />}
              title={t('noExtraGroupsFound')}
              description={t('noExtraGroupsHint')}
              action={canCreate ? <Button onClick={openGroupCreate}>{t('addExtraGroup')}</Button> : undefined}
            />
          )}

          {/* Empty (search/filter yields nothing) */}
          {adminBranchId && !isLoading && !isError && allGroups.length > 0 && filteredGroups.length === 0 && (
            <EmptyState icon={<Search className="h-8 w-8" />} title={t('noExtrasMatchSearch')} />
          )}

          {/* Groups list */}
          {adminBranchId && !isLoading && !isError && filteredGroups.map((group, i) => {
            const groupExtras = (extrasByGroup.get(group.id) ?? []).filter(
              (e) => matchesSearch(e.name) || matchesSearch(group.name),
            ).filter((e) => statusFilter === 'all' || matchesStatus(e.available))
            const isExpanded = expanded.has(group.id)
            return (
              <div key={group.id} className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                <div className="flex items-center justify-between gap-3 p-4">
                  <button
                    onClick={() => toggleExpanded(group.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-start"
                    aria-expanded={isExpanded}
                    aria-label={t('toggleGroupAria', { name: group.name })}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[var(--fg)]">{group.name}</span>
                        <Badge variant="secondary">{t(`selectionType.${group.selection_type}`)}</Badge>
                        {group.required && <Badge variant="warning">{t('requiredBadge')}</Badge>}
                        <Badge variant="secondary">{t('minMaxBadge', { min: group.min_selection, max: group.max_selection })}</Badge>
                      </div>
                      {group.description && <p className="text-xs text-[var(--fg-muted)] mt-0.5 line-clamp-1">{group.description}</p>}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {canUpdate && (
                      <div className="flex flex-col me-1">
                        <button
                          onClick={() => moveGroup(group, -1)}
                          disabled={i === 0 || reorderGroupsMutation.isPending}
                          className="text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-30"
                          aria-label={t('moveUpAria', { name: group.name })}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => moveGroup(group, 1)}
                          disabled={i === filteredGroups.length - 1 || reorderGroupsMutation.isPending}
                          className="text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-30"
                          aria-label={t('moveDownAria', { name: group.name })}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => canUpdate && toggleGroupActive(group)}
                      disabled={!canUpdate || updateGroupMutation.isPending}
                      title={group.is_active ? t('markInactive') : t('markActive')}
                    >
                      <Badge variant={group.is_active ? 'success' : 'secondary'}>
                        {group.is_active
                          ? <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{t('active')}</span>
                          : <span className="inline-flex items-center gap-1"><EyeOff className="h-3 w-3" />{t('inactive')}</span>}
                      </Badge>
                    </button>
                    {canUpdate && (
                      <Button variant="ghost" size="icon-sm" onClick={() => openGroupEdit(group)} aria-label={t('editExtraGroupAria')}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteGroupTarget(group)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        aria-label={t('deleteExtraGroupAria')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-[var(--border)] px-4 pb-4">
                    {groupExtras.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-sm text-[var(--fg-muted)] mb-3">{t('noExtrasInGroup')}</p>
                        {canCreate && (
                          <Button variant="secondary" size="sm" onClick={() => openExtraCreate(group.id)}>{t('addExtra')}</Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableHeader>{t('name')}</TableHeader>
                              <TableHeader>{t('priceColumn')}</TableHeader>
                              <TableHeader>{t('sortOrder')}</TableHeader>
                              <TableHeader>{t('status')}</TableHeader>
                              <TableHeader>{t('actionsColumn')}</TableHeader>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {groupExtras.map((extra) => (
                              <TableRow key={extra.id}>
                                <TableCell>
                                  <span className="font-medium">{extra.name}</span>
                                  {extra.description && <p className="text-xs text-[var(--fg-muted)] line-clamp-1">{extra.description}</p>}
                                </TableCell>
                                <TableCell>{formatCurrency(extra.price)}</TableCell>
                                <TableCell>{extra.order ?? '—'}</TableCell>
                                <TableCell>
                                  <button
                                    onClick={() => canUpdate && toggleExtraAvailable(extra)}
                                    disabled={!canUpdate || updateExtraMutation.isPending}
                                    title={extra.available ? t('markInactive') : t('markActive')}
                                  >
                                    <Badge variant={extra.available ? 'success' : 'secondary'}>
                                      {extra.available ? t('active') : t('inactive')}
                                    </Badge>
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    {canUpdate && (
                                      <Button variant="ghost" size="icon-sm" onClick={() => openExtraEdit(extra)} aria-label={t('editExtraAria')}>
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {canDelete && (
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => setDeleteExtraTarget(extra)}
                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                        aria-label={t('deleteExtraAria')}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {canCreate && (
                          <Button variant="ghost" size="sm" className="mt-3" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => openExtraCreate(group.id)}>
                            {t('addExtra')}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Create Group Modal */}
      <Modal open={groupCreateOpen} onClose={() => setGroupCreateOpen(false)} title={t('addExtraGroup')} size="md">
        <GroupFormFields form={groupCreateForm} onChange={setGroupCreateForm} error={groupCreateError} />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={() => setGroupCreateOpen(false)} className="flex-1">{t('cancel')}</Button>
          <Button onClick={submitGroupCreate} disabled={createGroupMutation.isPending} className="flex-1">
            {createGroupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('addExtraGroup')}
          </Button>
        </div>
        {createGroupMutation.isError && <p className="text-sm text-red-500 mt-2">{t('failedToCreateExtraGroupRetry')}</p>}
      </Modal>

      {/* Edit Group Modal */}
      <Modal open={!!editGroup} onClose={() => setEditGroup(null)} title={editGroup ? t('editColonName', { name: editGroup.name }) : t('editExtraGroup')} size="md">
        <GroupFormFields form={groupEditForm} onChange={setGroupEditForm} error={groupEditError} />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={() => setEditGroup(null)} className="flex-1">{t('cancel')}</Button>
          <Button onClick={submitGroupEdit} disabled={updateGroupMutation.isPending} className="flex-1">
            {updateGroupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('saveChanges')}
          </Button>
        </div>
        {updateGroupMutation.isError && <p className="text-sm text-red-500 mt-2">{t('failedToSaveChangesRetry')}</p>}
      </Modal>

      {/* Delete Group Confirmation */}
      <Modal open={!!deleteGroupTarget} onClose={() => setDeleteGroupTarget(null)} title={t('deleteExtraGroup')} size="sm">
        <p className="text-[var(--fg-muted)] mb-6">{t('confirmDeleteExtraGroup', { name: deleteGroupTarget?.name ?? '' })}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDeleteGroupTarget(null)} className="flex-1">{t('cancel')}</Button>
          <Button onClick={confirmDeleteGroup} disabled={deleteGroupMutation.isPending} className="flex-1 bg-red-500 hover:bg-red-600 border-red-500">
            {deleteGroupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('deleteAction')}
          </Button>
        </div>
        {deleteGroupMutation.isError && <p className="text-sm text-red-500 mt-2">{t('failedToDeleteExtraGroupRetry')}</p>}
      </Modal>

      {/* Create Extra Modal */}
      <Modal open={!!extraCreateGroupId} onClose={() => setExtraCreateGroupId(null)} title={t('addExtra')} size="md">
        <ExtraFormFields form={extraCreateForm} onChange={setExtraCreateForm} error={extraCreateError} />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={() => setExtraCreateGroupId(null)} className="flex-1">{t('cancel')}</Button>
          <Button onClick={submitExtraCreate} disabled={createExtraMutation.isPending} className="flex-1">
            {createExtraMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('addExtra')}
          </Button>
        </div>
        {createExtraMutation.isError && <p className="text-sm text-red-500 mt-2">{t('failedToCreateExtraRetry')}</p>}
      </Modal>

      {/* Edit Extra Modal */}
      <Modal open={!!editExtra} onClose={() => setEditExtra(null)} title={editExtra ? t('editColonName', { name: editExtra.name }) : t('editExtra')} size="md">
        <ExtraFormFields form={extraEditForm} onChange={setExtraEditForm} error={extraEditError} />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={() => setEditExtra(null)} className="flex-1">{t('cancel')}</Button>
          <Button onClick={submitExtraEdit} disabled={updateExtraMutation.isPending} className="flex-1">
            {updateExtraMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('saveChanges')}
          </Button>
        </div>
        {updateExtraMutation.isError && <p className="text-sm text-red-500 mt-2">{t('failedToSaveChangesRetry')}</p>}
      </Modal>

      {/* Delete Extra Confirmation */}
      <Modal open={!!deleteExtraTarget} onClose={() => setDeleteExtraTarget(null)} title={t('deleteExtra')} size="sm">
        <p className="text-[var(--fg-muted)] mb-6">{t('confirmDeleteExtra', { name: deleteExtraTarget?.name ?? '' })}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDeleteExtraTarget(null)} className="flex-1">{t('cancel')}</Button>
          <Button onClick={confirmDeleteExtra} disabled={deleteExtraMutation.isPending} className="flex-1 bg-red-500 hover:bg-red-600 border-red-500">
            {deleteExtraMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('deleteAction')}
          </Button>
        </div>
        {deleteExtraMutation.isError && <p className="text-sm text-red-500 mt-2">{t('failedToDeleteExtraRetry')}</p>}
      </Modal>
    </div>
    </ErrorBoundary>
    </PermissionGuard>
  )
}

// ── Shared form fields components ─────────────────────────────────────────────

function GroupFormFields({
  form, onChange, error,
}: {
  form: GroupForm
  onChange: (f: GroupForm) => void
  error: string | null
}) {
  const t = useTranslations('console')
  const set = (field: keyof GroupForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange({ ...form, [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })

  return (
    <div className="space-y-4 mb-4">
      <Input label={t('extraGroupNameLabel')} value={form.name} onChange={set('name')} />
      <Textarea label={t('descriptionLabel')} value={form.description} onChange={set('description')} rows={2} />
      <div>
        <label htmlFor="selection-type" className="block text-sm font-medium text-[var(--fg)] mb-1">{t('selectionTypeLabel')}</label>
        <select
          id="selection-type"
          value={form.selection_type}
          onChange={set('selection_type')}
          className="w-full h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
        >
          <option value="single">{t('selectionType.single')}</option>
          <option value="multiple">{t('selectionType.multiple')}</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label={t('minSelectionLabel')} type="number" min={0} value={form.min_selection} onChange={set('min_selection')} />
        <Input label={t('maxSelectionLabel')} type="number" min={1} value={form.max_selection} onChange={set('max_selection')} />
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
        <input type="checkbox" checked={form.required} onChange={set('required')} className="rounded" />
        {t('requiredLabel')}
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
        <input type="checkbox" checked={form.is_active} onChange={set('is_active')} className="rounded" />
        {t('active')}
      </label>
      {error && <p className="text-sm text-red-500">{t(`extraGroupFormError.${error}`)}</p>}
    </div>
  )
}

function ExtraFormFields({
  form, onChange, error,
}: {
  form: ExtraForm
  onChange: (f: ExtraForm) => void
  error: string | null
}) {
  const t = useTranslations('console')
  const set = (field: keyof ExtraForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })

  return (
    <div className="space-y-4 mb-4">
      <Input label={t('extraNameLabel')} value={form.name} onChange={set('name')} />
      <Textarea label={t('descriptionLabel')} value={form.description} onChange={set('description')} rows={2} />
      <Input label={t('imageUrlLabel')} value={form.image} onChange={set('image')} />
      <div className="grid grid-cols-2 gap-4">
        <Input label={t('priceDollarLabel')} type="number" min={0} step="0.01" value={form.price} onChange={set('price')} leftIcon={<span className="text-xs">$</span>} />
        <Input label={t('sortOrderLabel')} type="number" min={1} value={form.order} onChange={set('order')} />
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
        <input type="checkbox" checked={form.available} onChange={set('available')} className="rounded" />
        {t('active')}
      </label>
      {error && <p className="text-sm text-red-500">{t(`extraFormError.${error}`)}</p>}
    </div>
  )
}
