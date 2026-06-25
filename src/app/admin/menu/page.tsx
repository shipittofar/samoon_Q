'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  Plus, Search, Edit2, Trash2, Eye, EyeOff, Star, Clock, Flame,
  Loader2, AlertCircle,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { formatCurrency } from '@/utils'
import { useMenuItems, useCategories, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem } from '@/hooks'
import type { MenuItem } from '@/types'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

// ── Form state shape ──────────────────────────────────────────────────────────

interface MenuItemForm {
  name: string
  description: string
  price: string
  discount: string
  calories: string
  preparation_time: string
  image: string
  category_id: string
  available: boolean
  is_featured: boolean
  is_popular: boolean
}

const EMPTY_FORM: MenuItemForm = {
  name: '', description: '', price: '', discount: '', calories: '',
  preparation_time: '', image: '', category_id: '', available: true,
  is_featured: false, is_popular: false,
}

function itemToForm(item: MenuItem): MenuItemForm {
  return {
    name: item.name,
    description: item.description,
    price: String(item.price),
    discount: String(item.discount ?? ''),
    calories: String(item.calories ?? ''),
    preparation_time: String(item.preparation_time),
    image: item.image,
    category_id: item.category_id,
    available: item.available,
    is_featured: item.is_featured ?? false,
    is_popular: item.is_popular ?? false,
  }
}

function formToPayload(form: MenuItemForm): Partial<MenuItem> {
  return {
    name: form.name,
    description: form.description,
    price: parseFloat(form.price) || 0,
    discount: form.discount ? parseFloat(form.discount) : undefined,
    calories: form.calories ? parseInt(form.calories, 10) : undefined,
    preparation_time: parseInt(form.preparation_time, 10) || 15,
    image: form.image,
    category_id: form.category_id,
    available: form.available,
    is_featured: form.is_featured,
    is_popular: form.is_popular,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminMenuPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<MenuItemForm>(EMPTY_FORM)

  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<MenuItemForm>(EMPTY_FORM)

  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: itemsData, isLoading: itemsLoading, isError: itemsError, refetch } = useMenuItems()
  const { data: categories, isLoading: catsLoading } = useCategories()

  const createMutation = useCreateMenuItem()
  const updateMutation = useUpdateMenuItem()
  const deleteMutation = useDeleteMenuItem()

  const allItems: MenuItem[] = itemsData?.results ?? []

  const filtered = useMemo(() => allItems.filter((item) => {
    const matchCat = categoryFilter === 'all' || item.category_id === categoryFilter
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  }), [allItems, categoryFilter, search])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setCreateForm(EMPTY_FORM)
    setCreateOpen(true)
  }

  const submitCreate = () => {
    createMutation.mutate(formToPayload(createForm), {
      onSuccess: () => { setCreateOpen(false); setCreateForm(EMPTY_FORM) },
    })
  }

  const openEdit = (item: MenuItem) => {
    setEditItem(item)
    setEditForm(itemToForm(item))
    setEditOpen(true)
  }

  const submitEdit = () => {
    if (!editItem) return
    updateMutation.mutate({ id: editItem.id, payload: formToPayload(editForm) }, {
      onSuccess: () => { setEditOpen(false); setEditItem(null) },
    })
  }

  const toggleAvailable = (item: MenuItem) => {
    updateMutation.mutate({ id: item.id, payload: { available: !item.available } })
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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (

    <PermissionGuard permission="menu.view" fallback={<AccessDenied />}>
    <ErrorBoundary feature="AdminMenu">
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="py-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">Menu Management</h1>
                <Badge variant="secondary">{allItems.length} items</Badge>
              </div>
              <p className="text-[var(--fg-muted)] mt-1">Add, edit, and manage your menu offerings</p>
            </div>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add Item</Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items…"
                className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all ${categoryFilter === 'all' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-200'}`}
              >
                All
              </button>
              {catsLoading
                ? <span className="text-sm text-[var(--fg-muted)] px-2 py-1.5">Loading…</span>
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

          {/* Loading */}
          {itemsLoading && (
            <div className="flex items-center justify-center py-24 gap-3 text-[var(--fg-muted)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading menu…</span>
            </div>
          )}

          {/* Error */}
          {itemsError && !itemsLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-[var(--fg-muted)]">Failed to load menu items.</p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          )}

          {/* Grid */}
          {!itemsLoading && !itemsError && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((item, i) => {
                  const isToggling = updateMutation.isPending && updateMutation.variables?.id === item.id
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden ${!item.available ? 'opacity-60' : ''}`}
                    >
                      <div className="relative h-36">
                        <Image src={item.image} alt={item.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute top-2 start-2 flex flex-col gap-1">
                          {item.is_featured && <Badge variant="default" className="text-[10px]">Featured</Badge>}
                          {item.is_popular && <Badge variant="warning" className="text-[10px]">Popular</Badge>}
                          {item.discount && <Badge variant="danger" className="text-[10px]">{item.discount}% OFF</Badge>}
                        </div>
                        <div className="absolute top-2 end-2">
                          <button
                            onClick={() => toggleAvailable(item)}
                            disabled={isToggling}
                            className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all shadow ${item.available ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'} disabled:opacity-50`}
                            title={item.available ? 'Mark unavailable' : 'Mark available'}
                          >
                            {isToggling
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : item.available ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="font-semibold text-[var(--fg)] text-sm truncate mb-0.5">{item.name}</p>
                        <p className="text-xs text-[var(--fg-muted)] line-clamp-2 mb-2">{item.description}</p>
                        <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)] mb-3">
                          <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-amber-400 fill-amber-400" />{item.rating}</span>
                          <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{item.preparation_time}m</span>
                          {item.calories && <span className="flex items-center gap-0.5"><Flame className="h-3 w-3" />{item.calories}</span>}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[var(--fg)]">{formatCurrency(item.price)}</span>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(item)} aria-label="Edit item">
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openDelete(item)}
                              className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                              aria-label="Delete item"
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
                  <p className="text-[var(--fg-muted)]">No items found.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Menu Item" size="lg">
        <MenuItemFormFields
          form={createForm}
          onChange={setCreateForm}
          categories={categories ?? []}
        />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={() => setCreateOpen(false)} className="flex-1">Cancel</Button>
          <Button
            onClick={submitCreate}
            disabled={createMutation.isPending}
            className="flex-1"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Item'}
          </Button>
        </div>
        {createMutation.isError && (
          <p className="text-sm text-red-500 mt-2">Failed to create item. Please try again.</p>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditItem(null) }}
        title={editItem ? `Edit: ${editItem.name}` : 'Edit Item'}
        size="lg"
      >
        <MenuItemFormFields
          form={editForm}
          onChange={setEditForm}
          categories={categories ?? []}
        />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={() => setEditOpen(false)} className="flex-1">Cancel</Button>
          <Button
            onClick={submitEdit}
            disabled={updateMutation.isPending}
            className="flex-1"
          >
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
          </Button>
        </div>
        {updateMutation.isError && (
          <p className="text-sm text-red-500 mt-2">Failed to save changes. Please try again.</p>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null) }}
        title="Delete Item"
        size="sm"
      >
        <p className="text-[var(--fg-muted)] mb-6">
          Are you sure you want to delete <span className="font-semibold text-[var(--fg)]">{deleteTarget?.name}</span>? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)} className="flex-1">Cancel</Button>
          <Button
            onClick={confirmDelete}
            disabled={deleteMutation.isPending}
            className="flex-1 bg-red-500 hover:bg-red-600 border-red-500"
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
          </Button>
        </div>
        {deleteMutation.isError && (
          <p className="text-sm text-red-500 mt-2">Failed to delete item. Please try again.</p>
        )}
      </Modal>
    </div>
    </ErrorBoundary>
  
    </PermissionGuard>

  )
}

// ── Shared form fields component ──────────────────────────────────────────────

import type { Category } from '@/types'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'

function MenuItemFormFields({
  form,
  onChange,
  categories,
}: {
  form: MenuItemForm
  onChange: (f: MenuItemForm) => void
  categories: Category[]
}) {
  const set = (field: keyof MenuItemForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    onChange({ ...form, [field]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })

  return (
    <div className="space-y-4 mb-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input label="Item Name" value={form.name} onChange={set('name')} />
        </div>
        <div className="col-span-2">
          <label htmlFor="menu-category" className="block text-sm font-medium text-[var(--fg)] mb-1">Category</label>
          <select
            id="menu-category"
            value={form.category_id}
            onChange={set('category_id')}
            className="w-full h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
          >
            <option value="">Select category…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Input label="Price ($)" type="number" value={form.price} onChange={set('price')} leftIcon={<span className="text-xs">$</span>} />
        <Input label="Discount %" type="number" value={form.discount} onChange={set('discount')} />
        <Input label="Calories" type="number" value={form.calories} onChange={set('calories')} />
        <Input label="Prep Time (min)" type="number" value={form.preparation_time} onChange={set('preparation_time')} />
      </div>
      <Textarea label="Description" value={form.description} onChange={set('description')} rows={3} />
      <Input label="Image URL" value={form.image} onChange={set('image')} />
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
          <input type="checkbox" checked={form.available} onChange={set('available')} className="rounded" />
          Available
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
          <input type="checkbox" checked={form.is_featured} onChange={set('is_featured')} className="rounded" />
          Featured
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--fg)] cursor-pointer">
          <input type="checkbox" checked={form.is_popular} onChange={set('is_popular')} className="rounded" />
          Popular
        </label>
      </div>
    </div>
  )
}
