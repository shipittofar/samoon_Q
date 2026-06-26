'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Star, MapPin, GitBranch, Phone, Mail, Globe, Clock,
  UtensilsCrossed, Tag, Share2, Check, ExternalLink,
  ChevronRight, Store, ArrowLeft,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { cn } from '@/utils'
import { usePublicTenant, useCategories, useMenuItems, useActivePromotions } from '@/hooks'
import {
  getMarketplaceMeta,
  BUSINESS_TYPE_LABELS,
  type MarketplaceMeta,
  type PublicBranchInfo,
} from '@/types/marketplace'
import type { Tenant, Category, MenuItem, PromotionRule } from '@/types'

// ── Price level helper ────────────────────────────────────────────────────────

function PriceLevel({ level }: { level?: number }) {
  if (!level) return null
  const labels = ['', '$', '$$', '$$$', '$$$$']
  return (
    <span className="text-sm text-[var(--fg-muted)]" aria-label={`Price level: ${labels[level]}`}>
      {labels[level]}
    </span>
  )
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

function Breadcrumb({ name }: { name: string }) {
  return (
    <nav aria-label="Breadcrumb" className="bg-[var(--bg)] border-b border-[var(--border)]">
      <ol className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-1.5 text-sm text-[var(--fg-muted)]">
        <li>
          <Link href="/discover" className="hover:text-[var(--fg)] transition-colors">
            Discover
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="w-3.5 h-3.5" />
        </li>
        <li className="font-medium text-[var(--fg)] truncate max-w-[200px]" aria-current="page">
          {name}
        </li>
      </ol>
    </nav>
  )
}

// ── Hero Section ──────────────────────────────────────────────────────────────

function HeroSection({ tenant, meta }: { tenant: Tenant; meta: MarketplaceMeta }) {
  const accentColor =
    (tenant.settings?.theme as { primaryColor?: string } | undefined)?.primaryColor ??
    'var(--accent)'
  const label = tenant.businessTypes.map((t) => BUSINESS_TYPE_LABELS[t] ?? t).join(' · ')

  return (
    <section
      aria-labelledby="tenant-hero-heading"
      className="relative h-[55vh] min-h-[340px] max-h-[600px] overflow-hidden"
    >
      {/* Cover image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={meta.coverImage}
        alt={`${tenant.name} cover`}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />

      {/* Badges */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
        <span
          className={cn(
            'text-xs font-semibold px-2.5 py-1 rounded-full shadow',
            meta.openNow ? 'bg-emerald-500 text-white' : 'bg-gray-800/90 text-gray-200',
          )}
        >
          {meta.openNow ? 'Open now' : 'Closed'}
        </span>
        {meta.featured && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-500 text-white shadow">
            Featured
          </span>
        )}
        {!meta.featured && meta.popular && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500 text-white shadow">
            Popular
          </span>
        )}
        {meta.isNew && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow">
            New
          </span>
        )}
      </div>

      {/* Content overlay */}
      <div className="absolute bottom-0 inset-x-0 px-4 pb-8 sm:px-8 max-w-7xl mx-auto">
        <div className="flex items-end gap-4">
          {/* Logo circle */}
          <div
            className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-2xl flex items-center justify-center text-white font-bold text-2xl sm:text-3xl shadow-lg border-2 border-white/20"
            style={{ background: accentColor }}
            aria-hidden="true"
          >
            {tenant.name[0]}
          </div>

          <div className="min-w-0">
            <p className="text-white/70 text-sm mb-0.5">{label}</p>
            <h1
              id="tenant-hero-heading"
              className="text-3xl sm:text-4xl font-bold text-white leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {tenant.name}
            </h1>
            {meta.tagline && (
              <p className="text-white/80 text-sm sm:text-base mt-1 italic">{meta.tagline}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-sm text-white/80">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" aria-hidden="true" />
                <strong className="text-white">{meta.rating.toFixed(1)}</strong>
                <span>({meta.reviewCount.toLocaleString()} reviews)</span>
              </span>
              <span className="flex items-center gap-1 text-sm text-white/80">
                <MapPin className="w-4 h-4" aria-hidden="true" />
                {meta.city}
              </span>
              <span className="flex items-center gap-1 text-sm text-white/80">
                <GitBranch className="w-4 h-4" aria-hidden="true" />
                {meta.branchCount} {meta.branchCount === 1 ? 'branch' : 'branches'}
              </span>
              <PriceLevel level={meta.priceLevel} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Share Button ──────────────────────────────────────────────────────────────

function ShareButton({ tenant }: { tenant: Tenant }) {
  const [copied, setCopied] = useState(false)
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${tenant.slug}`
      : `/${tenant.slug}`

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: tenant.name, url })
        return
      } catch {
        // fallback to copy
      }
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--fg-muted)] hover:bg-[var(--card-hover)] transition-colors"
      aria-label="Share this business"
    >
      {copied ? (
        <Check className="w-4 h-4 text-emerald-500" aria-hidden="true" />
      ) : (
        <Share2 className="w-4 h-4" aria-hidden="true" />
      )}
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}

// ── Quick Actions ─────────────────────────────────────────────────────────────

function QuickActions({ tenant, meta }: { tenant: Tenant; meta: MarketplaceMeta }) {
  const flags = tenant.settings?.featureFlags as Record<string, boolean> | undefined
  const hasReservations = flags?.['reservations.enabled'] ?? false
  const hasLoyalty =
    flags?.['loyalty.enabled'] ??
    flags?.['cafe.loyalty.enabled'] ??
    flags?.['mobile_cafe.loyalty.enabled'] ??
    false

  const base = `/${tenant.slug}/${meta.primaryBranchSlug}`

  return (
    <section aria-label="Quick actions">
      <div className="flex flex-wrap gap-2">
        <Link
          href={`${base}/menu`}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors"
        >
          <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
          View Menu
        </Link>

        <a
          href="#branches"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
        >
          <GitBranch className="w-4 h-4" aria-hidden="true" />
          Choose Branch
        </a>

        {hasReservations && (
          <Link
            href={`${base}/reservation`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
          >
            <Clock className="w-4 h-4" aria-hidden="true" />
            Reserve
          </Link>
        )}

        {hasLoyalty && (
          <Link
            href={`${base}/loyalty`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
          >
            <Tag className="w-4 h-4" aria-hidden="true" />
            Loyalty
          </Link>
        )}

        <ShareButton tenant={tenant} />
      </div>
    </section>
  )
}

// ── Business Info ─────────────────────────────────────────────────────────────

function BusinessInfo({ meta }: { meta: MarketplaceMeta }) {
  return (
    <section aria-labelledby="about-heading">
      <h2 id="about-heading" className="text-xl font-semibold text-[var(--fg)] mb-4">
        About
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Description + tags */}
        <div>
          <p className="text-[var(--fg-muted)] leading-relaxed mb-4">{meta.description}</p>

          {meta.cuisines.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {meta.cuisines.map((c) => (
                <span
                  key={c}
                  className="text-xs px-2.5 py-1 rounded-full bg-[var(--bg-secondary)] text-[var(--fg-muted)] border border-[var(--border)]"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          {meta.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {meta.tags.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Contact info */}
        <div className="space-y-3">
          {meta.phone && (
            <a
              href={`tel:${meta.phone}`}
              className="flex items-center gap-3 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
            >
              <Phone className="w-4 h-4 shrink-0" aria-hidden="true" />
              {meta.phone}
            </a>
          )}
          {meta.email && (
            <a
              href={`mailto:${meta.email}`}
              className="flex items-center gap-3 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
            >
              <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
              {meta.email}
            </a>
          )}
          {meta.website && (
            <a
              href={meta.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
            >
              <Globe className="w-4 h-4 shrink-0" aria-hidden="true" />
              {meta.website.replace(/^https?:\/\//, '')}
              <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Branches Section ──────────────────────────────────────────────────────────

function BranchCard({ branch, tenantSlug }: { branch: PublicBranchInfo; tenantSlug: string }) {
  return (
    <article className="flex flex-col bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-[var(--shadow-soft)] hover:shadow-md transition-shadow">
      {branch.image && (
        <div className="relative h-36 overflow-hidden bg-[var(--bg-secondary)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={branch.image} alt="" aria-hidden="true" className="w-full h-full object-cover" />
          <span
            className={cn(
              'absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full',
              branch.openNow ? 'bg-emerald-500/90 text-white' : 'bg-gray-800/80 text-gray-200',
            )}
          >
            {branch.openNow ? 'Open' : 'Closed'}
          </span>
        </div>
      )}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-[var(--fg)] mb-1">{branch.name}</h3>
        <p className="text-sm text-[var(--fg-muted)] flex items-start gap-1.5 mb-1">
          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          {branch.address}, {branch.city}
        </p>
        {branch.todayHours && (
          <p className="text-sm text-[var(--fg-muted)] flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {branch.todayHours}
          </p>
        )}
        {branch.phone && (
          <a
            href={`tel:${branch.phone}`}
            className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] flex items-center gap-1.5 mb-3"
          >
            <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {branch.phone}
          </a>
        )}
        <Link
          href={`/${tenantSlug}/${branch.slug}`}
          className="mt-auto text-center text-sm font-medium px-3 py-2 rounded-xl border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
          aria-label={`Visit ${branch.name}`}
        >
          Visit Branch
        </Link>
      </div>
    </article>
  )
}

function BranchesSection({
  meta,
  tenantSlug,
}: {
  meta: MarketplaceMeta
  tenantSlug: string
}) {
  const branches = meta.branches ?? []
  if (branches.length === 0) return null

  return (
    <section id="branches" aria-labelledby="branches-heading">
      <h2 id="branches-heading" className="text-xl font-semibold text-[var(--fg)] mb-5">
        Our Locations
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {branches.map((b) => (
          <BranchCard key={b.slug} branch={b} tenantSlug={tenantSlug} />
        ))}
      </div>
    </section>
  )
}

// ── Categories Section ────────────────────────────────────────────────────────

function CategoriesSection({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null
  const CATEGORY_ICONS: Record<string, string> = {
    pizza: '🍕', burgers: '🍔', pasta: '🍝', drinks: '🥤', desserts: '🍰',
    coffee: '☕', salads: '🥗', sushi: '🍣', tacos: '🌮', breakfast: '🍳',
  }

  return (
    <section aria-labelledby="categories-heading">
      <h2 id="categories-heading" className="text-xl font-semibold text-[var(--fg)] mb-5">
        Browse by Category
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {categories.slice(0, 10).map((cat) => {
          const icon = CATEGORY_ICONS[cat.slug?.toLowerCase() ?? ''] ?? '🍽️'
          return (
            <div
              key={cat.id}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--card-hover)] transition-colors cursor-default"
            >
              <span className="text-2xl" role="img" aria-label={cat.name}>
                {icon}
              </span>
              <span className="text-sm font-medium text-[var(--fg)] text-center">{cat.name}</span>
              {cat.items_count != null && (
                <span className="text-xs text-[var(--fg-muted)]">{cat.items_count} items</span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Featured Items ────────────────────────────────────────────────────────────

function FeaturedItemsSection({
  items,
  tenantSlug,
  primaryBranchSlug,
}: {
  items: MenuItem[]
  tenantSlug: string
  primaryBranchSlug: string
}) {
  const featured = items.filter((i) => i.is_featured || i.is_popular).slice(0, 4)
  if (featured.length === 0) return null

  return (
    <section aria-labelledby="featured-items-heading">
      <div className="flex items-center justify-between mb-5">
        <h2 id="featured-items-heading" className="text-xl font-semibold text-[var(--fg)]">
          Popular Items
        </h2>
        <Link
          href={`/${tenantSlug}/${primaryBranchSlug}/menu`}
          className="text-sm text-[var(--accent)] hover:underline font-medium"
        >
          View full menu
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {featured.map((item) => (
          <article
            key={item.id}
            className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-[var(--shadow-soft)]"
          >
            {item.image && (
              <div className="h-32 overflow-hidden bg-[var(--bg-secondary)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="p-3">
              <h3 className="font-semibold text-sm text-[var(--fg)] truncate">{item.name}</h3>
              <p className="text-xs text-[var(--fg-muted)] line-clamp-2 mt-0.5 mb-2">
                {item.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[var(--fg)]">
                  ${item.price.toFixed(2)}
                </span>
                <span className="flex items-center gap-0.5 text-xs text-[var(--fg-muted)]">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" aria-hidden="true" />
                  {item.rating.toFixed(1)}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

// ── Promotions Section ────────────────────────────────────────────────────────

function PromotionsSection({ promotions }: { promotions: PromotionRule[] }) {
  if (promotions.length === 0) return null

  const TYPE_LABELS: Record<string, string> = {
    percentage_discount: 'Discount',
    fixed_discount: 'Fixed off',
    buy_one_get_one: 'BOGO',
    happy_hour: 'Happy Hour',
  }

  return (
    <section aria-labelledby="promotions-heading">
      <h2 id="promotions-heading" className="text-xl font-semibold text-[var(--fg)] mb-5">
        Current Offers
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.slice(0, 3).map((promo) => (
          <div
            key={promo.id}
            className="p-4 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)] mb-2 block">
              {TYPE_LABELS[promo.type] ?? promo.type}
            </span>
            <h3 className="font-semibold text-[var(--fg)] mb-1">{promo.name}</h3>
            <p className="text-sm text-[var(--fg-muted)]">{promo.description}</p>
            {promo.discountPercent != null && (
              <p className="mt-2 text-xl font-bold text-[var(--accent)]">
                {promo.discountPercent}% off
              </p>
            )}
            {promo.discountAmount != null && (
              <p className="mt-2 text-xl font-bold text-[var(--accent)]">
                ${promo.discountAmount} off
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Reviews Section ───────────────────────────────────────────────────────────

interface MockReview {
  id: string
  name: string
  initials: string
  rating: number
  date: string
  text: string
}

const MOCK_REVIEWS: MockReview[] = [
  {
    id: 'r1',
    name: 'Sarah M.',
    initials: 'SM',
    rating: 5,
    date: 'December 2024',
    text: 'Absolutely outstanding experience from start to finish. The food was incredible, service impeccable, and the ambience perfect for a special occasion.',
  },
  {
    id: 'r2',
    name: 'James K.',
    initials: 'JK',
    rating: 5,
    date: 'November 2024',
    text: 'Best meal I have had all year. Everything on the menu is thoughtfully crafted. Will be coming back with the whole family next time.',
  },
  {
    id: 'r3',
    name: 'Aisha T.',
    initials: 'AT',
    rating: 4,
    date: 'October 2024',
    text: 'Great food and friendly staff. A couple of dishes were slow to arrive but the quality made it worthwhile. Highly recommend the signature dishes.',
  },
]

function ReviewsSection({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  return (
    <section aria-labelledby="reviews-heading">
      <div className="flex items-center gap-4 mb-5">
        <h2 id="reviews-heading" className="text-xl font-semibold text-[var(--fg)]">
          Customer Reviews
        </h2>
        <span className="flex items-center gap-1 text-sm text-[var(--fg-muted)]">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" aria-hidden="true" />
          <strong className="text-[var(--fg)]">{rating.toFixed(1)}</strong>
          <span>· {reviewCount.toLocaleString()} reviews</span>
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {MOCK_REVIEWS.map((review) => (
          <div
            key={review.id}
            className="p-4 bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-sm font-bold shrink-0">
                {review.initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--fg)]">{review.name}</p>
                <p className="text-xs text-[var(--fg-muted)]">{review.date}</p>
              </div>
            </div>
            <div className="flex gap-0.5 mb-2" aria-label={`${review.rating} out of 5 stars`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  className={cn(
                    'w-3.5 h-3.5',
                    i < review.rating
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-gray-300 fill-gray-300',
                  )}
                  aria-hidden="true"
                />
              ))}
            </div>
            <p className="text-sm text-[var(--fg-muted)] leading-relaxed">{review.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Gallery Section ───────────────────────────────────────────────────────────

function GallerySection({ meta }: { meta: MarketplaceMeta }) {
  const images = [meta.coverImage, ...(meta.gallery ?? [])].slice(0, 6)
  if (images.length <= 1) return null

  return (
    <section aria-labelledby="gallery-heading">
      <h2 id="gallery-heading" className="text-xl font-semibold text-[var(--fg)] mb-5">
        Gallery
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {images.map((src, i) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className="aspect-video overflow-hidden rounded-xl bg-[var(--bg-secondary)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            />
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Loading / Error states ────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <>
      <Header />
      <div className="animate-pulse">
        <div className="h-[55vh] min-h-[340px] bg-[var(--card)]" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-4 py-10 space-y-6">
          <div className="h-8 w-48 bg-[var(--card)] rounded-xl" />
          <div className="h-4 w-full max-w-lg bg-[var(--card)] rounded-xl" />
          <div className="h-4 w-full max-w-md bg-[var(--card)] rounded-xl" />
        </div>
      </div>
      <Footer />
    </>
  )
}

function TenantNotFoundState() {
  return (
    <>
      <Header />
      <main className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center">
        <Store className="w-16 h-16 text-[var(--fg-muted)] mb-6" aria-hidden="true" />
        <h1 className="text-3xl font-bold text-[var(--fg)] mb-3">Business not found</h1>
        <p className="text-[var(--fg-muted)] max-w-sm mb-8">
          We could not find a business at this URL.
        </p>
        <Link
          href="/discover"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Browse all businesses
        </Link>
      </main>
      <Footer />
    </>
  )
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function TenantHomepageClient({ tenantSlug }: { tenantSlug: string }) {
  const { data: tenant, isLoading } = usePublicTenant(tenantSlug)
  const { data: categories = [] } = useCategories()
  const { data: menuItemsPage } = useMenuItems()
  const menuItems = menuItemsPage?.results ?? []
  const { data: promotions = [] } = useActivePromotions()

  if (isLoading) return <LoadingSkeleton />
  if (!tenant) return <TenantNotFoundState />

  const meta = getMarketplaceMeta(tenant.settings)
  if (!meta) return <TenantNotFoundState />

  return (
    <>
      <Header />

      <Breadcrumb name={tenant.name} />

      <main id="main-content">
        <HeroSection tenant={tenant} meta={meta} />

        <div className="max-w-7xl mx-auto px-4 py-10 space-y-16">
          <QuickActions tenant={tenant} meta={meta} />
          <BusinessInfo meta={meta} />
          <BranchesSection meta={meta} tenantSlug={tenantSlug} />
          <CategoriesSection categories={categories} />
          <FeaturedItemsSection
            items={menuItems}
            tenantSlug={tenantSlug}
            primaryBranchSlug={meta.primaryBranchSlug}
          />
          <PromotionsSection promotions={promotions} />
          <ReviewsSection rating={meta.rating} reviewCount={meta.reviewCount} />
          <GallerySection meta={meta} />
        </div>
      </main>

      <Footer />
    </>
  )
}
