'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Check, Clock, ChefHat, Bell, Bike, Truck, X, UtensilsCrossed } from 'lucide-react'
import { simulateOrderUpdates } from '@/services/websocket.service'
import { useOrderWebSocket } from '@/hooks/client'
import { cn } from '@/utils'
import {
  getTrackerStatusOrder,
  getTerminalOrderStatuses,
  usesDineInFulfillment,
  usesPickupFulfillment,
} from '@/lib/order-status'
import type { OrderStatus, OrderType } from '@/types'

const DELIVERY_STEPS: {
  status: OrderStatus
  labelKey: string
  icon: React.ElementType
  descriptionKey: string
}[] = [
  { status: 'pending', labelKey: 'orderPlaced', icon: Clock, descriptionKey: 'orderPlacedDesc' },
  { status: 'accepted', labelKey: 'accepted', icon: Check, descriptionKey: 'acceptedDesc' },
  { status: 'preparing', labelKey: 'preparing', icon: ChefHat, descriptionKey: 'preparingDesc' },
  { status: 'ready', labelKey: 'ready', icon: Bell, descriptionKey: 'readyDesc' },
  { status: 'delivered', labelKey: 'delivered', icon: Bike, descriptionKey: 'deliveredDesc' },
]

const PICKUP_STEPS: {
  status: OrderStatus
  labelKey: string
  icon: React.ElementType
  descriptionKey: string
}[] = [
  { status: 'pending', labelKey: 'orderPlaced', icon: Clock, descriptionKey: 'orderPlacedDesc' },
  { status: 'accepted', labelKey: 'accepted', icon: Check, descriptionKey: 'acceptedDesc' },
  { status: 'preparing', labelKey: 'preparing', icon: ChefHat, descriptionKey: 'preparingDesc' },
  { status: 'ready', labelKey: 'ready', icon: Bell, descriptionKey: 'readyDesc' },
  { status: 'picked_up', labelKey: 'pickedUp', icon: Truck, descriptionKey: 'pickedUpDesc' },
]

const DINE_IN_STEPS: {
  status: OrderStatus
  labelKey: string
  icon: React.ElementType
  descriptionKey: string
}[] = [
  { status: 'pending', labelKey: 'orderPlaced', icon: Clock, descriptionKey: 'orderPlacedDesc' },
  { status: 'accepted', labelKey: 'confirmed', icon: Check, descriptionKey: 'confirmedDesc' },
  { status: 'preparing', labelKey: 'preparing', icon: ChefHat, descriptionKey: 'preparingDesc' },
  { status: 'ready', labelKey: 'ready', icon: Bell, descriptionKey: 'readyDesc' },
  { status: 'served', labelKey: 'served', icon: UtensilsCrossed, descriptionKey: 'servedDesc' },
]

interface OrderTrackerProps {
  orderId: string
  initialStatus?: OrderStatus
  orderType?: OrderType
  initialEstimatedTime?: number | null
  useMockSimulation?: boolean
}

export function OrderTracker({
  orderId,
  initialStatus = 'pending',
  orderType,
  initialEstimatedTime = null,
  useMockSimulation = true,
}: OrderTrackerProps) {
  const t = useTranslations('orderTracker')
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>(initialStatus)
  const [estimatedTime, setEstimatedTime] = useState<number | null>(initialEstimatedTime)
  const [isCancelled, setIsCancelled] = useState(initialStatus === 'cancelled')

  const orderContext = useMemo(
    () => ({ status: currentStatus, order_type: orderType ?? 'delivery' as const }),
    [currentStatus, orderType],
  )
  const dineInWorkflow = usesDineInFulfillment(orderContext)
  const pickupWorkflow = usesPickupFulfillment(orderContext)
  const statusOrder = useMemo(() => getTrackerStatusOrder(orderContext), [orderContext])
  const steps = dineInWorkflow ? DINE_IN_STEPS : pickupWorkflow ? PICKUP_STEPS : DELIVERY_STEPS
  const terminalStatuses = getTerminalOrderStatuses(orderContext)

  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK === 'true'

  const shouldConnectWs = !isMockMode && useMockSimulation && !isCancelled
  const { status: wsStatus, estimatedTime: wsEta } = useOrderWebSocket(shouldConnectWs ? orderId : null)

  useEffect(() => {
    if (isMockMode || !wsStatus) return
    setCurrentStatus(wsStatus)
  }, [isMockMode, wsStatus])

  useEffect(() => {
    if (isMockMode || wsEta === null) return
    setEstimatedTime(wsEta)
  }, [isMockMode, wsEta])

  useEffect(() => {
    setCurrentStatus(initialStatus)
    setIsCancelled(initialStatus === 'cancelled')
  }, [initialStatus])

  useEffect(() => {
    if (initialEstimatedTime != null) {
      setEstimatedTime(initialEstimatedTime)
    }
  }, [initialEstimatedTime])

  const currentIdx = statusOrder.indexOf(currentStatus)

  useEffect(() => {
    if (!isMockMode || !useMockSimulation || isCancelled) return
    const cleanup = simulateOrderUpdates(orderId, (status, eta) => {
      setCurrentStatus(status as OrderStatus)
      setEstimatedTime(eta)
    })
    return cleanup
  }, [orderId, isMockMode, useMockSimulation, isCancelled])

  if (isCancelled) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
          <X className="h-8 w-8 text-red-500" />
        </div>
        <div>
          <h3 className="font-semibold text-[var(--fg)]">{t('orderCancelled')}</h3>
          <p className="text-sm text-[var(--fg-muted)] mt-1">{t('orderCancelledDesc')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {estimatedTime !== null && estimatedTime > 0 && !terminalStatuses.includes(currentStatus) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 bg-orange-50 dark:bg-orange-950/20 rounded-2xl p-4 border border-orange-200 dark:border-orange-900"
          >
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--fg)]">{t('estimatedTime')}</p>
              <p className="text-lg font-bold text-orange-500">{t('minutesCount', { count: estimatedTime })}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        <div className="absolute top-5 start-5 end-5 h-0.5 bg-[var(--border)]" />
        <motion.div
          className="absolute top-5 start-5 h-0.5 bg-orange-500"
          initial={{ width: '0%' }}
          animate={{ width: currentIdx === -1 ? '0%' : `${(currentIdx / (steps.length - 1)) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />

        <div className="relative flex justify-between">
          {steps.map((step) => {
            const stepIdx = statusOrder.indexOf(step.status)
            const done = stepIdx < currentIdx
            const active = stepIdx === currentIdx

            return (
              <div key={step.status} className="flex flex-col items-center gap-2 relative">
                <motion.div
                  className={cn(
                    'relative h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10',
                    done
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : active
                        ? 'bg-white dark:bg-[var(--card)] border-orange-500 text-orange-500 shadow-[var(--shadow-brand)]'
                        : 'bg-[var(--card)] border-[var(--border)] text-[var(--fg-subtle)]',
                  )}
                  animate={active ? { scale: [1, 1.1, 1] } : {}}
                  transition={active ? { repeat: Infinity, duration: 2 } : {}}
                >
                  {done ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <step.icon className={cn('h-4 w-4', active && 'animate-pulse')} />
                  )}
                  {active && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-orange-500"
                      animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    />
                  )}
                </motion.div>
                <div className="text-center hidden sm:block">
                  <p className={cn('text-xs font-medium', active ? 'text-orange-500' : done ? 'text-[var(--fg)]' : 'text-[var(--fg-subtle)]')}>
                    {t(step.labelKey)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {steps.find((s) => s.status === currentStatus) && (
          <motion.div
            key={currentStatus}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center py-4"
          >
            <div className="inline-flex items-center gap-2 bg-[var(--card-hover)] rounded-full px-4 py-2">
              {(() => {
                const step = steps.find((s) => s.status === currentStatus)!
                return (
                  <>
                    <step.icon className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium text-[var(--fg)]">{t(step.descriptionKey)}</span>
                  </>
                )
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
