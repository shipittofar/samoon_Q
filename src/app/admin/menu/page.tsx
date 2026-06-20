'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Plus, Search, Edit2, Trash2, Eye, EyeOff, Star, Clock, Flame } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { MOCK_MENU_ITEMS, MOCK_CATEGORIES } from '@/lib/mock-data'
import { formatCurrency } from '@/utils'
import type { MenuItem } from '@/types'

export default function AdminMenuPage() {
  const [items, setItems] = useState<MenuItem[]>(MOCK_MENU_ITEMS)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const filtered = items.filter((item) => {
    const matchCat = categoryFilter === 'all' || item.category_id === categoryFilter
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const toggleAvailable = (id: string) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, available: !i.available } : i))
  }

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">Menu Management</h1>
                <Badge variant="secondary">{items.length} items</Badge>
              </div>
              <p className="text-[var(--fg-muted)] mt-1">Add, edit, and manage your menu offerings</p>
            </div>
            <Button leftIcon={<Plus className="h-4 w-4" />}>Add Item</Button>
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
              {MOCK_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all ${categoryFilter === cat.id ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-200'}`}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item, i) => (
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
                      onClick={() => toggleAvailable(item.id)}
                      className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all shadow ${item.available ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}
                      title={item.available ? 'Mark unavailable' : 'Mark available'}
                    >
                      {item.available ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
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
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => { setEditItem(item); setEditOpen(true) }}
                        aria-label="Edit item"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deleteItem(item.id)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        aria-label="Delete item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <span className="text-4xl block mb-4">🍽️</span>
              <p className="text-[var(--fg-muted)]">No items found.</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditItem(null) }}
        title={editItem ? `Edit: ${editItem.name}` : 'Edit Item'}
        size="lg"
      >
        {editItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Input label="Item Name" defaultValue={editItem.name} />
              </div>
              <Input label="Price" type="number" defaultValue={String(editItem.price)} leftIcon={<span className="text-xs">$</span>} />
              <Input label="Discount %" type="number" defaultValue={String(editItem.discount || 0)} />
              <Input label="Calories" type="number" defaultValue={String(editItem.calories || '')} />
              <Input label="Prep Time (min)" type="number" defaultValue={String(editItem.preparation_time)} />
            </div>
            <Textarea label="Description" defaultValue={editItem.description} rows={3} />
            <Input label="Image URL" defaultValue={editItem.image} />
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setEditOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={() => setEditOpen(false)} className="flex-1">Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
