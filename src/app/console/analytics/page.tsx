'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react'
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
  useSelectedBranch,
  useBranchState,
} from '@/hooks'
import { MiniBarChart } from '@/components/charts/MiniBarChart'
import { Sparkline } from '@/components/charts/Sparkline'
import { AnalyticsExport } from '@/components/admin/AnalyticsExport'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import type { AnalyticsSummary } from '@/types/analytics'

// ── Shared primitives ─────────────────────────────────────────────────────────

function Delta({ pct }: { pct: number }) {
  const up = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-[var(--success-text)]' : 'text-[var(--danger-text)]'}`}>
      {up ? <TrendingUp className="h-3 w-3"/> : <TrendingDown className="h-3 w-3"/>}
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
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:bg-[var(--card-hover)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[var(--fg-muted)]">{label}</p>
        {expandable && (
          expanded
            ? <ChevronUp className="h-4 w-4 text-[var(--fg-muted)] shrink-0"/>
            : <ChevronDown className="h-4 w-4 text-[var(--fg-muted)] shrink-0"/>
        )}
      </div>
      <p className="text-2xl font-bold text-[var(--fg)] mt-1">{value}</p>
      {changePct !== undefined && <Delta pct={changePct} />}
    </div>
  )
  if (!expandable) return inner
  return <button className="text-left w-full"onClick={onToggle}>{inner}</button>
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-lg font-semibold text-[var(--fg)] mb-4 mt-8 first:mt-0">{title}</h2>
}

function LoadingPlaceholder() {
  const t = useTranslations('console')
  return <p className="text-sm text-[var(--fg-muted)]">{t('loadingEllipsis')}</p>
}

function DrillDownPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 mt-3">
      {children}
    </div>
  )
}

// ── Revenue Section ───────────────────────────────────────────────────────────

function RevenueSection() {
  const t = useTranslations('console')
  const { data, isLoading } = useRevenueAnalytics()
  const [expanded, setExpanded] = useState<'revenue' | 'orders' | null>(null)

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  return (
    <div className="space-y-3"aria-label={t('revenueAnalyticsAria')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label={t('totalRevenue')} value={`$${data.totalRevenue.toLocaleString()}`}
          changePct={data.revenueChangePct} expandable expanded={expanded === 'revenue'}
          onToggle={() => setExpanded(expanded === 'revenue' ? null : 'revenue')}
        />
        <KpiCard
          label={t('totalOrders')} value={data.totalOrders.toLocaleString()}
          expandable expanded={expanded === 'orders'}
          onToggle={() => setExpanded(expanded === 'orders' ? null : 'orders')}
        />
        <KpiCard label={t('avgOrderValue')} value={`$${data.averageOrderValue.toFixed(2)}`} />
      </div>

      {expanded === 'revenue' && (
        <DrillDownPanel>
          <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">{t('dailyRevenue30Days')}</p>
          <MiniBarChart data={data.dailyRevenue} height={56} aria-label={t('dailyRevenueBarChartAria')} />
        </DrillDownPanel>
      )}

      {expanded === 'orders' && (
        <DrillDownPanel>
          <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">{t('topItemsByOrders')}</p>
          <ul className="space-y-2">
            {data.topItems.map((item) => (
              <li key={item.name} className="flex items-center justify-between text-sm">
                <span className="text-[var(--fg)]">{item.name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-[var(--fg-muted)]">{t('ordersCount', { count: item.orderCount })}</span>
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
  const t = useTranslations('console')
  const { data, isLoading } = useReservationAnalytics()
  const [expanded, setExpanded] = useState(false)

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  const statusBreakdown = [
    { label: t('statusUpcoming'),  count: data.upcomingReservations,  color: 'bg-[var(--info)]' },
    { label: t('statusCancelled'), count: data.cancelledReservations, color: 'bg-[var(--danger)]'  },
    { label: t('statusCompleted'), count: data.totalReservations - data.upcomingReservations - data.cancelledReservations, color: 'bg-[var(--success)]' },
  ]

  return (
    <div className="space-y-3"aria-label={t('reservationAnalyticsAria')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label={t('totalReservationsLabel')} value={data.totalReservations.toLocaleString()}
          changePct={data.reservationsChangePct} expandable expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
        />
        <KpiCard label={t('upcoming')} value={data.upcomingReservations.toLocaleString()} />
        <KpiCard label={t('breadcrumbs.cancelled')} value={data.cancelledReservations.toLocaleString()} />
        <KpiCard label={t('occupancyRate')} value={`${data.occupancyRate}%`} />
      </div>

      {expanded && (
        <DrillDownPanel>
          <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">{t('statusBreakdown')}</p>
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
            {t('tableOccupancyRatio', { occupied: data.tablesOccupied, total: data.tablesTotal })}
          </p>
          <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden mb-4">
            <div className="h-full bg-[var(--accent)] rounded-full"style={{ width: `${data.occupancyRate}%` }} />
          </div>
          <p className="text-xs text-[var(--fg-muted)] mb-2">{t('dailyReservations30Days')}</p>
          <Sparkline data={data.dailyReservations} height={40} aria-label={t('dailyReservationsSparklineAria')} />
        </DrillDownPanel>
      )}
    </div>
  )
}

// ── Loyalty Section ───────────────────────────────────────────────────────────

function LoyaltySection() {
  const t = useTranslations('console')
  const { data, isLoading } = useLoyaltyAnalytics()
  const [expanded, setExpanded] = useState(false)

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  return (
    <div className="space-y-3"aria-label={t('loyaltyAnalyticsAria')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label={t('totalMembers')} value={data.totalMembers.toLocaleString()} />
        <KpiCard
          label={t('activeThisMonth')} value={data.activeMembersThisMonth.toLocaleString()}
          expandable expanded={expanded} onToggle={() => setExpanded((v) => !v)}
        />
        <KpiCard label={t('pointsIssued')} value={data.pointsIssued.toLocaleString()} />
        <KpiCard label={t('redemptionRate')} value={`${data.redemptionRate.toFixed(1)}%`} />
      </div>

      {expanded && (
        <DrillDownPanel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">{t('tierDistribution')}</p>
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
              <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">{t('topRewards')}</p>
              <ul className="space-y-2">
                {data.topRewards.map((r) => (
                  <li key={r.name} className="flex justify-between text-sm">
                    <span className="text-[var(--fg)]">{r.name}</span>
                    <span className="font-medium text-[var(--fg)]">{t('redemptionsCount', { count: r.redemptions })}</span>
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
  const t = useTranslations('console')
  const { data, isLoading } = usePromotionAnalytics()
  const [expanded, setExpanded] = useState(false)

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  return (
    <div className="space-y-3"aria-label={t('promotionAnalyticsAria')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label={t('totalPromotions')} value={data.totalPromotions.toString()} />
        <KpiCard label={t('activePromotions')} value={data.activePromotions.toString()} />
        <KpiCard
          label={t('totalDiscountGiven')} value={`$${data.totalDiscountGiven.toLocaleString()}`}
          changePct={data.discountChangePct} expandable expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
        />
      </div>

      {expanded && (
        <DrillDownPanel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">{t('usageByType')}</p>
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
              <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">{t('topPromotions')}</p>
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
  const t = useTranslations('console')
  const { data, isLoading } = useVendorAnalytics()

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  return (
    <div className="space-y-4"aria-label={t('vendorAnalyticsAria')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label={t('totalVendorsLabel')} value={data.totalVendors.toString()} />
        <KpiCard label={t('activeVendorsLabel')} value={data.activeVendors.toString()} />
        <KpiCard label={t('totalRevenue')} value={`$${data.totalRevenue.toLocaleString()}`} />
        <KpiCard label={t('totalCommission')} value={`$${data.totalCommission.toLocaleString()}`} />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg)]">
              <th className="text-left px-4 py-2 text-[var(--fg-muted)] font-medium">{t('vendorLabel')}</th>
              <th className="text-right px-4 py-2 text-[var(--fg-muted)] font-medium">{t('customerTableHeaders.orders')}</th>
              <th className="text-right px-4 py-2 text-[var(--fg-muted)] font-medium">{t('revenueLabel')}</th>
              <th className="text-right px-4 py-2 text-[var(--fg-muted)] font-medium">{t('commissionLabel')}</th>
              <th className="text-right px-4 py-2 text-[var(--fg-muted)] font-medium">{t('avgRatingStarLabel')}</th>
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
  const t = useTranslations('console')
  const { data, isLoading } = useMenuAnalytics()
  const [tab, setTab] = useState<'top' | 'slow' | 'category'>('top')

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  const TAB_LABEL_KEY: Record<'top' | 'slow' | 'category', string> = {
    top: 'topSellers', slow: 'slowMovers', category: 'byCategoryLabel',
  }

  return (
    <div className="space-y-4"aria-label={t('menuPerformanceAnalyticsAria')}>
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label={t('totalItemsSold')} value={data.totalItemsSold.toLocaleString()} />
        <KpiCard label={t('menuRevenue')} value={`$${data.totalMenuRevenue.toLocaleString()}`} />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="flex border-b border-[var(--border)]">
          {(['top', 'slow', 'category'] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === tabKey
                  ? 'border-b-2 border-[var(--accent-border)] text-[var(--accent-text)]'
                  : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
              }`}
            >
              {t(TAB_LABEL_KEY[tabKey])}
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
                    <span className="text-[var(--fg-muted)]">{t('ordersCount', { count: item.orderCount })}</span>
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
                    <span className="text-[var(--fg-muted)]">{t('ordersCount', { count: item.orderCount })}</span>
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
                  <th className="text-left py-2 text-[var(--fg-muted)] font-medium">{t('category')}</th>
                  <th className="text-right py-2 text-[var(--fg-muted)] font-medium">{t('itemsLabel')}</th>
                  <th className="text-right py-2 text-[var(--fg-muted)] font-medium">{t('customerTableHeaders.orders')}</th>
                  <th className="text-right py-2 text-[var(--fg-muted)] font-medium">{t('revenueLabel')}</th>
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

const PERIOD_LABEL_KEYS: Record<ComparisonPeriodLabel, string> = {
  day:     'periodTodayVsYesterday',
  week:    'periodThisWeekVsLastWeek',
  month:   'periodThisMonthVsLastMonth',
  quarter: 'periodThisQuarterVsLastQuarter',
  year:    'periodThisYearVsLastYear',
}

const PERIOD_TAB_KEYS: Record<ComparisonPeriodLabel, string> = {
  day: 'periodTabDay', week: 'periodTabWeek', month: 'periodTabMonth',
  quarter: 'periodTabQuarter', year: 'periodTabYear',
}

const COMPARISON_FIELDS: Array<{ key: keyof AnalyticsSummary; labelKey: string; format: (v: number) => string }> = [
  { key: 'totalRevenue',      labelKey: 'revenueLabel',      format: (v) => `$${v.toLocaleString()}` },
  { key: 'totalOrders',       labelKey: 'customerTableHeaders.orders', format: (v) => v.toLocaleString() },
  { key: 'totalReservations', labelKey: 'breadcrumbs.reservations', format: (v) => v.toLocaleString() },
  { key: 'newCustomers',      labelKey: 'newCustomersLabel', format: (v) => v.toLocaleString() },
]

function ComparisonSection() {
  const t = useTranslations('console')
  const [period, setPeriod] = useState<ComparisonPeriodLabel>('week')
  const { current, previous, isLoading } = useAnalyticsComparison(period)

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"aria-label={t('periodComparisonAria')}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h3 className="text-sm font-semibold text-[var(--fg)]">{t('periodComparison')}</h3>
        <div className="flex gap-1 flex-wrap">
          {(Object.keys(PERIOD_LABEL_KEYS) as ComparisonPeriodLabel[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                  : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
              }`}
            >
              {t(PERIOD_TAB_KEYS[p])}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingPlaceholder />
      ) : (
        <>
          <p className="text-xs text-[var(--fg-muted)] mb-3">{t(PERIOD_LABEL_KEYS[period])}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COMPARISON_FIELDS.map(({ key, labelKey, format }) => {
              const curr = current ? (current[key] as number | undefined) ?? 0 : null
              const prev = previous ? (previous[key] as number | undefined) ?? 0 : null
              const delta = curr !== null && prev !== null && prev !== 0
                ? ((curr - prev) / prev) * 100
                : null
              const isUp = delta !== null && delta >= 0
              return (
                <div key={String(key)} className="bg-[var(--bg)] rounded-lg p-3">
                  <p className="text-xs text-[var(--fg-muted)] mb-1">{t(labelKey)}</p>
                  <p className="text-lg font-bold text-[var(--fg)]">
                    {curr !== null ? format(curr) : '—'}
                  </p>
                  <p className="text-xs text-[var(--fg-muted)] mt-0.5">
                    {t('prevColonValue', { value: prev !== null ? format(prev) : '—' })}
                  </p>
                  {delta !== null && (
                    <p className={`text-xs font-medium mt-1 ${isUp ? 'text-[var(--success-text)]' : 'text-[var(--danger-text)]'}`}>
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
  const t = useTranslations('console')
  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary()
  // Phase 3.2 — this page previously read `activeBranch` (the unrelated,
  // unvalidated customer-storefront branch) for its branch-context
  // indicator and "view branch analytics" link. The admin
  // branch-resolution state machine is the only legitimate source.
  // Analytics itself is tenant-wide (useAnalyticsSummary takes no branch
  // param) — branchState !== 'ready' does not block the page, it only
  // disables the per-branch drill-down link, shown explicitly.
  const selectedBranch = useSelectedBranch()
  const branchState = useBranchState()

  return (
    <ErrorBoundary feature="Analytics">
    <PermissionGuard permission="analytics.view"fallback={<AccessDenied />}>
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--fg)]">{t('analyticsTitle')}</h1>
          {branchState === 'loading' && (
            <span className="text-xs text-[var(--fg-muted)]">{t('loadingBranchesEllipsis')}</span>
          )}
          {branchState === 'error' && (
            <span className="text-xs text-[var(--danger-text)]">{t('failedToLoadBranches')}</span>
          )}
          {(branchState === 'ready' || branchState === 'empty') && (
            <BranchContextIndicator branchId={selectedBranch?.id} branchName={selectedBranch?.name} />
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {branchState === 'ready' && selectedBranch && (
            <Link
              href={`/console/branches/${selectedBranch.id}/analytics`}
              className="text-sm text-[var(--info-text)] hover:underline"
            >
              {t('viewBranchAnalyticsArrow')}
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
          <KpiCard label={t('revenueLabel')} value={`$${summary.totalRevenue.toLocaleString()}`} changePct={summary.revenueChangePct} />
          <KpiCard label={t('customerTableHeaders.orders')} value={summary.totalOrders.toLocaleString()} changePct={summary.ordersChangePct} />
          <KpiCard label={t('breadcrumbs.reservations')} value={summary.totalReservations.toLocaleString()} changePct={summary.reservationsChangePct} />
          <KpiCard label={t('newCustomersLabel')} value={summary.newCustomers.toLocaleString()} changePct={summary.customersChangePct} />
          <KpiCard label={t('activeVendorsLabel')} value={summary.activeVendors.toString()} />
          <KpiCard label={t('activePromotions')} value={summary.activePromotions.toString()} />
        </div>
      )}

      <SectionHeader title={t('periodComparison')} />
      <ComparisonSection />

      <SectionHeader title={t('revenueAndOrders')} />
      <RevenueSection />

      <SectionHeader title={t('breadcrumbs.reservations')} />
      <ReservationsSection />

      <SectionHeader title={t('menuPerformance')} />
      <MenuSection />

      <SectionHeader title={t('loyaltyLabel')} />
      <LoyaltySection />

      <SectionHeader title={t('promotionsLabel')} />
      <PromotionsSection />

      <SectionHeader title={t('vendorsLabel')} />
      <VendorsSection />
    </main>
    </PermissionGuard>
    </ErrorBoundary>
  )
}
