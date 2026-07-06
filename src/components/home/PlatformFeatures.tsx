import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, UtensilsCrossed, CalendarCheck, QrCode, Gift, BarChart2, Monitor, CreditCard, GitBranch, Ticket, PartyPopper } from 'lucide-react'

const FEATURES = [
  { icon: UtensilsCrossed, key: 'onlineMenu' },
  { icon: CalendarCheck, key: 'reservations' },
  { icon: QrCode, key: 'qrOrdering' },
  { icon: Gift, key: 'loyalty' },
  { icon: BarChart2, key: 'analytics' },
  { icon: Monitor, key: 'kitchenDisplay' },
  { icon: CreditCard, key: 'posIntegration' },
  { icon: GitBranch, key: 'multiBranch' },
  { icon: Ticket, key: 'giftCards' },
  { icon: PartyPopper, key: 'events' },
]

export function PlatformFeatures() {
  const t = useTranslations('home')
  return (
    <section className="py-20 bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-medium text-orange-500 uppercase tracking-widest mb-3">{t('platformFeatures.eyebrow')}</p>
          <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--fg)] mb-4">
            {t('platformFeatures.heading')}
          </h2>
          <p className="text-[var(--fg-muted)] max-w-xl mx-auto">
            {t('platformFeatures.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.key}
                className="group bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 text-center hover:border-orange-200 dark:hover:border-orange-900 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="h-12 w-12 rounded-2xl bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center mx-auto mb-3 group-hover:bg-orange-100 dark:group-hover:bg-orange-950/40 transition-colors">
                  <Icon className="h-6 w-6 text-orange-500" />
                </div>
                <h3 className="font-semibold text-sm text-[var(--fg)] mb-1 group-hover:text-orange-500 transition-colors">
                  {t(`platformFeatures.items.${f.key}.label`)}
                </h3>
                <p className="text-xs text-[var(--fg-subtle)] leading-relaxed hidden lg:block">
                  {t(`platformFeatures.items.${f.key}.description`)}
                </p>
              </div>
            )
          })}
        </div>

        {/* H5: closing CTA so the features section doesn't end cold. */}
        <div className="mt-12 text-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3.5 rounded-2xl transition-all shadow-[0_8px_30px_-4px_rgba(249,115,22,0.4)] hover:shadow-[0_12px_40px_-4px_rgba(249,115,22,0.5)] hover:-translate-y-0.5"
          >
            {t('platformFeatures.getStartedFree')}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-sm text-[var(--fg-muted)]">
            {t('platformFeatures.noCreditCardNote')}
          </p>
        </div>
      </div>
    </section>
  )
}
