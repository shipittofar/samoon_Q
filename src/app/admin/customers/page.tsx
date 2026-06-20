'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Users, Mail, Phone, ShoppingBag, Star, TrendingUp } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui'
import { Avatar } from '@/components/ui'
import { formatCurrency, formatDate } from '@/utils'

const MOCK_CUSTOMERS = [
  { id: '1', first_name: 'Alice', last_name: 'Johnson', email: 'alice@example.com', phone: '+1234567890', orders: 14, spent: 420.50, rating: 4.9, joined: '2024-01-15', status: 'vip' },
  { id: '2', first_name: 'Bob', last_name: 'Chen', email: 'bob@example.com', phone: '+0987654321', orders: 8, spent: 210.75, rating: 4.7, joined: '2024-02-20', status: 'regular' },
  { id: '3', first_name: 'Carol', last_name: 'Davis', email: 'carol@example.com', phone: '+1122334455', orders: 22, spent: 680.00, rating: 5.0, joined: '2023-11-05', status: 'vip' },
  { id: '4', first_name: 'Dan', last_name: 'Wilson', email: 'dan@example.com', phone: '+5544332211', orders: 3, spent: 67.20, rating: 4.2, joined: '2024-03-10', status: 'new' },
  { id: '5', first_name: 'Eva', last_name: 'Martinez', email: 'eva@example.com', phone: '+6677889900', orders: 17, spent: 530.40, rating: 4.8, joined: '2023-12-01', status: 'vip' },
]

const STATUS_BADGE: Record<string, 'default' | 'success' | 'info' | 'secondary'> = {
  vip: 'default', regular: 'success', new: 'info',
}

export default function AdminCustomersPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = MOCK_CUSTOMERS.filter((c) => {
    const matchFilter = filter === 'all' || c.status === filter
    const q = search.toLowerCase()
    const matchSearch = !search || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || c.email.includes(q)
    return matchFilter && matchSearch
  })

  const totalRevenue = MOCK_CUSTOMERS.reduce((s, c) => s + c.spent, 0)
  const avgOrderValue = totalRevenue / MOCK_CUSTOMERS.reduce((s, c) => s + c.orders, 0)

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">Customers</h1>
            <p className="text-[var(--fg-muted)] mt-1">Manage your customer base and loyalty</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Customers', value: MOCK_CUSTOMERS.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
              { label: 'VIP Members', value: MOCK_CUSTOMERS.filter((c) => c.status === 'vip').length, icon: Star, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30' },
              { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
              { label: 'Avg Order Value', value: formatCurrency(avgOrderValue), icon: ShoppingBag, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4">
                <div className={`inline-flex h-9 w-9 rounded-xl ${bg} items-center justify-center mb-3`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className="text-xl font-bold text-[var(--fg)]">{value}</p>
                <p className="text-xs text-[var(--fg-muted)] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers…" className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
            </div>
            <div className="flex gap-2">
              {['all', 'vip', 'regular', 'new'].map((s) => (
                <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all capitalize ${filter === s ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-200'}`}>{s === 'all' ? 'All' : s.toUpperCase()}</button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--card-hover)]">
                    {['Customer', 'Contact', 'Orders', 'Total Spent', 'Rating', 'Joined', 'Status'].map((h) => (
                      <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filtered.map((c, i) => (
                    <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="hover:bg-[var(--card-hover)] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar firstName={c.first_name} lastName={c.last_name} size="sm" />
                          <span className="font-medium text-[var(--fg)]">{c.first_name} {c.last_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)]"><Mail className="h-3 w-3" />{c.email}</div>
                        <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)] mt-0.5"><Phone className="h-3 w-3" />{c.phone}</div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-[var(--fg)]">{c.orders}</td>
                      <td className="px-4 py-3.5 font-semibold text-[var(--fg)]">{formatCurrency(c.spent)}</td>
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-1 text-amber-500 font-medium">
                          <Star className="h-3.5 w-3.5 fill-amber-400" />{c.rating}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[var(--fg-muted)]">{formatDate(c.joined)}</td>
                      <td className="px-4 py-3.5">
                        <Badge variant={STATUS_BADGE[c.status] || 'secondary'} className="uppercase text-xs">{c.status}</Badge>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
