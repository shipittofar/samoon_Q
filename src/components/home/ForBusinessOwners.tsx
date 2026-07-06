import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, BarChart3, QrCode, Users, Star, Layers, Zap } from 'lucide-react'

const BENEFITS = [
  { icon: BarChart3, key: 'realtimeAnalytics' },
  { icon: QrCode, key: 'qrTableOrdering' },
  { icon: Users, key: 'teamManagement' },
  { icon: Star, key: 'loyaltyPrograms' },
  { icon: Layers, key: 'multiBranchReady' },
  { icon: Zap, key: 'liveOrderDisplay' },
]

export function ForBusinessOwners() {
  const t = useTranslations('home')
  return (
    <section className="py-20 bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <div>
            <span className="inline-block bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full mb-5">
              {t('forBusinessOwners.eyebrow')}
            </span>
            <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--fg)] mb-5 leading-tight">
              {t('forBusinessOwners.heading')}
            </h2>
            <p className="text-[var(--fg-muted)] leading-relaxed mb-8">
              {t('forBusinessOwners.subtitle')}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-3 rounded-2xl transition-all shadow-[0_8px_30px_-4px_rgba(249,115,22,0.4)] hover:-translate-y-0.5"
              >
                {t('forBusinessOwners.registerYourBusiness')} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/restaurant"
                className="inline-flex items-center gap-2 border border-[var(--border)] hover:border-orange-300 text-[var(--fg)] font-semibold px-5 py-3 rounded-2xl transition-all hover:-translate-y-0.5"
              >
                {t('forBusinessOwners.seeAllFeatures')}
              </Link>
            </div>
          </div>

          {/* Right — benefits grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {BENEFITS.map((b) => {
              const Icon = b.icon
              return (
                <div
                  key={b.key}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 hover:border-orange-200 dark:hover:border-orange-900 hover:shadow-md transition-all"
                >
                  <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5 text-orange-500" />
                  </div>
                  <h4 className="font-semibold text-[var(--fg)] text-sm mb-1">{t(`forBusinessOwners.benefits.${b.key}.title`)}</h4>
                  <p className="text-xs text-[var(--fg-muted)] leading-relaxed">{t(`forBusinessOwners.benefits.${b.key}.description`)}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
