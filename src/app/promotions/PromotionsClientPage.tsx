'use client'

import { useTranslations } from 'next-intl'
import { CapabilityGuard, CapabilityNotAvailable } from '@/components/guards/CapabilityGuard'
import { usePromotions, useActivePromotions } from '@/hooks'
import { promotionService } from '@/services/promotion.service'
import type { PromotionRule, PromotionType } from '@/types'

const TYPE_KEYS: Record<PromotionType, string> = {
  percentage_discount: 'percentageDiscount',
  fixed_discount:      'fixedDiscount',
  buy_one_get_one:     'buyOneGetOne',
  happy_hour:          'happyHour',
}

const WEEKDAY_KEYS: Record<number, string> = {
  1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat', 7: 'sun',
}

function formatDiscount(p: PromotionRule, t: ReturnType<typeof useTranslations>): string {
  if (p.type === 'buy_one_get_one') return t('bogo')
  if (p.discountPercent !== undefined) return t('percentOff', { percent: p.discountPercent })
  if (p.discountAmount !== undefined) return t('amountOff', { amount: p.discountAmount })
  return ''
}

function formatScheduleSummary(p: PromotionRule, t: ReturnType<typeof useTranslations>): string {
  const { schedule } = p
  const parts: string[] = []
  if (schedule.weekdays?.length) {
    parts.push(schedule.weekdays.map((d) => t(`weekdays.${WEEKDAY_KEYS[d]}`)).join(', '))
  }
  if (schedule.timeWindowStart && schedule.timeWindowEnd) {
    parts.push(`${schedule.timeWindowStart}–${schedule.timeWindowEnd}`)
  }
  if (schedule.endAt) {
    parts.push(t('untilDate', { date: new Date(schedule.endAt).toLocaleDateString() }))
  }
  return parts.join(' · ') || t('allDayEveryDay')
}

function PromotionCard({ promo }: { promo: PromotionRule }) {
  const t = useTranslations('promotionsPage')
  const isActive = promotionService.isPromotionActive(promo)
  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent-text)]">
              {t(`types.${TYPE_KEYS[promo.type]}`)}
            </span>
            {isActive && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--success-subtle)] text-[var(--success-text)]">
                {t('activeNow')}
              </span>
            )}
          </div>
          <p className="font-semibold text-[var(--fg)] mt-2">{promo.name}</p>
          <p className="text-sm text-[var(--fg-muted)] mt-0.5">{promo.description}</p>
          <p className="text-xs text-[var(--fg-muted)] mt-2">{formatScheduleSummary(promo, t)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-[var(--accent-text)]">{formatDiscount(promo, t)}</p>
        </div>
      </div>
    </li>
  )
}

function PromotionsContent() {
  const t = useTranslations('promotionsPage')
  const { data: all, isLoading: allLoading } = usePromotions()
  const { data: active, isLoading: activeLoading } = useActivePromotions()

  const happyHour = all?.filter((p) => p.type === 'happy_hour' && p.active) ?? []
  const upcoming = all?.filter(
    (p) => p.active && new Date(p.schedule.startAt) > new Date(),
  ) ?? []

  if (allLoading || activeLoading) {
    return <p className="text-[var(--fg-muted)]">{t('loadingPromotions')}</p>
  }

  return (
    <div className="space-y-10">
      {/* Active Promotions */}
      <section aria-labelledby="active-heading">
        <h2 id="active-heading"className="text-lg font-semibold text-[var(--fg)] mb-3">
          {t('activePromotions')}
        </h2>
        {!active?.length ? (
          <p className="text-[var(--fg-muted)] text-sm">{t('noActivePromotions')}</p>
        ) : (
          <ul className="space-y-3">
            {active.map((p) => <PromotionCard key={p.id} promo={p} />)}
          </ul>
        )}
      </section>

      {/* Happy Hour Offers */}
      <section aria-labelledby="happy-hour-heading">
        <h2 id="happy-hour-heading"className="text-lg font-semibold text-[var(--fg)] mb-3">
          {t('happyHourOffers')}
        </h2>
        {!happyHour.length ? (
          <p className="text-[var(--fg-muted)] text-sm">{t('noHappyHourOffers')}</p>
        ) : (
          <ul className="space-y-3">
            {happyHour.map((p) => <PromotionCard key={p.id} promo={p} />)}
          </ul>
        )}
      </section>

      {/* Upcoming Promotions */}
      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading"className="text-lg font-semibold text-[var(--fg)] mb-3">
          {t('upcomingPromotions')}
        </h2>
        {!upcoming.length ? (
          <p className="text-[var(--fg-muted)] text-sm">{t('noUpcomingPromotions')}</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((p) => <PromotionCard key={p.id} promo={p} />)}
          </ul>
        )}
      </section>
    </div>
  )
}

export function PromotionsClientPage() {
  const t = useTranslations('promotionsPage')
  return (
    <CapabilityGuard
      capability="menu"
      fallback={<CapabilityNotAvailable capability="menu"/>}
    >
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-6">{t('promotionsAndOffers')}</h1>
        <PromotionsContent />
      </main>
    </CapabilityGuard>
  )
}
