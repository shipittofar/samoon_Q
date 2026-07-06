'use client'

import { use, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  UtensilsCrossed, ArrowRight, Users, MapPin, User, Loader2,
  CalendarDays, Star, Heart, Music, Store, Tag, Navigation,
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Header } from '@/components/layout/Header'
import { CartDrawer, FloatingCart } from '@/components/cart/CartDrawer'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Footer } from '@/components/layout/Footer'
import { Button } from '@/components/ui/Button'
import { useTableInfo, useQRExperience } from '@/hooks'
import { useDineInStore, useTenantStore } from '@/stores'
import type { QRExperience } from '@/types/qr-experience'

interface QuickLink {
  href: string
  labelKey: string
  icon: React.ReactNode
}

function buildQuickLinks(exp: QRExperience): QuickLink[] {
  const links: QuickLink[] = []
  if (exp.showMenu)         links.push({ href: '/menu',         labelKey: 'browseMenu',     icon: <UtensilsCrossed className="h-5 w-5" /> })
  if (exp.showReservations) links.push({ href: '/reservation',  labelKey: 'reservations',   icon: <CalendarDays className="h-5 w-5" /> })
  if (exp.showReviews)      links.push({ href: '/reviews',      labelKey: 'reviews',        icon: <Star className="h-5 w-5" /> })
  if (exp.showLoyalty)      links.push({ href: '/loyalty',      labelKey: 'loyaltyRewards', icon: <Heart className="h-5 w-5" /> })
  if (exp.showEvents)       links.push({ href: '/events',       labelKey: 'events',         icon: <Music className="h-5 w-5" /> })
  if (exp.showVendors)      links.push({ href: '/vendors',      labelKey: 'vendors',        icon: <Store className="h-5 w-5" /> })
  if (exp.showLocation)     links.push({ href: '/location',     labelKey: 'liveLocation',   icon: <Navigation className="h-5 w-5" /> })
  if (exp.showPromotions)   links.push({ href: '/promotions',   labelKey: 'promotions',     icon: <Tag className="h-5 w-5" /> })
  return links
}

function QRExperienceQuickLinks({ experience }: { experience: QRExperience }) {
  const t = useTranslations('qrTable')
  const links = buildQuickLinks(experience)
  if (links.length === 0) return null
  return (
    <div className="mt-6">
      <p className="text-sm font-medium text-[var(--fg-muted)] mb-3">{t('explore')}</p>
      <div className="grid grid-cols-2 gap-2">
        {links.map((link) => (
          <Link key={link.href} href={link.href}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--fg)] hover:border-[var(--primary)] transition-colors">
            <span className="text-[var(--primary)]">{link.icon}</span>
            <span>{t(link.labelKey)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function TablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const t = useTranslations('qrTable')
  const { tableId } = use(params)
  const tableNumber = parseInt(tableId, 10) || 0
  const isValid = !(tableNumber < 1 || tableNumber > 100)

  const { data: tableInfo, isLoading: tableLoading } = useTableInfo(isValid ? tableId : null)
  const { setTableNumber, clearTable } = useDineInStore()

  const tenant = useTenantStore((s) => s.tenant)
  const primaryBusinessType = tenant?.businessTypes?.[0]
  const { data: experience } = useQRExperience(primaryBusinessType)

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
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-2">{t('invalidTable')}</h1>
          <p className="text-[var(--fg-muted)] mb-4">{t('invalidTableDesc')}</p>
          <Link href="/menu"><Button>{t('browseMenu')}</Button></Link>
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
                  {t('tableNumberLabel', { number: tableInfo?.number ?? tableNumber })}
                  {tableInfo?.section && <span className="font-normal text-white/80 text-sm ml-2">· {tableInfo.section}</span>}
                </p>
                <p className="text-white/80 text-sm">{t('dineInNoLoginRequired')}</p>
              </div>
            </div>
            <Link href={`/checkout?orderType=dine_in&table=${tableNumber}`}>
              <Button className="bg-white text-orange-600 hover:bg-orange-50 border-transparent shrink-0">
                {t('checkout')} <ArrowRight className="h-4 w-4 ms-1" />
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Main card */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-[var(--card)] rounded-3xl border border-[var(--border)] p-10 max-w-md mx-auto">
            <span className="text-6xl block mb-4">🍽️</span>
            <h2 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-2">{t('welcome')}</h2>
            <p className="text-[var(--fg-muted)] mb-6">{t('welcomeDesc', { number: tableInfo?.number ?? tableNumber })}</p>

            {/* Table metadata */}
            {tableLoading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-[var(--fg-muted)] mb-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('loadingTableInfoEllipsis')}</span>
              </div>
            ) : tableInfo && (
              <div className="flex flex-wrap justify-center gap-3 mb-6">
                {tableInfo.capacity && (
                  <div className="flex items-center gap-1.5 text-sm text-[var(--fg-muted)] bg-[var(--bg)] rounded-xl px-3 py-1.5">
                    <Users className="h-3.5 w-3.5 text-orange-500" />
                    <span>{t('seatsCount', { count: tableInfo.capacity })}</span>
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
                    <span>{t('serverLabel', { name: tableInfo.server_name })}</span>
                  </div>
                )}
              </div>
            )}

            <Link href="/menu" className="block">
              <Button className="w-full" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                {t('browseMenu')}
              </Button>
            </Link>

            {/* Business-specific quick links — driven by QRExperience, no business-type checks */}
            {experience && <QRExperienceQuickLinks experience={experience} />}
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
