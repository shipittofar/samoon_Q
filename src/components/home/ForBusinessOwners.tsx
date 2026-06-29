import Link from 'next/link'
import { ArrowRight, BarChart3, QrCode, Users, Star, Layers, Zap } from 'lucide-react'

const BENEFITS = [
  { icon: BarChart3, title: 'Real-time Analytics', description: 'Track orders, revenue, and customer trends across all your branches from one dashboard.' },
  { icon: QrCode, title: 'QR Table Ordering', description: 'Let guests scan and order directly from their table — no app download required.' },
  { icon: Users, title: 'Team Management', description: 'Fine-grained role-based access for managers, chefs, cashiers, and staff.' },
  { icon: Star, title: 'Loyalty Programs', description: 'Build and reward your regulars with points, tiers, and custom loyalty campaigns.' },
  { icon: Layers, title: 'Multi-Branch Ready', description: 'Manage unlimited branches, each with its own menu, hours, and inventory.' },
  { icon: Zap, title: 'Live Order Display', description: 'Stream incoming orders directly to your kitchen display in real time.' },
]

export function ForBusinessOwners() {
  return (
    <section className="py-20 bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left — copy */}
          <div>
            <span className="inline-block bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full mb-5">
              For Business Owners
            </span>
            <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--fg)] mb-5 leading-tight">
              Everything You Need to Run a Modern Hospitality Business
            </h2>
            <p className="text-[var(--fg-muted)] leading-relaxed mb-8">
              Savor gives restaurants, cafés, bars, and food trucks a complete digital operations platform — from online ordering and reservations to analytics and loyalty programs.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-3 rounded-2xl transition-all shadow-[0_8px_30px_-4px_rgba(249,115,22,0.4)] hover:-translate-y-0.5"
              >
                Register Your Business <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/restaurant"
                className="inline-flex items-center gap-2 border border-[var(--border)] hover:border-orange-300 text-[var(--fg)] font-semibold px-5 py-3 rounded-2xl transition-all hover:-translate-y-0.5"
              >
                See All Features
              </Link>
            </div>
          </div>

          {/* Right — benefits grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {BENEFITS.map((b) => {
              const Icon = b.icon
              return (
                <div
                  key={b.title}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 hover:border-orange-200 dark:hover:border-orange-900 hover:shadow-md transition-all"
                >
                  <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5 text-orange-500" />
                  </div>
                  <h4 className="font-semibold text-[var(--fg)] text-sm mb-1">{b.title}</h4>
                  <p className="text-xs text-[var(--fg-muted)] leading-relaxed">{b.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
