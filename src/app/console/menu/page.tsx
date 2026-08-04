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
import { ImageUploader, EMPTY_IMAGE_FIELD } from '@/components/ImageUploader'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PreviewButton } from '@/components/admin/PreviewButton'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { MenuTagBadge } from '@/components/menu/MenuTagBadge'
import { MenuTagMultiSelect } from '@/components/console/MenuTagMultiSelect'
import { CategoryCreateModal } from '@/components/console/CategoryCreateModal'

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
  const { data: extraGroups } = useConsoleExtraGroups(adminBranchId)
  const { data: branchTagsData, isLoading: tagsLoading } = useConsoleMenuTags(adminBranchId, { page_size: 200 })
  const branchTags = branchTagsData?.results ?? []

  // const createMutation = useCreateMenuItem(adminBranchId ?? '')
  const createMutation = useConsoleCreateMenuItem(adminBranchId ?? '')
  const updateMutation = useUpdateMenuItem(adminBranchId ?? '')
  const deleteMutation = useDeleteMenuItem(adminBranchId ?? '')
  const assignGroupsMutation = useAssignExtraGroupsToItem(adminBranchId ?? '')

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
    // adminBranchId alone already encodes that (see its derivation
    // above), but branchState/selectedBranch are checked explicitly too
    // so this guard doesn't silently depend on adminBranchId's specific
    // implementation staying in sync.
    if (branchState !== 'ready' || !selectedBranch || !adminBranchId) return
    createMutation.mutate(menuItemFormToWriteRequest(createForm), {
      onSuccess: (created) => {
        setCreateOpen(false)
        setCreateForm(EMPTY_FORM)
        // Attach the selected Extra Groups now that the item has an id — this
        // also materializes the item's flat `extras` for cart/checkout.
        if (createForm.extra_group_ids.length > 0) {
          assignGroupsMutation.mutate({ itemId: created.id, groupIds: createForm.extra_group_ids })
        }
      },
    })
  }

  const openEdit = (item: MenuItem) => {
    setEditItem(item)
    setEditForm(menuItemToFormInput(item))
    setEditOpen(true)
  }

  const submitEdit = () => {
    if (!editItem) return
    updateMutation.mutate({ id: editItem.id, payload: menuItemFormToWriteRequest(editForm) }, {
      onSuccess: () => {
        setEditOpen(false)
        // Attach/detach Extra Groups and re-materialize `extras` for cart/checkout.
        assignGroupsMutation.mutate({ itemId: editItem.id, groupIds: editForm.extra_group_ids })
        setEditItem(null)
      },
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

    <PermissionGuard permission="menu.view" fallback={<AccessDenied />}>
    <ErrorBoundary feature="AdminMenu">
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="py-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">{t('menuManagement')}</h1>
                <Badge variant="secondary">{t('itemsCount', { count: totalCount })}</Badge>
              </div>
              <p className="text-[var(--fg-muted)] mt-1">{t('menuPageSubtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              <PreviewButton href="/menu" label={t('previewMenu')} size="sm" />
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate} disabled={!adminBranchId}>{t('addItem')}</Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchItemsPlaceholder')}
                className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all ${categoryFilter === 'all' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-200'}`}
              >
                {t('allCategories')}
              </button>
              {catsLoading
                ? <span className="text-sm text-[var(--fg-muted)] px-2 py-1.5">{t('loadingEllipsis')}</span>
                : (categories ?? []).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all ${categoryFilter === cat.id ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-200'}`}
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
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{t('loadingBranchesEllipsis')}</span>
            </div>
          )}
          {branchState === 'error' && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-[var(--fg-muted)]">{t('failedToLoadBranches')}</p>
            </div>
          )}
          {branchState === 'empty' && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertCircle className="h-8 w-8 text-[var(--fg-muted)]" />
              <p className="text-sm text-[var(--fg-muted)]">{t('selectBranchToManageMenu')}</p>
            </div>
          )}

          {/* Loading */}
          {branchState === 'ready' && itemsLoading && (
            <div className="flex items-center justify-center py-24 gap-3 text-[var(--fg-muted)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{t('loadingMenu')}</span>
            </div>
          )}

          {/* Error */}
          {branchState === 'ready' && itemsError && !itemsLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-[var(--fg-muted)]">{t('failedToLoadMenuItems')}</p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>{tCommon('retry')}</Button>
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
                        <Image src={item.image} alt={item.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute top-2 start-2 flex flex-col gap-1">
                          {item.is_featured && <Badge variant="default" className="text-[10px]">{t('featured')}</Badge>}
                          {item.is_popular && <Badge variant="warning" className="text-[10px]">{t('popular')}</Badge>}
                          {item.discount && <Badge variant="danger" className="text-[10px]">{t('percentOff', { percent: item.discount })}</Badge>}
                        </div>
                        <div className="absolute top-2 end-2 flex gap-1">
                          <button
                            onClick={() => toggleAvailable(item)}
                            disabled={isUpdating}
                            className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all shadow ${item.available ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'} disabled:opacity-50`}
                            title={item.available ? t('markUnavailable') : t('markAvailable')}
                            aria-label={item.available ? t('markUnavailable') : t('markAvailable')}
                          >
                            {isTogglingAvailable
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : item.available ? <CircleCheck className="h-3.5 w-3.5" /> : <CircleX className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => toggleActive(item)}
                            disabled={isUpdating}
                            className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all shadow ${item.is_active ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'} disabled:opacity-50`}
                            title={item.is_active ? t('markHidden') : t('markPublished')}
                            aria-label={item.is_active ? t('markHidden') : t('markPublished')}
                          >
                            {isTogglingActive
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : item.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
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
                              <MenuTagBadge key={tag.id} tag={tag} className="text-[10px]" />
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)] mb-3">
                          <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-amber-400 fill-amber-400" />{item.rating}</span>
                          <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{item.preparation_time}m</span>
                          {item.calories && <span className="flex items-center gap-0.5"><Flame className="h-3 w-3" />{item.calories}</span>}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--fg)]">{formatCurrency(item.price)}</span>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(item)} aria-label={t('editItemAria')}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openDelete(item)}
                              className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                              aria-label={t('deleteItemAria')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
                  <p className="text-[var(--fg-muted)]">{t('noItemsFound')}</p>
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
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('addMenuItem')} size="lg">
        <MenuItemFormFields
          form={createForm}
          onChange={setCreateForm}
          categories={categories ?? []}
          extraGroups={extraGroups ?? []}
          branchTags={branchTags}
          tagsLoading={tagsLoading}
          canCreateCategory={canCreateCategory}
          onCreateCategory={() => openCategoryCreate('create')}
        />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={() => setCreateOpen(false)} className="flex-1">{t('cancel')}</Button>
          <Button
            onClick={submitCreate}
            disabled={createMutation.isPending}
            className="flex-1"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t('addItem')}
          </Button>
        </div>
        {createMutation.isError && (
          <p className="text-sm text-red-500 mt-2">{t('failedToCreateItemRetry')}</p>
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
        />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={() => setEditOpen(false)} className="flex-1">{t('cancel')}</Button>
          <Button
            onClick={submitEdit}
            disabled={updateMutation.isPending}
            className="flex-1"
          >
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
        title={t('deleteItem')}
        size="sm"
      >
        <p className="text-[var(--fg-muted)] mb-6">
          {t('confirmDeleteItem', { name: deleteTarget?.name ?? '' })}
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
          <p className="text-sm text-red-500 mt-2">{t('failedToDeleteItemRetry')}</p>
        )}
      </Modal>

      <CategoryCreateModal
        open={categoryCreateOpen}
        onClose={() => setCategoryCreateOpen(false)}
        branchId={adminBranchId}
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
}: {
  form: MenuItemFormInput
  onChange: (f: MenuItemFormInput) => void
  categories: Category[]
  extraGroups: ExtraGroup[]
  branchTags: ConsoleMenuTag[]
  tagsLoading?: boolean
  canCreateCategory?: boolean
  onCreateCategory?: () => void
}) {
  const t = useTranslations('console')
  const set = (field: Exclude<keyof MenuItemFormInput, 'image' | 'extra_group_ids'>) =>
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
          <Input label={t('itemNameLabel')} value={form.name} onChange={set('name')} />
        </div>
        <div className="col-span-2">
          <label htmlFor="menu-category" className="block text-sm font-medium text-[var(--fg)] mb-1">{t('category')}</label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <select
              id="menu-category"
              value={form.category_id}
              onChange={set('category_id')}
              className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
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
        <Input label={t('priceDollarLabel')} type="number" value={form.price} onChange={set('price')} leftIcon={<span className="text-xs">$</span>} />
        <Input label={t('discountPercentSignLabel')} type="number" value={form.discount} onChange={set('discount')} />
        <Input label={t('caloriesLabel')} type="number" value={form.calories} onChange={set('calories')} />
        <Input label={t('prepTimeMinLabel')} type="number" value={form.preparation_time} onChange={set('preparation_time')} />
      </div>
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
          <input type="checkbox" checked={form.available} onChange={set('available')} className="rounded" />
          {t('available')}
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={set('is_active')} className="rounded" />
          {t('publishedOnMenu')}
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
          <input type="checkbox" checked={form.is_featured} onChange={set('is_featured')} className="rounded" />
          {t('featured')}
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
          <input type="checkbox" checked={form.is_popular} onChange={set('is_popular')} className="rounded" />
          {t('popular')}
        </label>
      </div>

      {/* Extra Groups attach/detach — see docs/EXTRAS_MANAGEMENT_IMPLEMENTATION.md */}
      <div>
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
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all ${selected ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-200'}`}
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
            {assignedGroups.map((g) => <Badge key={g.id} variant="secondary" className="text-[10px]">{g.name}</Badge>)}
          </div>
        )}
      </div>
    </div>
  )
}
