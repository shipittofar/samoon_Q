'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { XCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function CheckoutFailurePage() {
  const t = useTranslations('checkoutResult')
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-2xl overflow-hidden text-center">
        <div className="bg-gradient-to-br from-red-400 to-red-600 p-8">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }} className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-white/20 mb-4">
            <XCircle className="h-10 w-10 text-white" />
          </motion.div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-white mb-1">{t('orderFailed')}</h1>
          <p className="text-white/80 text-sm">{t('orderFailedDesc')}</p>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-[var(--fg-muted)]">{t('failureBody')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/checkout"><Button className="w-full" leftIcon={<RefreshCw className="h-4 w-4" />}>{t('tryAgain')}</Button></Link>
            <Link href="/menu"><Button variant="secondary" className="w-full" leftIcon={<ArrowLeft className="h-4 w-4" />}>{t('backToMenu')}</Button></Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
