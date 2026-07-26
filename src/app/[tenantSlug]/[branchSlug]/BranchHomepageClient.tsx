'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Star, MapPin, Phone, Clock, ChevronRight,
  UtensilsCrossed, Tag, Share2, Check,
  ArrowLeft, Store,
} from 'lucide-react'
import { TenantHeader } from '@/components/layout/TenantHeader'
import { Footer } from '@/components/layout/Footer'
import { TenantFooter } from '@/components/layout/TenantFooter'
import { Fragment } from 'react'
import { cn, formatCurrency, getSmartCTA, buildPublicCTAs, buildPublicSections, buildCustomerJourney } from '@/utils'
import type { CustomerJourney } from '@/utils'
import { useTenantStore } from '@/stores'
import { usePublicBranch, useCategories, useMenuItems, useActivePromotions, useHomepageLayout } from '@/hooks'
import { ReviewsSection } from '@/components/reviews/ReviewsSection'
import { getMarketplaceMeta, type PublicBranchInfo } from '@/types/marketplace'
import type { Tenant, MenuItem, Category, PromotionRule } from '@/types'

// ── Breadcrumb ────────────────────────────────────────────────────────────────

function Breadcrumb({ tenantSlug, tenantName, branchName }: { tenantSlug: string; tenantName: string; branchName: string }) {
  const t = useTranslations('tenant')
  return (
    <nav aria-label={t('breadcrumbAria')} className="bg-[var(--bg)] border-b border-[var(--border)]">
      <ol className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-1.5 text-sm text-[var(--fg-muted)] flex-wrap">
        <li>
          <Link href="/discover" className="hover:text-[var(--fg)] transition-colors">{t('discover')}</Link>
        </li>
        <li aria-hidden="true"><ChevronRight className="w-3.5 h-3.5" /></li>
        <li>
          <Link href={`/${tenantSlug}`} className="hover:text-[var(--fg)] transition-colors truncate max-w-[160px] inline-block">{tenantName}</Link>
        </li>
        <li aria-hidden="true"><ChevronRight className="w-3.5 h-3.5" /></li>
        <li className="font-medium text-[var(--fg)] truncate max-w-[160px]" aria-current="page">{branchName}</li>
      </ol>
    </nav>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function HeroSection({
  branch,
  tenant,
  accentColor,
  tenantSlug,
  branchSlug,
}: {
  branch: PublicBranchInfo
  tenant: Tenant
  accentColor: string
  tenantSlug: string
  branchSlug: string
}) {
  const t = useTranslations('branch')
  const featureFlags = useTenantStore((s) => s.featureFlags)
  const meta = getMarketplaceMeta(tenant.settings)
  const cta = getSmartCTA({ tenantSlug, branchSlug, featureFlags, meta })

  return (
    // H9: increased height, H7: aria-labelledby
    <section
      aria-labelledby="branch-hero-heading"
      className="relative h-[45vh] min-h-[300px] max-h-[480px] overflow-hidden bg-gray-900"
    >
      {branch.image ? (
        // C3: next/image with priority for LCP, H7: decorative alt
        <Image
          src={branch.image}
          alt=""
          aria-hidden="true"
          fill
          priority
          className="object-cover opacity-70"
          sizes="100vw"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accentColor}88, ${accentColor}44)` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 max-w-7xl mx-auto px-4 sm:px-8 pb-8">
        <div className="flex items-end gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-sm font-medium mb-0.5">{tenant.name}</p>
            {/* H7: id for aria-labelledby */}
            <h1
              id="branch-hero-heading"
              className="text-3xl md:text-4xl font-bold text-white leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {branch.name}
            </h1>

            {/* C2: address in hero */}
            <p className="flex items-center gap-1.5 text-sm text-white/80 mt-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {branch.address}, {branch.city}
            </p>

            <div className="flex items-center gap-3 mt-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold',
                  branch.openNow ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white',
                )}
              >
                {branch.openNow ? t('openNow') : t('closed')}
              </span>
              {branch.todayHours && (
                <span className="text-white/70 text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" aria-hidden="true" />{branch.todayHours}
                </span>
              )}
            </div>

            {/* C1: Hero CTAs — driven by getSmartCTA (resolved feature flags) */}
            {cta && (
              <div className="flex flex-wrap gap-3 mt-4">
                <Link
                  href={cta.primary.href}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors shadow-lg"
                >
                  <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
                  {cta.primary.label}
                </Link>
                {cta.secondary && (
                  <Link
                    href={cta.secondary.href}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white text-sm font-medium transition-colors"
                  >
                    <Clock className="w-4 h-4" aria-hidden="true" />
                    {cta.secondary.label}
                  </Link>
                )}
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(`${branch.address}, ${branch.city}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white text-sm font-medium transition-colors"
                >
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  {t('directions')}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Quick Actions ─────────────────────────────────────────────────────────────

/** Selects the icon for a CTA based on its destination href. */
function ctaIcon(href: string): React.ReactNode {
  if (href.includes('/menu'))        return <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
  if (href.includes('/reservation')) return <Clock           className="w-4 h-4" aria-hidden="true" />
  if (href.includes('/loyalty'))     return <Tag             className="w-4 h-4" aria-hidden="true" />
  if (href.includes('#branches'))    return <MapPin          className="w-4 h-4" aria-hidden="true" />
  return                                    <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
}

function QuickActions({
  branch,
  tenantSlug,
  branchSlug,
  journey,
}: {
  branch: PublicBranchInfo
  tenantSlug: string
  branchSlug: string
  journey: CustomerJourney
}) {
  const t = useTranslations('branch')
  const [copied, setCopied] = useState(false)
  const pageUrl = typeof window !== 'undefined' ? window.location.href : `/${tenantSlug}/${branchSlug}`

  const allCTAs = [journey.primaryCTA, ...journey.secondaryCTAs].filter(
    (c): c is NonNullable<typeof c> => c !== null,
  )

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({ title: branch.name, url: pageUrl }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(pageUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <section className="bg-[var(--card)] border-b border-[var(--border)]" aria-label={t('quickActionsAria')}>
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap gap-2">
        {/* Journey-ordered feature CTAs */}
        {allCTAs.map((cta, i) => (
          <Link
            key={cta.href}
            href={cta.href}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm transition-colors',
              i === 0
                ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold hover:bg-[var(--accent-hover)]'
                : 'border border-[var(--border)] font-medium text-[var(--fg)] hover:bg-[var(--card-hover)]',
            )}
          >
            {ctaIcon(cta.href)}{cta.label}
          </Link>
        ))}

        {/* Branch-specific CTAs — not feature-flag-gated; always shown when available */}
        {branch.phone_number && (
          <a
            href={`tel:${branch.phone_number.replace(/\s/g, '')}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
          >
            <Phone className="w-4 h-4" aria-hidden="true" />{t('call')}
          </a>
        )}
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(`${branch.address}, ${branch.city}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
        >
          <MapPin className="w-4 h-4" aria-hidden="true" />{t('directions')}
        </a>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-500" aria-hidden="true" /> : <Share2 className="w-4 h-4" aria-hidden="true" />}
          {copied ? t('copiedExclaim') : t('share')}
        </button>
        <span role="status" aria-live="polite" className="sr-only">{copied ? t('linkCopiedToClipboard') : ''}</span>
      </div>
    </section>
  )
}

// ── Branch Info ───────────────────────────────────────────────────────────────

function BranchInfo({ branch }: { branch: PublicBranchInfo }) {
  const t = useTranslations('branch')
  return (
    <section aria-labelledby="branch-info-heading" className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 space-y-4">
      <h2 id="branch-info-heading" className="font-semibold text-[var(--fg)]">{t('branchInformation')}</h2>
      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-3 text-[var(--fg-muted)]">
          <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
          <div>
            <p>{branch.address}</p>
            <p>{branch.city}</p>
          </div>
        </div>
        {branch.phone_number && (
          <div className="flex items-center gap-3 text-[var(--fg-muted)]">
            <Phone className="w-4 h-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
            <a href={`tel:${branch.phone_number.replace(/\s/g, '')}`} className="hover:text-[var(--fg)] transition-colors">{branch.phone_number}</a>
          </div>
        )}
        {branch.todayHours && (
          <div className="flex items-center gap-3 text-[var(--fg-muted)]">
            <Clock className="w-4 h-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
            <span>{t('todayHours', { hours: branch.todayHours })}</span>
          </div>
        )}
      </div>
      {/* H5: converted to <button> for keyboard accessibility, increased height */}
      <button
        type="button"
        className="w-full h-48 rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--fg-muted)] text-sm cursor-pointer hover:bg-[var(--card-hover)] transition-colors"
        onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(`${branch.address}, ${branch.city}`)}`, '_blank')}
        aria-label={t('openInGoogleMapsAria')}
      >
        <div className="text-center">
          <MapPin className="w-8 h-8 mx-auto mb-1 text-[var(--accent)]" aria-hidden="true" />
          <p className="font-medium">{t('viewOnMap')}</p>
          <p className="text-xs text-[var(--fg-subtle)] mt-0.5">{branch.address}</p>
        </div>
      </button>
    </section>
  )
}

// ── Branch Switcher ───────────────────────────────────────────────────────────

function BranchSwitcher({
  branches,
  currentSlug,
  tenantSlug,
}: {
  branches: PublicBranchInfo[]
  currentSlug: string
  tenantSlug: string
}) {
  const t = useTranslations('branch')
  if (branches.length <= 1) return null

  const currentBranch = branches.find((b) => b.slug === currentSlug)
  const otherBranches = branches.filter((b) => b.slug !== currentSlug)

  return (
    <section aria-labelledby="branch-switcher-heading" className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5">
      <h2 id="branch-switcher-heading" className="font-semibold text-[var(--fg)] mb-3">{t('locations')}</h2>

      {/* H2: Current branch indicator */}
      {currentBranch && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--accent)]/8 border border-[var(--accent)]/20 mb-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--fg)] truncate">{currentBranch.name}</p>
            {currentBranch.todayHours && (
              <p className="text-xs text-[var(--fg-muted)] truncate">{currentBranch.todayHours}</p>
            )}
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium shrink-0">{t('youreHere')}</span>
        </div>
      )}

      <div className="space-y-1">
        {otherBranches.map((b) => (
          <Link
            key={b.slug}
            href={`/${tenantSlug}/${b.slug}`}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--card-hover)] transition-colors group"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--fg)] truncate">{b.name}</p>
              <p className="text-xs text-[var(--fg-muted)] truncate">{b.address}, {b.city}</p>
              {/* H8: today's hours in switcher */}
              {b.todayHours && (
                <p className="text-xs text-[var(--fg-subtle)] truncate mt-0.5">{b.todayHours}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  b.openNow ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                )}
              >
                {b.openNow ? t('open') : t('closed')}
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--fg-muted)] group-hover:text-[var(--fg)]" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ── Featured Menu Items ───────────────────────────────────────────────────────

function FeaturedMenuSection({ items, tenantSlug, branchSlug }: { items: MenuItem[]; tenantSlug: string; branchSlug: string }) {
  const t = useTranslations('branch')
  const featured = items.filter((i) => i.is_featured || i.is_popular).slice(0, 6)
  if (!featured.length) return null
  return (
    <section aria-labelledby="featured-items-heading">
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-[var(--border)]">
        {/* H6: upgraded heading */}
        <h2
          id="featured-items-heading"
          className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]"
        >
          {t('popularItems')}
        </h2>
        <Link href={`/${tenantSlug}/${branchSlug}/menu`} className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1 font-medium">
          {t('fullMenu')} <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {featured.map((item) => (
          <div key={item.id} className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden hover:shadow-md transition-shadow">
            {item.image && (
              // H10: next/image for featured items
              <div className="relative h-28 overflow-hidden">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 33vw"
                />
              </div>
            )}
            <div className="p-3">
              <p className="text-sm font-medium text-[var(--fg)] truncate">{item.name}</p>
              {/* H4: price fix — remove /100 */}
              <p className="text-sm text-[var(--accent)] font-semibold mt-0.5">
                {formatCurrency(item.price)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Categories ────────────────────────────────────────────────────────────────

function CategoriesSection({ categories, tenantSlug, branchSlug }: { categories: Category[]; tenantSlug: string; branchSlug: string }) {
  const t = useTranslations('branch')
  if (!categories.length) return null
  return (
    <section aria-labelledby="categories-heading">
      <div className="mb-5 pb-3 border-b border-[var(--border)]">
        {/* H6: upgraded heading */}
        <h2 id="categories-heading" className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">
          {t('categories')}
        </h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/${tenantSlug}/${branchSlug}/menu?category=${cat.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] text-sm text-[var(--fg-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--fg)] transition-colors"
          >
            <Tag className="w-3.5 h-3.5" aria-hidden="true" />{cat.name}
          </Link>
        ))}
      </div>
    </section>
  )
}

// ── Promotions ────────────────────────────────────────────────────────────────

function PromotionsSection({ promotions, tenantSlug, branchSlug }: { promotions: PromotionRule[]; tenantSlug: string; branchSlug: string }) {
  const t = useTranslations('branch')
  const tTenant = useTranslations('tenant')
  if (!promotions.length) return null

  const TYPE_LABEL_KEYS: Record<string, string> = {
    percentage_discount: 'discount',
    fixed_discount: 'fixedOff',
    buy_one_get_one: 'bogo',
    happy_hour: 'happyHour',
  }

  return (
    <section aria-labelledby="promotions-heading">
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-[var(--border)]">
        {/* H6: upgraded heading */}
        <h2 id="promotions-heading" className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]">
          {tTenant('currentOffers')}
        </h2>
        <Link href={`/${tenantSlug}/${branchSlug}/promotions`} className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1 font-medium">
          {t('allOffers')} <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {promotions.slice(0, 4).map((promo) => (
          <div key={promo.id} className="bg-[var(--card)] rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)] mb-1 block">
              {TYPE_LABEL_KEYS[promo.type] ? tTenant(`promoTypes.${TYPE_LABEL_KEYS[promo.type]}`) : promo.type}
            </span>
            <p className="font-semibold text-[var(--fg)] text-sm mb-1">{promo.name}</p>
            {promo.description && (
              <p className="text-xs text-[var(--fg-muted)] line-clamp-2 mb-2">{promo.description}</p>
            )}
            {/* H3: show discount value */}
            {promo.discountPercent != null && (
              <p className="text-lg font-bold text-[var(--accent)] mb-2">{tTenant('percentOff', { percent: promo.discountPercent })}</p>
            )}
            {promo.discountAmount != null && (
              <p className="text-lg font-bold text-[var(--accent)] mb-2">{tTenant('amountOff', { amount: promo.discountAmount })}</p>
            )}
            {/* H3: Use this offer CTA */}
            <Link
              href={`/${tenantSlug}/${branchSlug}/menu`}
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline"
            >
              {tTenant('useThisOffer')}
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

// ReviewsSection is imported from @/components/reviews/ReviewsSection

// ── Gallery ───────────────────────────────────────────────────────────────────

function GallerySection({ images, label }: { images: string[]; label: string }) {
  if (!images.length) return null
  return (
    <section aria-labelledby="gallery-heading">
      {/* H6: upgraded heading; C4: label makes source clear ("Business Gallery" vs branch) */}
      <h2
        id="gallery-heading"
        className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-5 pb-3 border-b border-[var(--border)]"
      >
        {label}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {images.slice(0, 6).map((url, i) => (
          // H10: next/image for gallery
          <div
            key={i}
            className="relative aspect-square rounded-xl overflow-hidden bg-[var(--bg-secondary)]"
          >
            <Image
              src={url}
              alt=""
              aria-hidden="true"
              fill
              className="object-cover hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 50vw, 33vw"
            />
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Rating Summary ────────────────────────────────────────────────────────────

function RatingSummary({ rating, reviewCount }: { rating?: number; reviewCount?: number }) {
  const t = useTranslations('tenant')
  if (!rating) return null
  return (
    <div className="flex items-center gap-2 p-4 bg-[var(--card)] rounded-2xl border border-[var(--border)]">
      <Star className="w-5 h-5 text-amber-400 fill-amber-400 shrink-0" aria-hidden="true" />
      <div>
        <span className="font-bold text-[var(--fg)] text-lg">{rating.toFixed(1)}</span>
        {reviewCount != null && (
          <span className="text-sm text-[var(--fg-muted)] ml-1.5">{t('reviewsCount', { count: reviewCount })}</span>
        )}
      </div>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function BranchSkeleton() {
  const t = useTranslations('branch')
  return (
    <>
      <TenantHeader />
      <div role="status" aria-label={t('loadingBranchPageAria')} className="animate-pulse">
        <div className="h-[45vh] min-h-[300px] bg-[var(--card)]" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 space-y-6">
              {/* Quick actions */}
              <div className="flex gap-3">
                <div className="h-10 w-32 bg-[var(--card-hover)] rounded-xl" />
                <div className="h-10 w-28 bg-[var(--card-hover)] rounded-xl" />
                <div className="h-10 w-24 bg-[var(--card-hover)] rounded-xl" />
              </div>
              {/* Menu cards */}
              <div className="space-y-3">
                <div className="h-7 w-40 bg-[var(--card-hover)] rounded-xl" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl overflow-hidden bg-[var(--card)] border border-[var(--border)]">
                      <div className="h-32 bg-[var(--card-hover)]" />
                      <div className="p-3 space-y-2">
                        <div className="h-4 w-3/4 bg-[var(--card-hover)] rounded" />
                        <div className="h-3 w-1/2 bg-[var(--card-hover)] rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Sidebar */}
            <div className="w-full lg:w-72 space-y-4 shrink-0">
              <div className="h-48 bg-[var(--card)] rounded-2xl border border-[var(--border)]" />
              <div className="h-32 bg-[var(--card)] rounded-2xl border border-[var(--border)]" />
            </div>
          </div>
        </div>
        <span className="sr-only">{t('loadingEllipsis')}</span>
      </div>
      <Footer />
    </>
  )
}

// ── Not found (client) ────────────────────────────────────────────────────────

function BranchNotFound({ tenantSlug }: { tenantSlug: string }) {
  const t = useTranslations('branch')
  const tTenant = useTranslations('tenant')
  return (
    <>
      <TenantHeader />
      <main className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center">
        <Store className="w-16 h-16 text-[var(--fg-muted)] mb-6" aria-hidden="true" />
        <h1 className="text-3xl font-bold text-[var(--fg)] mb-3">{t('branchNotFound')}</h1>
        <p className="text-[var(--fg-muted)] max-w-sm mb-8">
          {t('branchNotFoundDesc')}
        </p>
        <div className="flex items-center gap-3">
          <Link
            href={`/${tenantSlug}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] font-medium hover:bg-[var(--accent-hover)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {t('backToBusiness')}
          </Link>
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] text-[var(--fg)] font-medium hover:bg-[var(--card-hover)] transition-colors"
          >
            {tTenant('browseAllBusinesses')}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface Props {
  tenantSlug: string
  branchSlug: string
  tenantId: string
  branchId: string
  initialBranch: PublicBranchInfo
  marketplaceBranch: PublicBranchInfo
}

export default function BranchHomepageClient({
  tenantSlug,
  branchSlug,
  tenantId,
  branchId,
  initialBranch,
  marketplaceBranch,
}: Props) {
  const t = useTranslations('branch')
  const tenant = useTenantStore((s) => s.tenant)
  const tenantState = useTenantStore((s) => s.tenantState)
  const tenantLoading = useTenantStore((s) => s.isLoading || s.tenantState === 'loading')
  const { data: branch, isLoading: branchLoading } = usePublicBranch(tenantId, branchId, {
    marketplaceBranch,
    initialData: initialBranch,
  })
  const { data: categories = [] } = useCategories(branchId)
  const { data: menuItemsPage } = useMenuItems(branchId)
  const { data: promotions = [] } = useActivePromotions()
  const { data: layout } = useHomepageLayout(tenantId)
  const featureFlags = useTenantStore((s) => s.featureFlags)

  const menuItems: MenuItem[] = menuItemsPage?.results ?? []

  if (tenantLoading || branchLoading) return <BranchSkeleton />
  if (!tenant || tenant.slug !== tenantSlug || tenantState !== 'resolved' || !branch) {
    return <BranchNotFound tenantSlug={tenantSlug} />
  }

  const meta = getMarketplaceMeta(tenant.settings)
  const sections = buildPublicSections(layout?.sections)

  // Smart Customer Journey: business-type-aware CTA priority + section order
  const ctas = buildPublicCTAs({ tenantSlug, branchSlug, featureFlags })
  const journey = buildCustomerJourney({ businessTypes: tenant.businessTypes, ctas })

  const accentColor =
    tenant.settings?.theme?.primaryColor ?? '#e85d04'

  const allBranches = meta?.branches ?? []
  const tenantGallery = meta?.gallery ?? []
  const rating = meta?.rating
  const reviewCount = meta?.reviewCount

  // C4: use branch.image as the branch-specific photo if available;
  // label tenant gallery clearly so it doesn't imply branch-specific imagery
  const branchPhotos = branch.image ? [branch.image] : []
  const hasGallery = tenantGallery.length > 0

  return (
    <>
      <TenantHeader />
      <Breadcrumb tenantSlug={tenantSlug} tenantName={tenant.name} branchName={branch.name} />
      <HeroSection
        branch={branch}
        tenant={tenant}
        accentColor={accentColor}
        tenantSlug={tenantSlug}
        branchSlug={branchSlug}
      />
      <QuickActions branch={branch} tenantSlug={tenantSlug} branchSlug={branchSlug} journey={journey} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content — rendered in journey section order */}
          <div className="lg:col-span-2 space-y-10">
            {/* Trust signal near top — always first */}
            <RatingSummary rating={rating} reviewCount={reviewCount} />

            {/* Section component map: visibility gated by buildPublicSections(),
                order driven by buildCustomerJourney().sectionOrder */}
            {(() => {
              const sectionNodes: Partial<Record<string, React.ReactNode>> = {
                // CategoriesSection always renders alongside featured_menu (structural nav)
                featured_menu: (
                  <>
                    <CategoriesSection categories={categories} tenantSlug={tenantSlug} branchSlug={branchSlug} />
                    {sections.featured_menu && <FeaturedMenuSection items={menuItems} tenantSlug={tenantSlug} branchSlug={branchSlug} />}
                  </>
                ),
                reviews: sections.reviews ? (
                  <ReviewsSection
                    tenantId={tenant.id}
                    tenantSlug={tenantSlug}
                    branchId={branchId}
                    initialRating={rating}
                    initialReviewCount={reviewCount}
                  />
                ) : null,
                // C4: Branch-specific photo first, then labeled tenant gallery
                gallery: sections.gallery ? (
                  <>
                    {branchPhotos.length > 0 && <GallerySection images={branchPhotos} label={t('thisLocation')} />}
                    {hasGallery && <GallerySection images={tenantGallery} label={t('businessGallery')} />}
                  </>
                ) : null,
                promotions: sections.promotions ? (
                  <PromotionsSection promotions={promotions as PromotionRule[]} tenantSlug={tenantSlug} branchSlug={branchSlug} />
                ) : null,
              }
              return journey.sectionOrder
                .filter((k) => k !== 'branches') // branches is in sidebar, not main column
                .map((key) => {
                  const node = sectionNodes[key]
                  if (node === null || node === undefined) return null
                  return <Fragment key={key}>{node}</Fragment>
                })
            })()}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <BranchInfo branch={branch} />
            {sections.branches && <BranchSwitcher branches={allBranches} currentSlug={branchSlug} tenantSlug={tenantSlug} />}
          </div>
        </div>
      </div>
      {meta
        ? <TenantFooter tenantName={tenant.name} tenantSlug={tenantSlug} meta={meta} />
        : <Footer />}
    </>
  )
}
