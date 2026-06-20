'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { CheckCircle2, Package, ArrowRight, Home, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { OrderTracker } from '@/components/order/OrderTracker'
import confetti from 'canvas-confetti'

function SuccessContent() {
  const params = useSearchParams()
  const orderId = params.get('orderId') || ''
  const orderNumber = params.get('orderNumber') || '#0000'

  useEffect(() => {
    const fire = () => {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#f97316', '#fb923c', '#fdba74', '#fff7ed'] })
    }
    const t = setTimeout(fire, 300)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
              className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-white/20 mb-4"
            >
              <CheckCircle2 className="h-10 w-10 text-white" />
            </motion.div>
            <h1 className="font-[var(--font-display)] text-2xl font-bold text-white mb-1">Order Confirmed!</h1>
            <p className="text-white/80 text-sm">Your delicious meal is on its way</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Order Number */}
            <div className="text-center bg-[var(--card-hover)] rounded-2xl p-4">
              <p className="text-xs text-[var(--fg-muted)] uppercase tracking-wider mb-1">Order Number</p>
              <p className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{orderNumber}</p>
            </div>

            {/* Tracker */}
            <div>
              <h2 className="font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" /> Live Order Tracking
              </h2>
              <OrderTracker orderId={orderId} initialStatus="pending" useMockSimulation />
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Link href={`/order/${orderId}`}>
                <Button variant="secondary" className="w-full" leftIcon={<Package className="h-4 w-4" />}>
                  Track Order
                </Button>
              </Link>
              <Link href="/menu">
                <Button className="w-full" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Order More
                </Button>
              </Link>
            </div>
            <Link href="/" className="flex items-center justify-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors">
              <Home className="h-3.5 w-3.5" /> Back to Home
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default function CheckoutSuccessPage() {
  return <Suspense><SuccessContent /></Suspense>
}
