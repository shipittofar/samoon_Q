'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Search, Users, Clock, Phone, Mail, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { MOCK_RESERVATIONS } from '@/lib/mock-data'
import { MOCK_BRANCHES } from '@/lib/mock-data'
import { formatDate } from '@/utils'
import type { Reservation } from '@/types'

const ALL_RESERVATIONS: Reservation[] = [
  ...MOCK_RESERVATIONS,
  { id: 'res-002', branch_id: '1', date: '2025-02-16', time: '20:00', guests: 2, name: 'Emma Wilson', phone: '+1987654321', email: 'emma@example.com', status: 'pending', created_at: new Date().toISOString() },
  { id: 'res-003', branch_id: '2', date: '2025-02-15', time: '19:00', guests: 6, name: 'Carlos Reyes', phone: '+1122334455', status: 'confirmed', confirmation_code: 'SAV-3291', notes: 'Birthday celebration', created_at: new Date().toISOString() },
  { id: 'res-004', branch_id: '1', date: '2025-02-15', time: '18:30', guests: 3, name: 'Sophie Kim', phone: '+1556677889', status: 'cancelled', created_at: new Date().toISOString() },
]

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'secondary'> = {
  confirmed: 'success', pending: 'warning', cancelled: 'danger', completed: 'secondary',
}

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState(ALL_RESERVATIONS)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentDate, setCurrentDate] = useState(new Date())

  const filtered = reservations.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.phone.includes(search)
    return matchStatus && matchSearch
  })

  const updateStatus = (id: string, status: Reservation['status']) => {
    setReservations((prev) => prev.map((r) => r.id === id ? { ...r, status } : r))
  }

  const todayStr = currentDate.toISOString().split('T')[0]
  const todayReservations = filtered.filter((r) => r.date === todayStr)

  const counts = { all: reservations.length, pending: reservations.filter((r) => r.status === 'pending').length, confirmed: reservations.filter((r) => r.status === 'confirmed').length, cancelled: reservations.filter((r) => r.status === 'cancelled').length }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">Reservations</h1>
              <p className="text-[var(--fg-muted)] mt-1">Manage table bookings across all branches</p>
            </div>
            {/* Date navigator */}
            <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-xl p-1">
              <Button variant="ghost" size="icon-sm" onClick={() => setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-[var(--fg)] px-3">{formatDate(currentDate.toISOString())}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total', value: counts.all, color: 'text-[var(--fg)]', bg: 'bg-[var(--card-hover)]' },
              { label: 'Pending', value: counts.pending, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20' },
              { label: 'Confirmed', value: counts.confirmed, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
              { label: 'Cancelled', value: counts.cancelled, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/20' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-4 border border-[var(--border)]`}>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-sm text-[var(--fg-muted)]">{label}</p>
              </div>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone…" className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
            </div>
            <div className="flex gap-2">
              {['all', 'pending', 'confirmed', 'cancelled'].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all capitalize ${statusFilter === s ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-200'}`}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--card-hover)]">
                    {['Guest', 'Date & Time', 'Guests', 'Branch', 'Contact', 'Notes', 'Status', 'Actions'].map((h) => (
                      <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filtered.map((res, i) => {
                    const branch = MOCK_BRANCHES.find((b) => b.id === res.branch_id)
                    return (
                      <motion.tr key={res.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="hover:bg-[var(--card-hover)] transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-[var(--fg)]">{res.name}</p>
                          {res.confirmation_code && <p className="text-xs text-orange-500 font-mono">{res.confirmation_code}</p>}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-[var(--fg)]">
                            <Calendar className="h-3.5 w-3.5 text-orange-500" />
                            {res.date}
                          </div>
                          <div className="flex items-center gap-1.5 text-[var(--fg-muted)] mt-0.5">
                            <Clock className="h-3.5 w-3.5" />
                            {res.time}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-[var(--fg)]">
                            <Users className="h-3.5 w-3.5 text-orange-500" />
                            {res.guests}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-[var(--fg-muted)] whitespace-nowrap">{branch?.name || '—'}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)]">
                            <Phone className="h-3 w-3" />{res.phone}
                          </div>
                          {res.email && (
                            <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)] mt-0.5">
                              <Mail className="h-3 w-3" />{res.email}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-[var(--fg-muted)] max-w-32">
                          <span className="truncate block italic">{res.notes || '—'}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={STATUS_BADGE[res.status] || 'secondary'} className="capitalize">{res.status}</Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          {res.status === 'pending' && (
                            <div className="flex gap-1">
                              <Button size="icon-sm" onClick={() => updateStatus(res.id, 'confirmed')} className="bg-emerald-500 hover:bg-emerald-600" aria-label="Confirm">
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon-sm" variant="destructive" onClick={() => updateStatus(res.id, 'cancelled')} aria-label="Cancel">
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-16 text-center">
                  <Calendar className="h-10 w-10 text-[var(--fg-subtle)] mx-auto mb-3" />
                  <p className="text-[var(--fg-muted)]">No reservations found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
