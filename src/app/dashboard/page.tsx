'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Package, Heart, Calendar, MapPin, ArrowRight, Clock, TrendingUp, Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuthStore, useTenantStore } from '@/stores'
import { useOrders, useReservations } from '@/hooks'
import { resolveBestDashboardActions } from '@/utils/navigation-intelligence'
import { Card } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui'
import { Skeleton } from '@/components/ui'
import { formatCurrency, formatDate, formatRelativeTime } from '@/utils'
import { isTerminalOrderStatus, getOrderStatusLabelKey } from '@/lib/order-status'


const STATUS_BADGE_MAP: Record<string, 'success' | 'warning' | 'info' | 'purple' | 'danger' | 'secondary'> = {
  delivered: 'success',
  picked_up: 'success',
  served: 'success',
  pending: 'warning',
  accepted: 'info',
  preparing: 'purple',
  ready: 'success',
  cancelled: 'danger',
}

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const tOrder = useTranslations('order')
  const tCommon = useTranslations('common')
  const { user } = useAuthStore()
  const tenantSlug = useTenantStore((s) => s.tenant?.slug)
  const { data: ordersData, isLoading: ordersLoading } = useOrders()
  const { data: reservationsData, isLoading: resLoading } = useReservations()
  const QUICK_ACTIONS = resolveBestDashboardActions(tenantSlug)

  const orders = ordersData?.results || []
  // Next ones first; finished and cancelled ones are on the reservations page.
  const reservations = (reservationsData?.results || [])
    .filter((r) => (r.status === 'pending' || r.status === 'confirmed') && new Date(r.reserved_at ?? `${r.date}T${r.time}`) > new Date())
    .reverse()
  const activeOrder = orders.find((o) => !isTerminalOrderStatus(o) && o.status !== 'cancelled')

  const stats = [
    { label: t('totalOrders'), value: ordersData?.count || 0, icon: Package, color: 'text-[var(--info-text)]', bg: 'bg-[var(--info-subtle)]' },
    { label: t('reservations'), value: reservationsData?.count || 0, icon: Calendar, color: 'text-[var(--chart-5)]', bg: 'bg-[var(--chart-5)]/10' },
    { label: t('totalSpent'), value: formatCurrency(orders.reduce((s, o) => s + (o.total || 0), 0)), icon: TrendingUp, color: 'text-[var(--success-text)]', bg: 'bg-[var(--success-subtle)]' },
    { label: t('avgRating'), value: '4.8★', icon: Star, color: 'text-[var(--rating)]', bg: 'bg-[var(--warning-subtle)]' },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)]">
          {t('greeting', { name: user?.first_name })}
        </h1>
        <p className="text-[var(--fg-muted)] mt-1">{t('subtitle')}</p>
      </div>

      {/* Active Order Banner */}
      {activeOrder && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-active)] rounded-2xl p-5 text-white"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Clock className="h-5 w-5"/>
              </div>
              <div>
                <p className="font-semibold">{t('activeOrderLabel', { number: activeOrder.order_number })}</p>
                <p className="text-white/80 text-sm capitalize">
                  {tOrder(`status.${getOrderStatusLabelKey(activeOrder.status)}`)}
                </p>
              </div>
            </div>
            <Link href={`/order/${activeOrder.id}`}>
              <Button variant="secondary"size="sm"className="bg-[var(--card)] text-[var(--accent-text)] hover:bg-[var(--accent-subtle)] border-transparent">
                {t('trackNow')} <ArrowRight className="h-3.5 w-3.5 ms-1"/>
              </Button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card>
              <div className={`inline-flex h-10 w-10 rounded-xl ${stat.bg} items-center justify-center mb-3`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold text-[var(--fg)]">{stat.value}</p>
              <p className="text-sm text-[var(--fg-muted)] mt-0.5">{stat.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-semibold text-[var(--fg)] mb-4">{t('quickActions')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.label} href={action.href}>
              <div className="group bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 text-center hover:border-[var(--accent-border)]/50 hover:shadow-lg transition-all duration-200 cursor-pointer">
                <div className={`mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br ${action.color} flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform shadow-lg`}>
                  {action.icon}
                </div>
                <p className="text-sm font-semibold text-[var(--fg)] group-hover:text-[var(--accent-text)] transition-colors">{action.label}</p>
                <p className="text-xs text-[var(--fg-muted)] mt-0.5">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[var(--fg)]">{t('recentOrders')}</h2>
          <Link href="/dashboard/orders"className="text-sm text-[var(--accent-text)] hover:text-[var(--accent-text)] flex items-center gap-1">
            {tCommon('viewAll')} <ArrowRight className="h-3.5 w-3.5"/>
          </Link>
        </div>
        <Card padding="none">
          {ordersLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map((i) => <div key={i} className="flex gap-3"><Skeleton className="h-12 w-12 rounded-xl"/><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2"/><Skeleton className="h-3 w-1/3"/></div></div>)}
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="h-8 w-8 text-[var(--fg-subtle)] mx-auto mb-2"/>
              <p className="text-sm text-[var(--fg-muted)]">{t('noOrdersYet')}</p>
              <Link href="/menu"><Button variant="outline"size="sm"className="mt-3">{t('orderNow')}</Button></Link>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {orders.slice(0, 4).map((order) => (
                <Link key={order.id} href={`/order/${order.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--card-hover)] transition-colors">
                  <div className="h-10 w-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-[var(--accent-text)]"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--fg)]">{order.order_number}</p>
                    <p className="text-xs text-[var(--fg-muted)]">{formatRelativeTime(order.created_at)}</p>
                  </div>
                  <div className="text-end shrink-0">
                    <Badge variant={STATUS_BADGE_MAP[order.status] || 'secondary'} className="mb-1 capitalize">
                      {tOrder(`status.${getOrderStatusLabelKey(order.status)}`)}
                    </Badge>
                    <p className="text-sm font-semibold text-[var(--fg)]">{formatCurrency(order.total)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Upcoming Reservations */}
      {reservations.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--fg)]">{t('upcomingReservations')}</h2>
            <Link href="/dashboard/reservations"className="text-sm text-[var(--accent-text)] hover:text-[var(--accent-text)] flex items-center gap-1">
              {tCommon('viewAll')} <ArrowRight className="h-3.5 w-3.5"/>
            </Link>
          </div>
          <div className="grid gap-4">
            {reservations.slice(0, 2).map((res) => (
              <Card key={res.id} className="flex items-center gap-4 !p-4">
                <div className="h-12 w-12 rounded-xl bg-[var(--chart-5)]/10 flex items-center justify-center shrink-0">
                  <Calendar className="h-6 w-6 text-[var(--chart-5)]"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--fg)]">{t('guestsTimeTemplate', { guests: res.guests, time: res.time })}</p>
                  <p className="text-sm text-[var(--fg-muted)]">
                    {formatDate(`${res.date}T00:00`)}
                    {res.business_name ? ` · ${res.business_name}` : ''}
                  </p>
                </div>
                <Badge variant={res.status === 'confirmed' ? 'success' : 'warning'}>
                  {t(`reservationStatus.${res.status}`)}
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
