'use client'

import { use, useEffect } from 'react'
import { motion } from 'framer-motion'
import { UtensilsCrossed, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { CartDrawer, FloatingCart } from '@/components/cart/CartDrawer'
import { Footer } from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { useCartStore } from '@/stores'

export default function TablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = use(params)
  const tableNumber = parseInt(tableId, 10) || 0

  if (!tableNumber || tableNumber < 1 || tableNumber > 100) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-center p-4">
        <div>
          <span className="text-5xl mb-4 block">❌</span>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-2">Invalid Table</h1>
          <p className="text-[var(--fg-muted)] mb-4">This QR code is not valid.</p>
          <Link href="/menu"><Button>Browse Menu</Button></Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <CartDrawer />
      <FloatingCart />

      {/* Welcome banner */}
      <div className="pt-20">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-500 to-orange-600 text-white py-5 px-4"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-lg">Table {tableNumber}</p>
                <p className="text-white/80 text-sm">Dine-in ordering — no login required</p>
              </div>
            </div>
            <Link href={`/checkout?orderType=dine_in&table=${tableNumber}`}>
              <Button className="bg-white text-orange-600 hover:bg-orange-50 border-transparent shrink-0">
                Checkout <ArrowRight className="h-4 w-4 ms-1" />
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Redirect to menu */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-[var(--card)] rounded-3xl border border-[var(--border)] p-10 max-w-md mx-auto">
            <span className="text-6xl block mb-4">🍽️</span>
            <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-2">Welcome!</h2>
            <p className="text-[var(--fg-muted)] mb-6">You are ordering from <strong className="text-[var(--fg)]">Table {tableNumber}</strong>. Browse our full menu and add items to your cart.</p>
            <Link href={`/menu`} className="block">
              <Button className="w-full" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Browse Menu
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
