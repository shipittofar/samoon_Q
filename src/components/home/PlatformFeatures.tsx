import Link from 'next/link'
import { ArrowRight, UtensilsCrossed, CalendarCheck, QrCode, Gift, BarChart2, Monitor, CreditCard, GitBranch, Ticket, PartyPopper } from 'lucide-react'

const FEATURES = [
  { icon: UtensilsCrossed, label: 'Online Menu', description: 'Beautiful digital menus with photos, descriptions, and dietary tags.' },
  { icon: CalendarCheck, label: 'Reservations', description: 'Real-time table booking with confirmation and reminders.' },
  { icon: QrCode, label: 'QR Ordering', description: 'Scan-to-order at the table. No app, no waiting.' },
  { icon: Gift, label: 'Loyalty', description: 'Points, tiers, and custom rewards to keep customers coming back.' },
  { icon: BarChart2, label: 'Analytics', description: 'Revenue, order trends, and customer insights in real time.' },
  { icon: Monitor, label: 'Kitchen Display', description: 'Live order stream to your kitchen display system.' },
  { icon: CreditCard, label: 'POS Integration', description: 'Sync with your existing point-of-sale system seamlessly.' },
  { icon: GitBranch, label: 'Multi-Branch', description: 'Unlimited branches, each independently configurable.' },
  { icon: Ticket, label: 'Gift Cards', description: 'Sell and redeem digital gift cards across all branches.' },
  { icon: PartyPopper, label: 'Events', description: 'Publish and manage special events and promotions.' },
]

export function PlatformFeatures() {
  return (
    <section className="py-20 bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-medium text-orange-500 uppercase tracking-widest mb-3">Platform</p>
          <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--fg)] mb-4">
            Everything in One Platform
          </h2>
          <p className="text-[var(--fg-muted)] max-w-xl mx-auto">
            Savor provides the complete digital stack for modern hospitality businesses — no third-party patchwork required.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.label}
                className="group bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 text-center hover:border-orange-200 dark:hover:border-orange-900 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="h-12 w-12 rounded-2xl bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center mx-auto mb-3 group-hover:bg-orange-100 dark:group-hover:bg-orange-950/40 transition-colors">
                  <Icon className="h-6 w-6 text-orange-500" />
                </div>
                <h3 className="font-semibold text-sm text-[var(--fg)] mb-1 group-hover:text-orange-500 transition-colors">
                  {f.label}
                </h3>
                <p className="text-xs text-[var(--fg-subtle)] leading-relaxed hidden lg:block">
                  {f.description}
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
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-sm text-[var(--fg-muted)]">
            No credit card required · Set up in minutes
          </p>
        </div>
      </div>
    </section>
  )
}
