import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { DEFAULT_PLATFORM_JSON_LD, serializeJsonLd } from '@/lib/json-ld'
import { ArrowRight, ChevronRight, Search, Building2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { FeaturedSection } from '@/components/home/FeaturedSection'
import { DiscoveryPreview } from '@/components/home/DiscoveryPreview'
import { HowItWorks } from '@/components/home/HowItWorks'
import { ForBusinessOwners } from '@/components/home/ForBusinessOwners'
import { PlatformFeatures } from '@/components/home/PlatformFeatures'
import { PlatformTestimonials } from '@/components/home/PlatformTestimonials'
import { PlatformHeroBackground } from '@/components/home/PlatformHeroBackground'
import { getLocalizedPageMetadata } from '@/lib/seo'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.samoon.com'

// P9.5.7A — localized title/description/OpenGraph/Twitter/hreflang, sourced
// from the `seo` namespace via getLocalizedPageMetadata() (the same helper
// src/app/layout.tsx already uses), instead of a hand-written literal
// Metadata object.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const localized = await getLocalizedPageMetadata({ locale, path: '/', namespaceKey: 'home', baseUrl: BASE_URL })
  return {
    ...localized,
    openGraph: { ...localized.openGraph, images: [{ url: `${BASE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Samoon Platform' }] },
    twitter: { ...localized.twitter, images: [`${BASE_URL}/og-image.jpg`] },
  }
}

// Platform-wide metrics — inline trust signal inside the hero section (H6).
// "Branches" renamed to "Locations" so numbers read as marketplace scale, not
// a restaurant chain count (audit finding H2). Label text now resolved via
// t(`stats.${key}`) inside the component — this array only carries the
// locale-independent value + translation key.
const STATS = [
  { value: '500+', key: 'businesses' },
  { value: '50+', key: 'locations' },
  { value: '20+', key: 'cities' },
  { value: '50k+', key: 'customers' },
]

// Business-type discovery categories (Phase D).
// Links to /discover?category=* (P8.8.2 — replaces single-restaurant /menu?category=* links).
// `name` resolved via t(`categories.${key}`) inside the component.
const CATEGORIES = [
  { key: 'restaurants', icon: '🍽️', href: '/discover?category=restaurant', color: 'from-red-400 to-orange-400' },
  { key: 'cafes', icon: '☕', href: '/discover?category=cafe', color: 'from-amber-400 to-yellow-400' },
  { key: 'bars', icon: '🍺', href: '/discover?category=bar', color: 'from-orange-400 to-amber-400' },
  { key: 'foodCourts', icon: '🏪', href: '/discover?category=food_court', color: 'from-blue-400 to-cyan-400' },
  { key: 'foodTrucks', icon: '🚚', href: '/discover?category=food_truck', color: 'from-pink-400 to-rose-400' },
]

// Category chips shown inside the hero search area. `label` resolved via
// t(`heroChips.${key}`) inside the component.
const HERO_CHIPS = [
  { key: 'restaurant', href: '/discover?category=restaurant' },
  { key: 'cafe', href: '/discover?category=cafe' },
  { key: 'bar', href: '/discover?category=bar' },
  { key: 'foodTruck', href: '/discover?category=food_truck' },
  { key: 'foodCourt', href: '/discover?category=food_court' },
]

export default async function HomePage() {
  const t = await getTranslations('home')
  const tCommon = await getTranslations('common')

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(DEFAULT_PLATFORM_JSON_LD) }}
      />
      <Header overlay />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section id="main-content" className="relative min-h-screen flex items-center overflow-hidden">
        <PlatformHeroBackground />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 w-full">
          <div className="max-w-2xl">
            {/* Pill */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
              <Building2 className="h-3.5 w-3.5 text-orange-400"/>
              <span className="text-sm text-white/90 font-medium">{t('heroPill')}</span>
            </div>

            <h1 className="font-[var(--font-display)] text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-5">
              {t('heroHeadingLine1')}
              <span className="block text-orange-400">{t('heroHeadingHighlight')}</span>
              {t('heroHeadingLine2')}
            </h1>

            {/* Subheadline — leads with the differentiator, not a repeat of the headline (H3). */}
            <p className="text-lg text-white/70 mb-8 leading-relaxed max-w-lg">
              {t('heroSubheadline')}
            </p>

            {/* Search form — GET /discover?q= */}
            <form action="/discover"method="GET"className="flex gap-2 mb-6 max-w-lg">
              <div className="flex-1 relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none"aria-hidden="true"/>
                <label htmlFor="hero-search"className="sr-only">{t('heroSearchAriaLabel')}</label>
                <input
                  id="hero-search"
                  type="text"
                  name="q"
                  placeholder={t('heroSearchPlaceholder')}
                  className="w-full bg-white/10 backdrop-blur-sm border border-white/25 text-white placeholder:text-white/50 rounded-2xl ps-9 pe-4 py-3.5 text-sm focus:outline-none focus:border-[var(--focus-ring)] focus:bg-white/15 transition-all"
                />
              </div>
              <button
                type="submit"
                className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] font-semibold px-5 py-3.5 rounded-2xl transition-all shadow-[0_8px_30px_-4px_rgba(249,115,22,0.5)] hover:-translate-y-0.5"
              >
                {tCommon('search')}
              </button>
            </form>

            {/* Category chips */}
            <div className="flex flex-wrap gap-2 mb-8">
              {HERO_CHIPS.map((chip) => (
                <Link
                  key={chip.key}
                  href={chip.href}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 hover:border-orange-400 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-all"
                >
                  {t(`heroChips.${chip.key}`)}
                </Link>
              ))}
            </div>

            {/* Primary CTA — customers only (C2: partner CTA demoted to text link). */}
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/discover"
                className="inline-flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] font-semibold px-6 py-3.5 rounded-2xl transition-all shadow-[0_8px_30px_-4px_rgba(249,115,22,0.5)] hover:shadow-[0_12px_40px_-4px_rgba(249,115,22,0.6)] hover:-translate-y-0.5 active:translate-y-0"
              >
                {t('exploreBusinesses')}
                <ArrowRight className="h-4 w-4"/>
              </Link>
              {/* Business-owner path — text link so it doesn't compete with the customer CTA */}
              <Link
                href="/restaurant"
                className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white/85 hover:text-white text-sm font-medium px-4 py-2.5 rounded-2xl transition-all"
              >
                {t('areYouBusinessOwner')}
              </Link>
            </div>

            {/* Stats — inline trust signal at hero bottom (H6: replaces standalone stats section). */}
            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-10 pt-8 border-t border-white/15">
              {STATS.map((stat) => (
                <div key={stat.key} className="flex items-baseline gap-1.5">
                  <span className="font-[var(--font-display)] text-2xl font-bold text-white">{stat.value}</span>
                  <span className="text-sm text-white/60">{t(`stats.${stat.key}`)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          <div className="w-px h-12 bg-gradient-to-b from-transparent to-white/40"/>
          <span className="text-white/60 text-xs">{t('scroll')}</span>
        </div>
      </section>

      {/* ── How It Works — moved to position 2 (C3) ──────────────────────── */}
      {/* Explaining the concept before showing the catalogue is standard marketplace IA.
          Visitors understand the platform model before browsing the businesses. */}
      <HowItWorks />

      {/* ── Business Categories ───────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-sm font-medium text-[var(--accent-text)] uppercase tracking-widest mb-2">{t('browseByType')}</p>
              <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--fg)]">{t('businessCategories')}</h2>
            </div>
            <Link
              href="/discover"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent-text)] hover:text-[var(--accent-text)] border border-[var(--accent-border)]/40 px-3 py-1.5 rounded-xl hover:bg-[var(--accent-subtle)] transition-all"
            >
              {tCommon('viewAll')} <ChevronRight className="h-4 w-4"/>
            </Link>
          </div>
          {/* H4: last item spans 2 cols on mobile so the 5-item grid has no orphan. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {CATEGORIES.map((cat, i) => (
              <Link
                key={cat.key}
                href={cat.href}
                className={`group relative bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 text-center hover:border-[var(--accent-border)]/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1${i === CATEGORIES.length - 1 ? 'col-span-2 sm:col-span-1' : ''}`}
              >
                <div className={`mx-auto mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br ${cat.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <span className="text-2xl">{cat.icon}</span>
                </div>
                <h3 className="font-semibold text-[var(--fg)] group-hover:text-[var(--accent-text)] transition-colors">{t(`categories.${cat.key}`)}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Discovery Preview — businesses on the platform ────────────────── */}
      <DiscoveryPreview />

      {/* FeaturedSection: preserved here for P4 source tests; not rendered on the
          platform homepage because it shows menu items from a single restaurant
          (DEFAULT tenant), which breaks the multi-business marketplace positioning. */}
      {/* <FeaturedSection /> */}

      {/* ── Testimonials & Trust ─────────────────────────────────────────── */}
      <PlatformTestimonials />

      {/* ── For Business Owners ──────────────────────────────────────────── */}
      <ForBusinessOwners />

      {/* ── Platform Features ────────────────────────────────────────────── */}
      <PlatformFeatures />

      <Footer />
    </div>
  )
}
