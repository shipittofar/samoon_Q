'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Clock, ChefHat, Bell, Bike, X } from 'lucide-react'
import { simulateOrderUpdates } from '@/services/websocket.service'
import { cn } from '@/utils'
import type { OrderStatus } from '@/types'

const STEPS: { status: OrderStatus; label: string; icon: React.ElementType; description: string }[] = [
  { status: 'pending', label: 'Order Placed', icon: Clock, description: 'Your order has been received' },
  { status: 'accepted', label: 'Accepted', icon: Check, description: 'Restaurant accepted your order' },
  { status: 'preparing', label: 'Preparing', icon: ChefHat, description: "Chef is crafting your meal" },
  { status: 'ready', label: 'Ready', icon: Bell, description: 'Your order is ready!' },
  { status: 'delivered', label: 'Delivered', icon: Bike, description: 'Enjoy your meal 🎉' },
]

const STATUS_ORDER: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'delivered']

interface OrderTrackerProps {
  orderId: string
  initialStatus?: OrderStatus
  useMockSimulation?: boolean
}

export function OrderTracker({ orderId, initialStatus = 'pending', useMockSimulation = true }: OrderTrackerProps) {
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>(initialStatus)
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null)
  const [isCancelled, setIsCancelled] = useState(initialStatus === 'cancelled')

  const currentIdx = STATUS_ORDER.indexOf(currentStatus)

  useEffect(() => {
    if (!useMockSimulation || isCancelled) return
    const cleanup = simulateOrderUpdates(orderId, (status, eta) => {
      setCurrentStatus(status as OrderStatus)
      setEstimatedTime(eta)
    })
    return cleanup
  }, [orderId, useMockSimulation, isCancelled])

  if (isCancelled) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
          <X className="h-8 w-8 text-red-500" />
        </div>
        <div>
          <h3 className="font-semibold text-[var(--fg)]">Order Cancelled</h3>
          <p className="text-sm text-[var(--fg-muted)] mt-1">Your order has been cancelled.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Estimated Time */}
      <AnimatePresence>
        {estimatedTime !== null && estimatedTime > 0 && (
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
              <p className="text-sm font-medium text-[var(--fg)]">Estimated time</p>
              <p className="text-lg font-bold text-orange-500">{estimatedTime} minutes</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bar */}
      <div className="relative">
        <div className="absolute top-5 start-5 end-5 h-0.5 bg-[var(--border)]" />
        <motion.div
          className="absolute top-5 start-5 h-0.5 bg-orange-500"
          initial={{ width: '0%' }}
          animate={{ width: currentIdx === -1 ? '0%' : `${(currentIdx / (STEPS.length - 1)) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />

        <div className="relative flex justify-between">
          {STEPS.map((step, idx) => {
            const stepIdx = STATUS_ORDER.indexOf(step.status)
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
                    {step.label}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Current Step Description */}
      <AnimatePresence mode="wait">
        {STEPS.find((s) => s.status === currentStatus) && (
          <motion.div
            key={currentStatus}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center py-4"
          >
            <div className="inline-flex items-center gap-2 bg-[var(--card-hover)] rounded-full px-4 py-2">
              {(() => {
                const step = STEPS.find((s) => s.status === currentStatus)!
                return (
                  <>
                    <step.icon className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium text-[var(--fg)]">{step.description}</span>
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
