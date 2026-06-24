'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Package, Clock, ChefHat, CheckCircle, Truck, XCircle, RefreshCw, AlertCircle, Loader2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatRelativeTime } from '@/utils'
import { cn } from '@/utils'
import { useAdminOrders, useUpdateOrderStatus, useAdminBranches } from '@/hooks'
import { useTenantStore } from '@/stores'
import type { Order, OrderStatus } from '@/types'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'


const STATUS_CONFIG: Record<OrderStatus, {
  label: string
  icon: React.ElementType
  color: string
  bg: string
  badge: 'warning' | 'info' | 'purple' | 'success' | 'danger' | 'secondary'
}> = {
  pending:   { label: 'Pending',   icon: Clock,        color: 'text-amber-500',   bg: 'bg-amber-50 dark:bg-amber-950/30',    badge: 'warning'   },
  accepted:  { label: 'Accepted',  icon: CheckCircle,  color: 'text-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/30',      badge: 'info'      },
  preparing: { label: 'Preparing', icon: ChefHat,      color: 'text-purple-500',  bg: 'bg-purple-50 dark:bg-purple-950/30',  badge: 'purple'    },
  ready:     { label: 'Ready',     icon: Package,      color: 'text-green-500',   bg: 'bg-green-50 dark:bg-green-950/30',    badge: 'success'   },
  delivered: { label: 'Delivered', icon: Truck,        color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', badge: 'success'  },
  cancelled: { label: 'Cancelled', icon: XCircle,      color: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-950/30',        badge: 'danger'    },
}

const STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'accepted', accepted: 'preparing', preparing: 'ready', ready: 'delivered',
}

function orderCustomerName(order: Order): string {
  if (order.user) return `${order.user.first_name} ${order.user.last_name}`.trim()
  return '—'
}

function orderItemNames(order: Order): string[] {
  return order.items.map((i) => i.quantity > 1 ? `${i.name} x${i.quantity}` : i.name)
}

export default function AdminOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const tenantId = useTenantStore((s) => s.tenant?.id ?? '')
  const { data: branches = [] } = useAdminBranches(tenantId)

  const filters = useMemo<Parameters<typeof useAdminOrders>[0]>(() => ({
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(branchFilter !== 'all' ? { branch_id: branchFilter } : {}),
    ...(search ? { search } : {}),
  }), [statusFilter, branchFilter, search])

  const { data, isLoading, isError, refetch } = useAdminOrders(filters)
  const updateStatus = useUpdateOrderStatus()

  const orders: Order[] = data?.results ?? []

  const statusCounts = useMemo(() => {
    const all = data?.results ?? []
    return (Object.keys(STATUS_CONFIG) as OrderStatus[]).reduce<Record<string, number>>((acc, s) => {
      acc[s] = all.filter((o) => o.status === s).length
      return acc
    }, {})
  }, [data])

  const advance = (order: Order) => {
    const next = STATUS_NEXT[order.status]
    if (!next) return
    updateStatus.mutate({ id: order.id, status: next })
  }

  return (
    <PermissionGuard permission="orders.view">
    <ErrorBoundary feature="AdminOrders">
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
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => refetch()}
            >
              Refresh
            </Button>
          </div>

          {/* Status Summary */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
            {(Object.entries(STATUS_CONFIG) as [OrderStatus, typeof STATUS_CONFIG[OrderStatus]][]).map(([status, cfg]) => (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all',
                  statusFilter === status
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                    : 'border-[var(--border)] bg-[var(--card)] hover:border-orange-200',
                )}
              >
                <cfg.icon className={cn('h-4 w-4', cfg.color)} />
                <span className="text-xs font-semibold text-[var(--fg)]">{statusCounts[status] ?? 0}</span>
                <span className="text-[10px] text-[var(--fg-muted)]">{cfg.label}</span>
              </button>
            ))}
          </div>

          {/* Search & Branch Filter */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by order # or customer name…"
                className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
              />
            </div>
            {branches.length > 0 && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                aria-label="Filter by branch"
              >
                <option value="all">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-24 gap-3 text-[var(--fg-muted)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading orders…</span>
            </div>
          )}

          {/* Error */}
          {isError && !isLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--fg-muted)]">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm">Failed to load orders.</p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          )}

          {/* Orders Table */}
          {!isLoading && !isError && (
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
                    {orders.map((order, i) => {
                      const cfg = STATUS_CONFIG[order.status]
                      const nextStatus = STATUS_NEXT[order.status]
                      const isPending = updateStatus.isPending && updateStatus.variables?.id === order.id
                      return (
                        <motion.tr
                          key={order.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.04 }}
                          className="hover:bg-[var(--card-hover)] transition-colors"
                        >
                          <td className="px-4 py-3.5 font-mono font-semibold text-[var(--fg)]">{order.order_number}</td>
                          <td className="px-4 py-3.5">
                            <span className="font-medium text-[var(--fg)]">{orderCustomerName(order)}</span>
                          </td>
                          <td className="px-4 py-3.5 text-[var(--fg-muted)] max-w-40">
                            <span className="truncate block">{orderItemNames(order).join(', ')}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge variant="secondary" className="capitalize text-xs">
                              {order.order_type === 'dine_in' && order.table_number
                                ? `Table ${order.table_number}`
                                : order.order_type.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-[var(--fg)] whitespace-nowrap">{formatCurrency(order.total)}</td>
                          <td className="px-4 py-3.5">
                            <Badge variant={cfg.badge} className="capitalize whitespace-nowrap">
                              <cfg.icon className="h-3 w-3 me-1" />
                              {cfg.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-[var(--fg-muted)] whitespace-nowrap">
                            {formatRelativeTime(order.created_at)}
                          </td>
                          <td className="px-4 py-3.5">
                            {nextStatus && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => advance(order)}
                                disabled={isPending}
                                className="whitespace-nowrap text-xs h-7"
                              >
                                {isPending
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : `→ ${STATUS_CONFIG[nextStatus]?.label}`}
                              </Button>
                            )}
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Empty */}
                {orders.length === 0 && (
                  <div className="py-16 text-center">
                    <Package className="h-10 w-10 text-[var(--fg-subtle)] mx-auto mb-3" />
                    <p className="text-[var(--fg-muted)]">No orders match your filter.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </ErrorBoundary>
    </PermissionGuard>
  )
}
