'use client'

import Link from 'next/link'
import { Star, MapPin, GitBranch, ExternalLink } from 'lucide-react'
import { cn } from '@/utils'
import type { Tenant } from '@/types'
import { type MarketplaceMeta, BUSINESS_TYPE_LABELS } from '@/types/marketplace'

interface BusinessCardProps {
  tenant: Tenant
  meta: MarketplaceMeta
  className?: string
}

function Badge({ meta }: { meta: MarketplaceMeta }) {
  if (meta.featured) return <span className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500 text-white">Featured</span>
  if (meta.isNew)    return <span className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500 text-white">New</span>
  if (meta.popular)  return <span className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500 text-white">Popular</span>
  return null
}

export function BusinessCard({ tenant, meta, className }: BusinessCardProps) {
  const label = tenant.businessTypes.map((t) => BUSINESS_TYPE_LABELS[t] ?? t).join(' · ')
  const accentColor = (tenant.settings?.theme as { primaryColor?: string } | undefined)?.primaryColor
  const viewHref  = `/${tenant.slug}/${meta.primaryBranchSlug}/menu`
  const branchHref = `/${tenant.slug}`

  return (
    <article
      className={cn(
        'group flex flex-col bg-[var(--card)] rounded-2xl border border-[var(--border)]',
        'overflow-hidden shadow-[var(--shadow-soft)] hover:shadow-md hover:-translate-y-0.5',
        'transition-all duration-200',
        className,
      )}
      aria-label={tenant.name}
    >
      {/* Cover image */}
      <div className="relative h-44 overflow-hidden bg-[var(--bg-secondary)] shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={meta.coverImage}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <span
          className={cn(
            'absolute top-3 left-3 text-xs font-semibold px-2 py-0.5 rounded-full',
            meta.openNow ? 'bg-emerald-500/90 text-white' : 'bg-gray-800/80 text-gray-200',
          )}
        >
          {meta.openNow ? 'Open now' : 'Closed'}
        </span>
        <Badge meta={meta} />
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-4">
        {/* Logo + name */}
        <div className="flex items-start gap-3 mb-2">
          <div
            className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm"
            style={{ background: accentColor ?? 'var(--accent)' }}
            aria-hidden="true"
          >
            {tenant.name[0]}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-[var(--fg)] leading-tight truncate">{tenant.name}</h3>
            <p className="text-xs text-[var(--fg-muted)] mt-0.5">{label}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-[var(--fg-muted)] line-clamp-2 mb-3">{meta.description}</p>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-[var(--fg-subtle)] mb-3">
          <span className="flex items-center gap-1" aria-label={`Rating: ${meta.rating} out of 5`}>
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" aria-hidden="true" />
            <span className="font-medium text-[var(--fg-muted)]">{meta.rating.toFixed(1)}</span>
            <span>({meta.reviewCount.toLocaleString()})</span>
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
            {meta.city}
          </span>
          <span className="flex items-center gap-1" aria-label={`${meta.branchCount} ${meta.branchCount === 1 ? 'branch' : 'branches'}`}>
            <GitBranch className="w-3.5 h-3.5" aria-hidden="true" />
            {meta.branchCount} {meta.branchCount === 1 ? 'Branch' : 'Branches'}
          </span>
        </div>

        {/* Cuisine tags */}
        {meta.cuisines.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {meta.cuisines.slice(0, 3).map((c) => (
              <span
                key={c}
                className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--fg-muted)] border border-[var(--border)]"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Actions — pushed to bottom */}
        <div className="flex gap-2 mt-auto">
          <Link
            href={viewHref}
            className="flex-1 text-center text-sm font-medium px-3 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-colors"
            aria-label={`View ${tenant.name} menu`}
          >
            View Menu
          </Link>
          <Link
            href={branchHref}
            className="text-sm font-medium px-3 py-2 rounded-xl border border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--card-hover)] transition-colors flex items-center gap-1.5"
            aria-label={`View ${tenant.name} branches`}
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            Branches
          </Link>
        </div>
      </div>
    </article>
  )
}
