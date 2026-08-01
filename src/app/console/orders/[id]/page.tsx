'use client'

import { use } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  User,
  MapPin,
  CreditCard,
  Hash,
  XCircle,
  Clock,
} from 'lucide-react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { Badge } from '@/components/ui'
import { formatCurrency } from '@/utils'
import { useOrder } from '@/hooks'
import { ORDER_STATUS_CONFIG } from '@/lib/order-status'
import type { OrderStatusHistory, OrderType, PaymentMethod, PaymentStatus } from '@/types'

const ORDER_TYPE_KEY: Record<OrderType, string> = { delivery: 'delivery', pickup: 'pickup', dine_in: 'dineIn' }
const PAYMENT_METHOD_KEY: Record<PaymentMethod, string> = { card: 'card', cash: 'cash', online: 'online', wallet: 'wallet' }
const PAYMENT_STATUS_KEY: Record<PaymentStatus, string> = {
  pending: 'paymentStatusPending',
  paid: 'paymentStatusPaid',
  failed: 'paymentStatusFailed',
  refunded: 'paymentStatusRefunded',
}

function TimelineItem({ entry, isLast }: { entry: OrderStatusHistory; isLast: boolean }) {
  const tOrder = useTranslations('order')
  const cfg = ORDER_STATUS_CONFIG[entry.status]
  const label = cfg ? tOrder(`status.${cfg.labelKey}`) : entry.status
  const Icon = cfg?.icon ?? Clock
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-gray-600" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" />}
      </div>
      <div className="pb-4">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleString()}</div>
        {entry.note && <div className="text-xs text-gray-600 mt-1">{entry.note}</div>}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 text-sm border-b last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

function OrderDetailContent({ id }: { id: string }) {
  const t = useTranslations('console')
  const tOrder = useTranslations('order')
  const tCheckout = useTranslations('checkout')
  const { data: order, isLoading, isError } = useOrder(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        {t('loadingOrder')}
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <XCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-gray-600">{t('orderNotFoundOrFailedToLoad')}</p>
        <Link href="/console/orders" className="text-sm text-blue-600 hover:underline">
          {t('backToOrders')}
        </Link>
      </div>
    )
  }

  const statusCfg = ORDER_STATUS_CONFIG[order.status]
  const statusLabel = statusCfg ? tOrder(`status.${statusCfg.labelKey}`) : order.status

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/console/orders" className="text-gray-400 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3 flex-1">
            <h1 className="text-lg font-semibold">{t('orderNumberHeading', { number: order.order_number })}</h1>
            <Badge variant={statusCfg?.badge ?? 'secondary'}>{statusLabel}</Badge>
          </div>
          <span className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString()}</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Summary */}
        <Section title={t('orderSummary')}>
          <Row label={t('tableHeaders.order')} value={`#${order.order_number}`} />
          <Row label={t('orderType')} value={<span className="capitalize">{tCheckout(ORDER_TYPE_KEY[order.order_type])}</span>} />
          <Row label={t('breadcrumbs.branches')} value={order.branch?.name ?? order.branch_id} />
          {order.table_number != null && <Row label={t('table')} value={order.table_number} />}
          <Row label={t('created')} value={new Date(order.created_at).toLocaleString()} />
          <Row label={t('updated')} value={new Date(order.updated_at).toLocaleString()} />
          {order.estimated_time != null && <Row label={t('estPrepTime')} value={t('minutesShort', { minutes: order.estimated_time })} />}
          {order.notes && <Row label={t('notes')} value={order.notes} />}
        </Section>

        {/* Items */}
        <Section title={t('tableHeaders.items')}>
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                <div>
                  <span className="font-medium">{item.menu_item?.name ?? t('item')}</span>
                  <span className="text-gray-400 ml-2">× {item.quantity}</span>
                  {item.notes && (
                    <div className="text-xs text-gray-500 mt-0.5">{item.notes}</div>
                  )}
                </div>
                <span>{formatCurrency(item.total_price)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>{t('subtotal')}</span><span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>{t('discount')} {order.discount_code ? `(${order.discount_code})` : ''}</span>
                <span>−{formatCurrency(order.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-500">
              <span>{t('tax')}</span><span>{formatCurrency(order.tax)}</span>
            </div>
            {order.service_charge > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>{t('serviceCharge')}</span><span>{formatCurrency(order.service_charge)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base pt-1 border-t">
              <span>{t('tableHeaders.total')}</span><span>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </Section>

        {/* Customer */}
        {order.user && (
          <Section title={t('tableHeaders.customer')}>
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="text-sm space-y-0.5">
                <div className="font-medium">{order.user.first_name} {order.user.last_name}</div>
                {order.user.email && <div className="text-gray-500">{order.user.email}</div>}
                {order.user.phone_number && <div className="text-gray-500">{order.user.phone_number}</div>}
              </div>
            </div>
          </Section>
        )}

        {/* Delivery Address */}
        {order.delivery_address && (
          <Section title={tCheckout('deliveryAddress')}>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                {order.delivery_address.formatted_address ? (
                  <div>{order.delivery_address.formatted_address}</div>
                ) : (
                  <>
                    <div>{order.delivery_address.street}</div>
                    <div className="text-gray-500">
                      {order.delivery_address.city}
                      {order.delivery_address.state ? `, ${order.delivery_address.state}` : ''}
                      {order.delivery_address.zip ?? order.delivery_address.postal_code ?? ''}
                    </div>
                  </>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* Payment */}
        <Section title={t('payment')}>
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-gray-400 shrink-0" />
            <div className="text-sm space-y-0.5">
              <Row label={t('method')} value={tCheckout(PAYMENT_METHOD_KEY[order.payment_method])} />
              <Row label={t('tableHeaders.status')} value={t(PAYMENT_STATUS_KEY[order.payment_status])} />
            </div>
          </div>
        </Section>

        {/* Timeline */}
        {order.status_history.length > 0 && (
          <Section title={t('statusHistory')}>
            <div className="mt-1">
              {order.status_history.map((entry, i) => (
                <TimelineItem
                  key={i}
                  entry={entry}
                  isLast={i === order.status_history.length - 1}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Audit link */}
        <div className="text-center">
          <Link
            href={`/console/audit-logs?resource=order&resourceId=${order.id}`}
            className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            <Hash className="w-3 h-3" />
            {t('viewAuditLogsForThisOrder')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <ErrorBoundary feature="Order Detail">
      <PermissionGuard permission="orders.view" fallback={<AccessDenied />}>
        <OrderDetailContent id={id} />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
