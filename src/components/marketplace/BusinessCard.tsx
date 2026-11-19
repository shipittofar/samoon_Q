'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Star, MapPin, Calendar, Award, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/utils'
import type { Tenant } from '@/types'
import { type MarketplaceMeta, type PublicBranchInfo, BUSINESS_TYPE_LABELS } from '@/types/marketplace'
import { usePublicBranches } from '@/hooks'
import { BranchPreview } from './BranchPreview'
import { resolveTenantBranding } from '@/lib/tenant-branding'
import { deriveBrandTokens, isValidHexColor } from '@/lib/brand-color'
import { getDiscoverCardPrimaryCta } from '@/lib/discover-card-cta'
import { HighlightText } from '@/components/search/HighlightText'
import { ProximityLine } from '@/components/location/ProximityLine'
import type { BranchProximity } from '@/lib/nearby'
import { DirectionsSheet } from '@/components/location/DirectionsSheet'
import { resolveVertical } from '@/verticals'

interface BusinessCardProps {
  tenant: Tenant
  meta: MarketplaceMeta
  /** When provided (e.g. Discover page), skips per-card branch API fetch. */
  branches?: PublicBranchInfo[]
  className?: string
  highlightQuery?: string
  /** Phase L3 — nearest/best branch for the customer (Discover). */
  proximity?: BranchProximity | null
  /** Phase L3 — card ↔ map pin highlight. */
  highlighted?: boolean
  onHoverChange?: (hovering: boolean) => void
}

function StatusBadge({ meta }: { meta: MarketplaceMeta }) {
  const t = useTranslations('marketplace')
  if (meta.featured) return <span className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--accent-fg)]">{t('featured')}</span>
  if (meta.isNew)    return <span className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--success)] text-[var(--success-fg)]">{t('new')}</span>
  if (meta.popular)  return <span className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--info)] text-[var(--info-fg)]">{t('popular')}</span>
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

export function BusinessCard({
  tenant,
  meta,
  branches: branchesProp,
  className,
  highlightQuery,
  proximity,
  highlighted,
  onHoverChange,
}: BusinessCardProps) {
  const t = useTranslations('marketplace')
  const [branchesOpen, setBranchesOpen] = useState(false)
  const [directionsOpen, setDirectionsOpen] = useState(false)
  const { data: resolvedBranches } = usePublicBranches(tenant.id, {
    enabled: branchesProp === undefined,
  })
  const branches = branchesProp ?? resolvedBranches ?? []
  const visibleBranches = branches.filter((b) => b.marketplaceVisible !== false)

  const label = tenant.businessTypes.map((bt) => (BUSINESS_TYPE_LABELS[bt] ? t(`businessTypes.${bt}`) : bt)).join(' · ')
  // Each card shows a different business, so the global --accent (the active
  // tenant's) does not apply. Derive this tenant' s own contrast-safe pair for
  // both themes and let .brand-chip pick — otherwise a dark brand colour makes
  // the tile vanish in dark mode and a pale one makes the initial unreadable.
  const chipStyle = useMemo(() => {
    const primary = resolveTenantBranding({ settings: tenant.settings })?.primaryColor
    if (!isValidHexColor(primary)) return undefined
    const { light, dark } = deriveBrandTokens(primary)
    return {
      '--chip-accent-light': light.accent,
      '--chip-accent-fg-light': light.accentFg,
      '--chip-accent-dark': dark.accent,
      '--chip-accent-fg-dark': dark.accentFg,
    } as CSSProperties
  }, [tenant.settings])
  const discoverAvatar = tenant.discoverAvatar
  const featureFlags = tenant.settings?.featureFlags ?? {}
  const hasReservations =
    branches.length > 0
      ? branches.some((b) => b.reservationsEnabled === true)
      : featureFlags['reservations.enabled'] === true
  const hasLoyalty = Object.entries(featureFlags).some(([k, v]) => k.includes('loyalty') && v === true)

  const tenantHref = `/${tenant.slug}`
  const { href: viewHref, labelKey: ctaLabelKey } = getDiscoverCardPrimaryCta({
    tenantSlug: tenant.slug,
    branchCount: meta.branchCount,
    primaryBranchSlug: meta.primaryBranchSlug,
  })
  const hasBranches = visibleBranches.length > 0
  const ctaLabel = t(ctaLabelKey)

  return (
    <article
      className={cn(
        'group flex flex-col bg-[var(--card)] rounded-2xl border border-[var(--border)]',
        'overflow-hidden shadow-[var(--shadow-soft)] hover:shadow-md hover:-translate-y-0.5',
        'transition-all duration-200',
        highlighted && 'ring-2 ring-[var(--accent)] -translate-y-0.5 shadow-md',
        className,
      )}
      aria-label={`${tenant.name} — ${label}`}
      data-tenant-id={tenant.id}
      onMouseEnter={onHoverChange ? () => onHoverChange(true) : undefined}
      onMouseLeave={onHoverChange ? () => onHoverChange(false) : undefined}
      onFocus={onHoverChange ? () => onHoverChange(true) : undefined}
      onBlur={onHoverChange ? () => onHoverChange(false) : undefined}
    >
      {/* Cover image — H4: use Next.js Image for format negotiation + lazy loading */}
      <div className="relative h-48 overflow-hidden bg-[var(--bg-secondary)] shrink-0">
        {tenant.discoverCover ? (
          <Image
            src={tenant.discoverCover}
            alt=""
            aria-hidden="true"
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--accent-subtle)] to-[var(--card-hover)] flex items-center justify-center">
            <span className="text-4xl opacity-40">🍽️</span>
          </div>
        )}
        {meta.openNow !== undefined && (
          <span
            className={cn(
              'absolute top-3 left-3 text-xs font-semibold px-2 py-0.5 rounded-full',
              meta.openNow ? 'bg-[var(--success)]/90 text-[var(--success-fg)]' : 'bg-[var(--card)]/80 text-[var(--fg-disabled)]',
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
            className="brand-chip h-10 w-10 shrink-0 rounded-xl flex items-center justify-center font-bold text-base shadow-sm overflow-hidden"
            style={chipStyle}
            aria-hidden="true"
          >
            {discoverAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={discoverAvatar} alt=""className="h-full w-full object-cover"/>
            ) : (
              tenant.name[0]
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-1">
              <h3 className="font-semibold text-[var(--fg)] leading-tight truncate">
                <HighlightText text={tenant.name} query={highlightQuery} />
              </h3>
              <PriceDots level={meta.priceLevel} />
            </div>
            <p className="text-xs text-[var(--fg-muted)] mt-0.5">{label}</p>
          </div>
        </div>

        {/* Description */}
        {tenant.description && (
          <p className="text-sm text-[var(--fg-muted)] line-clamp-2 mb-3">{tenant.description}</p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-[var(--fg-subtle)] mb-3 flex-wrap">
          {meta.rating !== undefined && (
            <span className="flex items-center gap-1"aria-label={t('ratingAria', { rating: meta.rating })}>
              <Star className="w-3.5 h-3.5 text-[var(--rating)] fill-[var(--rating)]"aria-hidden="true"/>
              <span className="font-medium text-[var(--fg-muted)]">{meta.rating.toFixed(1)}</span>
              <span>({(meta.reviewCount ?? 0).toLocaleString()})</span>
            </span>
          )}
          {meta.city && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5"aria-hidden="true"/>
              {meta.city}
            </span>
          )}
          {(meta.branchCount ?? 0) > 0 && (
            <span className="flex items-center gap-1"aria-label={t('locationsCount', { count: meta.branchCount ?? 0 })}>
              <MapPin className="w-3.5 h-3.5"aria-hidden="true"/>
              {t('locationsCount', { count: meta.branchCount ?? 0 })}
            </span>
          )}
        </div>

        {proximity && (
          <ProximityLine
            proximity={proximity}
            showBranchName={visibleBranches.length > 1}
            className="mb-3"
            onDirections={() => setDirectionsOpen(true)}
          />
        )}
        {proximity && directionsOpen && (
          <DirectionsSheet
            open
            onClose={() => setDirectionsOpen(false)}
            destination={{
              point: proximity.point,
              name: visibleBranches.length > 1 ? `${tenant.name} — ${proximity.branchName}` : tenant.name,
              address: branches.find((b) => b.id === proximity.branchId)?.address,
              emoji: resolveVertical(tenant.businessTypes).emoji,
            }}
          />
        )}

        {/* Service badges (amenities are branch-owned — not shown on tenant cards) */}
        {(hasReservations || hasLoyalty) && (
          <div className="flex flex-wrap gap-1 mb-3"role="list"aria-label={t('featuresAndAmenitiesAria')}>
            {hasReservations && (
              <span
                role="listitem"
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--info-subtle)] text-[var(--info-text)] border border-[var(--info-border)]"
              >
                <Calendar className="w-2.5 h-2.5"aria-hidden="true"/>
                {t('reservations')}
              </span>
            )}
            {hasLoyalty && (
              <span
                role="listitem"
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[var(--chart-5)]/10 text-[var(--chart-5)] border border-[var(--chart-5)]/30"
              >
                <Award className="w-2.5 h-2.5"aria-hidden="true"/>
                {t('loyalty')}
              </span>
            )}
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
                ? <ChevronUp className="w-3.5 h-3.5"aria-hidden="true"/>
                : <ChevronDown className="w-3.5 h-3.5"aria-hidden="true"/>}
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
