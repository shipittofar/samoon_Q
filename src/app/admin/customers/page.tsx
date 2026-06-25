'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Search, Users, Mail, Phone, ShoppingBag, Star, TrendingUp, Loader2, AlertCircle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui'
import { Avatar } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/utils'
import { useAdminCustomers, useBulkExportCustomers } from '@/hooks'
import type { AdminCustomerFilters, AdminCustomerTier } from '@/types'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { BulkActionBar } from '@/components/admin/BulkActionBar'


const TIER_BADGE: Record<AdminCustomerTier, 'default' | 'success' | 'info' | 'secondary'> = {
  vip: 'default', regular: 'success', new: 'info',
}

const TIERS: Array<AdminCustomerTier | 'all'> = ['all', 'vip', 'regular', 'new']

export default function AdminCustomersPage() {
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<AdminCustomerTier | 'all'>('all')

  const filters = useMemo<AdminCustomerFilters>(() => ({
    ...(tierFilter !== 'all' ? { tier: tierFilter } : {}),
    ...(search ? { search } : {}),
  }), [tierFilter, search])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const { data, isLoading, isError, refetch } = useAdminCustomers(filters)
  const bulkExport = useBulkExportCustomers()

  const customers = data?.results ?? []

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds((prev) => prev.size === customers.length ? new Set() : new Set(customers.map((c) => c.id)))
  }

  const selectedArr = Array.from(selectedIds)

  const stats = useMemo(() => {
    const totalRevenue = customers.reduce((s, c) => s + c.total_spent, 0)
    const totalOrders = customers.reduce((s, c) => s + c.order_count, 0)
    return {
      total: data?.count ?? customers.length,
      vipCount: customers.filter((c) => c.tier === 'vip').length,
      totalRevenue,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    }
  }, [customers, data?.count])

  return (

    <PermissionGuard permission="customers.view" fallback={<AccessDenied />}>
    <ErrorBoundary feature="AdminCustomers">
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
              { label: 'Total Customers', value: isLoading ? '—' : stats.total, icon: Users,       color: 'text-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/30' },
              { label: 'VIP Members',     value: isLoading ? '—' : stats.vipCount,  icon: Star,        color: 'text-orange-500',  bg: 'bg-orange-50 dark:bg-orange-950/30' },
              { label: 'Total Revenue',   value: isLoading ? '—' : formatCurrency(stats.totalRevenue), icon: TrendingUp,  color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
              { label: 'Avg Order Value', value: isLoading ? '—' : formatCurrency(stats.avgOrderValue), icon: ShoppingBag, color: 'text-purple-500',  bg: 'bg-purple-50 dark:bg-purple-950/30' },
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
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customers…"
                className="w-full h-10 ps-9 pe-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
            <div className="flex gap-2">
              {TIERS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all capitalize ${tierFilter === t ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-orange-200'}`}
                >
                  {t === 'all' ? 'All' : t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-24 gap-3 text-[var(--fg-muted)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading customers…</span>
            </div>
          )}

          {/* Error */}
          {isError && !isLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-[var(--fg-muted)]">Failed to load customers.</p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          )}

          {/* Table */}
          {!isLoading && !isError && (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--card-hover)]">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          aria-label="Select all customers"
                          checked={customers.length > 0 && selectedIds.size === customers.length}
                          onChange={toggleSelectAll}
                          className="rounded border-[var(--border)]"
                        />
                      </th>
                      {['Customer', 'Contact', 'Orders', 'Total Spent', 'Avg Order', 'Joined', 'Tier'].map((h) => (
                        <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {customers.map((c, i) => (
                      <motion.tr
                        key={c.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className={`hover:bg-[var(--card-hover)] transition-colors ${selectedIds.has(c.id) ? 'bg-orange-50/40 dark:bg-orange-950/10' : ''}`}
                      >
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            aria-label={`Select ${c.first_name} ${c.last_name}`}
                            checked={selectedIds.has(c.id)}
                            onChange={() => toggleSelect(c.id)}
                            className="rounded border-[var(--border)]"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-3 group">
                            <Avatar firstName={c.first_name} lastName={c.last_name} size="sm" />
                            <span className="font-medium text-[var(--fg)] group-hover:text-blue-600 transition-colors">{c.first_name} {c.last_name}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)]"><Mail className="h-3 w-3" />{c.email}</div>
                          {c.phone && <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)] mt-0.5"><Phone className="h-3 w-3" />{c.phone}</div>}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-[var(--fg)]">{c.order_count}</td>
                        <td className="px-4 py-3.5 font-semibold text-[var(--fg)]">{formatCurrency(c.total_spent)}</td>
                        <td className="px-4 py-3.5 text-[var(--fg-muted)]">{formatCurrency(c.avg_order_value)}</td>
                        <td className="px-4 py-3.5 text-[var(--fg-muted)]">{formatDate(c.created_at)}</td>
                        <td className="px-4 py-3.5">
                          <Badge variant={TIER_BADGE[c.tier] || 'secondary'} className="uppercase text-xs">{c.tier}</Badge>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>

                {/* Empty */}
                {customers.length === 0 && (
                  <div className="py-16 text-center">
                    <Users className="h-10 w-10 text-[var(--fg-subtle)] mx-auto mb-3" />
                    <p className="text-[var(--fg-muted)]">No customers found.</p>
                  </div>
                )}
              </div>
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
            label: 'Export Selected',
            onClick: () => { bulkExport.mutate(selectedArr); setSelectedIds(new Set()) },
            variant: 'primary',
            disabled: bulkExport.isPending,
          },
        ]}
      />
    </ErrorBoundary>

    </PermissionGuard>

  )
}
