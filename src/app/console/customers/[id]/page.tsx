'use client'

import { use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Mail, Phone, ShoppingBag, Star, TrendingUp,
  Calendar, Clock, Award, Loader2, AlertCircle, User, MessageSquare,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import { Avatar } from '@/components/ui'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useAdminCustomer, useAdminCustomerStats } from '@/hooks'
import { formatCurrency, formatDate } from '@/utils'
import type { AdminCustomerTier } from '@/types'

const TIER_BADGE: Record<AdminCustomerTier, 'default' | 'success' | 'info'> = {
  vip: 'default',
  regular: 'success',
  new: 'info',
}

const TIER_LABEL: Record<AdminCustomerTier, string> = {
  vip: 'VIP',
  regular: 'Regular',
  new: 'New',
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string
  value: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <div className={`inline-flex h-9 w-9 rounded-xl bg-opacity-10 items-center justify-center mb-3 ${color.replace('text-', 'bg-').replace('-500', '-100')}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className="text-xl font-bold text-[var(--fg)]">{value}</p>
      <p className="text-xs text-[var(--fg-muted)] mt-0.5">{label}</p>
    </div>
  )
}

function CustomerDetailContent({ id }: { id: string }) {
  const { data: customer, isLoading, isError } = useAdminCustomer(id)
  const { data: stats, isLoading: statsLoading } = useAdminCustomerStats(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-[var(--fg-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading customer…</span>
      </div>
    )
  }

  if (isError || !customer) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-[var(--fg-muted)]">Customer not found.</p>
        <Link href="/console/customers" className="text-sm text-blue-600 hover:underline">
          Back to Customers
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link
        href="/console/customers"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Customers
      </Link>

      {/* Profile header */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <Avatar firstName={customer.first_name} lastName={customer.last_name} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--fg)]">
                {customer.first_name} {customer.last_name}
              </h1>
              <Badge variant={TIER_BADGE[customer.tier]}>{TIER_LABEL[customer.tier]}</Badge>
              {!customer.is_verified && (
                <Badge variant="secondary">Unverified</Badge>
              )}
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span>{customer.email}</span>
              </div>
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{customer.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>Customer since {formatDate(customer.created_at)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)] font-mono">
            <User className="h-3 w-3" />
            {customer.id}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total Orders"
          value={customer.order_count.toString()}
          icon={ShoppingBag}
          color="text-blue-500"
        />
        <StatCard
          label="Total Spent"
          value={formatCurrency(customer.total_spent)}
          icon={TrendingUp}
          color="text-emerald-500"
        />
        <StatCard
          label="Avg Order Value"
          value={formatCurrency(customer.avg_order_value)}
          icon={Star}
          color="text-orange-500"
        />
        <StatCard
          label="Customer Tier"
          value={TIER_LABEL[customer.tier]}
          icon={Award}
          color="text-purple-500"
        />
      </div>

      {/* Extended stats from useAdminCustomerStats */}
      {!statsLoading && stats && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <h2 className="text-sm font-semibold text-[var(--fg)] mb-4">Activity Summary</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {stats.favorite_item && (
              <div>
                <dt className="text-[var(--fg-muted)] text-xs mb-0.5">Favourite Item</dt>
                <dd className="font-medium text-[var(--fg)]">{stats.favorite_item}</dd>
              </div>
            )}
            {stats.last_order_at && (
              <div>
                <dt className="text-[var(--fg-muted)] text-xs mb-0.5">Last Order</dt>
                <dd className="font-medium text-[var(--fg)]">{formatDate(stats.last_order_at)}</dd>
              </div>
            )}
            <div>
              <dt className="text-[var(--fg-muted)] text-xs mb-0.5">Order Count</dt>
              <dd className="font-medium text-[var(--fg)]">{stats.order_count}</dd>
            </div>
            <div>
              <dt className="text-[var(--fg-muted)] text-xs mb-0.5">Lifetime Value</dt>
              <dd className="font-medium text-[var(--fg)]">{formatCurrency(stats.total_spent)}</dd>
            </div>
            <div>
              <dt className="text-[var(--fg-muted)] text-xs mb-0.5">Avg Order</dt>
              <dd className="font-medium text-[var(--fg)]">{formatCurrency(stats.avg_order_value)}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Recent activity placeholder — links to order/reservation history */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-[var(--fg)] mb-3">Quick Links</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={`/console/orders?search=${encodeURIComponent(customer.email)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            View Orders
          </Link>
          <Link
            href={`/console/reservations?search=${encodeURIComponent(customer.email)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
          >
            <Clock className="h-3.5 w-3.5" />
            View Reservations
          </Link>
          <Link
            href={`/console/customers/${customer.id}/reviews`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            View Reviews
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <ErrorBoundary feature="Customer Detail">
      <PermissionGuard permission="customers.view" fallback={<AccessDenied />}>
        <div className="min-h-screen bg-[var(--bg)]">
          <div className="pt-16">
            <CustomerDetailContent id={id} />
          </div>
        </div>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
