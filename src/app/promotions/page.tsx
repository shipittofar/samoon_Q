'use client'

import { CapabilityGuard, CapabilityNotAvailable } from '@/components/guards/CapabilityGuard'
import { usePromotions, useActivePromotions } from '@/hooks'
import { promotionService } from '@/services/promotion.service'
import type { PromotionRule, PromotionType } from '@/types'

const TYPE_LABELS: Record<PromotionType, string> = {
  percentage_discount: '% Off',
  fixed_discount:      'Fixed Discount',
  buy_one_get_one:     'Buy One Get One',
  happy_hour:          'Happy Hour',
}

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun',
}

function formatDiscount(p: PromotionRule): string {
  if (p.type === 'buy_one_get_one') return 'BOGO'
  if (p.discountPercent !== undefined) return `${p.discountPercent}% off`
  if (p.discountAmount !== undefined) return `$${p.discountAmount} off`
  return ''
}

function formatScheduleSummary(p: PromotionRule): string {
  const { schedule } = p
  const parts: string[] = []
  if (schedule.weekdays?.length) {
    parts.push(schedule.weekdays.map((d) => WEEKDAY_LABELS[d]).join(', '))
  }
  if (schedule.timeWindowStart && schedule.timeWindowEnd) {
    parts.push(`${schedule.timeWindowStart}–${schedule.timeWindowEnd}`)
  }
  if (schedule.endAt) {
    parts.push(`until ${new Date(schedule.endAt).toLocaleDateString()}`)
  }
  return parts.join(' · ') || 'All day, every day'
}

function PromotionCard({ promo }: { promo: PromotionRule }) {
  const isActive = promotionService.isPromotionActive(promo)
  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
              {TYPE_LABELS[promo.type]}
            </span>
            {isActive && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                Active Now
              </span>
            )}
          </div>
          <p className="font-semibold text-[var(--fg)] mt-2">{promo.name}</p>
          <p className="text-sm text-[var(--fg-muted)] mt-0.5">{promo.description}</p>
          <p className="text-xs text-[var(--fg-muted)] mt-2">{formatScheduleSummary(promo)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-[var(--primary)]">{formatDiscount(promo)}</p>
        </div>
      </div>
    </li>
  )
}

function PromotionsContent() {
  const { data: all, isLoading: allLoading } = usePromotions()
  const { data: active, isLoading: activeLoading } = useActivePromotions()

  const happyHour = all?.filter((p) => p.type === 'happy_hour' && p.active) ?? []
  const upcoming = all?.filter(
    (p) => p.active && new Date(p.schedule.startAt) > new Date(),
  ) ?? []

  if (allLoading || activeLoading) {
    return <p className="text-[var(--fg-muted)]">Loading promotions…</p>
  }

  return (
    <div className="space-y-10">
      {/* Active Promotions */}
      <section aria-labelledby="active-heading">
        <h2 id="active-heading" className="text-lg font-semibold text-[var(--fg)] mb-3">
          Active Promotions
        </h2>
        {!active?.length ? (
          <p className="text-[var(--fg-muted)] text-sm">No promotions are active right now.</p>
        ) : (
          <ul className="space-y-3">
            {active.map((p) => <PromotionCard key={p.id} promo={p} />)}
          </ul>
        )}
      </section>

      {/* Happy Hour Offers */}
      <section aria-labelledby="happy-hour-heading">
        <h2 id="happy-hour-heading" className="text-lg font-semibold text-[var(--fg)] mb-3">
          Happy Hour Offers
        </h2>
        {!happyHour.length ? (
          <p className="text-[var(--fg-muted)] text-sm">No happy hour offers available.</p>
        ) : (
          <ul className="space-y-3">
            {happyHour.map((p) => <PromotionCard key={p.id} promo={p} />)}
          </ul>
        )}
      </section>

      {/* Upcoming Promotions */}
      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="text-lg font-semibold text-[var(--fg)] mb-3">
          Upcoming Promotions
        </h2>
        {!upcoming.length ? (
          <p className="text-[var(--fg-muted)] text-sm">No upcoming promotions scheduled.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((p) => <PromotionCard key={p.id} promo={p} />)}
          </ul>
        )}
      </section>
    </div>
  )
}

export default function PromotionsPage() {
  return (
    <CapabilityGuard
      capability="menu"
      fallback={<CapabilityNotAvailable capability="menu" />}
    >
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--fg)] mb-6">Promotions & Offers</h1>
        <PromotionsContent />
      </main>
    </CapabilityGuard>
  )
}
