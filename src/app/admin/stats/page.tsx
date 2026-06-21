'use client'

import { motion } from 'framer-motion'
import {
  TrendingUp, ShoppingBag, Users, Calendar, DollarSign,
  ArrowUpRight, ArrowDownRight, Package, Clock
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card, Badge } from '@/components/ui'
import { formatCurrency } from '@/utils'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

const STATS = [
  { label: 'Total Revenue', value: '$48,295', change: +12.5, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { label: 'Total Orders', value: '1,284', change: +8.2, icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { label: 'New Customers', value: '348', change: +15.3, icon: Users, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  { label: 'Reservations', value: '92', change: -3.1, icon: Calendar, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30' },
]

const RECENT_ORDERS = [
  { id: '#3901', customer: 'John Doe', items: 3, total: 67.45, status: 'preparing', time: '5m ago' },
  { id: '#3900', customer: 'Sarah Kim', items: 2, total: 32.90, status: 'delivered', time: '12m ago' },
  { id: '#3899', customer: 'Mike Chen', items: 5, total: 104.20, status: 'accepted', time: '18m ago' },
  { id: '#3898', customer: 'Emma Davis', items: 1, total: 18.99, status: 'ready', time: '25m ago' },
  { id: '#3897', customer: 'Alex Wilson', items: 4, total: 89.75, status: 'delivered', time: '34m ago' },
]

const STATUS_BADGE_MAP: Record<string, 'success' | 'warning' | 'info' | 'purple' | 'danger' | 'secondary'> = {
  delivered: 'success', pending: 'warning', accepted: 'info', preparing: 'purple', ready: 'success', cancelled: 'danger',
}

const TOP_ITEMS = [
  { name: 'Wagyu Smash Burger', orders: 284, revenue: 7098, trend: +18 },
  { name: 'Carbonara Autentica', orders: 231, revenue: 5079, trend: +12 },
  { name: 'Truffle Mushroom Pizza', orders: 198, revenue: 5741, trend: +7 },
  { name: 'Crème Brûlée', orders: 176, revenue: 2112, trend: +22 },
  { name: 'Mango Lassi', orders: 162, revenue: 1133, trend: -4 },
]

export default function AdminStatsPage() {
  return (
    <ErrorBoundary feature="AdminDashboard">
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">Admin Dashboard</h1>
                <Badge variant="default" className="text-xs">Preview UI</Badge>
              </div>
              <p className="text-[var(--fg-muted)]">Overview for the last 30 days</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {STATS.map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <Card>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <span className={`flex items-center gap-0.5 text-xs font-medium ${stat.change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {stat.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(stat.change)}%
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[var(--fg)] mb-1">{stat.value}</p>
                  <p className="text-sm text-[var(--fg-muted)]">{stat.label}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Orders */}
            <div className="lg:col-span-2">
              <Card padding="none">
                <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
                  <h2 className="font-semibold text-[var(--fg)]">Recent Orders</h2>
                  <Badge variant="secondary">{RECENT_ORDERS.length} live</Badge>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {RECENT_ORDERS.map((order, i) => (
                    <motion.div key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--card-hover)] transition-colors">
                      <div className="h-9 w-9 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--fg)]">{order.id} · {order.customer}</p>
                        <p className="text-xs text-[var(--fg-muted)]">{order.items} items · {order.time}</p>
                      </div>
                      <div className="text-end shrink-0">
                        <Badge variant={STATUS_BADGE_MAP[order.status] || 'secondary'} className="mb-1 capitalize text-xs">{order.status}</Badge>
                        <p className="text-sm font-semibold text-[var(--fg)]">{formatCurrency(order.total)}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Top Items */}
            <div>
              <Card padding="none">
                <div className="px-6 py-4 border-b border-[var(--border)]">
                  <h2 className="font-semibold text-[var(--fg)]">Top Selling Items</h2>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {TOP_ITEMS.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-3 px-5 py-3.5">
                      <span className="text-lg font-bold text-[var(--fg-subtle)] w-6 shrink-0">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--fg)] truncate">{item.name}</p>
                        <p className="text-xs text-[var(--fg-muted)]">{item.orders} orders · {formatCurrency(item.revenue)}</p>
                      </div>
                      <span className={`text-xs font-medium flex items-center gap-0.5 ${item.trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {item.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(item.trend)}%
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Quick Stats */}
              <Card className="mt-4">
                <h3 className="font-semibold text-[var(--fg)] mb-4">Today at a Glance</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Orders in Queue', value: '12', icon: Clock, color: 'text-amber-500' },
                    { label: 'Avg Prep Time', value: '18 min', icon: TrendingUp, color: 'text-blue-500' },
                    { label: 'Tables Reserved', value: '8 / 24', icon: Calendar, color: 'text-purple-500' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                        <Icon className={`h-4 w-4 ${color}`} />
                        {label}
                      </div>
                      <span className="text-sm font-semibold text-[var(--fg)]">{value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  )
}
