'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import {
  Plus, Search, Edit2, Trash2, Eye, EyeOff, Loader2, AlertCircle, Tags, RefreshCw,
} from 'lucide-react'
import { Badge, PaginationControls } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/ui/Table'
import { formatDate, slugify } from '@/utils'
import { getTotalPages } from '@/utils/pagination'
import {
  useConsoleMenuTags,
  useCreateMenuTag,
  useUpdateMenuTag,
  useDeleteMenuTag,
  usePermission,
  useSelectedBranch,
  useBranchState,
  useIsBranchReady,
} from '@/hooks'
import type { ConsoleMenuTag } from '@/types'
import {
  tagFormToWriteRequest,
  tagToFormInput,
  type TagFormInput,
} from '@/types'
import { withUploadedImage } from '@/lib/image-asset-write'
import { ImageUploader, EMPTY_IMAGE_FIELD } from '@/components/ImageUploader'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'

const EMPTY_FORM: TagFormInput = {
  name: '',
  slug: '',
  description: '',
  icon: '',
  image: { ...EMPTY_IMAGE_FIELD },
  color: '#f97316',
  is_active: true,
  display_order: '',
}

type ActiveFilter = 'all' | 'active' | 'inactive'

function validateForm(form: TagFormInput): string | null {
  if (!form.name.trim()) return 'nameRequired'
  if (!form.slug.trim()) return 'slugRequired'
  if (form.display_order && (!/^\d+$/.test(form.display_order) || parseInt(form.display_order, 10) < 0)) {
    return 'invalidDisplayOrder'
  }
  return null
}

function extractApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response'in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data
    if (typeof data === 'string') return data
    if (data && typeof data === 'object') {
      const detail = (data as { detail?: string }).detail
      if (detail) return detail
      const nonField = (data as { non_field_errors?: string[] }).non_field_errors
      if (nonField?.[0]) return nonField[0]
    }
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export default function AdminTagsPage() {
  const t = useTranslations('console')
  const tCommon = useTranslations('common')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
  const [ordering, setOrdering] = useState('display_order')
  const [page, setPage] = useState(1)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<TagFormInput>(EMPTY_FORM)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editTag, setEditTag] = useState<ConsoleMenuTag | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<TagFormInput>(EMPTY_FORM)
  const [editError, setEditError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<ConsoleMenuTag | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const adminBranch = useSelectedBranch()
  const branchState = useBranchState()
  const adminBranchId = useIsBranchReady() ? adminBranch?.id ?? '' : ''

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, activeFilter, ordering])

  const listParams = useMemo(
    () => ({
      page,
      search: debouncedSearch || undefined,
      ordering,
      is_active: activeFilter === 'all' ? undefined : activeFilter === 'active',
    }),
    [page, debouncedSearch, ordering, activeFilter],
  )

  const { data, isLoading, isError, refetch, pagination } = useConsoleMenuTags(adminBranchId, listParams)
  const tags = data?.results ?? []
  const totalCount = data?.count ?? 0

  const canCreate = usePermission('tag.create')
  const canUpdate = usePermission('tag.update')
  const canDelete = usePermission('tag.delete')

  const createMutation = useCreateMenuTag(adminBranchId)
  const updateMutation = useUpdateMenuTag(adminBranchId)
  const deleteMutation = useDeleteMenuTag(adminBranchId)

  const openCreate = () => {
    setCreateForm(EMPTY_FORM)
    setCreateError(null)
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    if (createMutation.isPending) return
    const validationError = validateForm(createForm)
    if (validationError) { setCreateError(validationError); return }
    setCreateError(null)
    const uploadCtx = {
      tenantId: adminBranch?.tenantId,
      branchId: adminBranchId,
      entityType: 'branch',
      entityId: adminBranchId,
    }
    createMutation.mutate(
      await withUploadedImage(tagFormToWriteRequest(createForm), createForm.image, 'menu_tag', uploadCtx),
      {
      onSuccess: () => { setCreateOpen(false); setCreateForm(EMPTY_FORM) },
    })
  }

  const openEdit = (tag: ConsoleMenuTag) => {
    setEditTag(tag)
    setEditForm(tagToFormInput(tag))
    setEditError(null)
    setEditOpen(true)
  }

  const submitEdit = async () => {
    if (!editTag || updateMutation.isPending) return
    const validationError = validateForm(editForm)
    if (validationError) { setEditError(validationError); return }
    setEditError(null)
    const uploadCtx = {
      tenantId: adminBranch?.tenantId,
      branchId: adminBranchId,
      entityType: 'branch',
      entityId: adminBranchId,
    }
    updateMutation.mutate(
      {
        id: editTag.id,
        payload: await withUploadedImage(tagFormToWriteRequest(editForm), editForm.image, 'menu_tag', uploadCtx),
      },
      {
      onSuccess: () => { setEditOpen(false); setEditTag(null) },
    })
  }

  const toggleActive = (tag: ConsoleMenuTag) => {
    updateMutation.mutate({ id: tag.id, payload: { is_active: !tag.is_active } })
  }

  const openDelete = (tag: ConsoleMenuTag) => {
    setDeleteTarget(tag)
    setDeleteError(null)
    setDeleteOpen(true)
  }

  const confirmDelete = () => {
    if (!deleteTarget || deleteMutation.isPending) return
    setDeleteError(null)
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => { setDeleteOpen(false); setDeleteTarget(null) },
      onError: (error) => {
        setDeleteError(extractApiError(error, t('failedToDeleteTagRetry')))
      },
    })
  }

  return (
    <PermissionGuard permission="tag.view"fallback={<AccessDenied />}>
      <ErrorBoundary feature="AdminTags">
        <div className="min-h-screen bg-[var(--bg)]">
          <div className="pt-20 pb-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="py-6 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">{t('tagManagement')}</h1>
                    <Badge variant="secondary">{t('tagsCount', { count: totalCount })}</Badge>
                  </div>
                  <p className="text-[var(--fg-muted)] mt-1">
                    {adminBranch ? t('tagPageSubtitle', { branch: adminBranch.name }) : t('selectBranchToManageTags')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshCw className="h-4 w-4"/>}
                    onClick={() => refetch()}
                    disabled={!adminBranchId || isLoading}
                    aria-label={t('refreshTagsAria')}
                  >
                    {t('refresh')}
                  </Button>
                  {canCreate && (
                    <Button leftIcon={<Plus className="h-4 w-4"/>} onClick={openCreate} disabled={!adminBranchId}>
                      {t('addTag')}
                    </Button>
                  )}
                </div>
              </div>

              {branchState === 'loading' && (
                <EmptyState icon={<Loader2 className="h-8 w-8 animate-spin"/>} title={t('loadingBranchesEllipsis')} />
              )}
              {branchState === 'error' && (
                <EmptyState icon={<AlertCircle className="h-8 w-8"/>} title={t('failedToLoadBranches')} />
              )}
              {branchState === 'empty' && (
                <EmptyState
                  icon={<Tags className="h-8 w-8"/>}
                  title={t('selectBranchToManageTags')}
                  description={t('tagPageNoBranchHint')}
                />
              )}

              {branchState === 'ready' && adminBranchId && (
                <div className="flex flex-wrap gap-3 mb-6">
                  <div className="relative flex-1 min-w-48 max-w-sm">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"/>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('searchTagsPlaceholder')}
                      aria-label={t('searchTagsPlaceholder')}
                      className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40 focus:border-[var(--focus-ring)]"
                    />
                  </div>
                  <select
                    value={activeFilter}
                    onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
                    aria-label={t('activeFilterLabel')}
                    className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40"
                  >
                    <option value="all">{t('allStatuses')}</option>
                    <option value="active">{t('activeOnly')}</option>
                    <option value="inactive">{t('inactiveOnly')}</option>
                  </select>
                  <select
                    value={ordering}
                    onChange={(e) => setOrdering(e.target.value)}
                    aria-label={t('sortTagsAriaLabel')}
                    className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40"
                  >
                    <option value="display_order">{t('sortByDisplayOrder')}</option>
                    <option value="name">{t('sortByNameAsc')}</option>
                    <option value="-name">{t('sortByNameDesc')}</option>
                    <option value="-created_at">{t('sortByNewest')}</option>
                    <option value="created_at">{t('sortByOldest')}</option>
                  </select>
                </div>
              )}

              {adminBranchId && isLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-xl bg-[var(--card-hover)] animate-pulse"/>
                  ))}
                </div>
              )}

              {adminBranchId && isError && !isLoading && (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <AlertCircle className="h-8 w-8 text-[var(--danger-text)]"/>
                  <p className="text-sm text-[var(--fg-muted)]">{t('failedToLoadTags')}</p>
                  <Button variant="secondary"size="sm"onClick={() => refetch()}>{tCommon('retry')}</Button>
                </div>
              )}

              {adminBranchId && !isLoading && !isError && totalCount === 0 && (
                <EmptyState
                  icon={<Tags className="h-8 w-8"/>}
                  title={t('noTagsFound')}
                  description={t('noTagsHint')}
                  action={canCreate ? <Button onClick={openCreate}>{t('addTag')}</Button> : undefined}
                />
              )}

              {adminBranchId && !isLoading && !isError && tags.length > 0 && (
                <>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeader>{t('imageIconColumn')}</TableHeader>
                        <TableHeader>{t('name')}</TableHeader>
                        <TableHeader>{t('slugColumn')}</TableHeader>
                        <TableHeader>{t('descriptionLabel')}</TableHeader>
                        <TableHeader>{t('colorLabel')}</TableHeader>
                        <TableHeader>{t('status')}</TableHeader>
                        <TableHeader>{t('displayOrderColumn')}</TableHeader>
                        <TableHeader>{t('itemsCountColumn')}</TableHeader>
                        <TableHeader>{t('createdDate')}</TableHeader>
                        <TableHeader>{t('actionsColumn')}</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tags.map((tag) => (
                        <TableRow key={tag.id}>
                          <TableCell>
                            <TagVisual tag={tag} />
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{tag.name}</span>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs text-[var(--fg-muted)]">{tag.slug}</code>
                          </TableCell>
                          <TableCell>
                            <p className="text-xs text-[var(--fg-muted)] line-clamp-2 max-w-xs">{tag.description || '—'}</p>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="h-4 w-4 rounded-full border border-[var(--border)] shrink-0"
                                style={{ backgroundColor: tag.color || '#f97316' }}
                                aria-hidden="true"
                              />
                              <span className="text-xs font-mono text-[var(--fg-muted)]">{tag.color || '—'}</span>
                            </span>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => canUpdate && toggleActive(tag)}
                              disabled={!canUpdate || updateMutation.isPending}
                              className="inline-flex"
                              title={tag.is_active ? t('markInactive') : t('markActive')}
                            >
                              <Badge variant={tag.is_active ? 'success' : 'secondary'}>
                                {tag.is_active
                                  ? <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3"/>{t('active')}</span>
                                  : <span className="inline-flex items-center gap-1"><EyeOff className="h-3 w-3"/>{t('inactive')}</span>}
                              </Badge>
                            </button>
                          </TableCell>
                          <TableCell>{tag.display_order}</TableCell>
                          <TableCell>{tag.item_count ?? 0}</TableCell>
                          <TableCell>{formatDate(tag.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {canUpdate && (
                                <Button variant="ghost"size="icon-sm"onClick={() => openEdit(tag)} aria-label={t('editTagAria')}>
                                  <Edit2 className="h-3.5 w-3.5"/>
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => openDelete(tag)}
                                  className="text-[var(--danger-text)] hover:text-[var(--danger-text)] hover:bg-[var(--danger-subtle)]"
                                  aria-label={t('deleteTagAria')}
                                >
                                  <Trash2 className="h-3.5 w-3.5"/>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <PaginationControls
                    page={page}
                    pageSize={pagination.page_size}
                    count={totalCount}
                    next={data?.next}
                    previous={data?.previous}
                    onPageChange={setPage}
                    previousLabel={t('previousLabel')}
                    nextLabel={t('nextLabel')}
                    pageOfLabel={t('pageOfTotalCount', {
                      page,
                      totalPages: getTotalPages(totalCount, pagination.page_size),
                      count: totalCount,
                    })}
                  />
                </>
              )}
            </div>
          </div>

          <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('addTag')} size="md">
            <TagFormFields form={createForm} onChange={setCreateForm} error={createError} autoSlug />
            <div className="flex gap-3 pt-2">
              <Button variant="secondary"onClick={() => setCreateOpen(false)} className="flex-1">{t('cancel')}</Button>
              <Button onClick={submitCreate} disabled={createMutation.isPending} className="flex-1">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : t('addTag')}
              </Button>
            </div>
            {createMutation.isError && (
              <p className="text-sm text-[var(--danger-text)] mt-2">{t('failedToCreateTagRetry')}</p>
            )}
          </Modal>

          <Modal
            open={editOpen}
            onClose={() => { setEditOpen(false); setEditTag(null) }}
            title={editTag ? t('editColonName', { name: editTag.name }) : t('editTag')}
            size="md"
          >
            <TagFormFields form={editForm} onChange={setEditForm} error={editError} />
            <div className="flex gap-3 pt-2">
              <Button variant="secondary"onClick={() => setEditOpen(false)} className="flex-1">{t('cancel')}</Button>
              <Button onClick={submitEdit} disabled={updateMutation.isPending} className="flex-1">
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : t('saveChanges')}
              </Button>
            </div>
            {updateMutation.isError && (
              <p className="text-sm text-[var(--danger-text)] mt-2">{t('failedToSaveChangesRetry')}</p>
            )}
          </Modal>

          <Modal
            open={deleteOpen}
            onClose={() => { setDeleteOpen(false); setDeleteTarget(null); setDeleteError(null) }}
            title={t('deleteTag')}
            size="sm"
          >
            <p className="text-[var(--fg-muted)] mb-6">
              {t('confirmDeleteTag', { name: deleteTarget?.name ?? '' })}
            </p>
            <div className="flex gap-3">
              <Button variant="secondary"onClick={() => setDeleteOpen(false)} className="flex-1">{t('cancel')}</Button>
              <Button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-[var(--danger)] hover:bg-[var(--danger-hover)] border-[var(--danger)]"
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : t('deleteAction')}
              </Button>
            </div>
            {deleteError && <p className="text-sm text-[var(--danger-text)] mt-2"role="alert">{deleteError}</p>}
            {deleteMutation.isError && !deleteError && (
              <p className="text-sm text-[var(--danger-text)] mt-2"role="alert">
                {extractApiError(deleteMutation.error, t('failedToDeleteTagRetry'))}
              </p>
            )}
          </Modal>
        </div>
      </ErrorBoundary>
    </PermissionGuard>
  )
}

function TagVisual({ tag }: { tag: ConsoleMenuTag }) {
  if (tag.image) {
    return (
      <div className="relative h-8 w-8 rounded-full overflow-hidden bg-[var(--card-hover)]">
        <Image src={tag.image} alt=""fill className="object-cover"sizes="32px"/>
      </div>
    )
  }
  if (tag.icon) {
    return <span className="text-lg"aria-hidden="true">{tag.icon}</span>
  }
  return <span className="text-xs text-[var(--fg-muted)]">—</span>
}

function TagFormFields({
  form,
  onChange,
  error,
  autoSlug = false,
}: {
  form: TagFormInput
  onChange: (f: TagFormInput) => void
  error: string | null
  autoSlug?: boolean
}) {
  const t = useTranslations('console')
  const slugTouchedRef = useRef(false)

  const set = (field: Exclude<keyof TagFormInput, 'image'>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value

      if (field === 'slug') {
        slugTouchedRef.current = true
        onChange({ ...form, slug: String(value) })
        return
      }

      if (field === 'name' && autoSlug && !slugTouchedRef.current) {
        onChange({ ...form, name: String(value), slug: slugify(String(value)) })
        return
      }

      onChange({ ...form, [field]: value })
    }

  return (
    <div className="space-y-4 mb-4">
      <Input label={t('tagNameLabel')} value={form.name} onChange={set('name')} />
      <Input label={t('slugLabel')} value={form.slug} onChange={set('slug')} />
      <Textarea label={t('descriptionLabel')} value={form.description} onChange={set('description')} rows={3} />
      <Input label={t('iconEmojiLabel')} value={form.icon} onChange={set('icon')} placeholder="🌱"/>
      <ImageUploader
        label={t('imageLabel')}
        value={form.image}
        onChange={(image) => onChange({ ...form, image })}
      />
      <div>
        <label className="block text-sm font-medium text-[var(--fg)] mb-1">{t('colorLabel')}</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.color || '#f97316'}
            onChange={(e) => onChange({ ...form, color: e.target.value })}
            className="h-10 w-14 rounded-lg border border-[var(--border)] cursor-pointer bg-transparent"
            aria-label={t('colorLabel')}
          />
          <Input value={form.color} onChange={set('color')} placeholder="#f97316"/>
        </div>
      </div>
      <Input label={t('displayOrderLabel')} type="number"min={0} value={form.display_order} onChange={set('display_order')} />
      <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
        <input type="checkbox"checked={form.is_active} onChange={set('is_active')} className="rounded"/>
        {t('active')}
      </label>
      {error && <p className="text-sm text-[var(--danger-text)]">{t(`tagFormError.${error}`)}</p>}
    </div>
  )
}
