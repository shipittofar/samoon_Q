'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { CheckCircle2, Calendar, Clock, Users, User, MapPin, Download, ExternalLink, Home, CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { downloadIcs, buildGoogleCalendarUrl } from '@/lib/calendar'
import { useTranslations } from 'next-intl'

function ReservationConfirmContent() {
  const t = useTranslations('reservation')
  const params = useSearchParams()

  const code = params.get('code') || ''
  const date = params.get('date') || ''
  const time = params.get('time') || ''
  const guests = params.get('guests') || ''
  const name = params.get('name') || ''
  const branch = params.get('branch') || ''
  const status = params.get('status') || ''
  const id = params.get('id') || ''

  // Graceful fallback when arriving without reservation context
  if (!code && !date) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4 pt-24">
          <div className="max-w-md w-full bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-xl p-8 text-center">
            <Calendar className="h-12 w-12 text-[var(--fg-subtle)] mx-auto mb-4" />
            <h1 className="font-[var(--font-display)] text-xl font-bold text-[var(--fg)] mb-2">{t('noReservationFoundTitle')}</h1>
            <p className="text-sm text-[var(--fg-muted)] mb-6">
              {t('noReservationFoundDesc')}
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/reservation"><Button className="w-full">{t('title')}</Button></Link>
              <Link href="/dashboard/reservations"><Button variant="secondary" className="w-full">{t('myReservations')}</Button></Link>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  const calendarEvent = {
    title: `Dinner Reservation at ${branch || 'Savor'}`,
    date,
    time,
    durationMinutes: 120,
    description: `Confirmation code: ${code} · Guests: ${guests} · Name: ${name}`,
    location: branch || 'Savor Platform',
    uid: id ? `${id}@savor` : undefined,
  }

  const googleUrl = buildGoogleCalendarUrl(calendarEvent)

  const handleDownloadIcs = () => {
    downloadIcs(calendarEvent, `reservation-${code || 'savor'}.ics`)
  }

  const displayDate = date
    ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  const details = [
    { icon: User, label: t('nameLabel'), value: name },
    { icon: Calendar, label: t('dateLabel'), value: displayDate || date },
    { icon: Clock, label: t('timeLabel'), value: time },
    { icon: Users, label: t('guests'), value: t('peopleSuffix', { count: Number(guests) || 0 }) },
    ...(branch ? [{ icon: MapPin, label: t('branchLabel'), value: branch }] : []),
  ].filter((d) => d.value)

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center p-4 pt-24 pb-16">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="max-w-md w-full"
        >
          <div className="bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-2xl overflow-hidden">
            {/* Header band */}
            <div className="bg-gradient-to-br from-orange-400 to-orange-600 p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
                className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-white/20 mb-4"
              >
                <CheckCircle2 className="h-10 w-10 text-white" />
              </motion.div>
              <h1 className="font-[var(--font-display)] text-2xl font-bold text-white mb-1">{t('confirmed')}</h1>
              <p className="text-white/80 text-sm">{t('lookForwardToSeeing')}</p>
              {status && (
                <span className="inline-block mt-2 px-3 py-0.5 rounded-full bg-white/20 text-white text-xs font-medium capitalize">
                  {status}
                </span>
              )}
            </div>

            <div className="p-6 space-y-5">
              {/* Confirmation code */}
              <div className="bg-[var(--card-hover)] rounded-2xl p-4 text-center">
                <p className="text-xs text-[var(--fg-muted)] uppercase tracking-wider mb-1">{t('confirmationCode')}</p>
                <p className="font-[var(--font-display)] text-2xl font-bold text-orange-500 tracking-widest">{code}</p>
              </div>

              {/* Reservation details */}
              <div className="space-y-3">
                {details.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-xs text-[var(--fg-muted)]">{label}</p>
                      <p className="text-sm font-medium text-[var(--fg)]">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Calendar actions */}
              <div className="border border-[var(--border)] rounded-2xl p-4 space-y-2">
                <p className="text-xs font-semibold text-[var(--fg)] flex items-center gap-1.5 mb-3">
                  <CalendarPlus className="h-3.5 w-3.5 text-orange-500" />
                  {t('addToCalendar')}
                </p>
                <button
                  onClick={handleDownloadIcs}
                  className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--fg)] hover:bg-[var(--card-hover)] hover:border-orange-300 transition-all text-start"
                  aria-label={t('downloadIcsAria')}
                >
                  <Download className="h-4 w-4 text-orange-500 shrink-0" />
                  {t('downloadIcsFile')}
                </button>
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--fg)] hover:bg-[var(--card-hover)] hover:border-orange-300 transition-all"
                  aria-label={t('addToGoogleCalendarAria')}
                >
                  <ExternalLink className="h-4 w-4 text-orange-500 shrink-0" />
                  {t('addToGoogleCalendar')}
                </a>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-1">
                <Link href="/reservation">
                  <Button variant="secondary" className="w-full">{t('makeAnotherReservation')}</Button>
                </Link>
                <Link href="/" className="flex items-center justify-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors">
                  <Home className="h-3.5 w-3.5" /> {t('backToHome')}
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  )
}

export default function ReservationConfirmPage() {
  return <Suspense><ReservationConfirmContent /></Suspense>
}
