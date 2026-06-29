import { Star } from 'lucide-react'

const TESTIMONIALS = [
  {
    quote:
      'Found three new restaurants in my neighbourhood using the category search. Booked a table and ordered — all from one place.',
    name: 'Sarah M.',
    role: 'Food Explorer',
    rating: 5,
  },
  {
    quote:
      'The QR ordering at my favourite café is seamless. No waiting for a waiter, and my loyalty points stack up every visit.',
    name: 'James T.',
    role: 'Regular Diner',
    rating: 5,
  },
  {
    quote:
      'Discovered a food truck pop-up through Savor that I would never have found otherwise. Now I check it every weekend.',
    name: 'Layla K.',
    role: 'Food Enthusiast',
    rating: 5,
  },
]

const TRUST_STATS = [
  { value: '50k+', label: 'Happy Customers' },
  { value: '4.8', label: 'Avg. App Rating' },
  { value: '500+', label: 'Businesses Listed' },
  { value: '98%', label: 'Satisfaction Rate' },
]

export function PlatformTestimonials() {
  return (
    <section className="py-20 bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-medium text-orange-500 uppercase tracking-widest mb-3">Loved by Diners</p>
          <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--fg)] mb-4">
            What Our Community Says
          </h2>
          <p className="text-[var(--fg-muted)] max-w-xl mx-auto">
            Thousands of food lovers use Savor every day to discover, book, and order from local businesses.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="flex gap-0.5">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-sm text-[var(--fg-muted)] leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
              <div>
                <p className="font-semibold text-sm text-[var(--fg)]">{t.name}</p>
                <p className="text-xs text-[var(--fg-subtle)]">{t.role}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Trust stats band */}
        <div className="bg-orange-500 rounded-3xl px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {TRUST_STATS.map((s) => (
            <div key={s.label}>
              <p className="font-[var(--font-display)] text-3xl font-bold text-white">{s.value}</p>
              <p className="text-sm text-orange-100 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
