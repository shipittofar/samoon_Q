'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  Plus, Search, Edit2, Trash2, Eye, EyeOff, ArrowUp, ArrowDown,
  Loader2, AlertCircle, Layers,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/ui/Table'
import { formatDate } from '@/utils'
import {
  useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, useReorderCategories,
  usePermission,
} from '@/hooks'
import { useBranchStore } from '@/stores'
import type { Category } from '@/types'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'

// ── Form state shape ──────────────────────────────────────────────────────────
// Mirrors the MenuItemForm/formToPayload pattern in console/menu/page.tsx —
// no parallel form-handling pattern introduced.

interface CategoryForm {
  name: string
  description: string
  image: string
  order: string
  is_active: boolean
}

const EMPTY_FORM: CategoryForm = {
  name: '', description: '', image: '', order: '', is_active: true,
}

function categoryToForm(category: Category): CategoryForm {
  return {
    name: category.name,
    description: category.description ?? '',
    image: category.image ?? '',
    order: String(category.order),
    is_active: category.is_active,
  }
}

function formToPayload(form: CategoryForm): Partial<Category> {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    image: form.image.trim() || undefined,
    order: form.order ? parseInt(form.order, 10) : undefined,
    is_active: form.is_active,
  }
}

/** Empty/whitespace-only name, or a non-numeric/negative sort order. */
function validateForm(form: CategoryForm): string | null {
  if (!form.name.trim()) return 'nameRequired'
  if (form.order && (!/^\d+$/.test(form.order) || parseInt(form.order, 10) < 1)) return 'invalidSortOrder'
  return null
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminCategoriesPage() {
  const t = useTranslations('console')
  const tCommon = useTranslations('common')
  const [search, setSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CategoryForm>(EMPTY_FORM)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editCategory, setEditCategory] = useState<Category | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<CategoryForm>(EMPTY_FORM)
  const [editError, setEditError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Categories are managed one branch at a time, same as console/menu/page.tsx.
  const adminBranch = useBranchStore((s) => s.adminActiveBranch)
  const adminBranchId = adminBranch?.slug

  const { data: categories, isLoading, isError, refetch } = useCategories(adminBranchId)
  const canCreate = usePermission('category.create')
  const canUpdate = usePermission('category.update')
  const canDelete = usePermission('category.delete')

  const createMutation = useCreateCategory(adminBranchId ?? '')
  const updateMutation = useUpdateCategory(adminBranchId ?? '')
  const deleteMutation = useDeleteCategory(adminBranchId ?? '')
  const reorderMutation = useReorderCategories(adminBranchId ?? '')

  const allCategories: Category[] = useMemo(
    () => [...(categories ?? [])].sort((a, b) => a.order - b.order),
    [categories],
  )

  const filtered = useMemo(
    () => allCategories.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())),
    [allCategories, search],
  )

  // ── Handlers ────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setCreateForm(EMPTY_FORM)
    setCreateError(null)
    setCreateOpen(true)
  }

  const submitCreate = () => {
    if (createMutation.isPending) return // guards against duplicate submission (double-click/double-Enter)
    const validationError = validateForm(createForm)
    if (validationError) { setCreateError(validationError); return }
    setCreateError(null)
    createMutation.mutate(formToPayload(createForm), {
      onSuccess: () => { setCreateOpen(false); setCreateForm(EMPTY_FORM) },
    })
  }

  const openEdit = (category: Category) => {
    setEditCategory(category)
    setEditForm(categoryToForm(category))
    setEditError(null)
    setEditOpen(true)
  }

  const submitEdit = () => {
    if (!editCategory || updateMutation.isPending) return
    const validationError = validateForm(editForm)
    if (validationError) { setEditError(validationError); return }
    setEditError(null)
    updateMutation.mutate({ id: editCategory.id, payload: formToPayload(editForm) }, {
      onSuccess: () => { setEditOpen(false); setEditCategory(null) },
    })
  }

  const toggleActive = (category: Category) => {
    updateMutation.mutate({ id: category.id, payload: { is_active: !category.is_active } })
  }

  const openDelete = (category: Category) => {
    setDeleteTarget(category)
    setDeleteOpen(true)
  }

  const confirmDelete = () => {
    if (!deleteTarget || deleteMutation.isPending) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => { setDeleteOpen(false); setDeleteTarget(null) },
    })
  }

  const move = (category: Category, direction: -1 | 1) => {
    const index = allCategories.findIndex((c) => c.id === category.id)
    const swapWith = allCategories[index + direction]
    if (!swapWith) return
    const reordered = [...allCategories]
    reordered[index] = swapWith
    reordered[index + direction] = category
    reorderMutation.mutate(reordered.map((c) => c.id))
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <PermissionGuard permission="category.view" fallback={<AccessDenied />}>
    <ErrorBoundary feature="AdminCategories">
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="py-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">{t('categoryManagement')}</h1>
                <Badge variant="secondary">{t('categoriesCount', { count: allCategories.length })}</Badge>
              </div>
              <p className="text-[var(--fg-muted)] mt-1">
                {adminBranch ? t('categoryPageSubtitle', { branch: adminBranch.name }) : t('selectBranchToManageCategories')}
              </p>
            </div>
            {canCreate && (
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate} disabled={!adminBranchId}>
                {t('addCategory')}
              </Button>
            )}
          </div>

          {/* No branch selected */}
          {!adminBranchId && (
            <EmptyState
              icon={<Layers className="h-8 w-8" />}
              title={t('selectBranchToManageCategories')}
              description={t('categoryPageNoBranchHint')}
            />
          )}

          {/* Search */}
          {adminBranchId && (
            <div className="relative max-w-sm mb-6">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchCategoriesPlaceholder')}
                className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
              />
            </div>
          )}

          {/* Loading */}
          {adminBranchId && isLoading && (
            <div className="flex items-center justify-center py-24 gap-3 text-[var(--fg-muted)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{t('loadingCategories')}</span>
            </div>
          )}

          {/* Error */}
          {adminBranchId && isError && !isLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-[var(--fg-muted)]">{t('failedToLoadCategories')}</p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>{tCommon('retry')}</Button>
            </div>
          )}

          {/* Empty (no categories at all for this branch) */}
          {adminBranchId && !isLoading && !isError && allCategories.length === 0 && (
            <EmptyState
              icon={<Layers className="h-8 w-8" />}
              title={t('noCategoriesFound')}
              description={t('noCategoriesHint')}
              action={canCreate ? <Button onClick={openCreate}>{t('addCategory')}</Button> : undefined}
            />
          )}

          {/* Empty (search yields nothing) */}
          {adminBranchId && !isLoading && !isError && allCategories.length > 0 && filtered.length === 0 && (
            <EmptyState icon={<Search className="h-8 w-8" />} title={t('noCategoriesMatchSearch')} />
          )}

          {/* List */}
          {adminBranchId && !isLoading && !isError && filtered.length > 0 && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>{t('sortOrder')}</TableHeader>
                  <TableHeader>{t('name')}</TableHeader>
                  <TableHeader>{t('branch')}</TableHeader>
                  <TableHeader>{t('status')}</TableHeader>
                  <TableHeader>{t('createdDate')}</TableHeader>
                  <TableHeader>{t('actionsColumn')}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((category, i) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="tabular-nums text-[var(--fg-muted)] w-6">{category.order}</span>
                        {canUpdate && (
                          <div className="flex flex-col">
                            <button
                              onClick={() => move(category, -1)}
                              disabled={i === 0 || reorderMutation.isPending}
                              className="text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-30"
                              aria-label={t('moveUpAria', { name: category.name })}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => move(category, 1)}
                              disabled={i === filtered.length - 1 || reorderMutation.isPending}
                              className="text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-30"
                              aria-label={t('moveDownAria', { name: category.name })}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {category.icon && <span aria-hidden="true">{category.icon}</span>}
                        <span className="font-medium">{category.name}</span>
                      </div>
                      {category.description && (
                        <p className="text-xs text-[var(--fg-muted)] line-clamp-1 mt-0.5">{category.description}</p>
                      )}
                    </TableCell>
                    <TableCell>{adminBranch?.name ?? category.branch_id}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => canUpdate && toggleActive(category)}
                        disabled={!canUpdate || updateMutation.isPending}
                        className="inline-flex"
                        title={category.is_active ? t('markInactive') : t('markActive')}
                      >
                        <Badge variant={category.is_active ? 'success' : 'secondary'}>
                          {category.is_active
                            ? <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{t('active')}</span>
                            : <span className="inline-flex items-center gap-1"><EyeOff className="h-3 w-3" />{t('inactive')}</span>}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell>{formatDate(category.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {canUpdate && (
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(category)} aria-label={t('editCategoryAria')}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openDelete(category)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            aria-label={t('deleteCategoryAria')}
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
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('addCategory')} size="md">
        <CategoryFormFields form={createForm} onChange={setCreateForm} error={createError} />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={() => setCreateOpen(false)} className="flex-1">{t('cancel')}</Button>
          <Button onClick={submitCreate} disabled={createMutation.isPending} className="flex-1">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('addCategory')}
          </Button>
        </div>
        {createMutation.isError && (
          <p className="text-sm text-red-500 mt-2">{t('failedToCreateCategoryRetry')}</p>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditCategory(null) }}
        title={editCategory ? t('editColonName', { name: editCategory.name }) : t('editCategory')}
        size="md"
      >
        <CategoryFormFields form={editForm} onChange={setEditForm} error={editError} />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={() => setEditOpen(false)} className="flex-1">{t('cancel')}</Button>
          <Button onClick={submitEdit} disabled={updateMutation.isPending} className="flex-1">
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('saveChanges')}
          </Button>
        </div>
        {updateMutation.isError && (
          <p className="text-sm text-red-500 mt-2">{t('failedToSaveChangesRetry')}</p>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null) }}
        title={t('deleteCategory')}
        size="sm"
      >
        <p className="text-[var(--fg-muted)] mb-6">
          {t('confirmDeleteCategory', { name: deleteTarget?.name ?? '' })}
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)} className="flex-1">{t('cancel')}</Button>
          <Button
            onClick={confirmDelete}
            disabled={deleteMutation.isPending}
            className="flex-1 bg-red-500 hover:bg-red-600 border-red-500"
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('deleteAction')}
          </Button>
        </div>
        {deleteMutation.isError && (
          <p className="text-sm text-red-500 mt-2">{t('failedToDeleteCategoryRetry')}</p>
        )}
      </Modal>
    </div>
    </ErrorBoundary>
    </PermissionGuard>
  )
}

// ── Shared form fields component ──────────────────────────────────────────────

function CategoryFormFields({
  form,
  onChange,
  error,
}: {
  form: CategoryForm
  onChange: (f: CategoryForm) => void
  error: string | null
}) {
  const t = useTranslations('console')
  const set = (field: keyof CategoryForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })

  return (
    <div className="space-y-4 mb-4">
      <Input label={t('categoryNameLabel')} value={form.name} onChange={set('name')} />
      <Textarea label={t('descriptionLabel')} value={form.description} onChange={set('description')} rows={3} />
      <Input label={t('imageUrlLabel')} value={form.image} onChange={set('image')} />
      <Input label={t('sortOrderLabel')} type="number" min={1} value={form.order} onChange={set('order')} />
      <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
        <input type="checkbox" checked={form.is_active} onChange={set('is_active')} className="rounded" />
        {t('active')}
      </label>
      {error && <p className="text-sm text-red-500">{t(`categoryFormError.${error}`)}</p>}
    </div>
  )
}
