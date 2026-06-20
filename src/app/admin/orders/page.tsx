'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, Package, Clock, ChefHat, CheckCircle, Truck, XCircle, RefreshCw } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatRelativeTime } from '@/utils'
import { cn } from '@/utils'

const MOCK_LIVE_ORDERS = [
  { id: 'ord-001', number: '#3902', customer: 'Alice Johnson', items: ['Wagyu Smash', 'Cold Brew x2'], total: 38.97, type: 'delivery', status: 'preparing', time: '2m ago', address: '42 Park Ave' },
  { id: 'ord-002', number: '#3901', customer: 'Bob Chen', items: ['Carbonara', 'Tiramisu'], total: 33.98, type: 'dine_in', status: 'accepted', time: '5m ago', table: 7 },
  { id: 'ord-003', number: '#3900', customer: 'Carol Davis', items: ['Margherita', 'Mango Lassi x2'], total: 31.97, type: 'pickup', status: 'ready', time: '8m ago' },
  { id: 'ord-004', number: '#3899', customer: 'Dan Wilson', items: ['Diavola', 'Crème Brûlée'], total: 34.98, type: 'delivery', status: 'pending', time: '12m ago', address: '88 Lexington' },
  { id: 'ord-005', number: '#3898', customer: 'Eva Martinez', items: ['Truffle Pizza', 'Lobster Linguine'], total: 67.98, type: 'dine_in', status: 'delivered', time: '20m ago', table: 12 },
]

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   icon: Clock,        color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-950/30',   badge: 'warning' as const },
  accepted:  { label: 'Accepted',  icon: CheckCircle,  color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-950/30',     badge: 'info' as const },
  preparing: { label: 'Preparing', icon: ChefHat,      color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30', badge: 'purple' as const },
  ready:     { label: 'Ready',     icon: Package,      color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-950/30',   badge: 'success' as const },
  delivered: { label: 'Delivered', icon: Truck,        color: 'text-emerald-500',bg: 'bg-emerald-50 dark:bg-emerald-950/30', badge: 'success' as const },
  cancelled: { label: 'Cancelled', icon: XCircle,      color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-950/30',       badge: 'danger' as const },
}

const STATUS_NEXT: Record<string, string> = {
  pending: 'accepted', accepted: 'preparing', preparing: 'ready', ready: 'delivered',
}

type OrderStatus = keyof typeof STATUS_CONFIG

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState(MOCK_LIVE_ORDERS)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const filtered = orders.filter((o) => {
    const matchStatus = filter === 'all' || o.status === filter
    const matchSearch = !search || o.number.includes(search) || o.customer.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const advance = (id: string) => {
    setOrders((prev) => prev.map((o) => {
      if (o.id !== id) return o
      const next = STATUS_NEXT[o.status]
      return next ? { ...o, status: next } : o
    }))
  }

  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">Orders</h1>
                <Badge variant="default">Live</Badge>
              </div>
              <p className="text-[var(--fg-muted)] mt-1">Manage and update incoming orders in real-time</p>
            </div>
            <Button variant="secondary" size="sm" leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
          </div>

          {/* Status Summary */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
              <button
                key={status}
                onClick={() => setFilter(filter === status ? 'all' : status)}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all',
                  filter === status ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : 'border-[var(--border)] bg-[var(--card)] hover:border-orange-200',
                )}
              >
                <cfg.icon className={cn('h-4 w-4', cfg.color)} />
                <span className="text-xs font-semibold text-[var(--fg)]">{statusCounts[status] || 0}</span>
                <span className="text-[10px] text-[var(--fg-muted)]">{cfg.label}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order # or customer name…"
              className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
            />
          </div>

          {/* Orders Table */}
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--card-hover)]">
                    {['Order', 'Customer', 'Items', 'Type', 'Total', 'Status', 'Time', 'Actions'].map((h) => (
                      <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filtered.map((order, i) => {
                    const cfg = STATUS_CONFIG[order.status as OrderStatus]
                    const nextStatus = STATUS_NEXT[order.status]
                    return (
                      <motion.tr
                        key={order.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.04 }}
                        className="hover:bg-[var(--card-hover)] transition-colors"
                      >
                        <td className="px-4 py-3.5 font-mono font-semibold text-[var(--fg)]">{order.number}</td>
                        <td className="px-4 py-3.5">
                          <span className="font-medium text-[var(--fg)]">{order.customer}</span>
                        </td>
                        <td className="px-4 py-3.5 text-[var(--fg-muted)] max-w-40">
                          <span className="truncate block">{order.items.join(', ')}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant="secondary" className="capitalize text-xs">
                            {order.type === 'dine_in' ? `Table ${order.table}` : order.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-[var(--fg)] whitespace-nowrap">{formatCurrency(order.total)}</td>
                        <td className="px-4 py-3.5">
                          <Badge variant={cfg.badge} className="capitalize whitespace-nowrap">
                            <cfg.icon className="h-3 w-3 me-1" />
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-[var(--fg-muted)] whitespace-nowrap">{order.time}</td>
                        <td className="px-4 py-3.5">
                          {nextStatus && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => advance(order.id)}
                              className="whitespace-nowrap text-xs h-7"
                            >
                              → {STATUS_CONFIG[nextStatus as OrderStatus]?.label}
                            </Button>
                          )}
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-16 text-center">
                  <Package className="h-10 w-10 text-[var(--fg-subtle)] mx-auto mb-3" />
                  <p className="text-[var(--fg-muted)]">No orders match your filter.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
