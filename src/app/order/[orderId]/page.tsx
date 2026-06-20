'use client'

import { use } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, MapPin, Phone, Clock, Package, CheckCircle2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { OrderTracker } from '@/components/order/OrderTracker'
import { Card } from '@/components/ui'
import { Badge } from '@/components/ui'
import { Skeleton } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { useOrder } from '@/hooks'
import { formatCurrency, formatDate, formatTime } from '@/utils'

const STATUS_BADGE_MAP: Record<string, 'success' | 'warning' | 'info' | 'purple' | 'danger' | 'secondary'> = {
  delivered: 'success', pending: 'warning', accepted: 'info',
  preparing: 'purple', ready: 'success', cancelled: 'danger',
}

export default function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params)
  const { data: order, isLoading } = useOrder(orderId)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <Header />
        <div className="pt-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <Header />
        <div className="text-center pt-24">
          <Package className="h-12 w-12 text-[var(--fg-subtle)] mx-auto mb-4" />
          <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-2">Order not found</h2>
          <Link href="/dashboard/orders"><Button>My Orders</Button></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <div className="pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back */}
          <div className="flex items-center gap-4 mb-8 pt-4">
            <Link href="/dashboard/orders">
              <Button variant="ghost" size="icon-sm"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">Order {order.order_number}</h1>
              <p className="text-sm text-[var(--fg-muted)]">{formatDate(order.created_at)} at {formatTime(order.created_at)}</p>
            </div>
            <Badge variant={STATUS_BADGE_MAP[order.status] || 'secondary'} className="ms-auto capitalize text-sm py-1.5 px-3">
              {order.status?.replace('_', ' ')}
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left */}
            <div className="lg:col-span-2 space-y-6">
              {/* Tracker */}
              {order.status !== 'cancelled' && (
                <Card>
                  <h2 className="font-semibold text-[var(--fg)] mb-6 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" /> Live Tracking
                  </h2>
                  <OrderTracker
                    orderId={order.id}
                    initialStatus={order.status}
                    useMockSimulation={order.status !== 'delivered'}
                  />
                </Card>
              )}

              {/* Items */}
              <Card>
                <h2 className="font-semibold text-[var(--fg)] mb-4">Order Items</h2>
                {order.items && order.items.length > 0 ? (
                  <div className="space-y-4">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex gap-3 items-start">
                        <div className="relative h-14 w-14 rounded-xl overflow-hidden shrink-0">
                          <Image src={item.menu_item.image} alt={item.menu_item.name} fill className="object-cover" sizes="56px" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--fg)] truncate">{item.menu_item.name}</p>
                          {item.extras?.length > 0 && <p className="text-xs text-[var(--fg-muted)]">+{item.extras.map(e => e.name).join(', ')}</p>}
                          <p className="text-sm text-[var(--fg-muted)]">
                            ×{item.quantity}
                            {item.quantity > 1 && item.unit_price && (
                              <span className="ml-2">
                                ({formatCurrency(item.unit_price)} each)
                              </span>
                            )}
                          </p>                        
                          </div>
                        <span className="font-semibold text-[var(--fg)] shrink-0">{formatCurrency(item.total_price)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--fg-muted)]">Order details not available.</p>
                )}
              </Card>
            </div>

            {/* Right: Summary */}
            <div className="space-y-4">
              <Card>
                <h2 className="font-semibold text-[var(--fg)] mb-4">Order Summary</h2>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between text-[var(--fg-muted)]"><span>Subtotal</span><span>{formatCurrency(order.subtotal || 0)}</span></div>
                  {order.discount_amount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−{formatCurrency(order.discount_amount)}</span></div>}
                  <div className="flex justify-between text-[var(--fg-muted)]"><span>Tax</span><span>{formatCurrency(order.tax || 0)}</span></div>
                  <div className="flex justify-between text-[var(--fg-muted)]"><span>Service</span><span>{formatCurrency(order.service_charge || 0)}</span></div>
                  <div className="flex justify-between font-bold text-[var(--fg)] text-base pt-2 border-t border-[var(--border)]">
                    <span>Total</span><span>{formatCurrency(order.total)}</span>
                  </div>
                  <Button className="w-full" size="sm" variant="secondary">Print Receipt</Button>
                </div>
              </Card>

              <Card>
                <h2 className="font-semibold text-[var(--fg)] mb-4">Delivery Info</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2 text-[var(--fg-muted)]">
                    <Package className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
                    <span className="capitalize">{order.order_type?.replace('_', ' ')}</span>
                  </div>
                  {order.delivery_address && (
                    <div className="flex items-start gap-2 text-[var(--fg-muted)]">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
                      <span>{order.delivery_address.street}, {order.delivery_address.city}</span>
                    </div>
                  )}
                  {order.table_number && (
                    <div className="flex items-center gap-2 text-[var(--fg-muted)]">
                      <CheckCircle2 className="h-4 w-4 text-orange-500" />
                      <span>Table #{order.table_number}</span>
                    </div>
                  )}
                </div>
              </Card>
              <div className="font-semibold text-[var(--fg)] mb-4">
                <Link href="/menu">
                  <Button className="w-full" variant="outline">Order Again</Button>
                </Link>
              </div>
              <Link href="/menu">
                <Button className="w-full" variant="outline">New Order</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
