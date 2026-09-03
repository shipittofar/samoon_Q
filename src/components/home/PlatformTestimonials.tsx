import { useTranslations } from 'next-intl'
import { Star } from 'lucide-react'

const TESTIMONIALS = [
  { key: 'sarah', rating: 5 },
  { key: 'james', rating: 5 },
  { key: 'layla', rating: 5 },
]

const TRUST_STATS = [
  { value: '50k+', key: 'happyCustomers' },
  { value: '4.8', key: 'avgAppRating' },
  { value: '500+', key: 'businessesListed' },
  { value: '98%', key: 'satisfactionRate' },
]

export function PlatformTestimonials() {
  const t = useTranslations('home')
  return (
    <section className="py-20 bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-medium text-[var(--accent-text)] uppercase tracking-widest mb-3">{t('testimonials.eyebrow')}</p>
          <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--fg)] mb-4">
            {t('testimonials.heading')}
          </h2>
          <p className="text-[var(--fg-muted)] max-w-xl mx-auto">
            {t('testimonials.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {TESTIMONIALS.map((item) => (
            <div
              key={item.key}
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: item.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-[var(--rating)] fill-[var(--rating)]"/>
                ))}
              </div>
              <p className="text-sm text-[var(--fg-muted)] leading-relaxed flex-1">&ldquo;{t(`testimonials.items.${item.key}.quote`)}&rdquo;</p>
              <div>
                <p className="font-semibold text-sm text-[var(--fg)]">{t(`testimonials.items.${item.key}.name`)}</p>
                <p className="text-xs text-[var(--fg-subtle)]">{t(`testimonials.items.${item.key}.role`)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Trust stats band */}
        <div className="bg-[var(--accent)] rounded-3xl px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {TRUST_STATS.map((s) => (
            <div key={s.key}>
              <p className="font-[var(--font-display)] text-3xl font-bold text-white">{s.value}</p>
              <p className="text-sm text-orange-100 mt-1">{t(`testimonials.stats.${s.key}`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
