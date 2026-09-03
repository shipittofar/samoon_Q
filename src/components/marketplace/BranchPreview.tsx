'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Clock, ExternalLink } from 'lucide-react'
import { cn } from '@/utils'
import type { PublicBranchInfo } from '@/types/marketplace'

interface BranchPreviewProps {
  branches: PublicBranchInfo[]
  tenantSlug: string
}

export function BranchPreview({ branches, tenantSlug }: BranchPreviewProps) {
  const t = useTranslations('marketplace')
  return (
    <div
      className="border-t border-[var(--border)] mt-3 pt-3"
      role="region"
      aria-label={t('branchLocationsAria')}
    >
      <p className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider mb-2">
        {t('locations')}
      </p>
      <ul className="space-y-2.5"role="list">
        {branches.map((b) => (
          <li key={b.slug} className="flex items-start gap-2">
            <span
              className={cn(
                'mt-1.5 h-1.5 w-1.5 rounded-full shrink-0',
                b.openNow ? 'bg-[var(--success)]' : 'bg-[var(--fg-subtle)]',
              )}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-medium text-[var(--fg)] truncate">{b.name}</p>
                <Link
                  href={`/${tenantSlug}/${b.slug}`}
                  className="shrink-0 text-xs text-[var(--accent)] hover:underline flex items-center gap-0.5"
                  aria-label={t('visitBranchAria', { name: b.name })}
                >
                  {t('view')}
                  <ExternalLink className="w-2.5 h-2.5"aria-hidden="true"/>
                </Link>
              </div>
              <p className="text-xs text-[var(--fg-muted)] truncate">{b.address}, {b.city}</p>
              {(b.cuisines?.length ?? 0) > 0 && (
                <p className="text-xs text-[var(--fg-subtle)] mt-0.5 truncate">
                  {b.cuisines!.slice(0, 2).join(' · ')}
                </p>
              )}
              {b.todayHours && (
                <p className="text-xs text-[var(--fg-subtle)] flex items-center gap-1 mt-0.5">
                  <Clock className="w-2.5 h-2.5"aria-hidden="true"/>
                  {b.todayHours} ·{' '}
                  <span className={b.openNow ? 'text-[var(--success-text)]' : ''}>
                    {b.openNow ? t('openNow') : t('closed')}
                  </span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
