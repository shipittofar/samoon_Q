'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Package, RefreshCw, AlertCircle, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatRelativeTime } from '@/utils'
import { cn } from '@/utils'
import { useAdminOrders, useUpdateOrderStatus, useAdminBranches, useBulkUpdateOrderStatus, useBulkCancelOrders } from '@/hooks'
import { ADMIN_ORDERS_PAGE_SIZE } from '@/services/admin.service'
import { useConsoleWorkspace } from '@/hooks/console-workspace'
import { getNextOrderStatus, getOrderStatusMeta, ORDER_STATUS_CONFIG, resolveOrderStatus, translateOrderStatusLabel } from '@/lib/order-status'
import type { AdminOrdersScope, Order, OrderStatus, OrderType } from '@/types'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { BulkActionBar } from '@/components/admin/BulkActionBar'
import { PreviewButton } from '@/components/admin/PreviewButton'


const ORDER_TYPE_KEY: Record<OrderType, string> = {
  delivery: 'delivery',
  pickup: 'pickup',
  dine_in: 'dineIn',
}

function orderCustomerName(order: Order): string {
  if (order.user) return `${order.user.first_name} ${order.user.last_name}`.trim()
  return '—'
}

function orderItemNames(order: Order): string[] {
  return order.items.map((i) => i.quantity > 1 ? `${i.name} x${i.quantity}` : i.name)
}

export default function AdminOrdersPage() {
  const t = useTranslations('console')
  const tOrder = useTranslations('order')
  const tCheckout = useTranslations('checkout')
  const tCommon = useTranslations('common')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState<string>('all')
  const [allOrdersMode, setAllOrdersMode] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const {
    activeTenantId,
    selectedBranchId,
    tenantLoading,
    branchLoading,
  } = useConsoleWorkspace()
  const tenantId = activeTenantId ?? ''
  const ordersScope: AdminOrdersScope = allOrdersMode ? 'global' : 'scoped'
  const { data: branches = [] } = useAdminBranches(tenantId)

  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [ordersScope, activeTenantId, selectedBranchId, statusFilter, branchFilter, search])

  const filters = useMemo<Parameters<typeof useAdminOrders>[0]>(() => ({
    page,
    page_size: ADMIN_ORDERS_PAGE_SIZE,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(allOrdersMode && branchFilter !== 'all' ? { branch_id: branchFilter } : {}),
    ...(search ? { search } : {}),
  }), [page, statusFilter, branchFilter, search, allOrdersMode])

  const { data, isLoading, isError, refetch } = useAdminOrders(filters, { scope: ordersScope })
  const awaitingScope = !allOrdersMode && (!activeTenantId || !selectedBranchId)
  const showLoading = isLoading || awaitingScope || (!allOrdersMode && (tenantLoading || branchLoading))
  const updateStatus = useUpdateOrderStatus()
  const bulkUpdateStatus = useBulkUpdateOrderStatus()
  const bulkCancel = useBulkCancelOrders()

  const orders: Order[] = data?.results ?? []
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / ADMIN_ORDERS_PAGE_SIZE))
  const canGoPrevious = page > 1 && data?.previous != null
  const canGoNext = data?.next != null

  const statusCounts = useMemo(() => {
    const all = data?.results ?? []
    return (Object.keys(ORDER_STATUS_CONFIG) as OrderStatus[]).reduce<Record<string, number>>((acc, s) => {
      acc[s] = all.filter((o) => resolveOrderStatus(o.status) === s).length
      return acc
    }, {})
  }, [data])

  const advance = (order: Order) => {
    const next = getNextOrderStatus(order)
    if (!next) return
    updateStatus.mutate({ id: order.id, status: next, order })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds((prev) => prev.size === orders.length ? new Set() : new Set(orders.map((o) => o.id)))
  }

  const selectedArr = Array.from(selectedIds)

  return (
    <PermissionGuard permission="orders.view"fallback={<AccessDenied />}>
    <ErrorBoundary feature="AdminOrders">
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">{t('breadcrumbs.orders')}</h1>
                <Badge variant="default">{t('connectionLive')}</Badge>
              </div>
              <p className="text-[var(--fg-muted)] mt-1">{t('ordersPageSubtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              <div
                role="group"
                aria-label={t('ordersScopeToggleAria')}
                className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card-hover)] p-0.5"
              >
                <button
                  type="button"
                  aria-pressed={!allOrdersMode}
                  onClick={() => setAllOrdersMode(false)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    !allOrdersMode
                      ? 'bg-[var(--card)] text-[var(--fg)] shadow-sm'
                      : 'text-[var(--fg-muted)] hover:text-[var(--fg)]',
                  )}
                >
                  {t('ordersScopeBranch')}
                </button>
                <button
                  type="button"
                  aria-pressed={allOrdersMode}
                  onClick={() => setAllOrdersMode(true)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    allOrdersMode
                      ? 'bg-[var(--card)] text-[var(--fg)] shadow-sm'
                      : 'text-[var(--fg-muted)] hover:text-[var(--fg)]',
                  )}
                >
                  {t('ordersScopeAll')}
                </button>
              </div>
              <PreviewButton href="/menu"label={t('previewMenu')} size="sm"/>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RefreshCw className="h-3.5 w-3.5"/>}
                onClick={() => refetch()}
                disabled={showLoading}
              >
                {t('refresh')}
              </Button>
            </div>
          </div>

          {/* Status Summary — counts are page-local; backend does not expose aggregates */}
          <p className="text-xs text-[var(--fg-muted)] mb-2">{t('ordersStatusOnPage')}</p>
          <div className="grid grid-cols-3 sm:grid-cols-8 gap-3 mb-6">
            {(Object.entries(ORDER_STATUS_CONFIG) as [OrderStatus, typeof ORDER_STATUS_CONFIG[OrderStatus]][]).map(([status, cfg]) => (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all',
                  statusFilter === status
                    ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)]'
                    : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent-border)]/50',
                )}
              >
                <cfg.icon className={cn('h-4 w-4', cfg.color)} />
                <span className="text-xl font-semibold text-[var(--fg)]">{statusCounts[status] ?? 0}</span>
                <span className="text-[10px] text-[var(--fg-muted)]">{translateOrderStatusLabel(tOrder, cfg.labelKey)}</span>
              </button>
            ))}
          </div>

          {/* Search & Branch Filter */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"/>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchOrdersPlaceholder')}
                className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40 focus:border-[var(--focus-ring)]"
              />
            </div>
            {allOrdersMode && branches.length > 0 && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40"
                aria-label={t('filterByBranchAria')}
              >
                <option value="all">{t('allBranches')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Loading */}
          {showLoading && (
            <div className="flex items-center justify-center py-24 gap-3 text-[var(--fg-muted)]">
              <Loader2 className="h-5 w-5 animate-spin"/>
              <span className="text-sm">{t('loadingOrders')}</span>
            </div>
          )}

          {/* Error */}
          {isError && !showLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--fg-muted)]">
              <AlertCircle className="h-8 w-8 text-[var(--danger-text)]"/>
              <p className="text-sm">{t('failedToLoadOrders')}</p>
              <Button variant="secondary"size="sm"onClick={() => refetch()}>{tCommon('retry')}</Button>
            </div>
          )}

          {/* Orders Table */}
          {!showLoading && !isError && (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--card-hover)]">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          aria-label={t('selectAllOrdersAria')}
                          checked={orders.length > 0 && selectedIds.size === orders.length}
                          onChange={toggleSelectAll}
                          className="rounded border-[var(--border)]"
                        />
                      </th>
                      {['order', 'customer', 'items', 'type', 'total', 'status', 'time', 'actions'].map((h) => (
                        <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider whitespace-nowrap">{t(`tableHeaders.${h}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {orders.map((order, i) => {
                      const cfg = getOrderStatusMeta(order.status)
                      const nextStatus = getNextOrderStatus(order)
                      const isPending = updateStatus.isPending && updateStatus.variables?.id === order.id
                      return (
                        <motion.tr
                          key={order.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.04 }}
                          className={`hover:bg-[var(--card-hover)] transition-colors ${selectedIds.has(order.id) ? 'bg-[var(--accent-subtle)]/40' : ''}`}
                        >
                          <td className="px-4 py-3.5">
                            <input
                              type="checkbox"
                              aria-label={t('selectOrderAria', { number: order.order_number })}
                              checked={selectedIds.has(order.id)}
                              onChange={() => toggleSelect(order.id)}
                              className="rounded border-[var(--border)]"
                            />
                          </td>
                          <td className="px-4 py-3.5 font-mono font-semibold text-[var(--fg)]">{order.order_number}</td>
                          <td className="px-4 py-3.5">
                            <span className="font-medium text-[var(--fg)]">{orderCustomerName(order)}</span>
                          </td>
                          <td className="px-4 py-3.5 text-[var(--fg-muted)] max-w-40">
                            <span className="truncate block">{orderItemNames(order).join(', ')}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge variant="secondary"className="capitalize text-xs">
                              {order.order_type === 'dine_in' && order.table_number
                                ? t('tableNumberLabel', { number: order.table_number })
                                : tCheckout(ORDER_TYPE_KEY[order.order_type])}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-[var(--fg)] whitespace-nowrap">{formatCurrency(order.total)}</td>
                          <td className="px-4 py-3.5">
                            <Badge variant={cfg.badge} className="capitalize whitespace-nowrap">
                              <cfg.icon className="h-3 w-3 me-1"/>
                              {translateOrderStatusLabel(tOrder, cfg.labelKey)}
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
                                  ? <Loader2 className="h-3 w-3 animate-spin"/>
                                  : t('advanceToStatus', { status: translateOrderStatusLabel(tOrder, getOrderStatusMeta(nextStatus).labelKey) })}
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
                    <Package className="h-10 w-10 text-[var(--fg-subtle)] mx-auto mb-3"/>
                    <p className="text-[var(--fg-muted)]">{t('noOrdersMatchFilter')}</p>
                  </div>
                )}
              </div>
              {(data?.count ?? 0) > ADMIN_ORDERS_PAGE_SIZE && (
                <div className="border-t border-[var(--border)] px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-[var(--fg-muted)]">
                    {t('pageOfTotalCount', { page, totalPages, count: data?.count ?? 0 })}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => p - 1)}
                      disabled={!canGoPrevious}
                    >
                      {t('previousLabel')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!canGoNext}
                    >
                      {t('nextLabel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
      <BulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        actions={[
          {
            label: t('acceptSelected'),
            onClick: () => { bulkUpdateStatus.mutate({ ids: selectedArr, status: 'accepted' }); setSelectedIds(new Set()) },
            variant: 'primary',
            disabled: bulkUpdateStatus.isPending,
          },
          {
            label: t('cancelSelected'),
            onClick: () => { bulkCancel.mutate(selectedArr); setSelectedIds(new Set()) },
            variant: 'danger',
            disabled: bulkCancel.isPending,
          },
        ]}
      />
    </ErrorBoundary>
    </PermissionGuard>
  )
}
