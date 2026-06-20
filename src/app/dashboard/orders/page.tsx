'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Package, ArrowRight, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'
import { Badge, Skeleton } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { useOrders } from '@/hooks'
import { formatCurrency, formatDate, formatRelativeTime } from '@/utils'

const STATUS_BADGE_MAP: Record<string, 'success' | 'warning' | 'info' | 'purple' | 'danger' | 'secondary'> = {
  delivered: 'success', pending: 'warning', accepted: 'info',
  preparing: 'purple', ready: 'success', cancelled: 'danger',
}

export default function OrdersPage() {
  const { data, isLoading, refetch } = useOrders()
  const [search, setSearch] = useState('')
  const orders = (data?.results || []).filter((o) =>
    !search || o.order_number?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">My Orders</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">{data?.count || 0} total orders</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order number…"
          className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 flex gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/4" /></div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-12 text-center">
          <Package className="h-12 w-12 text-[var(--fg-subtle)] mx-auto mb-4" />
          <h3 className="font-semibold text-[var(--fg)] mb-2">No orders yet</h3>
          <p className="text-sm text-[var(--fg-muted)] mb-4">Start ordering from our menu!</p>
          <Link href="/menu"><Button>Browse Menu</Button></Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/order/${order.id}`} className="block bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 hover:border-orange-200 dark:hover:border-orange-900 hover:shadow-md transition-all group">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center shrink-0">
                    <Package className="h-6 w-6 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-[var(--fg)]">{order.order_number}</p>
                      <Badge variant={STATUS_BADGE_MAP[order.status] || 'secondary'} className="capitalize text-xs">
                        {order.status?.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-[var(--fg-muted)]">
                      {formatDate(order.created_at)} · {order.order_type?.replace('_', ' ')} · {formatCurrency(order.total)}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[var(--fg-subtle)] group-hover:text-orange-500 transition-colors shrink-0" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
