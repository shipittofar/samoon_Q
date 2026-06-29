import type { Metadata } from 'next'
import Link from 'next/link'
import { DEFAULT_PLATFORM_JSON_LD, serializeJsonLd } from '@/lib/json-ld'
import Image from 'next/image'
import { ArrowRight, ChevronRight, Search, Building2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer, FloatingCart } from '@/components/cart/CartDrawer'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { FeaturedSection } from '@/components/home/FeaturedSection'
import { DiscoveryPreview } from '@/components/home/DiscoveryPreview'
import { HowItWorks } from '@/components/home/HowItWorks'
import { ForBusinessOwners } from '@/components/home/ForBusinessOwners'
import { PlatformFeatures } from '@/components/home/PlatformFeatures'

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

// Platform-wide metrics shown in the stats strip (Phase J — mock data).
const STATS = [
  { value: '500+', label: 'Businesses' },
  { value: '50+', label: 'Branches' },
  { value: '20+', label: 'Cities' },
  { value: '50k+', label: 'Customers' },
]

// Business-type discovery categories (Phase D).
// Links to /discover?category=* (P8.8.2 — replaces single-restaurant /menu?category=* links).
const CATEGORIES = [
  { name: 'Restaurants', icon: '🍽️', href: '/discover?category=restaurant', color: 'from-red-400 to-orange-400' },
  { name: 'Cafés', icon: '☕', href: '/discover?category=cafe', color: 'from-amber-400 to-yellow-400' },
  { name: 'Bars', icon: '🍺', href: '/discover?category=bar', color: 'from-orange-400 to-amber-400' },
  { name: 'Food Courts', icon: '🏪', href: '/discover?category=food_court', color: 'from-blue-400 to-cyan-400' },
  { name: 'Food Trucks', icon: '🚚', href: '/discover?category=food_truck', color: 'from-pink-400 to-rose-400' },
]

// Category chips shown inside the hero search area.
const HERO_CHIPS = [
  { label: 'Restaurant', href: '/discover?category=restaurant' },
  { label: 'Café', href: '/discover?category=cafe' },
  { label: 'Bar', href: '/discover?category=bar' },
  { label: 'Food Truck', href: '/discover?category=food_truck' },
  { label: 'Food Court', href: '/discover?category=food_court' },
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

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section id="main-content" className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1920&q=80"
            alt="Vibrant marketplace of restaurants and cafés"
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 w-full">
          <div className="max-w-2xl">
            {/* Pill */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
              <Building2 className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-sm text-white/90 font-medium">500+ businesses on Savor</span>
            </div>

            <h1 className="font-[var(--font-display)] text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-5">
              Discover
              <span className="block text-orange-400">Local Businesses</span>
              Near You.
            </h1>
            <p className="text-lg text-white/70 mb-8 leading-relaxed max-w-lg">
              Discover restaurants, cafés, bars, food trucks, and more. Browse menus, book tables, and order — all in one place.
            </p>

            {/* Search form — GET /discover?q= */}
            <form action="/discover" method="GET" className="flex gap-2 mb-6 max-w-lg">
              <div className="flex-1 relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" aria-hidden="true" />
                <label htmlFor="hero-search" className="sr-only">Search for restaurants, cafés, bars, and more</label>
                <input
                  id="hero-search"
                  type="text"
                  name="q"
                  placeholder="Search restaurants, cafés, bars…"
                  className="w-full bg-white/10 backdrop-blur-sm border border-white/25 text-white placeholder:text-white/50 rounded-2xl ps-9 pe-4 py-3.5 text-sm focus:outline-none focus:border-orange-400 focus:bg-white/15 transition-all"
                />
              </div>
              <button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-3.5 rounded-2xl transition-all shadow-[0_8px_30px_-4px_rgba(249,115,22,0.5)] hover:-translate-y-0.5"
              >
                Search
              </button>
            </form>

            {/* Category chips */}
            <div className="flex flex-wrap gap-2 mb-8">
              {HERO_CHIPS.map((chip) => (
                <Link
                  key={chip.label}
                  href={chip.href}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 hover:border-orange-400 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-all"
                >
                  {chip.label}
                </Link>
              ))}
            </div>

            {/* Primary + secondary CTAs */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/discover"
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3.5 rounded-2xl transition-all shadow-[0_8px_30px_-4px_rgba(249,115,22,0.5)] hover:shadow-[0_12px_40px_-4px_rgba(249,115,22,0.6)] hover:-translate-y-0.5 active:translate-y-0"
              >
                Explore Businesses
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/restaurant"
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/30 hover:bg-white/20 text-white font-semibold px-6 py-3.5 rounded-2xl transition-all hover:-translate-y-0.5"
              >
                Become a Partner
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          <div className="w-px h-12 bg-gradient-to-b from-transparent to-white/40" />
          <span className="text-white/60 text-xs">Scroll</span>
        </div>
      </section>

      {/* ── Platform Stats strip ──────────────────────────────────────────── */}
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

      {/* ── Business Categories ───────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-sm font-medium text-orange-500 uppercase tracking-widest mb-2">Browse by Type</p>
              <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--fg)]">Business Categories</h2>
            </div>
            <Link href="/discover" className="flex items-center gap-1 text-sm text-[var(--fg-muted)] hover:text-orange-500 transition-colors">
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
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Discovery Preview — businesses on the platform ────────────────── */}
      <DiscoveryPreview />

      {/* ── Featured Section (preserved — P4 tests require <FeaturedSection />) */}
      <FeaturedSection />

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <HowItWorks />

      {/* ── For Business Owners ──────────────────────────────────────────── */}
      <ForBusinessOwners />

      {/* ── Platform Features ────────────────────────────────────────────── */}
      <PlatformFeatures />

      <Footer />
    </div>
  )
}
