'use client'

import { use, useState, useRef } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft, Mail, Phone, ShoppingBag, Star, TrendingUp,
  Calendar, Clock, Award, Loader2, AlertCircle, User, MessageSquare,
  Gift, GitBranch, FileText, Tag, Megaphone, BarChart2,
  ChevronDown, ChevronUp, CheckCircle, XCircle, AlertTriangle,
  CreditCard, Ticket, Plus, Pencil, Trash2, Check, X, RotateCcw,
} from 'lucide-react'
import { Badge } from '@/components/ui'
import { Avatar } from '@/components/ui'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import {
  useAdminCustomer, useAdminCustomerStats,
  useBusinessCustomer, useBranchCustomers, useCustomerLoyalty,
  useCustomerTimeline, useCustomerNotes, useCreateCustomerNote,
  useUpdateCustomerNote, useDeleteCustomerNote,
  useCustomerTags, useTenantTagDefinitions, useUpdateCustomerTags,
  useCustomerAnalytics, useCustomerMarketing,
  useCustomerCoupons, useCustomerPayments, useCustomerOrders360, useCustomerReservations360,
  useAdminCustomerReviews,
} from '@/hooks'
import { formatCurrency, formatDate } from '@/utils'
import type {
  AdminCustomerTier, CustomerTimelineEvent, CustomerNote,
  CustomerTagColor, CustomerPayment, OrderType, PaymentMethod,
} from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const TIER_BADGE: Record<AdminCustomerTier, 'default' | 'success' | 'info'> = {
  vip: 'default',
  regular: 'success',
  new: 'info',
}

const TIER_KEY: Record<AdminCustomerTier, string> = {
  vip: 'tierVip',
  regular: 'tierRegular',
  new: 'tierNew',
}

const ORDER_TYPE_KEY: Record<OrderType, string> = { delivery: 'delivery', pickup: 'pickup', dine_in: 'dineIn' }
const PAYMENT_METHOD_KEY: Record<PaymentMethod, string> = { card: 'card', cash: 'cash', online: 'online', wallet: 'wallet' }
const PAYMENT_STATUS_KEY: Record<string, string> = {
  pending: 'paymentStatusPending', paid: 'paymentStatusPaid', failed: 'paymentStatusFailed', refunded: 'paymentStatusRefunded', completed: 'paymentStatusPaid',
}

const TAG_COLOR_CLASSES: Record<CustomerTagColor, string> = {
  gray:   'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  green:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  red:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
}

const TIMELINE_ICONS: Record<CustomerTimelineEvent['type'], React.ElementType> = {
  account_created: User,
  first_visit: Star,
  order_placed: ShoppingBag,
  order_completed: CheckCircle,
  order_cancelled: XCircle,
  order_refunded: RotateCcw,
  reservation_made: Calendar,
  reservation_confirmed: CheckCircle,
  reservation_completed: CheckCircle,
  reservation_cancelled: XCircle,
  reservation_no_show: AlertTriangle,
  points_earned: Gift,
  points_redeemed: Gift,
  reward_redeemed: Gift,
  tier_upgraded: Award,
  tier_downgraded: Award,
  coupon_received: Ticket,
  coupon_redeemed: Ticket,
  review_posted: MessageSquare,
  payment_completed: CreditCard,
  refund_issued: RotateCcw,
  admin_note: FileText,
  tag_added: Tag,
  tag_removed: Tag,
  marketing_email: Megaphone,
  marketing_sms: Megaphone,
  profile_updated: User,
  phone_verified: CheckCircle,
  birthday: Star,
}

const TIMELINE_COLORS: Partial<Record<CustomerTimelineEvent['type'], string>> = {
  order_placed: 'text-blue-500',
  order_completed: 'text-emerald-500',
  order_cancelled: 'text-red-400',
  order_refunded: 'text-orange-400',
  reservation_made: 'text-violet-500',
  reservation_completed: 'text-emerald-500',
  reservation_cancelled: 'text-red-400',
  reservation_no_show: 'text-amber-500',
  points_earned: 'text-yellow-500',
  points_redeemed: 'text-orange-400',
  reward_redeemed: 'text-purple-500',
  tier_upgraded: 'text-amber-500',
  tier_downgraded: 'text-gray-400',
  coupon_received: 'text-emerald-400',
  coupon_redeemed: 'text-teal-500',
  review_posted: 'text-blue-400',
  payment_completed: 'text-emerald-500',
  refund_issued: 'text-orange-400',
  admin_note: 'text-gray-500',
  tag_added: 'text-indigo-500',
  tag_removed: 'text-gray-400',
  marketing_email: 'text-violet-400',
  marketing_sms: 'text-violet-400',
  account_created: 'text-emerald-500',
  first_visit: 'text-blue-500',
  birthday: 'text-pink-500',
  phone_verified: 'text-emerald-500',
  profile_updated: 'text-gray-500',
}

type TabId = 'overview' | 'timeline' | 'orders' | 'reservations' | 'loyalty' | 'reviews' | 'notes' | 'tags' | 'marketing' | 'analytics'

const TABS: Array<{ id: TabId; labelKey: string; icon: React.ElementType }> = [
  { id: 'overview',      labelKey: 'customerTabOverview',      icon: User },
  { id: 'timeline',      labelKey: 'customerTabTimeline',      icon: Clock },
  { id: 'orders',        labelKey: 'customerTabOrders',        icon: ShoppingBag },
  { id: 'reservations',  labelKey: 'breadcrumbs.reservations', icon: Calendar },
  { id: 'loyalty',       labelKey: 'breadcrumbs.loyalty',      icon: Gift },
  { id: 'reviews',       labelKey: 'breadcrumbs.reviews',      icon: MessageSquare },
  { id: 'notes',         labelKey: 'customerTabNotes',         icon: FileText },
  { id: 'tags',          labelKey: 'customerTabTags',          icon: Tag },
  { id: 'marketing',     labelKey: 'customerTabMarketing',     icon: Megaphone },
  { id: 'analytics',     labelKey: 'customerTabAnalytics',     icon: BarChart2 },
]

// ── Small shared components ────────────────────────────────────────────────────

function SectionCard({ title, children, action }: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--fg)]">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function KpiRow({ items }: { items: Array<{ label: string; value: string; sub?: string }> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-xl font-bold text-[var(--fg)]">{item.value}</p>
          {item.sub && <p className="text-xs text-[var(--fg-muted)]">{item.sub}</p>}
          <p className="text-xs text-[var(--fg-muted)] mt-0.5">{item.label}</p>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <p className="text-sm text-[var(--fg-muted)]">{message}</p>
    </div>
  )
}

// ── Tab panels ─────────────────────────────────────────────────────────────────

function OverviewPanel({ id }: { id: string }) {
  const t = useTranslations('console')
  const { data: stats }   = useAdminCustomerStats(id)
  const { data: bc }      = useBusinessCustomer(id)
  const { data: branches } = useBranchCustomers(id)
  const { data: loyalty }  = useCustomerLoyalty(id)
  const { data: analytics } = useCustomerAnalytics(id)

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <KpiRow items={[
        { label: t('lifetimeSpend'),   value: formatCurrency(bc?.totalSpent ?? 0) },
        { label: t('totalOrders'),     value: (bc?.ordersCount ?? 0).toString() },
        { label: t('breadcrumbs.reservations'), value: (bc?.reservationsCount ?? 0).toString() },
        { label: t('loyaltyPoints'),   value: (loyalty?.points ?? 0).toLocaleString(), sub: loyalty?.tier ?? '' },
      ]} />

      {/* Activity summary */}
      {stats && (
        <SectionCard title={t('activitySummary')}>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {stats.favorite_item && (
              <div>
                <dt className="text-[var(--fg-muted)] text-xs mb-0.5">{t('favouriteItem')}</dt>
                <dd className="font-medium text-[var(--fg)]">{stats.favorite_item}</dd>
              </div>
            )}
            {stats.last_order_at && (
              <div>
                <dt className="text-[var(--fg-muted)] text-xs mb-0.5">{t('lastOrder')}</dt>
                <dd className="font-medium text-[var(--fg)]">{formatDate(stats.last_order_at)}</dd>
              </div>
            )}
            <div>
              <dt className="text-[var(--fg-muted)] text-xs mb-0.5">{t('avgOrderValue')}</dt>
              <dd className="font-medium text-[var(--fg)]">{formatCurrency(stats.avg_order_value)}</dd>
            </div>
          </dl>
        </SectionCard>
      )}

      {/* Interaction timeline */}
      {bc && (
        <SectionCard title={t('relationshipDetails')}>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-[var(--fg-muted)] text-xs mb-0.5">{t('firstInteraction')}</dt>
              <dd className="font-medium text-[var(--fg)]">{formatDate(bc.firstInteractionAt)}</dd>
            </div>
            <div>
              <dt className="text-[var(--fg-muted)] text-xs mb-0.5">{t('lastInteraction')}</dt>
              <dd className="font-medium text-[var(--fg)]">{formatDate(bc.lastInteractionAt)}</dd>
            </div>
            {analytics && (
              <div>
                <dt className="text-[var(--fg-muted)] text-xs mb-0.5">{t('visitFrequency')}</dt>
                <dd className="font-medium text-[var(--fg)]">{t('everyNDays', { days: analytics.visitFrequencyDays })}</dd>
              </div>
            )}
            {analytics?.favoriteBranchName && (
              <div>
                <dt className="text-[var(--fg-muted)] text-xs mb-0.5">{t('favouriteBranch')}</dt>
                <dd className="font-medium text-[var(--fg)]">{analytics.favoriteBranchName}</dd>
              </div>
            )}
            {analytics?.favoriteWeekday && (
              <div>
                <dt className="text-[var(--fg-muted)] text-xs mb-0.5">{t('favouriteDay')}</dt>
                <dd className="font-medium text-[var(--fg)]">{analytics.favoriteWeekday}</dd>
              </div>
            )}
            {analytics && (
              <div>
                <dt className="text-[var(--fg-muted)] text-xs mb-0.5">{t('daysSinceLastVisit')}</dt>
                <dd className="font-medium text-[var(--fg)]">{t('nDays', { days: analytics.daysSinceLastVisit })}</dd>
              </div>
            )}
          </dl>
        </SectionCard>
      )}

      {/* Branch breakdown */}
      {branches && branches.length > 0 && (
        <SectionCard title={t('branchActivity')}>
          <div className="divide-y divide-[var(--border)]">
            {branches.map((brc) => (
              <div key={brc.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-3.5 w-3.5 text-[var(--fg-muted)] shrink-0" />
                    <span className="font-medium text-[var(--fg)] truncate capitalize">{brc.branchId.replace(/-/g, ' ')}</span>
                    {brc.favoriteBranch && <Star className="h-3 w-3 text-orange-400 shrink-0" />}
                  </div>
                  {brc.lastVisit && (
                    <p className="text-xs text-[var(--fg-muted)] mt-0.5 pl-5">{t('lastVisitLabel', { date: formatDate(brc.lastVisit) })}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-medium text-[var(--fg)]">{t('visitsCount', { count: brc.visits })}</p>
                  <p className="text-xs text-[var(--fg-muted)]">{t('ordersCount', { count: brc.ordersCount })}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Quick Links */}
      <SectionCard title={t('quickLinks')}>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href={`/console/orders?customer=${encodeURIComponent(id)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            {t('viewOrders')}
          </Link>
          <Link
            href={`/console/reservations?customer=${encodeURIComponent(id)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
          >
            <Clock className="h-3.5 w-3.5" />
            {t('viewReservations')}
          </Link>
          <Link
            href={`/console/customers/${id}/reviews`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {t('viewReviews')}
          </Link>
        </div>
      </SectionCard>
    </div>
  )
}

function TimelinePanel({ id }: { id: string }) {
  const t = useTranslations('console')
  const tNotifications = useTranslations('notifications')
  const tLoyalty = useTranslations('loyalty')
  const { data: events, isLoading } = useCustomerTimeline(id)
  const [filterType, setFilterType] = useState<string>('all')

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" /></div>
  if (!events?.length) return <EmptyState message={t('noTimelineEventsYet')} />

  const types = Array.from(new Set(events.map((e) => e.type)))
  const filtered = filterType === 'all' ? events : events.filter((e) => e.type === filterType)

  // Group by date
  const grouped = filtered.reduce<Record<string, CustomerTimelineEvent[]>>((acc, e) => {
    const day = e.createdAt.slice(0, 10)
    if (!acc[day]) acc[day] = []
    acc[day].push(e)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filterType === 'all' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card-hover)] text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
        >
          {t('allCountParen', { count: events.length })}
        </button>
        {(['order_placed', 'reservation_made', 'points_earned', 'coupon_received', 'review_posted', 'admin_note'] as const).filter((tt) => types.includes(tt as CustomerTimelineEvent['type'])).map((tt) => (
          <button
            key={tt}
            onClick={() => setFilterType(tt)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${filterType === tt ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card-hover)] text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
          >
            {t(`timelineFilterTypes.${tt}`)}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([day, dayEvents]) => (
          <div key={day}>
            <p className="text-xs font-medium text-[var(--fg-muted)] mb-3 sticky top-0 bg-[var(--bg)] py-1">
              {formatDate(day)}
            </p>
            <div className="space-y-0 relative">
              <div className="absolute left-4 top-2 bottom-2 w-px bg-[var(--border)]" />
              {dayEvents.map((event) => {
                const Icon = TIMELINE_ICONS[event.type] ?? Clock
                const color = TIMELINE_COLORS[event.type] ?? 'text-[var(--fg-muted)]'
                return (
                  <div key={event.id} className="flex gap-4 py-3 relative">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--card)] border border-[var(--border)] ${color} z-10`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--fg)] leading-tight">{event.title}</p>
                          {event.description && (
                            <p className="text-xs text-[var(--fg-muted)] mt-0.5">{event.description}</p>
                          )}
                          {event.actorName && (
                            <p className="text-xs text-[var(--fg-muted)] mt-0.5">{tNotifications('byActor', { name: event.actorName })}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-[var(--fg-muted)]">
                            {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {event.amount !== undefined && event.amount > 0 && (
                            <p className="text-xs font-medium text-emerald-500">{formatCurrency(event.amount)}</p>
                          )}
                          {event.amount !== undefined && event.amount < 0 && (
                            <p className="text-xs font-medium text-red-400">{formatCurrency(event.amount)}</p>
                          )}
                          {event.points !== undefined && event.points > 0 && (
                            <p className="text-xs font-medium text-yellow-500">+{tLoyalty('pointsSuffix', { count: event.points })}</p>
                          )}
                          {event.points !== undefined && event.points < 0 && (
                            <p className="text-xs font-medium text-orange-400">{tLoyalty('pointsSuffix', { count: event.points })}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OrdersPanel({ id }: { id: string }) {
  const t = useTranslations('console')
  const tOrder = useTranslations('order')
  const tCheckout = useTranslations('checkout')
  const { data, isLoading } = useCustomerOrders360(id)

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" /></div>
  if (!data?.results.length) return <EmptyState message={t('noOrdersFoundForCustomer')} />

  const statusColor: Record<string, string> = {
    delivered: 'text-emerald-500', preparing: 'text-amber-500',
    cancelled: 'text-red-400', pending: 'text-blue-500', ready: 'text-purple-500',
  }

  return (
    <div className="space-y-3">
      {data.results.map((order) => (
        <div key={order.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[var(--fg)]">{order.order_number}</span>
                <span className={`text-xs font-medium capitalize ${statusColor[order.status ?? ''] ?? 'text-[var(--fg-muted)]'}`}>
                  {order.status ? tOrder(`status.${order.status}`) : ''}
                </span>
                <span className="text-xs text-[var(--fg-muted)] capitalize">{order.order_type ? tCheckout(ORDER_TYPE_KEY[order.order_type] ?? order.order_type) : ''}</span>
              </div>
              {order.items && (
                <p className="text-xs text-[var(--fg-muted)] mt-1 truncate">
                  {order.items.slice(0, 3).map((i) => i.name || i.menu_item?.name).filter(Boolean).join(', ')}
                  {order.items.length > 3 && ` ${t('plusNMore', { count: order.items.length - 3 })}`}
                </p>
              )}
              {order.created_at && (
                <p className="text-xs text-[var(--fg-muted)] mt-1">{formatDate(order.created_at)}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-[var(--fg)]">{formatCurrency(order.total ?? 0)}</p>
              <p className="text-xs text-[var(--fg-muted)] capitalize">{order.payment_method ? tCheckout(PAYMENT_METHOD_KEY[order.payment_method as PaymentMethod] ?? order.payment_method) : ''}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <Link
              href={`/console/orders?search=${order.order_number}`}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
            >
              <ShoppingBag className="h-3 w-3" />
              {t('viewOrder')}
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}

const RESERVATION_STATUS_KEY: Record<string, string> = {
  confirmed: 'statusConfirmed', pending: 'statusPending', cancelled: 'statusCancelled', completed: 'statusCompleted',
}

function ReservationsPanel({ id }: { id: string }) {
  const t = useTranslations('console')
  const { data, isLoading } = useCustomerReservations360(id)

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" /></div>
  if (!data?.results.length) return <EmptyState message={t('noReservationsFoundForCustomer')} />

  const statusColor: Record<string, string> = {
    confirmed: 'text-emerald-500', pending: 'text-amber-500',
    cancelled: 'text-red-400', completed: 'text-blue-500', no_show: 'text-red-400',
  }

  return (
    <div className="space-y-3">
      {data.results.map((res) => (
        <div key={res.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[var(--fg)]">{t('dateAtTime', { date: res.date, time: res.time })}</span>
                <span className={`text-xs font-medium capitalize ${statusColor[res.status] ?? 'text-[var(--fg-muted)]'}`}>{RESERVATION_STATUS_KEY[res.status] ? t(RESERVATION_STATUS_KEY[res.status]) : res.status}</span>
              </div>
              <p className="text-xs text-[var(--fg-muted)] mt-1">{t('guestsCountAnd', { count: res.guests, name: res.name })}</p>
              {res.notes && <p className="text-xs text-[var(--fg-muted)] mt-1 italic">{res.notes}</p>}
              {res.confirmation_code && (
                <p className="text-xs text-[var(--fg-muted)] mt-1 font-mono">{res.confirmation_code}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function LoyaltyPanel({ id }: { id: string }) {
  const t = useTranslations('console')
  const tLoyalty = useTranslations('loyalty')
  const { data: loyalty, isLoading } = useCustomerLoyalty(id)
  const { data: bc } = useBusinessCustomer(id)

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" /></div>
  if (!loyalty) return <EmptyState message={t('noLoyaltyAccountFound')} />

  const tierProgress: Record<string, { next?: string; threshold?: number }> = {
    bronze: { next: 'silver',   threshold: 500 },
    silver: { next: 'gold',     threshold: 1500 },
    gold:   { next: 'platinum', threshold: 4000 },
    platinum: {},
  }

  const tierInfo = tierProgress[loyalty.tier]
  const progressPct = tierInfo.threshold
    ? Math.min(100, (loyalty.lifetimePoints / tierInfo.threshold) * 100)
    : 100

  return (
    <div className="space-y-4">
      {/* Main loyalty card */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-[var(--fg-muted)] mb-1">{t('currentTier')}</p>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-sm font-semibold capitalize">
              <Award className="h-3.5 w-3.5" />
              {tLoyalty(`tiers.${loyalty.tier}`)}
            </span>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-[var(--fg)]">{loyalty.points.toLocaleString()}</p>
            <p className="text-xs text-[var(--fg-muted)]">{t('redeemablePoints')}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-[var(--fg-muted)]">
            <span>{t('lifetimePtsCount', { count: loyalty.lifetimePoints.toLocaleString() })}</span>
            {tierInfo.threshold && (
              <span>{t('nextTierAtThreshold', { tier: tLoyalty(`tiers.${tierInfo.next}`), threshold: tierInfo.threshold.toLocaleString() })}</span>
            )}
          </div>
          <div className="h-2 bg-[var(--card-hover)] rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Business customer loyalty stats */}
      {bc && (
        <KpiRow items={[
          { label: t('loyaltyPoints'),   value: bc.loyaltyPoints.toLocaleString() },
          { label: t('lifetimeValue'),   value: formatCurrency(bc.lifetimeValue) },
          { label: t('loyaltyTier'),     value: tLoyalty(`tiers.${bc.loyaltyTier}`) },
          { label: t('totalSpent'),      value: formatCurrency(bc.totalSpent) },
        ]} />
      )}

      {loyalty.tierExpiresAt && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-300">
          {t('tierExpiresLabel', { date: formatDate(loyalty.tierExpiresAt) })}
        </div>
      )}
    </div>
  )
}

function ReviewsPanel({ id }: { id: string }) {
  const t = useTranslations('console')
  const { data: reviews, isLoading } = useAdminCustomerReviews(id)

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" /></div>
  if (!reviews?.length) return <EmptyState message={t('noReviewsPostedYet')} />

  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length

  return (
    <div className="space-y-4">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4">
        <div className="text-3xl font-bold text-[var(--fg)]">{avg.toFixed(1)}</div>
        <div>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className={`h-4 w-4 ${s <= Math.round(avg) ? 'text-amber-400 fill-amber-400' : 'text-[var(--border)]'}`} />
            ))}
          </div>
          <p className="text-xs text-[var(--fg-muted)] mt-1">{t('reviewsCount', { count: reviews.length })}</p>
        </div>
      </div>
      <div className="space-y-3">
        {reviews.map((rev) => (
          <div key={rev.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`h-3.5 w-3.5 ${s <= rev.rating ? 'text-amber-400 fill-amber-400' : 'text-[var(--border)]'}`} />
                ))}
              </div>
              <span className="text-xs text-[var(--fg-muted)]">{formatDate(rev.created_at)}</span>
            </div>
            {rev.comment && <p className="text-sm text-[var(--fg)]">{rev.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function NotesPanel({ id }: { id: string }) {
  const t = useTranslations('console')
  const { data: notes, isLoading } = useCustomerNotes(id)
  const createNote = useCreateCustomerNote(id)
  const updateNote = useUpdateCustomerNote(id)
  const deleteNote = useDeleteCustomerNote(id)

  const [newContent, setNewContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleCreate = () => {
    if (!newContent.trim()) return
    createNote.mutate({
      content: newContent.trim(),
      authorId: '4',
      authorName: 'Olivia Owner',
    }, {
      onSuccess: () => setNewContent(''),
    })
  }

  const handleUpdate = (noteId: string) => {
    if (!editContent.trim()) return
    updateNote.mutate({ noteId, content: editContent.trim() }, {
      onSuccess: () => { setEditingId(null); setEditContent('') },
    })
  }

  const startEdit = (note: CustomerNote) => {
    setEditingId(note.id)
    setEditContent(note.content)
  }

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" /></div>

  return (
    <div className="space-y-4">
      {/* New note input */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
        <p className="text-sm font-medium text-[var(--fg)] mb-2">{t('addANote')}</p>
        <textarea
          ref={textareaRef}
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder={t('privateNotePlaceholder')}
          rows={3}
          className="w-full text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 text-[var(--fg)] placeholder:text-[var(--fg-muted)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleCreate}
            disabled={!newContent.trim() || createNote.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {createNote.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {t('addNote')}
          </button>
        </div>
      </div>

      {/* Existing notes */}
      {!notes?.length && <EmptyState message={t('noNotesYet')} />}
      {notes?.map((note) => (
        <div key={note.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
          {editingId === note.id ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={3}
                className="w-full text-sm bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 text-[var(--fg)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setEditingId(null); setEditContent('') }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border)] text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
                >
                  <X className="h-3 w-3" /> {t('cancel')}
                </button>
                <button
                  onClick={() => handleUpdate(note.id)}
                  disabled={updateNote.isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white text-xs font-medium disabled:opacity-50"
                >
                  <Check className="h-3 w-3" /> {t('save')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--fg)] whitespace-pre-wrap">{note.content}</p>
              <div className="flex items-center justify-between mt-3">
                <div className="text-xs text-[var(--fg-muted)]">
                  {note.authorName} · {formatDate(note.createdAt)}
                  {note.updatedAt !== note.createdAt && ` ${t('editedParen')}`}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(note)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-[var(--card-hover)] text-[var(--fg-muted)]"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => deleteNote.mutate(note.id)}
                    disabled={deleteNote.isPending}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-[var(--card-hover)] text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function TagsPanel({ id }: { id: string }) {
  const t = useTranslations('console')
  const { data: assignment, isLoading: tagsLoading } = useCustomerTags(id)
  const { data: allTags, isLoading: defsLoading } = useTenantTagDefinitions()
  const updateTags = useUpdateCustomerTags(id)

  if (tagsLoading || defsLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" /></div>

  const assignedIds = new Set(assignment?.tags.map((tag) => tag.id) ?? [])

  const toggle = (tagId: string) => {
    const next = assignedIds.has(tagId)
      ? [...assignedIds].filter((id) => id !== tagId)
      : [...assignedIds, tagId]
    updateTags.mutate(next)
  }

  return (
    <div className="space-y-4">
      {/* Current tags */}
      <SectionCard title={t('assignedTags')}>
        {!assignment?.tags.length
          ? <EmptyState message={t('noTagsAssignedYet')} />
          : (
            <div className="flex flex-wrap gap-2">
              {assignment.tags.map((tag) => (
                <span key={tag.id} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${TAG_COLOR_CLASSES[tag.color]}`}>
                  {tag.label}
                  <button
                    onClick={() => toggle(tag.id)}
                    className="hover:opacity-70"
                    aria-label={t('removeTagAria', { label: tag.label })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )
        }
      </SectionCard>

      {/* All available tags */}
      <SectionCard title={t('availableTags')}>
        {!allTags?.length
          ? <EmptyState message={t('noTagsDefinedYet')} />
          : (
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => {
                const active = assignedIds.has(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggle(tag.id)}
                    disabled={updateTags.isPending}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all disabled:opacity-50 ${
                      active
                        ? `${TAG_COLOR_CLASSES[tag.color]} border-current`
                        : 'bg-[var(--card-hover)] text-[var(--fg-muted)] border-transparent hover:border-[var(--border)]'
                    }`}
                  >
                    {active && <Check className="h-3 w-3" />}
                    {tag.label}
                  </button>
                )
              })}
            </div>
          )
        }
      </SectionCard>
    </div>
  )
}

function MarketingPanel({ id }: { id: string }) {
  const t = useTranslations('console')
  const { data: marketing, isLoading } = useCustomerMarketing(id)
  const { data: coupons } = useCustomerCoupons(id)

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" /></div>
  if (!marketing) return <EmptyState message={t('noMarketingDataAvailable')} />

  const channelKey: Record<string, string> = { email: 'channelEmail', sms: 'channelSms', push: 'channelPush', whatsapp: 'channelWhatsapp' }
  const couponStatusColor: Record<string, string> = {
    available: 'text-emerald-500', redeemed: 'text-[var(--fg-muted)]', expired: 'text-red-400',
  }
  const couponStatusKey: Record<string, string> = {
    available: 'couponStatusAvailable', redeemed: 'couponStatusRedeemed', expired: 'couponStatusExpired',
  }

  return (
    <div className="space-y-4">
      {/* Channel prefs */}
      <SectionCard title={t('channelPreferences')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {marketing.preferences.map((pref) => (
            <div key={pref.channel} className={`rounded-xl border p-3 text-center ${pref.subscribed ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10' : 'border-[var(--border)] opacity-60'}`}>
              <p className="text-xs font-medium text-[var(--fg)]">{t(channelKey[pref.channel])}</p>
              <p className={`text-xs mt-1 ${pref.subscribed ? 'text-emerald-600' : 'text-[var(--fg-muted)]'}`}>
                {pref.subscribed ? t('subscribed') : t('unsubscribed')}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* KPIs */}
      <KpiRow items={[
        { label: t('couponsReceived'), value: marketing.couponsReceived.toString() },
        { label: t('couponsRedeemed'), value: marketing.couponsRedeemed.toString() },
        { label: t('lastCampaign'),    value: marketing.lastCampaignAt ? formatDate(marketing.lastCampaignAt) : t('never') },
        { label: t('campaignHistory'), value: marketing.campaigns.length.toString() },
      ]} />

      {/* Campaign history */}
      {marketing.campaigns.length > 0 && (
        <SectionCard title={t('campaignHistory')}>
          <div className="divide-y divide-[var(--border)]">
            {marketing.campaigns.map((camp) => (
              <div key={camp.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--fg)] truncate">{camp.name}</p>
                  <p className="text-xs text-[var(--fg-muted)] mt-0.5 capitalize">{camp.channel} · {formatDate(camp.sentAt)}</p>
                </div>
                <div className="flex gap-2 shrink-0 text-xs">
                  <span className={camp.opened ? 'text-emerald-500' : 'text-[var(--fg-muted)]'}>{t('opened')}</span>
                  <span className={camp.clicked ? 'text-blue-500' : 'text-[var(--fg-muted)]'}>{t('clicked')}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Coupons */}
      {coupons && coupons.length > 0 && (
        <SectionCard title={t('coupons')}>
          <div className="space-y-3">
            {coupons.map((coup) => (
              <div key={coup.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-[var(--card-hover)] px-2 py-0.5 rounded text-[var(--fg)]">{coup.code}</span>
                    <span className={`text-xs capitalize ${couponStatusColor[coup.status]}`}>{t(couponStatusKey[coup.status])}</span>
                  </div>
                  <p className="text-xs text-[var(--fg-muted)] mt-1">{coup.description}</p>
                  {coup.expiresAt && <p className="text-xs text-[var(--fg-muted)]">{t('expiresLabel', { date: formatDate(coup.expiresAt) })}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-[var(--fg)]">
                    {t('discountOff', { amount: coup.discountType === 'percent' ? `${coup.discountValue}%` : formatCurrency(coup.discountValue) })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

function AnalyticsPanel({ id }: { id: string }) {
  const t = useTranslations('console')
  const { data: analytics, isLoading } = useCustomerAnalytics(id)
  const { data: payments } = useCustomerPayments(id)

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" /></div>
  if (!analytics) return <EmptyState message={t('analyticsNotYetAvailable')} />

  return (
    <div className="space-y-4">
      {/* Key metrics */}
      <KpiRow items={[
        { label: t('lifetimeValue'),      value: formatCurrency(analytics.lifetimeValue) },
        { label: t('avgOrderValue'),     value: formatCurrency(analytics.avgOrderValue) },
        { label: t('avgPartySize'),      value: analytics.avgReservationPartySize.toFixed(1) },
        { label: t('daysSinceLastVisit'), value: analytics.daysSinceLastVisit.toString() },
      ]} />

      {/* Behaviour patterns */}
      <SectionCard title={t('behaviourPatterns')}>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs text-[var(--fg-muted)] mb-0.5">{t('visitFrequency')}</dt>
            <dd className="font-medium text-[var(--fg)]">{t('everyNDaysApprox', { days: analytics.visitFrequencyDays })}</dd>
          </div>
          {analytics.favoriteBranchName && (
            <div>
              <dt className="text-xs text-[var(--fg-muted)] mb-0.5">{t('favouriteBranch')}</dt>
              <dd className="font-medium text-[var(--fg)]">{analytics.favoriteBranchName}</dd>
            </div>
          )}
          {analytics.favoriteWeekday && (
            <div>
              <dt className="text-xs text-[var(--fg-muted)] mb-0.5">{t('favouriteDay')}</dt>
              <dd className="font-medium text-[var(--fg)]">{analytics.favoriteWeekday}</dd>
            </div>
          )}
          {analytics.favoriteHour !== undefined && (
            <div>
              <dt className="text-xs text-[var(--fg-muted)] mb-0.5">{t('favouriteHour')}</dt>
              <dd className="font-medium text-[var(--fg)]">{analytics.favoriteHour}:00 – {analytics.favoriteHour + 1}:00</dd>
            </div>
          )}
          {analytics.favoriteCategories.length > 0 && (
            <div className="col-span-2">
              <dt className="text-xs text-[var(--fg-muted)] mb-0.5">{t('favouriteCategories')}</dt>
              <dd className="font-medium text-[var(--fg)]">{analytics.favoriteCategories.join(', ')}</dd>
            </div>
          )}
        </dl>
      </SectionCard>

      {/* Top items */}
      {analytics.favoriteItems.length > 0 && (
        <SectionCard title={t('favouriteItems')}>
          <div className="space-y-2">
            {analytics.favoriteItems.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="text-xs text-[var(--fg-muted)] w-4">{idx + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--fg)]">{item.name}</span>
                    <span className="text-[var(--fg-muted)]">{item.count}×</span>
                  </div>
                  <div className="h-1.5 bg-[var(--card-hover)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] rounded-full"
                      style={{ width: `${Math.min(100, (item.count / (analytics.favoriteItems[0]?.count ?? 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Revenue trend */}
      {analytics.revenueByMonth.length > 0 && (
        <SectionCard title={t('revenueTrend')}>
          <div className="flex items-end gap-1 h-24">
            {analytics.revenueByMonth.map((m) => {
              const max = Math.max(...analytics.revenueByMonth.map((x) => x.revenue))
              const pct = max > 0 ? (m.revenue / max) * 100 : 0
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-[var(--accent)] rounded-t opacity-80 hover:opacity-100 transition-opacity"
                    style={{ height: `${pct}%`, minHeight: '4px' }}
                    title={`${m.month}: ${formatCurrency(m.revenue)}`}
                  />
                  <span className="text-[10px] text-[var(--fg-muted)]">{m.month.slice(5)}</span>
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      {/* Payments */}
      {payments && payments.length > 0 && (
        <SectionCard title={t('paymentHistory')}>
          <div className="divide-y divide-[var(--border)]">
            {payments.map((pay: CustomerPayment) => (
              <div key={pay.id} className="py-3 first:pt-0 last:pb-0 flex justify-between items-center text-sm">
                <div>
                  <p className="font-medium text-[var(--fg)]">{formatCurrency(pay.amount)}</p>
                  <p className="text-xs text-[var(--fg-muted)] capitalize">{pay.method} · {formatDate(pay.processedAt)}</p>
                </div>
                <span className={`text-xs capitalize ${pay.status === 'completed' ? 'text-emerald-500' : 'text-orange-400'}`}>{t(PAYMENT_STATUS_KEY[pay.status] ?? pay.status)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function CustomerDetailContent({ id }: { id: string }) {
  const t = useTranslations('console')
  const tLoyalty = useTranslations('loyalty')
  const { data: customer, isLoading, isError } = useAdminCustomer(id)
  const { data: businessCustomer } = useBusinessCustomer(id)
  const { data: loyaltyAccount } = useCustomerLoyalty(id)
  const { data: tagAssignment } = useCustomerTags(id)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [showFullId, setShowFullId] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-[var(--fg-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">{t('loadingCustomer')}</span>
      </div>
    )
  }

  if (isError || !customer) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-[var(--fg-muted)]">{t('customerNotFound')}</p>
        <Link href="/console/customers" className="text-sm text-blue-600 hover:underline">
          {t('backToCustomers')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Back link */}
      <Link
        href="/console/customers"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('breadcrumbs.customers')}
      </Link>

      {/* Profile header card */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <Avatar firstName={customer.first_name} lastName={customer.last_name} size="lg" />

          <div className="flex-1 min-w-0">
            {/* Name + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--fg)]">
                {customer.first_name} {customer.last_name}
              </h1>
              <Badge variant={TIER_BADGE[customer.tier]}>{t(TIER_KEY[customer.tier])}</Badge>
              {!customer.is_verified && <Badge variant="secondary">{t('unverified')}</Badge>}
              {businessCustomer?.status === 'inactive' && (
                <Badge variant="secondary">{t('inactive')}</Badge>
              )}
              {businessCustomer?.favorite && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <Star className="h-3 w-3 fill-current" /> {t('tierVip')}
                </span>
              )}
            </div>

            {/* Tags inline */}
            {tagAssignment?.tags && tagAssignment.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tagAssignment.tags.map((tag) => (
                  <span key={tag.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLOR_CLASSES[tag.color]}`}>
                    {tag.label}
                  </span>
                ))}
              </div>
            )}

            {/* Contact info */}
            <div className="mt-2 space-y-1">
              {customer.email && (
                <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span>{customer.email}</span>
                </div>
              )}
              {customer.phone_number && (
                <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{customer.phone_number}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>{t('customerSinceLabel', { date: formatDate(customer.created_at) })}</span>
              </div>
            </div>
          </div>

          {/* Compact KPIs */}
          <div className="flex flex-col gap-2 text-right">
            <div>
              <p className="text-lg font-bold text-[var(--fg)]">{formatCurrency(customer.total_spent)}</p>
              <p className="text-xs text-[var(--fg-muted)]">{t('lifetimeSpend')}</p>
            </div>
            <div>
              <p className="text-base font-semibold text-[var(--fg)]">{t('ordersCount', { count: customer.order_count })}</p>
            </div>
            {loyaltyAccount && (
              <div className="flex items-center gap-1 justify-end">
                <Gift className="h-3 w-3 text-amber-500" />
                <span className="text-sm font-medium text-[var(--fg)]">{tLoyalty('pointsSuffix', { count: loyaltyAccount.points.toLocaleString() })}</span>
              </div>
            )}
          </div>
        </div>

        {/* IDs (collapsed by default) */}
        <button
          onClick={() => setShowFullId((v) => !v)}
          className="mt-4 flex items-center gap-1.5 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          {showFullId ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showFullId ? t('hideIds') : t('showIds')}
        </button>
        {showFullId && (
          <div className="mt-2 p-3 bg-[var(--bg)] rounded-lg text-xs font-mono text-[var(--fg-muted)] space-y-1">
            <p><span className="text-[var(--fg-muted)]">{t('platformUserLabel')} </span>{customer.id}</p>
            {businessCustomer && <p><span className="text-[var(--fg-muted)]">{t('businessCustomerLabel')} </span>{businessCustomer.id}</p>}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 border-b border-[var(--border)] min-w-max">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t(tab.labelKey)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview'     && <OverviewPanel id={id} />}
        {activeTab === 'timeline'     && <TimelinePanel id={id} />}
        {activeTab === 'orders'       && <OrdersPanel id={id} />}
        {activeTab === 'reservations' && <ReservationsPanel id={id} />}
        {activeTab === 'loyalty'      && <LoyaltyPanel id={id} />}
        {activeTab === 'reviews'      && <ReviewsPanel id={id} />}
        {activeTab === 'notes'        && <NotesPanel id={id} />}
        {activeTab === 'tags'         && <TagsPanel id={id} />}
        {activeTab === 'marketing'    && <MarketingPanel id={id} />}
        {activeTab === 'analytics'    && <AnalyticsPanel id={id} />}
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
          <div className="pt-2">
            <CustomerDetailContent id={id} />
          </div>
        </div>
      </PermissionGuard>
    </ErrorBoundary>
  )
}
