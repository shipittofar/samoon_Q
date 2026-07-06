import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Search, Store, ShoppingBag } from 'lucide-react'

const STEPS = [
  {
    step: '01',
    icon: Search,
    key: 'discover',
    href: '/discover',
    color: 'bg-orange-50 dark:bg-orange-950/20 text-orange-500',
    border: 'border-orange-200 dark:border-orange-900',
  },
  {
    step: '02',
    icon: Store,
    key: 'pickLocation',
    href: '/discover',
    color: 'bg-blue-50 dark:bg-blue-950/20 text-blue-500',
    border: 'border-blue-200 dark:border-blue-900',
  },
  {
    step: '03',
    icon: ShoppingBag,
    key: 'orderOrReserve',
    href: '/reservation',
    color: 'bg-green-50 dark:bg-green-950/20 text-green-500',
    border: 'border-green-200 dark:border-green-900',
  },
]

export function HowItWorks() {
  const t = useTranslations('home')
  return (
    <section className="py-20 bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-medium text-orange-500 uppercase tracking-widest mb-3">{t('howItWorks.eyebrow')}</p>
          <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--fg)] mb-4">
            {t('howItWorks.heading')}
          </h2>
          <p className="text-[var(--fg-muted)] max-w-xl mx-auto">
            {t('howItWorks.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line — desktop only */}
          <div className="hidden md:block absolute top-14 start-[33%] end-[33%] h-px bg-[var(--border)]" />

          {STEPS.map((step) => {
            const Icon = step.icon
            return (
              <div key={step.step} className="relative flex flex-col items-center text-center">
                <div
                  className={`h-28 w-28 rounded-3xl border-2 ${step.border} ${step.color} flex items-center justify-center mb-6 relative z-10 bg-[var(--card)]`}
                >
                  <Icon className="h-10 w-10" />
                  <span className="absolute -top-3 -end-3 h-7 w-7 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shadow-md">
                    {step.step}
                  </span>
                </div>
                <h3 className="font-[var(--font-display)] text-xl font-bold text-[var(--fg)] mb-3">
                  {t(`howItWorks.steps.${step.key}.title`)}
                </h3>
                <p className="text-sm text-[var(--fg-muted)] leading-relaxed mb-5 max-w-xs">
                  {t(`howItWorks.steps.${step.key}.description`)}
                </p>
                <Link
                  href={step.href}
                  className="text-sm font-medium text-orange-500 hover:text-orange-600 hover:underline transition-colors"
                >
                  {t(`howItWorks.steps.${step.key}.cta`)} →
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
