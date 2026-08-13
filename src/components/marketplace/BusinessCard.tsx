'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Star, MapPin, Calendar, Award, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/utils'
import type { Tenant } from '@/types'
import { type MarketplaceMeta, type PublicBranchInfo, BUSINESS_TYPE_LABELS } from '@/types/marketplace'
import { usePublicBranches } from '@/hooks'
import { BranchPreview } from './BranchPreview'
import { resolveTenantBranding, resolveTenantImage } from '@/lib/tenant-branding'

interface BusinessCardProps {
  tenant: Tenant
  meta: MarketplaceMeta
  /** When provided (e.g. Discover page), skips per-card branch API fetch. */
  branches?: PublicBranchInfo[]
  className?: string
}

function StatusBadge({ meta }: { meta: MarketplaceMeta }) {
  const t = useTranslations('marketplace')
  if (meta.featured) return <span className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500 text-white">{t('featured')}</span>
  if (meta.isNew)    return <span className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500 text-white">{t('new')}</span>
  if (meta.popular)  return <span className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500 text-white">{t('popular')}</span>
  return null
}

function PriceDots({ level }: { level?: number }) {
  const t = useTranslations('marketplace')
  if (!level) return null
  const symbol = '$'.repeat(level)
  const labels = ['', t('priceBudget'), t('priceModerate'), t('priceUpscale'), t('priceFineDining')]
  return (
    <span
      className="text-xs font-medium text-[var(--fg-subtle)]"
      aria-label={labels[level]}
    >
      {symbol}
    </span>
  )
}

export function BusinessCard({ tenant, meta, branches: branchesProp, className }: BusinessCardProps) {
  const t = useTranslations('marketplace')
  const [branchesOpen, setBranchesOpen] = useState(false)
  const { data: resolvedBranches } = usePublicBranches(tenant.id, tenant.settings, {
    enabled: branchesProp === undefined,
  })
  const branches = branchesProp ?? resolvedBranches ?? meta.branches ?? []
  const visibleBranches = branches.filter((b) => b.marketplaceVisible !== false)

  const label = tenant.businessTypes.map((bt) => (BUSINESS_TYPE_LABELS[bt] ? t(`businessTypes.${bt}`) : bt)).join(' · ')
  const accentColor = resolveTenantBranding({ settings: tenant.settings })?.primaryColor
  const tenantImage = resolveTenantImage(tenant)
  const featureFlags = tenant.settings?.featureFlags ?? {}
  const hasReservations =
    branches.length > 0
      ? branches.some((b) => b.reservationsEnabled === true)
      : featureFlags['reservations.enabled'] === true
  const hasLoyalty = Object.entries(featureFlags).some(([k, v]) => k.includes('loyalty') && v === true)

  // C3: multi-branch businesses go to the tenant homepage so users can choose a location.
  // Single-branch businesses go directly to the menu.
  const isMultiBranch = (meta.branchCount ?? 0) > 1
  const viewHref   = isMultiBranch ? `/${tenant.slug}` : `/${tenant.slug}/${meta.primaryBranchSlug ?? ''}/menu`
  const tenantHref = `/${tenant.slug}`
  const hasBranches = visibleBranches.length > 0
  // C3: Use a contextual CTA label based on business type and branch count
  const nonMenuTypes = ['bar', 'hotel', 'other']
  const isNonMenuType = tenant.businessTypes.every((bt) => nonMenuTypes.includes(bt))
  const ctaLabel = isMultiBranch ? t('explore') : isNonMenuType ? t('visit') : t('viewMenu')

  return (
    <article
      className={cn(
        'group flex flex-col bg-[var(--card)] rounded-2xl border border-[var(--border)]',
        'overflow-hidden shadow-[var(--shadow-soft)] hover:shadow-md hover:-translate-y-0.5',
        'transition-all duration-200',
        className,
      )}
      aria-label={`${tenant.name} — ${label}`}
    >
      {/* Cover image — H4: use Next.js Image for format negotiation + lazy loading */}
      <div className="relative h-48 overflow-hidden bg-[var(--bg-secondary)] shrink-0">
        {meta.coverImage ? (
          <Image
            src={meta.coverImage}
            alt=""
            aria-hidden="true"
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-950/30 dark:to-stone-900 flex items-center justify-center">
            <span className="text-4xl opacity-40">🍽️</span>
          </div>
        )}
        {meta.openNow !== undefined && (
          <span
            className={cn(
              'absolute top-3 left-3 text-xs font-semibold px-2 py-0.5 rounded-full',
              meta.openNow ? 'bg-emerald-500/90 text-white' : 'bg-gray-800/80 text-gray-200',
            )}
          >
            {meta.openNow ? t('openNow') : t('closed')}
          </span>
        )}
        <StatusBadge meta={meta} />
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-4">
        {/* Logo + name + price */}
        <div className="flex items-start gap-3 mb-2">
          <div
            className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm overflow-hidden"
            style={{ background: accentColor ?? 'var(--accent)' }}
            aria-hidden="true"
          >
            {tenantImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenantImage} alt="" className="h-full w-full object-cover" />
            ) : (
              tenant.name[0]
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-1">
              <h3 className="font-semibold text-[var(--fg)] leading-tight truncate">{tenant.name}</h3>
              <PriceDots level={meta.priceLevel} />
            </div>
            <p className="text-xs text-[var(--fg-muted)] mt-0.5">{label}</p>
          </div>
        </div>

        {/* Description */}
        {meta.description && (
          <p className="text-sm text-[var(--fg-muted)] line-clamp-2 mb-3">{meta.description}</p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-[var(--fg-subtle)] mb-3 flex-wrap">
          {meta.rating !== undefined && (
            <span className="flex items-center gap-1" aria-label={t('ratingAria', { rating: meta.rating })}>
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" aria-hidden="true" />
              <span className="font-medium text-[var(--fg-muted)]">{meta.rating.toFixed(1)}</span>
              <span>({(meta.reviewCount ?? 0).toLocaleString()})</span>
            </span>
          )}
          {meta.city && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
              {meta.city}
            </span>
          )}
          {(meta.branchCount ?? 0) > 0 && (
            <span className="flex items-center gap-1" aria-label={t('locationsCount', { count: meta.branchCount ?? 0 })}>
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
              {t('locationsCount', { count: meta.branchCount ?? 0 })}
            </span>
          )}
        </div>

        {/* Cuisine tags */}
        {(meta.cuisines?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1 mb-2" role="list" aria-label={t('cuisinesAria')}>
            {meta.cuisines!.slice(0, 3).map((c) => (
              <span
                key={c}
                role="listitem"
                className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--fg-muted)] border border-[var(--border)]"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Service & amenity badges */}
        {(hasReservations || hasLoyalty || (meta.amenities ?? []).length > 0) && (
          <div className="flex flex-wrap gap-1 mb-3" role="list" aria-label={t('featuresAndAmenitiesAria')}>
            {hasReservations && (
              <span
                role="listitem"
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
              >
                <Calendar className="w-2.5 h-2.5" aria-hidden="true" />
                {t('reservations')}
              </span>
            )}
            {hasLoyalty && (
              <span
                role="listitem"
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800"
              >
                <Award className="w-2.5 h-2.5" aria-hidden="true" />
                {t('loyalty')}
              </span>
            )}
            {(meta.amenities ?? []).slice(0, 2).map((a) => (
              <span
                key={a}
                role="listitem"
                className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--fg-subtle)] border border-[var(--border)]"
              >
                {a}
              </span>
            ))}
          </div>
        )}

        {/* Actions — pushed to bottom */}
        <div className="flex gap-2 mt-auto">
          <Link
            href={viewHref}
            className="flex-1 text-center text-sm font-medium px-3 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-colors"
            aria-label={t('ctaAria', { cta: ctaLabel, name: tenant.name })}
          >
            {ctaLabel}
          </Link>
          {hasBranches ? (
            <button
              type="button"
              onClick={() => setBranchesOpen((o) => !o)}
              aria-expanded={branchesOpen}
              aria-label={branchesOpen ? t('hideBranchesAria', { name: tenant.name }) : t('showBranchesAria', { name: tenant.name })}
              className="text-sm font-medium px-3 py-2 rounded-xl border border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--card-hover)] transition-colors flex items-center gap-1.5"
            >
              {branchesOpen
                ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
              {t('branches')}
            </button>
          ) : (
            <Link
              href={tenantHref}
              className="text-sm font-medium px-3 py-2 rounded-xl border border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--card-hover)] transition-colors"
              aria-label={t('viewHomepageAria', { name: tenant.name })}
            >
              {t('visit')}
            </Link>
          )}
        </div>

        {/* Branch preview */}
        {branchesOpen && visibleBranches.length > 0 && (
          <BranchPreview branches={visibleBranches} tenantSlug={tenant.slug} />
        )}
      </div>
    </article>
  )
}
