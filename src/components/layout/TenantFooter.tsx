'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { usePublicLinkLabel } from '@/hooks/verticals'
import { Mail, Phone, Globe, Instagram, Twitter, MapPin } from 'lucide-react'
import type { MarketplaceMeta } from '@/types/marketplace'
import { useTenantStore } from '@/stores'
import { usePublicBranches } from '@/hooks'
import { buildFooterLinks } from '@/utils'

interface TenantFooterProps {
  tenantName: string
  tenantSlug: string
  meta: MarketplaceMeta
}

export function TenantFooter({ tenantName, tenantSlug, meta }: TenantFooterProps) {
  const t = useTranslations('tenantFooter')
  const publicLinkLabel = usePublicLinkLabel()
  const featureFlags = useTenantStore((s) => s.featureFlags)
  const tenantId = useTenantStore((s) => s.tenant?.id ?? '')
  const { data: publicBranches = [] } = usePublicBranches(tenantId)
  const primaryBranch =
    publicBranches.find((b) => b.slug === meta.primaryBranchSlug) ?? publicBranches[0]
  const quickLinks = buildFooterLinks({
    tenantSlug,
    featureFlags,
    // Listing metadata may not carry primaryBranchSlug; fall back to the
    // first public branch so Menu / Reservations links still appear.
    meta: { ...meta, primaryBranchSlug: meta.primaryBranchSlug ?? primaryBranch?.slug },
    branch: primaryBranch
      ? {
          orderingEnabled: primaryBranch.checkout?.orderingEnabled,
          reservationsEnabled: primaryBranch.reservationsEnabled,
        }
      : undefined,
  })

  const year = new Date().getFullYear()

  const hasSocial = meta.socialLinks?.instagram || meta.socialLinks?.twitter
  const hasContact = meta.phone_number || meta.email || meta.website

  return (
    <footer className="bg-[var(--bg-secondary)] border-t border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href={`/${tenantSlug}`} className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-active)] flex items-center justify-center shadow">
                <span className="text-white text-sm font-bold">
                  {tenantName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="font-[var(--font-display)] text-lg font-bold text-[var(--fg)]">
                {tenantName}
              </span>
            </Link>

            {meta.tagline && (
              <p className="text-sm text-[var(--fg-muted)] mb-3 italic">{meta.tagline}</p>
            )}
            {meta.description && (
              <p className="text-sm text-[var(--fg-muted)] leading-relaxed mb-4 max-w-xs">
                {meta.description}
              </p>
            )}

            {/* Social links */}
            {hasSocial && (
              <div className="flex items-center gap-2">
                {meta.socialLinks?.instagram && (
                  <a
                    href={meta.socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('instagram')}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--fg-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--card-hover)] transition-all"
                  >
                    <Instagram className="h-4 w-4"/>
                  </a>
                )}
                {meta.socialLinks?.twitter && (
                  <a
                    href={meta.socialLinks.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('twitterX')}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--fg-muted)] hover:text-[var(--accent-text)] hover:bg-[var(--card-hover)] transition-all"
                  >
                    <Twitter className="h-4 w-4"/>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Quick links — feature-flag-aware, branch-aware via buildFooterLinks() */}
          <div>
            <h4 className="text-sm font-semibold text-[var(--fg)] mb-4">{t('quickLinks')}</h4>
            <ul className="space-y-3 text-sm text-[var(--fg-muted)]">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-[var(--accent-text)] transition-colors">
                    {publicLinkLabel(link.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          {hasContact && (
            <div>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-4">{t('contact')}</h4>
              <ul className="space-y-3">
                {meta.city && (
                  <li className="flex items-start gap-2 text-sm text-[var(--fg-muted)]">
                    <MapPin className="h-4 w-4 text-[var(--accent-text)] shrink-0 mt-0.5"/>
                    {meta.city}
                  </li>
                )}
                {meta.phone_number && (
                  <li>
                    <a
                      href={`tel:${meta.phone_number}`}
                      className="flex items-center gap-2 min-h-[24px] py-1 text-sm text-[var(--fg-muted)] hover:text-[var(--accent-text)] transition-colors"
                    >
                      <Phone className="h-4 w-4 text-[var(--accent-text)] shrink-0"/>
                      {meta.phone_number}
                    </a>
                  </li>
                )}
                {meta.email && (
                  <li>
                    <a
                      href={`mailto:${meta.email}`}
                      className="flex items-center gap-2 min-h-[24px] py-1 text-sm text-[var(--fg-muted)] hover:text-[var(--accent-text)] transition-colors"
                    >
                      <Mail className="h-4 w-4 text-[var(--accent-text)] shrink-0"/>
                      {meta.email}
                    </a>
                  </li>
                )}
                {meta.website && (
                  <li>
                    <a
                      href={meta.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 min-h-[24px] py-1 text-sm text-[var(--fg-muted)] hover:text-[var(--accent-text)] transition-colors"
                    >
                      <Globe className="h-4 w-4 text-[var(--accent-text)] shrink-0"/>
                      {meta.website.replace(/^https?:\/\//, '')}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="py-5 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[var(--fg-subtle)]">
            {t('copyright', { year, name: tenantName })}
          </p>
          <p className="text-xs text-[var(--fg-subtle)]">
            {t('poweredBy')}{' '}
            <Link href="/"className="hover:text-[var(--accent-text)] transition-colors">
              {t('samoonPlatform')}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
