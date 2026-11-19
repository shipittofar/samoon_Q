'use client'

import { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import {
  Plus, Search, Edit2, Trash2, Eye, EyeOff, Star, Clock, Flame,
  Loader2, AlertCircle, CircleCheck, CircleX,
} from 'lucide-react'
import { Badge, PaginationControls } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { formatCurrency } from '@/utils'
import { getTotalPages } from '@/utils/pagination'
import { applyConsoleMenuClientFilters } from '@/lib/console-menu-client-filters'
import { useConsoleMenuItems, useConsoleCategories, useConsoleCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem, useConsoleExtraGroups, useAssignExtraGroupsToItem, useConsoleMenuTags, useSelectedBranch, useBranchState, useIsBranchReady, usePermission } from '@/hooks'
import type { Category, MenuItem, MenuItemFormInput } from '@/types'
import { menuItemFormToWriteRequest, menuItemToFormInput } from '@/types'
import { withUploadedImage } from '@/lib/image-asset-write'
import { useIdempotencyKeys, useSubmissionGuard } from '@/hooks/use-submission-guard'
import { ImageUploader, EMPTY_IMAGE_FIELD } from '@/components/ImageUploader'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PreviewButton } from '@/components/admin/PreviewButton'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { MenuTagBadge } from '@/components/menu/MenuTagBadge'
import { MenuTagMultiSelect } from '@/components/console/MenuTagMultiSelect'
import { CategoryCreateModal } from '@/components/console/CategoryCreateModal'
import { QrManagementPanel } from '@/components/qr/QrManagementPanel'
import { APP_URL } from '@/constants'
import { useCatalogTerms } from '@/hooks/verticals'
import { CatalogAttributeFields } from '@/components/console/CatalogAttributeFields'
import { numericAttribute, type VerticalDefinition } from '@/verticals'

// ── Form state shape ──────────────────────────────────────────────────────────

const EMPTY_FORM: MenuItemFormInput = {
  name: '', description: '', price: '', discount: '', calories: '',
  preparation_time: '', image: { ...EMPTY_IMAGE_FIELD }, category_id: '', available: true,
  is_active: true, is_featured: false, is_popular: false, extra_group_ids: [], tag_ids: [],
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminMenuPage() {
  const t = useTranslations('console')
  const tCommon = useTranslations('common')
  const tVerticals = useTranslations('verticals')
  // Phase 1 — food tenants keep the original wording/fields; service
  // verticals (salon, clinic) get service wording and schema-driven fields.
  const { vertical, term } = useCatalogTerms()
  const isFood = vertical.family === 'food'
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [page, setPage] = useState(1)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<MenuItemFormInput>(EMPTY_FORM)

  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<MenuItemFormInput>(EMPTY_FORM)

  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false)
  const [categoryCreateTarget, setCategoryCreateTarget] = useState<'create' | 'edit'>('create')

  // Console operates on whichever branch the admin has selected via
  // AdminBranchSwitcher — menu items/categories/mutations are all scoped to
  // it, never to a tenant-wide "all branches" collection (there is no such
  // thing; see docs/BRANCH_MENU_ANALYSIS.md).
  // Phase 3 — must be '' (disables the query), never undefined: passing
  // undefined into useMenuItems/useCategories/useExtraGroups would let
  // them silently fall back to the unrelated customer-storefront active
  // branch (useActiveBranchId()) via their `branchId ?? fallbackBranchId`
  // internal default — an implicit branch selection this admin page must
  // never exhibit.
  const branchState = useBranchState()
  const selectedBranch = useSelectedBranch()
  const adminBranchId = useIsBranchReady() ? selectedBranch?.id ?? '' : ''

  useEffect(() => {
    setPage(1)
  }, [search, categoryFilter])

  const { data: itemsData, isLoading: itemsLoading, isError: itemsError, refetch, pagination } = useConsoleMenuItems(
    adminBranchId,
    { page },
  )
  const { data: categories, isLoading: catsLoading } = useConsoleCategories(adminBranchId)
  const canCreateCategory = usePermission('category.create')
  const canManageMenuQr = usePermission('menu.manage')
  const { data: extraGroups } = useConsoleExtraGroups(adminBranchId)
  const { data: branchTagsData, isLoading: tagsLoading } = useConsoleMenuTags(adminBranchId, { page_size: 200 })
  const branchTags = branchTagsData?.results ?? []

  // const createMutation = useCreateMenuItem(adminBranchId ?? '')
  const createMutation = useConsoleCreateMenuItem(adminBranchId ?? '')
  const updateMutation = useUpdateMenuItem(adminBranchId ?? '')
  const deleteMutation = useDeleteMenuItem(adminBranchId ?? '')
  const assignGroupsMutation = useAssignExtraGroupsToItem(adminBranchId ?? '')
  const createGuard = useSubmissionGuard(adminBranchId ? `menu-item-create:${adminBranchId}` : undefined)
  const editGuard = useSubmissionGuard('menu-item-edit')
  const uploadKeys = useIdempotencyKeys()

  const totalCount = itemsData?.count ?? 0

  const clientFilters = useMemo(
    () => ({ search, categoryId: categoryFilter }),
    [search, categoryFilter],
  )

  // Interim client-side filter — see src/lib/console-menu-client-filters.ts.
  // Applies to the current page only until the console endpoint supports server-side filters.
  const filtered = useMemo(() => {
    const pageItems = itemsData?.results ?? []
    return applyConsoleMenuClientFilters(pageItems, clientFilters)
  }, [itemsData?.results, clientFilters])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const openCreate = () => {
    // Phase 3.6 — mirrors console/categories/page.tsx's disabled-button
    // guard on the trigger; kept here too as defense in depth in case this
    // handler is ever wired to a second, unguarded entry point.
    if (!adminBranchId) return
    setCreateForm(EMPTY_FORM)
    setCreateOpen(true)
  }

  const submitCreate = () => {
    // Phase 3.6 — no menu-item creation may execute unless the branch
    // resolution state machine is 'ready' with a real selectedBranch.
    void createGuard.run(async ({ signal, isCurrent }) => {
      if (branchState !== 'ready' || !selectedBranch || !adminBranchId) return
      const uploadCtx = {
        tenantId: selectedBranch.tenantId,
        branchId: adminBranchId,
        entityType: 'branch',
        entityId: adminBranchId,
        signal,
        idempotencyKey: uploadKeys.keyFor('menu-create', createForm.image.file),
      }
      const payload = await withUploadedImage(menuItemFormToWriteRequest(createForm, vertical), createForm.image, 'menu_item', uploadCtx)
      if (!isCurrent()) return
      const created = await createMutation.mutateAsync(payload)
      uploadKeys.reset('menu-create')
      setCreateOpen(false)
      setCreateForm(EMPTY_FORM)
      if (createForm.extra_group_ids.length > 0) {
        try {
          await assignGroupsMutation.mutateAsync({ itemId: created.id, groupIds: createForm.extra_group_ids })
        } catch {
          // Item create already succeeded. Group assignment stays best-effort.
        }
      }
    })
  }

  const openEdit = (item: MenuItem) => {
    setEditItem(item)
    setEditForm(menuItemToFormInput(item))
    setEditOpen(true)
  }

  const submitEdit = () => {
    void editGuard.run(async ({ signal, isCurrent }) => {
      if (!editItem || !selectedBranch || !adminBranchId) return
      const uploadCtx = {
        tenantId: selectedBranch.tenantId,
        branchId: adminBranchId,
        entityType: 'branch',
        entityId: adminBranchId,
        signal,
        idempotencyKey: uploadKeys.keyFor(`menu-edit:${editItem.id}`, editForm.image.file),
      }
      const payload = await withUploadedImage(menuItemFormToWriteRequest(editForm, vertical), editForm.image, 'menu_item', uploadCtx)
      if (!isCurrent()) return
      const itemId = editItem.id
      const groupIds = editForm.extra_group_ids
      await updateMutation.mutateAsync({ id: itemId, payload })
      uploadKeys.reset(`menu-edit:${itemId}`)
      setEditOpen(false)
      setEditItem(null)
      try {
        await assignGroupsMutation.mutateAsync({ itemId, groupIds })
      } catch {
        // Item update already succeeded.
      }
    })
  }

  const toggleAvailable = (item: MenuItem) => {
    updateMutation.mutate({ id: item.id, payload: { available: !item.available } })
  }

  const toggleActive = (item: MenuItem) => {
    updateMutation.mutate({ id: item.id, payload: { is_active: !item.is_active } })
  }

  const openDelete = (item: MenuItem) => {
    setDeleteTarget(item)
    setDeleteOpen(true)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => { setDeleteOpen(false); setDeleteTarget(null) },
    })
  }

  const openCategoryCreate = (target: 'create' | 'edit') => {
    if (!canCreateCategory || !adminBranchId) return
    setCategoryCreateTarget(target)
    setCategoryCreateOpen(true)
  }

  const handleCategoryCreated = (category: Category) => {
    if (categoryCreateTarget === 'create') {
      setCreateForm((form) => ({ ...form, category_id: category.id }))
    } else {
      setEditForm((form) => ({ ...form, category_id: category.id }))
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (

    <PermissionGuard permission="menu.view"fallback={<AccessDenied />}>
    <ErrorBoundary feature="AdminMenu">
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="py-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">{isFood ? t('menuManagement') : term('catalog')}</h1>
                <Badge variant="secondary">{t('itemsCount', { count: totalCount })}</Badge>
              </div>
              <p className="text-[var(--fg-muted)] mt-1">{isFood ? t('menuPageSubtitle') : term('pageSubtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              <PreviewButton href="/menu"label={isFood ? t('previewMenu') : term('preview')} size="sm"/>
              <Button leftIcon={<Plus className="h-4 w-4"/>} onClick={openCreate} disabled={!adminBranchId}>{isFood ? t('addItem') : term('addItem')}</Button>
            </div>
          </div>

          {adminBranchId ? (
            <div className="mb-6">
              <QrManagementPanel
                scope="menu"
                entityId={adminBranchId}
                canManage={canManageMenuQr}
                publicUrl={`${APP_URL}/menu`}
                publicUrlLabel={t('currentPublicPageLabel')}
                title={t('menuQrTitle')}
                description={t('menuQrDescription')}
                sectionAria={t('menuQrSectionAria')}
              />
            </div>
          ) : null}

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"/>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isFood ? t('searchItemsPlaceholder') : term('searchPlaceholder')}
                className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40 focus:border-[var(--focus-ring)]"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all ${categoryFilter === 'all' ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent-text)]' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent-border)]/50'}`}
              >
                {t('allCategories')}
              </button>
              {catsLoading
                ? <span className="text-sm text-[var(--fg-muted)] px-2 py-1.5">{t('loadingEllipsis')}</span>
                : (categories ?? []).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all ${categoryFilter === cat.id ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent-text)]' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent-border)]/50'}`}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))
              }
            </div>
          </div>

          {/* Branch resolution state — distinct copy per state, never collapsed together.
              These are separate from itemsLoading/itemsError below, which reflect
              useMenuItems() itself and only ever run once branchState === 'ready'. */}
          {branchState === 'loading' && (
            <div className="flex items-center justify-center py-24 gap-3 text-[var(--fg-muted)]">
              <Loader2 className="h-5 w-5 animate-spin"/>
              <span className="text-sm">{t('loadingBranchesEllipsis')}</span>
            </div>
          )}
          {branchState === 'error' && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertCircle className="h-8 w-8 text-[var(--danger-text)]"/>
              <p className="text-sm text-[var(--fg-muted)]">{t('failedToLoadBranches')}</p>
            </div>
          )}
          {branchState === 'empty' && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertCircle className="h-8 w-8 text-[var(--fg-muted)]"/>
              <p className="text-sm text-[var(--fg-muted)]">{isFood ? t('selectBranchToManageMenu') : term('selectBranch')}</p>
            </div>
          )}

          {/* Loading */}
          {branchState === 'ready' && itemsLoading && (
            <div className="flex items-center justify-center py-24 gap-3 text-[var(--fg-muted)]">
              <Loader2 className="h-5 w-5 animate-spin"/>
              <span className="text-sm">{isFood ? t('loadingMenu') : term('loading')}</span>
            </div>
          )}

          {/* Error */}
          {branchState === 'ready' && itemsError && !itemsLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertCircle className="h-8 w-8 text-[var(--danger-text)]"/>
              <p className="text-sm text-[var(--fg-muted)]">{isFood ? t('failedToLoadMenuItems') : term('loadFailed')}</p>
              <Button variant="secondary"size="sm"onClick={() => refetch()}>{tCommon('retry')}</Button>
            </div>
          )}

          {/* Grid */}
          {branchState === 'ready' && !itemsLoading && !itemsError && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((item, i) => {
                  const isUpdating = updateMutation.isPending && updateMutation.variables?.id === item.id
                  const isTogglingAvailable = isUpdating && updateMutation.variables?.payload.available !== undefined
                  const isTogglingActive = isUpdating && updateMutation.variables?.payload.is_active !== undefined
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden ${!item.is_active ? 'opacity-60' : ''}`}
                    >
                      <div className="relative h-36">
                        {item.image ? (
                          <Image src={item.image} alt={item.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw"/>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-30" aria-hidden="true">{vertical.emoji}</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"/>
                        <div className="absolute top-2 start-2 flex flex-col gap-1">
                          {item.is_featured && <Badge variant="default"className="text-[10px]">{t('featured')}</Badge>}
                          {item.is_popular && <Badge variant="warning"className="text-[10px]">{t('popular')}</Badge>}
                          {item.discount && <Badge variant="danger"className="text-[10px]">{t('percentOff', { percent: item.discount })}</Badge>}
                        </div>
                        <div className="absolute top-2 end-2 flex gap-1">
                          <button
                            onClick={() => toggleAvailable(item)}
                            disabled={isUpdating}
                            className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all shadow ${item.available ? 'bg-[var(--success)] text-[var(--danger-fg)]' : 'bg-[var(--danger)] text-[var(--danger-fg)]'} disabled:opacity-50`}
                            title={item.available ? t('markUnavailable') : t('markAvailable')}
                            aria-label={item.available ? t('markUnavailable') : t('markAvailable')}
                          >
                            {isTogglingAvailable
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin"/>
                              : item.available ? <CircleCheck className="h-3.5 w-3.5"/> : <CircleX className="h-3.5 w-3.5"/>}
                          </button>
                          <button
                            onClick={() => toggleActive(item)}
                            disabled={isUpdating}
                            className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all shadow ${item.is_active ? 'bg-[var(--success)] text-[var(--danger-fg)]' : 'bg-[var(--danger)] text-[var(--danger-fg)]'} disabled:opacity-50`}
                            title={item.is_active ? t('markHidden') : t('markPublished')}
                            aria-label={item.is_active ? t('markHidden') : t('markPublished')}
                          >
                            {isTogglingActive
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin"/>
                              : item.is_active ? <Eye className="h-3.5 w-3.5"/> : <EyeOff className="h-3.5 w-3.5"/>}
                          </button>
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <Badge variant={item.available ? 'success' : 'secondary'} className="text-[10px]">
                            {item.available ? t('statusAvailable') : t('statusUnavailable')}
                          </Badge>
                          <Badge variant={item.is_active ? 'success' : 'secondary'} className="text-[10px]">
                            {item.is_active ? t('statusPublished') : t('statusHidden')}
                          </Badge>
                        </div>
                        <p className="font-semibold text-[var(--fg)] text-sm truncate mb-0.5">{item.name}</p>
                        <p className="text-xs text-[var(--fg-muted)] line-clamp-2 mb-2">{item.description}</p>
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {item.tags.map((tag) => (
                              <MenuTagBadge key={tag.id} tag={tag} className="text-[10px]"/>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)] mb-3">
                          <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-[var(--rating)] fill-[var(--rating)]"/>{item.rating}</span>
                          {isFood ? (
                            <>
                              <span className="flex items-center gap-0.5"><Clock className="h-3 w-3"/>{item.preparation_time}m</span>
                              {item.calories && <span className="flex items-center gap-0.5"><Flame className="h-3 w-3"/>{item.calories}</span>}
                            </>
                          ) : numericAttribute(item.attributes, 'duration_minutes') !== undefined ? (
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3"/>
                              {tVerticals('facts.durationMinutes', { minutes: numericAttribute(item.attributes, 'duration_minutes')! })}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--fg)]">{formatCurrency(item.price)}</span>
                          <div className="flex gap-1">
                            <Button variant="ghost"size="icon-sm"onClick={() => openEdit(item)} aria-label={t('editItemAria')}>
                              <Edit2 className="h-3.5 w-3.5"/>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openDelete(item)}
                              className="text-[var(--danger-text)] hover:text-[var(--danger-text)] hover:bg-[var(--danger-subtle)]"
                              aria-label={t('deleteItemAria')}
                            >
                              <Trash2 className="h-3.5 w-3.5"/>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Empty */}
              {filtered.length === 0 && (
                <div className="py-20 text-center">
                  <span className="text-4xl block mb-4">🍽️</span>
                  <p className="text-[var(--fg-muted)]">{isFood ? t('noItemsFound') : term('emptyState')}</p>
                </div>
              )}

              <PaginationControls
                page={page}
                pageSize={pagination.page_size}
                count={totalCount}
                next={itemsData?.next}
                previous={itemsData?.previous}
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

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={isFood ? t('addMenuItem') : term('newItemTitle')} size="lg">
        <MenuItemFormFields
          form={createForm}
          onChange={setCreateForm}
          categories={categories ?? []}
          extraGroups={extraGroups ?? []}
          branchTags={branchTags}
          tagsLoading={tagsLoading}
          canCreateCategory={canCreateCategory}
          onCreateCategory={() => openCategoryCreate('create')}
          vertical={vertical}
        />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary"onClick={() => setCreateOpen(false)} className="flex-1">{t('cancel')}</Button>
          <Button
            type="button"
            onClick={submitCreate}
            disabled={createGuard.locked || createMutation.isPending}
            className="flex-1"
          >
            {createGuard.locked || createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : (isFood ? t('addItem') : term('addItem'))}
          </Button>
        </div>
        {createMutation.isError && (
          <p className="text-sm text-[var(--danger-text)] mt-2">{t('failedToCreateItemRetry')}</p>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditItem(null) }}
        title={editItem ? t('editColonName', { name: editItem.name }) : t('editItem')}
        size="lg"
      >
        <MenuItemFormFields
          form={editForm}
          onChange={setEditForm}
          categories={categories ?? []}
          extraGroups={extraGroups ?? []}
          branchTags={branchTags}
          tagsLoading={tagsLoading}
          canCreateCategory={canCreateCategory}
          onCreateCategory={() => openCategoryCreate('edit')}
          vertical={vertical}
        />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary"onClick={() => setEditOpen(false)} className="flex-1">{t('cancel')}</Button>
          <Button
            type="button"
            onClick={submitEdit}
            disabled={editGuard.locked || updateMutation.isPending}
            className="flex-1"
          >
            {editGuard.locked || updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : t('saveChanges')}
          </Button>
        </div>
        {updateMutation.isError && (
          <p className="text-sm text-[var(--danger-text)] mt-2">{t('failedToSaveChangesRetry')}</p>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null) }}
        title={t('deleteItem')}
        size="sm"
      >
        <p className="text-[var(--fg-muted)] mb-6">
          {t('confirmDeleteItem', { name: deleteTarget?.name ?? '' })}
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
        {deleteMutation.isError && (
          <p className="text-sm text-[var(--danger-text)] mt-2">{t('failedToDeleteItemRetry')}</p>
        )}
      </Modal>

      <CategoryCreateModal
        open={categoryCreateOpen}
        onClose={() => setCategoryCreateOpen(false)}
        branchId={adminBranchId}
        tenantId={selectedBranch?.tenantId}
        onSuccess={handleCategoryCreated}
        showSuccessToast
        zIndex={60}
      />
    </div>
    </ErrorBoundary>
  
    </PermissionGuard>

  )
}

// ── Shared form fields component ──────────────────────────────────────────────

import type { ConsoleMenuTag, ExtraGroup } from '@/types'

function MenuItemFormFields({
  form,
  onChange,
  categories,
  extraGroups,
  branchTags,
  tagsLoading,
  canCreateCategory,
  onCreateCategory,
  vertical,
}: {
  form: MenuItemFormInput
  onChange: (f: MenuItemFormInput) => void
  /** Phase 1 — shapes which fields are shown (food vs service). */
  vertical: VerticalDefinition
  categories: Category[]
  extraGroups: ExtraGroup[]
  branchTags: ConsoleMenuTag[]
  tagsLoading?: boolean
  canCreateCategory?: boolean
  onCreateCategory?: () => void
}) {
  const t = useTranslations('console')
  const { term } = useCatalogTerms(vertical)
  const isFood = vertical.family === 'food'
  const set = (field: Exclude<keyof MenuItemFormInput, 'image' | 'extra_group_ids' | 'item_kind' | 'attributes'>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange({ ...form, [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })

  const toggleExtraGroup = (groupId: string) => {
    const selected = form.extra_group_ids.includes(groupId)
      ? form.extra_group_ids.filter((id) => id !== groupId)
      : [...form.extra_group_ids, groupId]
    onChange({ ...form, extra_group_ids: selected })
  }

  const assignedGroups = extraGroups.filter((g) => form.extra_group_ids.includes(g.id))

  return (
    <div className="space-y-4 mb-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input label={isFood ? t('itemNameLabel') : term('itemName')} value={form.name} onChange={set('name')} />
        </div>
        <div className="col-span-2">
          <label htmlFor="menu-category"className="block text-sm font-medium text-[var(--fg)] mb-1">{t('category')}</label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <select
              id="menu-category"
              value={form.category_id}
              onChange={set('category_id')}
              className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40 focus:border-[var(--focus-ring)]"
            >
              <option value="">{t('selectCategoryEllipsis')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {canCreateCategory && onCreateCategory && (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={onCreateCategory}
                className="shrink-0 self-start sm:self-center"
              >
                {t('createCategoryQuick')}
              </Button>
            )}
          </div>
        </div>
        <Input label={t('priceDollarLabel')} type="number"value={form.price} onChange={set('price')} leftIcon={<span className="text-xs">$</span>} />
        <Input label={t('discountPercentSignLabel')} type="number"value={form.discount} onChange={set('discount')} />
        {vertical.usesFoodFields && (
          <>
            <Input label={t('caloriesLabel')} type="number" value={form.calories} onChange={set('calories')} />
            <Input label={t('prepTimeMinLabel')} type="number" value={form.preparation_time} onChange={set('preparation_time')} />
          </>
        )}
      </div>
      {!isFood && (
        <CatalogAttributeFields
          vertical={vertical}
          itemKind={form.item_kind}
          attributes={form.attributes}
          onChange={(next) => onChange({ ...form, ...next })}
        />
      )}
      <Textarea label={t('descriptionLabel')} value={form.description} onChange={set('description')} rows={3} />
      <MenuTagMultiSelect
        tags={branchTags}
        value={form.tag_ids}
        onChange={(tag_ids) => onChange({ ...form, tag_ids })}
        isLoading={tagsLoading}
      />
      <ImageUploader
        label={t('imageLabel')}
        value={form.image}
        onChange={(image) => onChange({ ...form, image })}
      />
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
          <input type="checkbox"checked={form.available} onChange={set('available')} className="rounded"/>
          {t('available')}
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
          <input type="checkbox"checked={form.is_active} onChange={set('is_active')} className="rounded"/>
          {t('publishedOnMenu')}
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
          <input type="checkbox"checked={form.is_featured} onChange={set('is_featured')} className="rounded"/>
          {t('featured')}
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
          <input type="checkbox"checked={form.is_popular} onChange={set('is_popular')} className="rounded"/>
          {t('popular')}
        </label>
      </div>

      {/* Extra Groups attach/detach — see docs/EXTRAS_MANAGEMENT_IMPLEMENTATION.md.
          Phase 1: cart add-ons only exist for verticals with a cart. */}
      {vertical.supportsCart && <div>
        <label className="block text-sm font-medium text-[var(--fg)] mb-1">{t('extraGroupsLabel')}</label>
        {extraGroups.length === 0 ? (
          <p className="text-xs text-[var(--fg-muted)]">{t('noExtraGroupsAvailable')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {extraGroups.map((group) => {
              const selected = form.extra_group_ids.includes(group.id)
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => toggleExtraGroup(group.id)}
                  aria-pressed={selected}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all ${selected ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent-text)]' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent-border)]/50'}`}
                >
                  {group.name}
                </button>
              )
            })}
          </div>
        )}
        {/* Preview of assigned groups */}
        {assignedGroups.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="text-xs text-[var(--fg-muted)]">{t('assignedGroupsPreview')}</span>
            {assignedGroups.map((g) => <Badge key={g.id} variant="secondary"className="text-[10px]">{g.name}</Badge>)}
          </div>
        )}
      </div>}
    </div>
  )
}
