'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Fragment, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Star, MapPin, Phone, Mail, Globe, Clock,
  UtensilsCrossed, Tag, Share2, Check, ExternalLink,
  ChevronRight, Store, ArrowLeft, Wifi, ParkingSquare, Wind,
} from 'lucide-react'
import { TenantHeader } from '@/components/layout/TenantHeader'
import { Footer } from '@/components/layout/Footer'
import { TenantFooter } from '@/components/layout/TenantFooter'
import { cn, formatCurrency, getSmartCTA, buildPublicCTAs, buildPublicSections, buildCustomerJourney } from '@/utils'
import type { CustomerJourney } from '@/utils'
import { useTenantStore } from '@/stores'
import { useCategories, useMenuItems, useActivePromotions, useHomepageLayout, usePublicBranches } from '@/hooks'
import { ReviewsSection } from '@/components/reviews/ReviewsSection'
import {
  getMarketplaceMeta,
  BUSINESS_TYPE_LABELS,
  type MarketplaceMeta,
  type PublicBranchInfo,
} from '@/types/marketplace'
import type { Tenant, Category, MenuItem, PromotionRule } from '@/types'

// ── Price level helper ────────────────────────────────────────────────────────

function PriceLevel({ level }: { level?: number }) {
  const t = useTranslations('tenant')
  if (!level) return null
  const labels = ['', '$', '$$', '$$$', '$$$$']
  return (
    <span className="text-sm text-white/80" aria-label={t('priceLevelAria', { level: labels[level] })}>
      {labels[level]}
    </span>
  )
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

function Breadcrumb({ name }: { name: string }) {
  const t = useTranslations('tenant')
  return (
    <nav aria-label={t('breadcrumbAria')} className="bg-[var(--bg)] border-b border-[var(--border)]">
      <ol className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-1.5 text-sm text-[var(--fg-muted)]">
        <li className="inline-flex items-center">
          <Link href="/discover" className="hover:text-[var(--fg)] transition-colors">
            {t('discover')}
          </Link>
        </li>
        <li aria-hidden="true" className="inline-flex items-center">
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        </li>
        <li className="inline-flex items-center font-medium text-[var(--fg)] truncate max-w-[200px]" aria-current="page">
          {name}
        </li>
      </ol>
    </nav>
  )
}

/** Tenant homepage omits the Order Online entry point; branch pages keep it. */
const ORDER_ONLINE_LABEL = 'Order Online' as const

// ── Hero Section ──────────────────────────────────────────────────────────────

function HeroSection({
  tenant,
  meta,
  branchCapability,
}: {
  tenant: Tenant
  meta: MarketplaceMeta
  branchCapability?: { orderingEnabled?: boolean; reservationsEnabled?: boolean }
}) {
  const t = useTranslations('tenant')
  const tMarketplace = useTranslations('marketplace')
  const accentColor = tenant.settings?.theme?.primaryColor ?? 'var(--accent)'
  const label = tenant.businessTypes.map((bt) => (BUSINESS_TYPE_LABELS[bt] ? tMarketplace(`businessTypes.${bt}`) : bt)).join(' · ')

  const featureFlags = useTenantStore((s) => s.featureFlags)
  const cta = getSmartCTA({
    tenantSlug: tenant.slug,
    branchSlug: undefined,
    featureFlags,
    meta,
    branch: branchCapability,
  })
  const heroPrimary =
    cta && cta.primary.label !== ORDER_ONLINE_LABEL ? cta.primary : undefined
  const heroSecondary =
    cta?.secondary && cta.secondary.label !== ORDER_ONLINE_LABEL
      ? cta.secondary
      : undefined

  return (
    <section
      aria-labelledby="tenant-hero-heading"
      className="relative h-[55vh] min-h-[340px] max-h-[600px] overflow-hidden"
    >
      {/* C1/H1: Next.js Image with priority for above-fold hero */}
      {meta.coverImage ? (
        <Image
          src={meta.coverImage}
          alt=""
          aria-hidden="true"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-orange-900 to-stone-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />

      {/* Badges */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
        {meta.openNow !== undefined && (
          <span
            className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-full shadow',
              meta.openNow ? 'bg-emerald-500 text-white' : 'bg-gray-800/90 text-gray-200',
            )}
          >
            {meta.openNow ? tMarketplace('openNow') : tMarketplace('closed')}
          </span>
        )}
        {meta.featured && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-500 text-white shadow">
            {tMarketplace('featured')}
          </span>
        )}
        {!meta.featured && meta.popular && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500 text-white shadow">
            {tMarketplace('popular')}
          </span>
        )}
        {meta.isNew && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow">
            {tMarketplace('new')}
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
            {/* H8: tagline — not italic, cleaner weight */}
            {meta.tagline && (
              <p className="text-base text-white/90 mt-1">{meta.tagline}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {meta.rating !== undefined && (
                <span className="flex items-center gap-1 text-sm text-white/80">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" aria-hidden="true" />
                  <strong className="text-white">{meta.rating.toFixed(1)}</strong>
                  <span>{t('reviewsCount', { count: meta.reviewCount ?? 0 })}</span>
                </span>
              )}
              {meta.city && (
                <span className="flex items-center gap-1 text-sm text-white/80">
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  {meta.city}
                </span>
              )}
              {/* C4: MapPin instead of GitBranch */}
              {(meta.branchCount ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-sm text-white/80">
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  {t('locationsCountLower', { count: meta.branchCount ?? 0 })}
                </span>
              )}
              <PriceLevel level={meta.priceLevel} />
            </div>

            {/* C1: Primary CTA in hero — driven by getSmartCTA (resolved feature flags) */}
            {(heroPrimary || heroSecondary) && (
              <div className="flex flex-wrap gap-3 mt-4">
                {heroPrimary && (
                  <Link
                    href={heroPrimary.href}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors shadow-lg"
                  >
                    <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
                    {heroPrimary.label}
                  </Link>
                )}
                {heroSecondary ? (
                  <Link
                    href={heroSecondary.href}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white text-sm font-medium transition-colors"
                  >
                    <MapPin className="w-4 h-4" aria-hidden="true" />
                    {heroSecondary.label}
                  </Link>
                ) : heroPrimary ? (
                  <a
                    href="#branches"
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white text-sm font-medium transition-colors"
                  >
                    <MapPin className="w-4 h-4" aria-hidden="true" />
                    {t('allLocations')}
                  </a>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Share Button ──────────────────────────────────────────────────────────────

function ShareButton({ tenant }: { tenant: Tenant }) {
  const t = useTranslations('tenant')
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
      aria-label={t('shareThisBusinessAria')}
    >
      {copied ? (
        <Check className="w-4 h-4 text-emerald-500" aria-hidden="true" />
      ) : (
        <Share2 className="w-4 h-4" aria-hidden="true" />
      )}
      {copied ? t('copiedExclaim') : t('share')}
    </button>
  )
}

// ── Quick Actions ─────────────────────────────────────────────────────────────

/** Selects the icon for a CTA based on its destination href. */
function ctaIcon(href: string): React.ReactNode {
  if (href.includes('/menu'))        return <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
  if (href.includes('/reservation')) return <Clock           className="w-4 h-4" aria-hidden="true" />
  if (href.includes('/loyalty'))     return <Tag             className="w-4 h-4" aria-hidden="true" />
  if (href.includes('#branches'))    return <MapPin          className="w-4 h-4" aria-hidden="true" />
  return                                    <ExternalLink    className="w-4 h-4" aria-hidden="true" />
}

/**
 * Renders the quick-action bar in journey priority order.
 * Receives a pre-computed CustomerJourney so CTA resolution and ordering
 * happen once in the parent, not in every sub-component.
 */
function QuickActions({ journey, tenant }: { journey: CustomerJourney; tenant: Tenant }) {
  const t = useTranslations('tenant')
  const allCTAs = [journey.primaryCTA, ...journey.secondaryCTAs].filter(
    (c): c is NonNullable<typeof c> => c !== null,
  )

  return (
    <section aria-label={t('quickActionsAria')}>
      <div className="flex flex-wrap gap-2">
        {allCTAs.map((cta, i) => (
          <Link
            key={cta.href}
            href={cta.href}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm transition-colors',
              i === 0
                ? 'bg-[var(--accent)] text-[var(--accent-fg)] font-semibold hover:bg-[var(--accent-hover)]'
                : 'border border-[var(--border)] font-medium text-[var(--fg)] hover:bg-[var(--card-hover)]',
            )}
          >
            {ctaIcon(cta.href)}
            {cta.label}
          </Link>
        ))}
        <ShareButton tenant={tenant} />
      </div>
    </section>
  )
}

// ── Amenities Strip ───────────────────────────────────────────────────────────

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  wifi: <Wifi className="w-3.5 h-3.5" aria-hidden="true" />,
  parking: <ParkingSquare className="w-3.5 h-3.5" aria-hidden="true" />,
  'air conditioning': <Wind className="w-3.5 h-3.5" aria-hidden="true" />,
}

function AmenitiesStrip({ amenities }: { amenities: string[] }) {
  const t = useTranslations('tenant')
  if (amenities.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mt-4" role="list" aria-label={t('amenitiesAria')}>
      {amenities.map((a) => (
        <span
          key={a}
          role="listitem"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] text-[var(--fg-muted)] border border-[var(--border)]"
        >
          {AMENITY_ICONS[a.toLowerCase()] ?? null}
          {a}
        </span>
      ))}
    </div>
  )
}

// ── Business Info ─────────────────────────────────────────────────────────────

function BusinessInfo({ meta }: { meta: MarketplaceMeta }) {
  const t = useTranslations('tenant')
  return (
    <section aria-labelledby="about-heading">
      {/* H9: Upgraded section heading */}
      <h2
        id="about-heading"
        className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-4 pb-3 border-b border-[var(--border)]"
      >
        {t('about')}
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Description + story + tags */}
        <div>
          {meta.description && (
            <p className="text-[var(--fg-muted)] leading-relaxed mb-4">{meta.description}</p>
          )}

          {/* C2: Our Story block */}
          {meta.story && (
            <div className="mb-4 p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--fg)] mb-2">{t('ourStory')}</h3>
              <p className="text-sm text-[var(--fg-muted)] leading-relaxed">{meta.story}</p>
            </div>
          )}

          {(meta.cuisines?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {meta.cuisines!.map((c) => (
                <span
                  key={c}
                  className="text-xs px-2.5 py-1 rounded-full bg-[var(--bg-secondary)] text-[var(--fg-muted)] border border-[var(--border)]"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          {(meta.tags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {meta.tags!.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* C5: Amenities */}
          <AmenitiesStrip amenities={meta.amenities ?? []} />
        </div>

        {/* Contact info */}
        <div className="space-y-3">
          {meta.phone_number && (
            <a
              href={`tel:${meta.phone_number}`}
              className="flex items-center gap-3 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
            >
              <Phone className="w-4 h-4 shrink-0" aria-hidden="true" />
              {meta.phone_number}
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
  const t = useTranslations('tenant')
  return (
    <article className="flex flex-col bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-[var(--shadow-soft)] hover:shadow-md transition-shadow">
      {branch.image && (
        <div className="relative h-36 overflow-hidden bg-[var(--bg-secondary)]">
          {/* H10: Next.js Image for branch card */}
          <Image
            src={branch.image}
            alt=""
            aria-hidden="true"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <span
            className={cn(
              'absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full',
              branch.openNow ? 'bg-emerald-500/90 text-white' : 'bg-gray-800/80 text-gray-200',
            )}
          >
            {branch.openNow ? t('open') : t('closed')}
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
        {branch.phone_number && (
          <a
            href={`tel:${branch.phone_number}`}
            className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] flex items-center gap-1.5 mb-3"
          >
            <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {branch.phone_number}
          </a>
        )}
        <Link
          href={`/${tenantSlug}/${branch.slug}`}
          className="mt-auto text-center text-sm font-medium px-3 py-2 rounded-xl border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
          aria-label={t('visitBranchAria', { name: branch.name })}
        >
          {t('visitBranch')}
        </Link>
      </div>
    </article>
  )
}

function BranchesSection({
  branches,
  tenantSlug,
}: {
  branches: PublicBranchInfo[]
  tenantSlug: string
}) {
  const t = useTranslations('tenant')
  if (branches.length === 0) return null

  return (
    <section id="branches" aria-labelledby="branches-heading">
      {/* H9: Upgraded section heading */}
      <h2
        id="branches-heading"
        className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-5 pb-3 border-b border-[var(--border)]"
      >
        {t('ourLocations')}
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

function CategoriesSection({
  categories,
  tenantSlug,
  primaryBranchSlug,
}: {
  categories: Category[]
  tenantSlug: string
  primaryBranchSlug: string
}) {
  const t = useTranslations('tenant')
  if (categories.length === 0) return null
  const CATEGORY_ICONS: Record<string, string> = {
    pizza: '🍕', burgers: '🍔', pasta: '🍝', drinks: '🥤', desserts: '🍰',
    coffee: '☕', salads: '🥗', sushi: '🍣', tacos: '🌮', breakfast: '🍳',
  }

  return (
    <section aria-labelledby="categories-heading">
      {/* H9: Upgraded section heading */}
      <h2
        id="categories-heading"
        className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-5 pb-3 border-b border-[var(--border)]"
      >
        {t('browseByCategory')}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {categories.slice(0, 10).map((cat) => {
          const icon = CATEGORY_ICONS[cat.slug?.toLowerCase() ?? ''] ?? '🍽️'
          return (
            // C3: Link instead of non-interactive div
            <Link
              key={cat.id}
              href={`/${tenantSlug}/${primaryBranchSlug}/menu?category=${cat.slug}`}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--card-hover)] hover:border-[var(--accent)]/30 transition-colors"
              aria-label={t('browseCategoryAria', { name: cat.name })}
            >
              <span className="text-2xl" aria-hidden="true">
                {icon}
              </span>
              <span className="text-sm font-medium text-[var(--fg)] text-center">{cat.name}</span>
              {cat.items_count != null && (
                <span className="text-xs text-[var(--fg-muted)]">{t('itemsCount', { count: cat.items_count })}</span>
              )}
            </Link>
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
  const t = useTranslations('tenant')
  const featured = items.filter((i) => i.is_featured || i.is_popular).slice(0, 4)
  if (featured.length === 0) return null

  return (
    <section aria-labelledby="featured-items-heading">
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-[var(--border)]">
        {/* H9: Upgraded section heading */}
        <h2
          id="featured-items-heading"
          className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)]"
        >
          {t('popularItems')}
        </h2>
        <Link
          href={`/${tenantSlug}/${primaryBranchSlug}/menu`}
          className="text-sm text-[var(--accent)] hover:underline font-medium"
        >
          {t('viewFullMenu')}
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {featured.map((item) => (
          <article
            key={item.id}
            className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-[var(--shadow-soft)]"
          >
            {item.image && (
              // H10: Next.js Image for featured items
              <div className="relative h-32 overflow-hidden bg-[var(--bg-secondary)]">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 25vw"
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
                  {formatCurrency(item.price)}
                </span>
                <span className="flex items-center gap-0.5 text-xs text-[var(--fg-muted)]">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" aria-hidden="true" />
                  {item.rating?.toFixed(1) ?? "0.0"}
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

function PromotionsSection({
  promotions,
  tenantSlug,
  primaryBranchSlug,
}: {
  promotions: PromotionRule[]
  tenantSlug: string
  primaryBranchSlug: string
}) {
  const t = useTranslations('tenant')
  if (promotions.length === 0) return null

  const TYPE_LABEL_KEYS: Record<string, string> = {
    percentage_discount: 'discount',
    fixed_discount: 'fixedOff',
    buy_one_get_one: 'bogo',
    happy_hour: 'happyHour',
  }

  return (
    <section aria-labelledby="promotions-heading">
      {/* H9: Upgraded section heading */}
      <h2
        id="promotions-heading"
        className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-5 pb-3 border-b border-[var(--border)]"
      >
        {t('currentOffers')}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.slice(0, 3).map((promo) => (
          <div
            key={promo.id}
            className="p-4 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)] mb-2 block">
              {TYPE_LABEL_KEYS[promo.type] ? t(`promoTypes.${TYPE_LABEL_KEYS[promo.type]}`) : promo.type}
            </span>
            <h3 className="font-semibold text-[var(--fg)] mb-1">{promo.name}</h3>
            <p className="text-sm text-[var(--fg-muted)]">{promo.description}</p>
            {promo.discountPercent != null && (
              <p className="mt-2 text-xl font-bold text-[var(--accent)]">
                {t('percentOff', { percent: promo.discountPercent })}
              </p>
            )}
            {promo.discountAmount != null && (
              <p className="mt-2 text-xl font-bold text-[var(--accent)]">
                {t('amountOff', { amount: promo.discountAmount })}
              </p>
            )}
            {/* H6: Use this offer CTA */}
            <Link
              href={`/${tenantSlug}/${primaryBranchSlug}/menu`}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline"
            >
              {t('useThisOffer')}
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

// ReviewsSection is imported from @/components/reviews/ReviewsSection

// ── Gallery Section ───────────────────────────────────────────────────────────

function GallerySection({ meta }: { meta: MarketplaceMeta }) {
  const t = useTranslations('tenant')
  const images = [meta.coverImage, ...(meta.gallery ?? [])].filter(Boolean).slice(0, 6)
  // H5: Show gallery even with a single image (was <= 1)
  if (images.length === 0) return null

  return (
    <section aria-labelledby="gallery-heading">
      {/* H9: Upgraded section heading */}
      <h2
        id="gallery-heading"
        className="font-[var(--font-display)] text-2xl font-bold text-[var(--fg)] mb-5 pb-3 border-b border-[var(--border)]"
      >
        {t('gallery')}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {images.map((src, i) => (
          <div
            key={i}
            className="relative aspect-video overflow-hidden rounded-xl bg-[var(--bg-secondary)]"
          >
            <Image
              src={src as string}
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

// ── Loading / Error states ────────────────────────────────────────────────────

function LoadingSkeleton() {
  const t = useTranslations('tenant')
  return (
    <>
      <TenantHeader />
      <div role="status" aria-label={t('loadingPageContentAria')} className="animate-pulse">
        <div className="h-[55vh] min-h-[340px] bg-[var(--card)]" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">
          {/* Quick actions row */}
          <div className="flex gap-3">
            <div className="h-10 w-32 bg-[var(--card-hover)] rounded-xl" />
            <div className="h-10 w-28 bg-[var(--card-hover)] rounded-xl" />
            <div className="h-10 w-28 bg-[var(--card-hover)] rounded-xl" />
          </div>
          {/* Section heading + cards */}
          <div className="space-y-4">
            <div className="h-7 w-44 bg-[var(--card-hover)] rounded-xl" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden bg-[var(--card)] border border-[var(--border)]">
                  <div className="h-36 bg-[var(--card-hover)]" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 w-3/4 bg-[var(--card-hover)] rounded" />
                    <div className="h-3 w-1/2 bg-[var(--card-hover)] rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Secondary section */}
          <div className="space-y-4">
            <div className="h-7 w-36 bg-[var(--card-hover)] rounded-xl" />
            <div className="h-4 w-full max-w-lg bg-[var(--card-hover)] rounded-xl" />
            <div className="h-4 w-full max-w-md bg-[var(--card-hover)] rounded-xl" />
          </div>
        </div>
        <span className="sr-only">{t('loadingEllipsis')}</span>
      </div>
      <Footer />
    </>
  )
}

function TenantNotFoundState() {
  const t = useTranslations('tenant')
  return (
    <>
      <TenantHeader />
      <main className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center">
        <Store className="w-16 h-16 text-[var(--fg-muted)] mb-6" aria-hidden="true" />
        <h1 className="text-3xl font-bold text-[var(--fg)] mb-3">{t('businessNotFound')}</h1>
        <p className="text-[var(--fg-muted)] max-w-sm mb-8">
          {t('businessNotFoundDesc')}
        </p>
        <Link
          href="/discover"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {t('browseAllBusinesses')}
        </Link>
      </main>
      <Footer />
    </>
  )
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function TenantHomepageClient({ tenantSlug }: { tenantSlug: string }) {
  const tenant = useTenantStore((s) => s.tenant)
  const tenantState = useTenantStore((s) => s.tenantState)
  const isLoading = useTenantStore((s) => s.isLoading || s.tenantState === 'loading')
  const tenantId = tenant?.id ?? ''
  // The tenant homepage previews the tenant's primary branch's menu — there is
  // no single "tenant menu"; each branch (including the primary one) owns its
  // own independent categories/items. See docs/BRANCH_MENU_ANALYSIS.md.
  const meta = tenant ? getMarketplaceMeta(tenant.settings) : undefined
  const { data: publicBranches = [] } = usePublicBranches(tenantId, tenant?.settings)
  const primaryBranch =
    publicBranches.find((b) => b.slug === meta?.primaryBranchSlug) ?? publicBranches[0]
  const visibleBranches = publicBranches.filter((b) => b.marketplaceVisible !== false)
  const primaryBranchCapability = primaryBranch
    ? {
        orderingEnabled: primaryBranch.checkout?.orderingEnabled,
        reservationsEnabled: primaryBranch.reservationsEnabled,
      }
    : undefined
  const primaryBranchId = primaryBranch?.id
  const { data: categories = [] } = useCategories(primaryBranchId)
  const { data: menuItemsPage } = useMenuItems(primaryBranchId)
  const menuItems = menuItemsPage?.results ?? []
  const { data: promotions = [] } = useActivePromotions()
  // Website Builder section config — optional, fails open to DEFAULT_SECTIONS
  const { data: layout } = useHomepageLayout(tenantId)
  const featureFlags = useTenantStore((s) => s.featureFlags)

  if (isLoading) return <LoadingSkeleton />
  if (!tenant || tenant.slug !== tenantSlug || tenantState !== 'resolved') return <TenantNotFoundState />
  if (!meta) return <TenantNotFoundState />

  // Section visibility: Website Builder config or DEFAULT_SECTIONS
  const sections = buildPublicSections(layout?.sections)

  // Smart Customer Journey: business-type-aware CTA priority + section order
  const ctas = buildPublicCTAs({
    tenantSlug,
    branchSlug: undefined,
    featureFlags,
    meta,
    branch: primaryBranchCapability,
  })
  const homepageCTAs = {
    ...ctas,
    menu: ctas.menu?.label === ORDER_ONLINE_LABEL ? null : ctas.menu,
  }
  const journey = buildCustomerJourney({ businessTypes: tenant.businessTypes, ctas: homepageCTAs })

  // Section component map — visibility still gated by buildPublicSections().
  // The featured_menu slot always includes CategoriesSection so it moves with
  // featured content in the journey order.
  const sectionNodes: Partial<Record<string, React.ReactNode>> = {
    about: sections.about ? <BusinessInfo meta={meta} /> : null,
    reviews: sections.reviews ? (
      <ReviewsSection
        tenantId={tenant.id}
        tenantSlug={tenantSlug}
        initialRating={meta.rating}
        initialReviewCount={meta.reviewCount}
      />
    ) : null,
    gallery: sections.gallery ? <GallerySection meta={meta} /> : null,
    branches: sections.branches ? (
      <BranchesSection branches={visibleBranches} tenantSlug={tenantSlug} />
    ) : null,
    // CategoriesSection always renders (structural nav); FeaturedItemsSection is section-gated.
    featured_menu: (
      <>
        <CategoriesSection
          categories={categories}
          tenantSlug={tenantSlug}
          primaryBranchSlug={meta.primaryBranchSlug ?? ''}
        />
        {sections.featured_menu && (
          <FeaturedItemsSection
            items={menuItems}
            tenantSlug={tenantSlug}
            primaryBranchSlug={meta.primaryBranchSlug ?? ''}
          />
        )}
      </>
    ),
    promotions: sections.promotions ? (
      <PromotionsSection
        promotions={promotions}
        tenantSlug={tenantSlug}
        primaryBranchSlug={meta.primaryBranchSlug ?? ''}
      />
    ) : null,
  }

  return (
    <>
      <TenantHeader />

      <Breadcrumb name={tenant.name} />

      <main id="main-content">
        <HeroSection tenant={tenant} meta={meta} branchCapability={primaryBranchCapability} />

        <div className="max-w-7xl mx-auto px-4 py-10 space-y-16">
          <QuickActions journey={journey} tenant={tenant} />
          {journey.sectionOrder.map((key) => {
            const node = sectionNodes[key]
            if (node === null || node === undefined) return null
            return <Fragment key={key}>{node}</Fragment>
          })}
        </div>
      </main>

      <TenantFooter tenantName={tenant.name} tenantSlug={tenantSlug} meta={meta} />
    </>
  )
}
