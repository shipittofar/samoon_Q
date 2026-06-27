import type { Metadata } from 'next'
import Link from 'next/link'
import { DEFAULT_PLATFORM_JSON_LD, serializeJsonLd } from '@/lib/json-ld'
import Image from 'next/image'
import { ArrowRight, MapPin, ChevronRight, Flame } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer, FloatingCart } from '@/components/cart/CartDrawer'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { FeaturedSection } from '@/components/home/FeaturedSection'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.savor.com'

export const metadata: Metadata = {
  title: 'Savor — Discover Local Businesses',
  description:
    'Browse restaurants, cafés, bars, food trucks, and more. Discover local businesses, explore menus, and book tables on Savor.',
  openGraph: {
    title: 'Savor — Discover Local Businesses',
    description: 'Discover local restaurants, cafés, and bars near you.',
    url: BASE_URL,
    siteName: 'Savor Platform',
    type: 'website',
    images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Savor Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Savor — Discover Local Businesses',
    description: 'Discover local restaurants, cafés, and bars near you.',
    images: [`${BASE_URL}/og-image.jpg`],
  },
  alternates: { canonical: BASE_URL },
}

const STATS = [
  { value: '500+', label: 'Menu Items' },
  { value: '50k+', label: 'Happy Customers' },
  { value: '4.9★', label: 'Average Rating' },
  { value: '30min', label: 'Avg. Delivery' },
]

const CATEGORIES = [
  { name: 'Pizza', icon: '🍕', count: 8, href: '/menu?category=pizza', color: 'from-red-400 to-orange-400' },
  { name: 'Burgers', icon: '🍔', count: 6, href: '/menu?category=burger', color: 'from-amber-400 to-yellow-400' },
  { name: 'Pasta', icon: '🍝', count: 5, href: '/menu?category=pasta', color: 'from-orange-400 to-amber-400' },
  { name: 'Drinks', icon: '🥤', count: 7, href: '/menu?category=drinks', color: 'from-blue-400 to-cyan-400' },
  { name: 'Desserts', icon: '🍰', count: 6, href: '/menu?category=desserts', color: 'from-pink-400 to-rose-400' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(DEFAULT_PLATFORM_JSON_LD) }}
      />
      <Header />
      <ErrorBoundary feature="CartDrawer"><CartDrawer /></ErrorBoundary>
      <ErrorBoundary feature="FloatingCart"><FloatingCart /></ErrorBoundary>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=80"
            alt="Restaurant ambiance"
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
          <div className="max-w-2xl">
            {/* Pill label */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
              <Flame className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-sm text-white/90 font-medium">Now open for delivery</span>
            </div>

            <h1 className="font-[var(--font-display)] text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-6">
              Extraordinary
              <span className="block text-orange-400">Flavors,</span>
              Delivered.
            </h1>
            <p className="text-lg text-white/70 mb-8 leading-relaxed max-w-lg">
              From farm-fresh ingredients to unforgettable recipes crafted with passion. Experience fine dining at home or reserve your perfect table.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/menu"
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3.5 rounded-2xl transition-all shadow-[0_8px_30px_-4px_rgba(249,115,22,0.5)] hover:shadow-[0_12px_40px_-4px_rgba(249,115,22,0.6)] hover:-translate-y-0.5 active:translate-y-0"
              >
                Order Now
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/reservation"
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/30 hover:bg-white/20 text-white font-semibold px-6 py-3.5 rounded-2xl transition-all hover:-translate-y-0.5"
              >
                Reserve a Table
              </Link>
            </div>

            {/* Mini stats */}
            <div className="flex items-center gap-6 mt-10">
              <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-gradient-to-br from-orange-300 to-orange-600" />
                ))}
              </div>
              <div>
                <div className="flex text-orange-400 text-sm">{'★★★★★'}</div>
                <p className="text-white/60 text-xs">Loved by 50,000+ customers</p>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          <div className="w-px h-12 bg-gradient-to-b from-transparent to-white/40" />
          <span className="text-white/40 text-xs">Scroll</span>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-[var(--card)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className={`py-8 px-6 text-center ${i < STATS.length - 1 ? 'border-e border-[var(--border)]' : ''}`}
              >
                <p className="font-[var(--font-display)] text-3xl font-bold text-orange-500 mb-1">{stat.value}</p>
                <p className="text-sm text-[var(--fg-muted)]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-sm font-medium text-orange-500 uppercase tracking-widest mb-2">Explore</p>
              <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--fg)]">Our Categories</h2>
            </div>
            <Link href="/menu" className="flex items-center gap-1 text-sm text-[var(--fg-muted)] hover:text-orange-500 transition-colors">
              View all <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                href={cat.href}
                className="group relative bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 text-center hover:border-orange-200 dark:hover:border-orange-900 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`mx-auto mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br ${cat.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <span className="text-2xl">{cat.icon}</span>
                </div>
                <h3 className="font-semibold text-[var(--fg)] group-hover:text-orange-500 transition-colors">{cat.name}</h3>
                <p className="text-xs text-[var(--fg-muted)] mt-1">{cat.count} items</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <FeaturedSection />

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative bg-gradient-to-br from-orange-500 to-orange-700 rounded-3xl overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
            <div className="relative px-8 py-16 md:px-16 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-white text-center md:text-start">
                <h2 className="font-[var(--font-display)] text-3xl md:text-4xl font-bold mb-3">Reserve Your Table</h2>
                <p className="text-white/80 max-w-md">Book in advance and enjoy a premium dining experience. Special occasions, corporate dinners, or an intimate evening for two.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <Link href="/reservation" className="inline-flex items-center justify-center gap-2 bg-white text-orange-600 font-semibold px-6 py-3.5 rounded-2xl hover:bg-orange-50 transition-colors shadow-lg">
                  <MapPin className="h-4 w-4" /> Book a Table
                </Link>
                <Link href="/restaurant" className="inline-flex items-center justify-center gap-2 border border-white/30 text-white font-semibold px-6 py-3.5 rounded-2xl hover:bg-white/10 transition-colors">
                  Learn More <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
