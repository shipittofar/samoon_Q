'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Calendar, Plus, Clock, Users, MapPin, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge, Card, Skeleton } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { useReservations } from '@/hooks'
import { formatDate } from '@/utils'
import { cn } from '@/utils'

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'secondary'> = {
  confirmed: 'success', pending: 'warning', cancelled: 'danger', completed: 'secondary',
}

const BRANCH_NAME_KEYS: Record<string, string> = {
  '1': 'mainBranch',
  '2': 'downtownBranch',
}

export default function ReservationsPage() {
  const { data, isLoading } = useReservations()
  const t = useTranslations('dashboard')
  const reservations = data?.results || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">{t('reservations')}</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">{t('totalReservationsCount', { count: data?.count || 0 })}</p>
        </div>
        <Link href="/reservation">
          <Button leftIcon={<Plus className="h-4 w-4"/>}>{t('newReservation')}</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-2xl"/>)}
        </div>
      ) : reservations.length === 0 ? (
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-12 text-center">
          <Calendar className="h-12 w-12 text-[var(--fg-subtle)] mx-auto mb-4"/>
          <h3 className="font-semibold text-[var(--fg)] mb-2">{t('noReservationsYet')}</h3>
          <p className="text-sm text-[var(--fg-muted)] mb-4">{t('bookTableForNextVisit')}</p>
          <Link href="/reservation"><Button>{t('bookATable')}</Button></Link>
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.map((res, i) => (
            <motion.div key={res.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="!p-0 overflow-hidden">
                <div className={cn('h-1', res.status === 'confirmed' ? 'bg-[var(--success)]' : res.status === 'cancelled' ? 'bg-[var(--danger)]' : 'bg-[var(--warning)]')} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-[var(--fg)]">{res.name}</p>
                        <Badge variant={STATUS_BADGE[res.status] || 'secondary'} className="capitalize">{res.status}</Badge>
                      </div>
                      {res.confirmation_code && (
                        <p className="text-xs text-[var(--fg-muted)]">{t('codeLabel')} <span className="font-mono font-semibold text-[var(--accent-text)]">{res.confirmation_code}</span></p>
                      )}
                    </div>
                    {res.status !== 'cancelled' && res.status !== 'completed' && (
                      <Button variant="ghost"size="icon-sm"className="text-[var(--danger-text)] hover:text-[var(--danger-text)] hover:bg-[var(--danger-subtle)]">
                        <X className="h-4 w-4"/>
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    {[
                      { icon: Calendar, label: formatDate(res.date) },
                      { icon: Clock, label: res.time },
                      { icon: Users, label: t('guestsCount', { count: res.guests }) },
                      { icon: MapPin, label: t(BRANCH_NAME_KEYS[res.branch_id] ?? 'airportBranch') },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center gap-2 text-[var(--fg-muted)]">
                        <Icon className="h-3.5 w-3.5 text-[var(--accent-text)] shrink-0"/>
                        <span className="truncate">{label}</span>
                      </div>
                    ))}
                  </div>
                  {res.notes && (
                    <p className="mt-3 text-xs text-[var(--fg-muted)] italic bg-[var(--card-hover)] rounded-lg px-3 py-2">
                        &quot;{res.notes}&quot;
                    </p>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
