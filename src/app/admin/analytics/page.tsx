'use client'

import {
  useAnalyticsSummary,
  useRevenueAnalytics,
  useReservationAnalytics,
  useLoyaltyAnalytics,
  usePromotionAnalytics,
  useVendorAnalytics,
} from '@/hooks'
import { MiniBarChart } from '@/components/charts/MiniBarChart'
import { Sparkline } from '@/components/charts/Sparkline'
import { AnalyticsExport } from '@/components/admin/AnalyticsExport'

function KpiCard({
  label,
  value,
  changePct,
}: {
  label: string
  value: string
  changePct?: number
}) {
  const isPositive = changePct !== undefined && changePct >= 0
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-sm text-[var(--fg-muted)]">{label}</p>
      <p className="text-2xl font-bold text-[var(--fg)] mt-1">{value}</p>
      {changePct !== undefined && (
        <p className={`text-xs mt-1 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(changePct).toFixed(1)}% vs prev period
        </p>
      )}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-lg font-semibold text-[var(--fg)] mb-4 mt-8 first:mt-0">{title}</h2>
}

function LoadingPlaceholder() {
  return <p className="text-sm text-[var(--fg-muted)]">Loading…</p>
}

// ── Revenue Section ───────────────────────────────────────────────────────────

function RevenueSection() {
  const { data, isLoading } = useRevenueAnalytics()

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  return (
    <div className="space-y-4" aria-label="Revenue analytics">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Revenue" value={`$${data.totalRevenue.toLocaleString()}`} changePct={data.revenueChangePct} />
        <KpiCard label="Total Orders" value={data.totalOrders.toLocaleString()} />
        <KpiCard label="Avg Order Value" value={`$${data.averageOrderValue.toFixed(2)}`} />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">Daily Revenue (30 days)</p>
        <MiniBarChart data={data.dailyRevenue} height={56} aria-label="Daily revenue bar chart" />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">Top Items</p>
        <ul className="space-y-2">
          {data.topItems.map((item) => (
            <li key={item.name} className="flex items-center justify-between text-sm">
              <span className="text-[var(--fg)]">{item.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-[var(--fg-muted)]">{item.orderCount} orders</span>
                <span className="font-medium text-[var(--fg)]">${item.revenue.toLocaleString()}</span>
                <span className={`text-xs ${item.trendPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {item.trendPct >= 0 ? '▲' : '▼'}{Math.abs(item.trendPct)}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── Reservations Section ──────────────────────────────────────────────────────

function ReservationsSection() {
  const { data, isLoading } = useReservationAnalytics()

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  return (
    <div className="space-y-4" aria-label="Reservation analytics">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Reservations" value={data.totalReservations.toLocaleString()} changePct={data.reservationsChangePct} />
        <KpiCard label="Upcoming" value={data.upcomingReservations.toLocaleString()} />
        <KpiCard label="Cancelled" value={data.cancelledReservations.toLocaleString()} />
        <KpiCard label="Occupancy Rate" value={`${data.occupancyRate}%`} />
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm font-medium text-[var(--fg-muted)] mb-1">Table Occupancy</p>
        <p className="text-sm text-[var(--fg)]">{data.tablesOccupied} / {data.tablesTotal} tables occupied</p>
        <div className="mt-2 h-2 rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className="h-full bg-[var(--primary)] rounded-full"
            style={{ width: `${data.occupancyRate}%` }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">Daily Reservations (30 days)</p>
        <Sparkline data={data.dailyReservations} height={40} aria-label="Daily reservations sparkline" />
      </div>
    </div>
  )
}

// ── Loyalty Section ───────────────────────────────────────────────────────────

function LoyaltySection() {
  const { data, isLoading } = useLoyaltyAnalytics()

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  const tierEntries = Object.entries(data.tierDistribution) as [string, number][]

  return (
    <div className="space-y-4" aria-label="Loyalty analytics">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Members" value={data.totalMembers.toLocaleString()} />
        <KpiCard label="Active This Month" value={data.activeMembersThisMonth.toLocaleString()} />
        <KpiCard label="Points Issued" value={data.pointsIssued.toLocaleString()} />
        <KpiCard label="Redemption Rate" value={`${data.redemptionRate.toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">Tier Distribution</p>
          <ul className="space-y-2">
            {tierEntries.map(([tier, count]) => (
              <li key={tier} className="flex justify-between text-sm capitalize">
                <span className="text-[var(--fg)]">{tier}</span>
                <span className="font-medium text-[var(--fg)]">{count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
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
    </div>
  )
}

// ── Promotions Section ────────────────────────────────────────────────────────

function PromotionsSection() {
  const { data, isLoading } = usePromotionAnalytics()

  if (isLoading) return <LoadingPlaceholder />
  if (!data) return null

  const typeEntries = Object.entries(data.usageByType) as [string, number][]

  return (
    <div className="space-y-4" aria-label="Promotion analytics">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Promotions" value={data.totalPromotions.toString()} />
        <KpiCard label="Active Promotions" value={data.activePromotions.toString()} />
        <KpiCard label="Total Discount Given" value={`$${data.totalDiscountGiven.toLocaleString()}`} changePct={data.discountChangePct} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">Usage by Type</p>
          <ul className="space-y-2">
            {typeEntries.map(([type, count]) => (
              <li key={type} className="flex justify-between text-sm">
                <span className="text-[var(--fg)] capitalize">{type.replace(/_/g, ' ')}</span>
                <span className="font-medium text-[var(--fg)]">{count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const { data: summary, isLoading: summaryLoading } = useAnalyticsSummary()

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--fg)]">Analytics</h1>
        <AnalyticsExport />
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

      <SectionHeader title="Revenue" />
      <RevenueSection />

      <SectionHeader title="Reservations" />
      <ReservationsSection />

      <SectionHeader title="Loyalty" />
      <LoyaltySection />

      <SectionHeader title="Promotions" />
      <PromotionsSection />

      <SectionHeader title="Vendors" />
      <VendorsSection />
    </main>
  )
}
