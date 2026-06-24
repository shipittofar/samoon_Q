'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react'
import { useBranchStore } from '@/stores'
import { BranchContextIndicator } from '@/components/admin/RealtimeDashboardWidgets'
import {
  useAnalyticsSummary,
  useRevenueAnalytics,
  useReservationAnalytics,
  useLoyaltyAnalytics,
  usePromotionAnalytics,
  useVendorAnalytics,
  useMenuAnalytics,
  useAnalyticsComparison,
} from '@/hooks'
import { MiniBarChart } from '@/components/charts/MiniBarChart'
import { Sparkline } from '@/components/charts/Sparkline'
import { AnalyticsExport } from '@/components/admin/AnalyticsExport'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import type { AnalyticsSummary } from '@/types/analytics'

// ── Shared primitives ─────────────────────────────────────────────────────────

function Delta({ pct }: { pct: number }) {
  const up = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function KpiCard({
  label,
  value,
  changePct,
  expandable,
  expanded,
  onToggle,
}: {
  label: string
  value: string
  changePct?: number
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
}) {
  const inner = (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--card-hover)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[var(--fg-muted)]">{label}</p>
        {expandable && (
          expanded
            ? <ChevronUp className="h-4 w-4 text-[var(--fg-muted)] shrink-0" />
            : <ChevronDown className="h-4 w-4 text-[var(--fg-muted)] shrink-0" />
        )}
      </div>
      <p className="text-2xl font-bold text-[var(--fg)] mt-1">{value}</p>
      {changePct !== undefined && <Delta pct={changePct} />}
    </div>
  )
  if (!expandable) return inner
  return <button className="text-left w-full" onClick={onToggle}>{inner}</button>
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-lg font-semibold text-[var(--fg)] mb-4 mt-8 first:mt-0">{title}</h2>
}

function LoadingPlaceholder() {
  return <p className="text-sm text-[var(--fg-muted)]">Loading…</p>
}

function DrillDownPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 mt-3">
      {children}
    </div>
  )
}

// ── Revenue Section ───────────────────────────────────────────────────────────

function RevenueSection() {
  const { data, isLoading } = useRevenueAnalytics()
  const [expanded, setExpanded] = useState<'revenue' | 'orders' | null>(null)

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  return (
    <div className="space-y-3" aria-label="Revenue analytics">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Total Revenue" value={`$${data.totalRevenue.toLocaleString()}`}
          changePct={data.revenueChangePct} expandable expanded={expanded === 'revenue'}
          onToggle={() => setExpanded(expanded === 'revenue' ? null : 'revenue')}
        />
        <KpiCard
          label="Total Orders" value={data.totalOrders.toLocaleString()}
          expandable expanded={expanded === 'orders'}
          onToggle={() => setExpanded(expanded === 'orders' ? null : 'orders')}
        />
        <KpiCard label="Avg Order Value" value={`$${data.averageOrderValue.toFixed(2)}`} />
      </div>

      {expanded === 'revenue' && (
        <DrillDownPanel>
          <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">Daily Revenue (30 days)</p>
          <MiniBarChart data={data.dailyRevenue} height={56} aria-label="Daily revenue bar chart" />
        </DrillDownPanel>
      )}

      {expanded === 'orders' && (
        <DrillDownPanel>
          <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">Top Items by Orders</p>
          <ul className="space-y-2">
            {data.topItems.map((item) => (
              <li key={item.name} className="flex items-center justify-between text-sm">
                <span className="text-[var(--fg)]">{item.name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-[var(--fg-muted)]">{item.orderCount} orders</span>
                  <span className="font-medium text-[var(--fg)]">${item.revenue.toLocaleString()}</span>
                  <Delta pct={item.trendPct} />
                </div>
              </li>
            ))}
          </ul>
        </DrillDownPanel>
      )}
    </div>
  )
}

// ── Reservations Section ──────────────────────────────────────────────────────

function ReservationsSection() {
  const { data, isLoading } = useReservationAnalytics()
  const [expanded, setExpanded] = useState(false)

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  const statusBreakdown = [
    { label: 'Upcoming',  count: data.upcomingReservations,  color: 'bg-blue-400' },
    { label: 'Cancelled', count: data.cancelledReservations, color: 'bg-red-400'  },
    { label: 'Completed', count: data.totalReservations - data.upcomingReservations - data.cancelledReservations, color: 'bg-green-400' },
  ]

  return (
    <div className="space-y-3" aria-label="Reservation analytics">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Total Reservations" value={data.totalReservations.toLocaleString()}
          changePct={data.reservationsChangePct} expandable expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
        />
        <KpiCard label="Upcoming" value={data.upcomingReservations.toLocaleString()} />
        <KpiCard label="Cancelled" value={data.cancelledReservations.toLocaleString()} />
        <KpiCard label="Occupancy Rate" value={`${data.occupancyRate}%`} />
      </div>

      {expanded && (
        <DrillDownPanel>
          <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">Status Breakdown</p>
          <div className="space-y-2 mb-4">
            {statusBreakdown.map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-3 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${color}`} />
                <span className="flex-1 text-[var(--fg)]">{label}</span>
                <span className="font-medium text-[var(--fg)]">{count}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--fg-muted)] mb-1">
            Table Occupancy: {data.tablesOccupied}/{data.tablesTotal}
          </p>
          <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden mb-4">
            <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${data.occupancyRate}%` }} />
          </div>
          <p className="text-xs text-[var(--fg-muted)] mb-2">Daily Reservations (30 days)</p>
          <Sparkline data={data.dailyReservations} height={40} aria-label="Daily reservations sparkline" />
        </DrillDownPanel>
      )}
    </div>
  )
}

// ── Loyalty Section ───────────────────────────────────────────────────────────

function LoyaltySection() {
  const { data, isLoading } = useLoyaltyAnalytics()
  const [expanded, setExpanded] = useState(false)

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  return (
    <div className="space-y-3" aria-label="Loyalty analytics">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Members" value={data.totalMembers.toLocaleString()} />
        <KpiCard
          label="Active This Month" value={data.activeMembersThisMonth.toLocaleString()}
          expandable expanded={expanded} onToggle={() => setExpanded((v) => !v)}
        />
        <KpiCard label="Points Issued" value={data.pointsIssued.toLocaleString()} />
        <KpiCard label="Redemption Rate" value={`${data.redemptionRate.toFixed(1)}%`} />
      </div>

      {expanded && (
        <DrillDownPanel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">Tier Distribution</p>
              <ul className="space-y-2">
                {(Object.entries(data.tierDistribution) as [string, number][]).map(([tier, count]) => (
                  <li key={tier} className="flex justify-between text-sm capitalize">
                    <span className="text-[var(--fg)]">{tier}</span>
                    <span className="font-medium text-[var(--fg)]">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">Top Rewards</p>
              <ul className="space-y-2">
                {data.topRewards.map((r) => (
                  <li key={r.name} className="flex justify-between text-sm">
                    <span className="text-[var(--fg)]">{r.name}</span>
                    <span className="font-medium text-[var(--fg)]">{r.redemptions} redemptions</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </DrillDownPanel>
      )}
    </div>
  )
}

// ── Promotions Section ────────────────────────────────────────────────────────

function PromotionsSection() {
  const { data, isLoading } = usePromotionAnalytics()
  const [expanded, setExpanded] = useState(false)

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  return (
    <div className="space-y-3" aria-label="Promotion analytics">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Promotions" value={data.totalPromotions.toString()} />
        <KpiCard label="Active Promotions" value={data.activePromotions.toString()} />
        <KpiCard
          label="Total Discount Given" value={`$${data.totalDiscountGiven.toLocaleString()}`}
          changePct={data.discountChangePct} expandable expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
        />
      </div>

      {expanded && (
        <DrillDownPanel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">Usage by Type</p>
              <ul className="space-y-2">
                {(Object.entries(data.usageByType) as [string, number][]).map(([type, count]) => (
                  <li key={type} className="flex justify-between text-sm">
                    <span className="text-[var(--fg)] capitalize">{type.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-[var(--fg)]">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">Top Promotions</p>
              <ul className="space-y-2">
                {data.topPromotions.map((p) => (
                  <li key={p.name} className="flex justify-between text-sm">
                    <span className="text-[var(--fg)]">{p.name}</span>
                    <span className="font-medium text-[var(--fg)]">${p.discountGiven.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </DrillDownPanel>
      )}
    </div>
  )
}

// ── Vendors Section ───────────────────────────────────────────────────────────

function VendorsSection() {
  const { data, isLoading } = useVendorAnalytics()

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  return (
    <div className="space-y-4" aria-label="Vendor analytics">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Vendors" value={data.totalVendors.toString()} />
        <KpiCard label="Active Vendors" value={data.activeVendors.toString()} />
        <KpiCard label="Total Revenue" value={`$${data.totalRevenue.toLocaleString()}`} />
        <KpiCard label="Total Commission" value={`$${data.totalCommission.toLocaleString()}`} />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
              <th className="text-left px-4 py-2 text-[var(--fg-muted)] font-medium">Vendor</th>
              <th className="text-right px-4 py-2 text-[var(--fg-muted)] font-medium">Orders</th>
              <th className="text-right px-4 py-2 text-[var(--fg-muted)] font-medium">Revenue</th>
              <th className="text-right px-4 py-2 text-[var(--fg-muted)] font-medium">Commission</th>
              <th className="text-right px-4 py-2 text-[var(--fg-muted)] font-medium">Avg ★</th>
            </tr>
          </thead>
          <tbody>
            {data.vendors.map((v) => (
              <tr key={v.vendorId} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-2 text-[var(--fg)]">{v.name}</td>
                <td className="px-4 py-2 text-right text-[var(--fg)]">{v.ordersCount.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-[var(--fg)]">${v.revenue.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-[var(--fg)]">${v.commissionPaid.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-[var(--fg)]">{v.avgRating.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Menu Performance Section ──────────────────────────────────────────────────

function MenuSection() {
  const { data, isLoading } = useMenuAnalytics()
  const [tab, setTab] = useState<'top' | 'slow' | 'category'>('top')

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  return (
    <div className="space-y-4" aria-label="Menu performance analytics">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Total Items Sold" value={data.totalItemsSold.toLocaleString()} />
        <KpiCard label="Menu Revenue" value={`$${data.totalMenuRevenue.toLocaleString()}`} />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="flex border-b border-[var(--border)]">
          {(['top', 'slow', 'category'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'border-b-2 border-[var(--primary)] text-[var(--primary)]'
                  : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
              }`}
            >
              {t === 'top' ? 'Top Sellers' : t === 'slow' ? 'Slow Movers' : 'By Category'}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === 'top' && (
            <ul className="space-y-2">
              {data.topSellers.map((item) => (
                <li key={item.itemId} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-[var(--fg)] font-medium">{item.name}</span>
                    <span className="ml-2 text-xs text-[var(--fg-muted)]">{item.category}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[var(--fg-muted)]">{item.orderCount} orders</span>
                    <span className="font-medium text-[var(--fg)]">${item.revenue.toLocaleString()}</span>
                    <Delta pct={item.trendPct} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === 'slow' && (
            <ul className="space-y-2">
              {data.slowMovers.map((item) => (
                <li key={item.itemId} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-[var(--fg)] font-medium">{item.name}</span>
                    <span className="ml-2 text-xs text-[var(--fg-muted)]">{item.category}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[var(--fg-muted)]">{item.orderCount} orders</span>
                    <span className="font-medium text-[var(--fg)]">${item.revenue.toLocaleString()}</span>
                    <Delta pct={item.trendPct} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === 'category' && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 text-[var(--fg-muted)] font-medium">Category</th>
                  <th className="text-right py-2 text-[var(--fg-muted)] font-medium">Items</th>
                  <th className="text-right py-2 text-[var(--fg-muted)] font-medium">Orders</th>
                  <th className="text-right py-2 text-[var(--fg-muted)] font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.categoryPerformance.map((cat) => (
                  <tr key={cat.category} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 text-[var(--fg)]">{cat.category}</td>
                    <td className="py-2 text-right text-[var(--fg)]">{cat.itemCount}</td>
                    <td className="py-2 text-right text-[var(--fg)]">{cat.orderCount.toLocaleString()}</td>
                    <td className="py-2 text-right font-medium text-[var(--fg)]">${cat.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Comparison Section ────────────────────────────────────────────────────────

type ComparisonPeriodLabel = 'day' | 'week' | 'month' | 'quarter' | 'year'

const PERIOD_LABELS: Record<ComparisonPeriodLabel, string> = {
  day:     'Today vs Yesterday',
  week:    'This Week vs Last Week',
  month:   'This Month vs Last Month',
  quarter: 'This Quarter vs Last Quarter',
  year:    'This Year vs Last Year',
}

const COMPARISON_FIELDS: Array<{ key: keyof AnalyticsSummary; label: string; format: (v: number) => string }> = [
  { key: 'totalRevenue',      label: 'Revenue',        format: (v) => `$${v.toLocaleString()}` },
  { key: 'totalOrders',       label: 'Orders',         format: (v) => v.toLocaleString() },
  { key: 'totalReservations', label: 'Reservations',   format: (v) => v.toLocaleString() },
  { key: 'newCustomers',      label: 'New Customers',  format: (v) => v.toLocaleString() },
]

function ComparisonSection() {
  const [period, setPeriod] = useState<ComparisonPeriodLabel>('week')
  const { current, previous, isLoading } = useAnalyticsComparison(period)

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5" aria-label="Period comparison">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h3 className="text-sm font-semibold text-[var(--fg)]">Period Comparison</h3>
        <div className="flex gap-1 flex-wrap">
          {(Object.keys(PERIOD_LABELS) as ComparisonPeriodLabel[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingPlaceholder />
      ) : (
        <>
          <p className="text-xs text-[var(--fg-muted)] mb-3">{PERIOD_LABELS[period]}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COMPARISON_FIELDS.map(({ key, label, format }) => {
              const curr = current ? (current[key] as number | undefined) ?? 0 : null
              const prev = previous ? (previous[key] as number | undefined) ?? 0 : null
              const delta = curr !== null && prev !== null && prev !== 0
                ? ((curr - prev) / prev) * 100
                : null
              const isUp = delta !== null && delta >= 0
              return (
                <div key={String(key)} className="bg-[var(--bg)] rounded-lg p-3">
                  <p className="text-xs text-[var(--fg-muted)] mb-1">{label}</p>
                  <p className="text-lg font-bold text-[var(--fg)]">
                    {curr !== null ? format(curr) : '—'}
                  </p>
                  <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                    prev: {prev !== null ? format(prev) : '—'}
                  </p>
                  {delta !== null && (
                    <p className={`text-xs font-medium mt-1 ${isUp ? 'text-green-600' : 'text-red-500'}`}>
                      {isUp ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary()
  const activeBranch = useBranchStore((s) => s.activeBranch)

  return (
    <ErrorBoundary feature="Analytics">
    <PermissionGuard permission="analytics.view">
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--fg)]">Analytics</h1>
          <BranchContextIndicator branchId={activeBranch?.id} branchName={activeBranch?.name} />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {activeBranch && (
            <Link
              href={`/admin/branches/${activeBranch.id}/analytics`}
              className="text-sm text-blue-600 hover:underline"
            >
              View branch analytics →
            </Link>
          )}
          <AnalyticsExport />
        </div>
      </div>

      {/* Summary KPIs */}
      {summaryLoading ? (
        <LoadingPlaceholder />
      ) : summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <KpiCard label="Revenue" value={`$${summary.totalRevenue.toLocaleString()}`} changePct={summary.revenueChangePct} />
          <KpiCard label="Orders" value={summary.totalOrders.toLocaleString()} changePct={summary.ordersChangePct} />
          <KpiCard label="Reservations" value={summary.totalReservations.toLocaleString()} changePct={summary.reservationsChangePct} />
          <KpiCard label="New Customers" value={summary.newCustomers.toLocaleString()} changePct={summary.customersChangePct} />
          <KpiCard label="Active Vendors" value={summary.activeVendors.toString()} />
          <KpiCard label="Active Promotions" value={summary.activePromotions.toString()} />
        </div>
      )}

      <SectionHeader title="Period Comparison" />
      <ComparisonSection />

      <SectionHeader title="Revenue & Orders" />
      <RevenueSection />

      <SectionHeader title="Reservations" />
      <ReservationsSection />

      <SectionHeader title="Menu Performance" />
      <MenuSection />

      <SectionHeader title="Loyalty" />
      <LoyaltySection />

      <SectionHeader title="Promotions" />
      <PromotionsSection />

      <SectionHeader title="Vendors" />
      <VendorsSection />
    </main>
    </PermissionGuard>
    </ErrorBoundary>
  )
}
