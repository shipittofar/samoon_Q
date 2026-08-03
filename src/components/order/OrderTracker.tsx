'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Check, Clock, X } from 'lucide-react'
import { simulateOrderUpdates } from '@/services/websocket.service'
import { useOrderWebSocket } from '@/hooks/client'
import { cn } from '@/utils'
import { getOrderStatusTimeline } from '@/lib/order-status'
import { humanizeWireValue } from '@/lib/humanize'
import type { Order, OrderStatusTimelineEntry } from '@/types'

interface OrderTrackerProps {
  orderId: string
  order?: Pick<Order, 'status' | 'status_label' | 'status_timeline' | 'status_history' | 'estimated_time'>
  initialStatus?: string
  useMockSimulation?: boolean
}

function timelineLabel(entry: OrderStatusTimelineEntry): string {
  return entry.label ?? humanizeWireValue(entry.status)
}

export function OrderTracker({
  orderId,
  order,
  initialStatus = 'pending',
  useMockSimulation = true,
}: OrderTrackerProps) {
  const t = useTranslations('orderTracker')
  const timeline = useMemo(
    () => (order ? getOrderStatusTimeline(order as Order) : []),
    [order],
  )

  const [currentStatus, setCurrentStatus] = useState(initialStatus)
  const [estimatedTime, setEstimatedTime] = useState<number | null>(
    order?.estimated_time ?? null,
  )
  const [isCancelled, setIsCancelled] = useState(
    initialStatus === 'cancelled' || order?.status === 'cancelled',
  )

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
    if (order?.status) {
      setCurrentStatus(order.status)
      setIsCancelled(order.status === 'cancelled')
    } else {
      setCurrentStatus(initialStatus)
      setIsCancelled(initialStatus === 'cancelled')
    }
    if (order?.estimated_time != null) setEstimatedTime(order.estimated_time)
  }, [order?.status, order?.estimated_time, initialStatus])

  useEffect(() => {
    if (!isMockMode || !useMockSimulation || isCancelled) return
    const cleanup = simulateOrderUpdates(orderId, (status, eta) => {
      setCurrentStatus(status)
      setEstimatedTime(eta)
    })
    return cleanup
  }, [orderId, isMockMode, useMockSimulation, isCancelled])

  const currentIdx = timeline.findIndex(
    (step) => step.current === true || step.status === currentStatus,
  )
  const resolvedIdx = currentIdx >= 0 ? currentIdx : timeline.length - 1
  const currentEntry = timeline.find((s) => s.status === currentStatus)

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

  if (!timeline.length) {
    return (
      <div className="text-center py-6">
        <p className="text-sm font-medium text-[var(--fg)]">
          {order?.status_label ?? humanizeWireValue(currentStatus)}
        </p>
        {estimatedTime != null && estimatedTime > 0 && (
          <p className="text-sm text-[var(--fg-muted)] mt-2">
            {t('minutesCount', { count: estimatedTime })}
          </p>
        )}
      </div>
    )
  }

  const terminal = timeline[timeline.length - 1]
  const isTerminal = currentStatus === terminal.status

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {estimatedTime !== null && estimatedTime > 0 && !isTerminal && (
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
          animate={{
            width:
              resolvedIdx <= 0
                ? '0%'
                : `${(resolvedIdx / (timeline.length - 1)) * 100}%`,
          }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />

        <div className="relative flex justify-between">
          {timeline.map((step, stepIdx) => {
            const done = stepIdx < resolvedIdx || step.completed === true
            const active = stepIdx === resolvedIdx || step.current === true

            return (
              <div key={`${step.status}-${stepIdx}`} className="flex flex-col items-center gap-2 relative">
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
                  {done ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  {active && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-orange-500"
                      animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    />
                  )}
                </motion.div>
                <div className="text-center hidden sm:block">
                  <p
                    className={cn(
                      'text-xs font-medium',
                      active ? 'text-orange-500' : done ? 'text-[var(--fg)]' : 'text-[var(--fg-subtle)]',
                    )}
                  >
                    {timelineLabel(step)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {(currentEntry || timeline[resolvedIdx]) && (
          <motion.div
            key={currentStatus}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center py-4"
          >
            <div className="inline-flex items-center gap-2 bg-[var(--card-hover)] rounded-full px-4 py-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-[var(--fg)]">
                {currentEntry?.description ??
                  timelineLabel(currentEntry ?? timeline[resolvedIdx])}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
