'use client'

import { use, useEffect } from 'react'
import { motion } from 'framer-motion'
import { UtensilsCrossed, ArrowRight, Users, MapPin, User, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { CartDrawer, FloatingCart } from '@/components/cart/CartDrawer'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Footer } from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { useTableInfo } from '@/hooks'
import { useDineInStore } from '@/stores'

export default function TablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = use(params)
  const tableNumber = parseInt(tableId, 10) || 0
  const isValid = !(tableNumber < 1 || tableNumber > 100)

  const { data: tableInfo, isLoading: tableLoading } = useTableInfo(isValid ? tableId : null)
  const { setTableNumber, clearTable } = useDineInStore()

  // Persist table number so checkout can read it even after navigating away
  useEffect(() => {
    if (isValid) {
      setTableNumber(tableNumber)
    } else {
      clearTable()
    }
  }, [isValid, tableNumber, setTableNumber, clearTable])

  if (!isValid) {
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
      <ErrorBoundary feature="CartDrawer"><CartDrawer /></ErrorBoundary>
      <ErrorBoundary feature="FloatingCart"><FloatingCart /></ErrorBoundary>

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
                <p className="font-semibold text-lg">
                  Table {tableInfo?.number ?? tableNumber}
                  {tableInfo?.section && <span className="font-normal text-white/80 text-sm ml-2">· {tableInfo.section}</span>}
                </p>
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

        {/* Main card */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-[var(--card)] rounded-3xl border border-[var(--border)] p-10 max-w-md mx-auto">
            <span className="text-6xl block mb-4">🍽️</span>
            <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-2">Welcome!</h2>
            <p className="text-[var(--fg-muted)] mb-6">You are ordering from <strong className="text-[var(--fg)]">Table {tableInfo?.number ?? tableNumber}</strong>. Browse our full menu and add items to your cart.</p>

            {/* Table metadata */}
            {tableLoading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-[var(--fg-muted)] mb-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading table info…</span>
              </div>
            ) : tableInfo && (
              <div className="flex flex-wrap justify-center gap-3 mb-6">
                {tableInfo.capacity && (
                  <div className="flex items-center gap-1.5 text-sm text-[var(--fg-muted)] bg-[var(--bg)] rounded-xl px-3 py-1.5">
                    <Users className="h-3.5 w-3.5 text-orange-500" />
                    <span>Seats {tableInfo.capacity}</span>
                  </div>
                )}
                {tableInfo.section && (
                  <div className="flex items-center gap-1.5 text-sm text-[var(--fg-muted)] bg-[var(--bg)] rounded-xl px-3 py-1.5">
                    <MapPin className="h-3.5 w-3.5 text-orange-500" />
                    <span>{tableInfo.section}</span>
                  </div>
                )}
                {tableInfo.server_name && (
                  <div className="flex items-center gap-1.5 text-sm text-[var(--fg-muted)] bg-[var(--bg)] rounded-xl px-3 py-1.5">
                    <User className="h-3.5 w-3.5 text-orange-500" />
                    <span>Server: {tableInfo.server_name}</span>
                  </div>
                )}
              </div>
            )}

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
