'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Search, Users, Mail, Phone, ShoppingBag, Star, TrendingUp, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Avatar, PaginationControls } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { formatDate, cn } from '@/utils'
import { getTotalPages } from '@/utils/pagination'
import { useAdminCustomers, useBulkExportCustomers } from '@/hooks'
import { useConsoleWorkspace } from '@/hooks/console-workspace'
import { ADMIN_CUSTOMERS_PAGE_SIZE } from '@/services/admin.service'
import type { AdminCustomerFilters, AdminCustomerTier, AdminOrdersScope, ConsoleCustomer } from '@/types'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { BulkActionBar } from '@/components/admin/BulkActionBar'

const TIER_KEY: Record<AdminCustomerTier, string> = {
  vip: 'tierVip', regular: 'tierRegular', new: 'tierNew',
}

const TIERS: Array<AdminCustomerTier | 'all'> = ['all', 'vip', 'regular', 'new']

function customerRowId(customer: ConsoleCustomer): string {
  return String(customer.id)
}

export default function AdminCustomersPage() {
  const t = useTranslations('console')
  const tCommon = useTranslations('common')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<AdminCustomerTier | 'all'>('all')
  const [allCustomersMode, setAllCustomersMode] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const {
    activeTenantId,
    selectedBranchId,
    tenantLoading,
    branchLoading,
  } = useConsoleWorkspace()
  const customersScope: AdminOrdersScope = allCustomersMode ? 'global' : 'scoped'

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [customersScope, activeTenantId, selectedBranchId, debouncedSearch])

  const filters = useMemo<AdminCustomerFilters>(() => ({
    page,
    page_size: ADMIN_CUSTOMERS_PAGE_SIZE,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  }), [page, debouncedSearch])

  const { data, isLoading, isError, refetch } = useAdminCustomers(filters, { scope: customersScope })
  const bulkExport = useBulkExportCustomers()

  const awaitingScope = !allCustomersMode && (!activeTenantId || !selectedBranchId)
  const showLoading = isLoading || awaitingScope || (!allCustomersMode && (tenantLoading || branchLoading))

  const customers = data?.results ?? []
  const totalCount = data?.count ?? 0

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === customers.length ? new Set() : new Set(customers.map(customerRowId)),
    )
  }

  const selectedRows = customers.filter((c) => selectedIds.has(customerRowId(c)))

  return (

    <PermissionGuard permission="customers.view"fallback={<AccessDenied />}>
    <ErrorBoundary feature="AdminCustomers">
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex items-center justify-between gap-4">
            <div>
              <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('breadcrumbs.customers')}</h1>
              <p className="text-sm text-[var(--fg-muted)] mt-0.5">{t('customersPageSubtitle')}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label={t('customersScopeToggleAria')}
              className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--card-hover)] p-0.5"
            >
              <button
                type="button"
                aria-pressed={!allCustomersMode}
                onClick={() => setAllCustomersMode(false)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  !allCustomersMode
                    ? 'bg-[var(--card)] text-[var(--fg)] shadow-sm'
                    : 'text-[var(--fg-muted)] hover:text-[var(--fg)]',
                )}
              >
                {t('ordersScopeBranch')}
              </button>
              <button
                type="button"
                aria-pressed={allCustomersMode}
                onClick={() => setAllCustomersMode(true)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  allCustomersMode
                    ? 'bg-[var(--card)] text-[var(--fg)] shadow-sm'
                    : 'text-[var(--fg-muted)] hover:text-[var(--fg)]',
                )}
              >
                {t('allBranches')}
              </button>
            </div>
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

          {/* Stats — total uses paginated `count`; VIP/revenue/AOV have no list-API source */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[
              {
                label: t('totalCustomers'),
                value: showLoading ? '—' : String(totalCount),
                icon: Users,
                color: 'text-[var(--info-text)]',
                bg: 'bg-[var(--info-subtle)]',
              },
              {
                label: t('vipMembers'),
                value: '—',
                title: t('customerStatUnavailable'),
                icon: Star,
                color: 'text-[var(--accent-text)]',
                bg: 'bg-[var(--accent-subtle)]',
              },
              {
                label: t('totalRevenue'),
                value: '—',
                title: t('customerStatUnavailable'),
                icon: TrendingUp,
                color: 'text-[var(--success-text)]',
                bg: 'bg-[var(--success-subtle)]',
              },
              {
                label: t('avgOrderValue'),
                value: '—',
                title: t('customerStatUnavailable'),
                icon: ShoppingBag,
                color: 'text-[var(--chart-5)]',
                bg: 'bg-[var(--chart-5)]/10',
              },
            ].map(({ label, value, icon: Icon, color, bg, title }) => (
              <div key={label} className="bg-[var(--card)] border border-[var(--border)] rounded-xl px-3 py-2.5" title={title}>
                <div className="flex items-center gap-2">
                  <div className={`inline-flex h-7 w-7 rounded-lg ${bg} items-center justify-center shrink-0`}>
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-[var(--fg)] leading-tight">{value}</p>
                    <p className="text-[11px] text-[var(--fg-muted)] leading-tight truncate">{label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex gap-2 mb-4 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--fg-muted)]"/>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchCustomersPlaceholder')}
                className="w-full h-9 ps-9 pe-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/40"
              />
            </div>
            <div className="flex gap-1.5">
              {TIERS.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTierFilter(tf)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all capitalize ${tierFilter === tf ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent-text)]' : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--accent-border)]/50'}`}
                >
                  {tf === 'all' ? t('allTiers') : t(TIER_KEY[tf]).toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {tierFilter !== 'all' && (
            <p className="text-xs text-[var(--fg-muted)] mb-3 -mt-2">{t('tierFilterUnavailable')}</p>
          )}

          {/* Loading */}
          {showLoading && (
            <div className="flex items-center justify-center py-24 gap-3 text-[var(--fg-muted)]">
              <Loader2 className="h-5 w-5 animate-spin"/>
              <span className="text-sm">{t('loadingCustomers')}</span>
            </div>
          )}

          {/* Error */}
          {isError && !showLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <AlertCircle className="h-8 w-8 text-[var(--danger-text)]"/>
              <p className="text-sm text-[var(--fg-muted)]">{t('failedToLoadCustomers')}</p>
              <Button variant="secondary"size="sm"onClick={() => refetch()}>{tCommon('retry')}</Button>
            </div>
          )}

          {/* Table */}
          {!showLoading && !isError && (
            <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--card-hover)]">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          aria-label={t('selectAllCustomersAria')}
                          checked={customers.length > 0 && selectedIds.size === customers.length}
                          onChange={toggleSelectAll}
                          className="rounded border-[var(--border)]"
                        />
                      </th>
                      {['customer', 'contact', 'orders', 'reservations', 'lastActivity'].map((h) => (
                        <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider whitespace-nowrap">{t(`customerTableHeaders.${h}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {customers.map((c, i) => {
                      const rowId = customerRowId(c)
                      return (
                      <motion.tr
                        key={rowId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className={`hover:bg-[var(--card-hover)] transition-colors ${selectedIds.has(rowId) ? 'bg-[var(--accent-subtle)]/40' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label={t('selectCustomerAria', { name: `${c.first_name} ${c.last_name}` })}
                            checked={selectedIds.has(rowId)}
                            onChange={() => toggleSelect(rowId)}
                            className="rounded border-[var(--border)]"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/console/customers/${rowId}`} className="flex items-center gap-3 group">
                            <Avatar firstName={c.first_name} lastName={c.last_name} size="sm"/>
                            <span className="font-medium text-[var(--fg)] group-hover:text-[var(--info-text)] transition-colors">{c.first_name} {c.last_name}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)]"><Mail className="h-3 w-3"/>{c.email || '—'}</div>
                          {c.phone_number && <div className="flex items-center gap-1 text-xs text-[var(--fg-muted)] mt-0.5"><Phone className="h-3 w-3"/>{c.phone_number}</div>}
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--fg)]">{c.orders_count}</td>
                        <td className="px-4 py-3 font-medium text-[var(--fg)]">{c.reservations_count}</td>
                        <td className="px-4 py-3 text-[var(--fg-muted)]">{c.last_activity_at ? formatDate(c.last_activity_at) : '—'}</td>
                      </motion.tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Empty */}
                {customers.length === 0 && (
                  <div className="py-16 text-center">
                    <Users className="h-10 w-10 text-[var(--fg-subtle)] mx-auto mb-3"/>
                    <p className="text-[var(--fg-muted)]">{t('noCustomersFound')}</p>
                  </div>
                )}
              </div>
              <PaginationControls
                page={page}
                pageSize={ADMIN_CUSTOMERS_PAGE_SIZE}
                count={totalCount}
                next={data?.next}
                previous={data?.previous}
                onPageChange={setPage}
                previousLabel={t('previousLabel')}
                nextLabel={t('nextLabel')}
                pageOfLabel={t('pageOfTotalCount', {
                  page,
                  totalPages: getTotalPages(totalCount, ADMIN_CUSTOMERS_PAGE_SIZE),
                  count: totalCount,
                })}
              />
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
            label: t('exportSelected'),
            onClick: () => {
              if (selectedRows.length === 0) return
              bulkExport.mutate(selectedRows)
              setSelectedIds(new Set())
            },
            variant: 'primary',
            disabled: bulkExport.isPending || selectedRows.length === 0,
          },
        ]}
      />
    </ErrorBoundary>

    </PermissionGuard>

  )
}
