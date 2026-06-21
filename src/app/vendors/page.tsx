'use client'

import { useState } from 'react'
import { CapabilityGuard, CapabilityNotAvailable } from '@/components/guards/CapabilityGuard'
import { useVendors, useVendorStats, useVendorSettlements } from '@/hooks'
import type { Vendor, VendorCategory, VendorStatus } from '@/types'

const CATEGORY_LABELS: Record<VendorCategory, string> = {
  asian:         'Asian',
  western:       'Western',
  mediterranean: 'Mediterranean',
  mexican:       'Mexican',
  indian:        'Indian',
  desserts:      'Desserts',
  beverages:     'Beverages',
  fast_food:     'Fast Food',
  healthy:       'Healthy',
  other:         'Other',
}

const STATUS_COLORS: Record<VendorStatus, string> = {
  active:    'bg-green-100 text-green-700',
  inactive:  'bg-gray-100 text-gray-500',
  pending:   'bg-yellow-100 text-yellow-700',
  suspended: 'bg-red-100 text-red-600',
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  const filled = Math.round(rating)
  return (
    <span className="flex items-center gap-1 text-sm">
      <span className="text-yellow-400">{'★'.repeat(filled)}{'☆'.repeat(5 - filled)}</span>
      <span className="text-[var(--fg-muted)]">{rating > 0 ? rating.toFixed(1) : 'No ratings'}</span>
      {count > 0 && <span className="text-[var(--fg-muted)]">({count})</span>}
    </span>
  )
}

function VendorCard({ vendor, onSelect }: { vendor: Vendor; onSelect: (v: Vendor) => void }) {
  return (
    <li
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 cursor-pointer hover:border-[var(--primary)] transition-colors"
      onClick={() => onSelect(vendor)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {vendor.featured && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--primary)] text-white">
                Featured
              </span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[vendor.status]}`}>
              {vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
            </span>
          </div>
          <h3 className="font-semibold text-[var(--fg)]">{vendor.name}</h3>
          <p className="text-sm text-[var(--fg-muted)] mt-0.5 line-clamp-2">{vendor.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
              {CATEGORY_LABELS[vendor.category]}
            </span>
            {vendor.stallNumber && (
              <span className="text-xs text-[var(--fg-muted)]">Stall {vendor.stallNumber}</span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <StarRating rating={vendor.rating} count={vendor.ratingCount} />
        </div>
      </div>
    </li>
  )
}

function VendorProfile({ vendor, onBack }: { vendor: Vendor; onBack: () => void }) {
  const { data: stats } = useVendorStats(vendor.id)
  const { data: settlements } = useVendorSettlements(vendor.id)

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] flex items-center gap-1"
        aria-label="Back to vendor list"
      >
        ← Back to Vendors
      </button>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {vendor.featured && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--primary)] text-white">
                  Featured
                </span>
              )}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[vendor.status]}`}>
                {vendor.status.charAt(0).toUpperCase() + vendor.status.slice(1)}
              </span>
            </div>
            <h2 className="text-xl font-bold text-[var(--fg)]">{vendor.name}</h2>
            <p className="text-[var(--fg-muted)] mt-1">{vendor.description}</p>
          </div>
          <StarRating rating={vendor.rating} count={vendor.ratingCount} />
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-[var(--fg-muted)]">
          <span className="px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs">
            {CATEGORY_LABELS[vendor.category]}
          </span>
          {vendor.stallNumber && <span>Stall: {vendor.stallNumber}</span>}
          {vendor.contactPhone && <span>📞 {vendor.contactPhone}</span>}
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {[
              { label: 'Orders', value: stats.ordersCount.toLocaleString() },
              { label: 'Active Items', value: stats.activeProducts },
              { label: 'Revenue', value: `$${stats.revenue.toLocaleString()}` },
              { label: 'Avg Rating', value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-[var(--border)] p-3 text-center">
                <p className="text-lg font-bold text-[var(--fg)]">{value}</p>
                <p className="text-xs text-[var(--fg-muted)]">{label}</p>
              </div>
            ))}
          </div>
        )}

        {settlements && settlements.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--fg)] mb-2">Recent Settlements</h3>
            <ul className="space-y-2">
              {settlements.slice(0, 3).map((s) => (
                <li key={s.id} className="flex justify-between text-sm">
                  <span className="text-[var(--fg-muted)]">
                    {new Date(s.settlementDate).toLocaleDateString()}
                  </span>
                  <span className={`font-medium ${
                    s.status === 'paid' ? 'text-green-600' :
                    s.status === 'failed' ? 'text-red-500' :
                    'text-yellow-600'
                  }`}>
                    ${s.amount.toLocaleString()} · {s.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function VendorsContent() {
  const { data: vendors, isLoading } = useVendors()
  const [selected, setSelected] = useState<Vendor | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<VendorCategory | 'all'>('all')

  if (isLoading) return <p className="text-[var(--fg-muted)]">Loading vendors…</p>

  if (selected) {
    return <VendorProfile vendor={selected} onBack={() => setSelected(null)} />
  }

  const activeVendors = vendors?.filter((v) => v.status === 'active') ?? []
  const featured = activeVendors.filter((v) => v.featured)
  const filtered = activeVendors.filter(
    (v) => categoryFilter === 'all' || v.category === categoryFilter,
  )

  const categories = Array.from(new Set(activeVendors.map((v) => v.category)))

  return (
    <div className="space-y-8">
      {/* Featured vendors */}
      {featured.length > 0 && (
        <section aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="text-lg font-semibold text-[var(--fg)] mb-3">
            Featured Vendors
          </h2>
          <ul className="space-y-3">
            {featured.map((v) => (
              <VendorCard key={v.id} vendor={v} onSelect={setSelected} />
            ))}
          </ul>
        </section>
      )}

      {/* All vendors with category filter */}
      <section aria-labelledby="all-heading">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 id="all-heading" className="text-lg font-semibold text-[var(--fg)]">
            All Vendors
          </h2>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'border-[var(--border)] text-[var(--fg-muted)]'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  categoryFilter === cat
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'border-[var(--border)] text-[var(--fg-muted)]'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className="text-[var(--fg-muted)] text-sm">No vendors in this category.</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((v) => (
              <VendorCard key={v.id} vendor={v} onSelect={setSelected} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default function VendorsPage() {
  return (
    <CapabilityGuard
      capability="ordering"
      fallback={<CapabilityNotAvailable capability="ordering" />}
    >
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-6">Vendors</h1>
        <VendorsContent />
      </main>
    </CapabilityGuard>
  )
}
