import type { Metadata } from 'next'
import Image from 'next/image'
import { MapPin, Phone, Mail, Clock, Globe } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Badge } from '@/components/ui'
import { fetchPublicTenantBySlug } from '@/lib/public-tenant-resolution'
import { resolvePublicBranchList } from '@/lib/public-branches'
import { composeMarketplacePresentation, getMarketplaceMeta } from '@/types/marketplace'
import { pickTenantContact, resolvePublicContact } from '@/lib/tenant-settings'
import { getLocalizedPageMetadata } from '@/lib/seo'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.samoon.com'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return getLocalizedPageMetadata({ locale, path: '/restaurant', namespaceKey: 'restaurantAbout', baseUrl: BASE_URL })
}

export default async function RestaurantPage() {
  const t = await getTranslations('restaurant')
  // Load the samoon tenant data so all public content is driven by admin settings.
  const tenant = await fetchPublicTenantBySlug('samoon').catch(() => null)
  const publicBranches = tenant ? await resolvePublicBranchList(tenant.id) : []
  const meta = tenant
    ? composeMarketplacePresentation({
        listing: getMarketplaceMeta(tenant.settings),
        branches: publicBranches,
        tenantContact: pickTenantContact(tenant.settings),
      })
    : undefined

  const story = meta?.story
  const tagline = meta?.tagline
  const gallery = meta?.gallery ?? []
  const contact = resolvePublicContact(publicBranches[0], pickTenantContact(tenant?.settings))
  const contactPhone = contact.phone_number
  const contactEmail = contact.email
  const contactWebsite = meta?.website
  const branches = publicBranches.map((b) => ({
    name: b.name,
    address: b.address,
    city: b.city,
    phone_number: b.phone_number,
    hours: b.todayHours ?? '',
    status: b.openNow ? 'open' : 'closed',
  }))

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header overlay />

      {/* Hero */}
      <div className="relative h-[60vh] overflow-hidden">
        {tenant?.heroImage ? (
          <Image
            src={tenant.heroImage}
            alt={`${tenant?.name ?? ''} interior`}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-active)] to-[var(--surface-sunken)]"/>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"/>
        <div className="absolute bottom-0 inset-x-0 p-8 sm:p-12 max-w-7xl mx-auto">
          <Badge variant="default"className="mb-3">{t('establishedBadge', { year: 2018 })}</Badge>
          <h1 className="font-[var(--font-display)] text-4xl sm:text-6xl font-bold text-white mb-3">{t('ourStory')}</h1>
          {tagline && <p className="text-white/80 text-lg max-w-xl">{tagline}</p>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* About — hidden entirely when the tenant hasn't configured a story/gallery yet */}
        {(story || gallery.length > 0) && (
          <section className="py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {story && (
              <div>
                <p className="text-sm font-medium text-[var(--accent-text)] uppercase tracking-widest mb-3">{t('title')}</p>
                <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--fg)] mb-6">{t('craftedTagline')}</h2>
                <div className="space-y-4 text-[var(--fg-muted)] leading-relaxed">
                  {story.split('\n\n').map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              </div>
            )}
            {gallery.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {gallery.slice(0, 4).map((src, i) => (
                  <div key={i} className={`relative rounded-2xl overflow-hidden ${i === 0 ? 'row-span-2' : ''} ${i === 0 ? 'h-72' : 'h-32'}`}>
                    <Image src={src} alt={`Gallery ${i + 1}`} fill className="object-cover hover:scale-105 transition-transform duration-500"sizes="(max-width: 768px) 50vw, 25vw"/>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Contact */}
        <section className="py-12 border-t border-[var(--border)]">
          <h2 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)] mb-8">{t('contactUsHeading')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              contactPhone ? { icon: Phone, label: t('phoneLabel'), value: contactPhone, href: `tel:${contactPhone}` } : null,
              contactEmail ? { icon: Mail, label: t('emailLabel'), value: contactEmail, href: `mailto:${contactEmail}` } : null,
              contactWebsite ? { icon: Globe, label: t('websiteLabel'), value: contactWebsite.replace(/^https?:\/\//, ''), href: contactWebsite } : null,
            ].filter(Boolean).map((item) => {
              if (!item) return null
              const { icon: Icon, label, value, href } = item
              return (
                <a key={label} href={href} className="group flex items-start gap-4 bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 hover:border-[var(--accent-border)]/50 transition-all">
                  <div className="h-10 w-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center shrink-0 group-hover:bg-[var(--accent-subtle)] transition-colors">
                    <Icon className="h-5 w-5 text-[var(--accent-text)]"/>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--fg-muted)] mb-0.5">{label}</p>
                    <p className="font-medium text-[var(--fg)] group-hover:text-[var(--accent-text)] transition-colors">{value}</p>
                  </div>
                </a>
              )
            })}
          </div>
        </section>

        {/* Branches / Locations — hidden when the tenant has no branches in marketplace meta yet */}
        {branches.length > 0 && (
        <section className="py-12 border-t border-[var(--border)]"id="branches">
          <h2 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)] mb-8">{t('ourLocations')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {branches.map((branch) => (
              <div key={branch.name} className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-[var(--font-display)] text-lg font-semibold text-[var(--fg)]">{branch.name}</h3>
                  <Badge variant={branch.status === 'open' ? 'success' : 'danger'} dot>{branch.status === 'open' ? t('open') : t('closed')}</Badge>
                </div>
                <div className="space-y-3 text-sm text-[var(--fg-muted)]">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-[var(--accent-text)] shrink-0 mt-0.5"/>
                    <span>{branch.address}<br />{branch.city}</span>
                  </div>
                  {branch.phone_number && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-[var(--accent-text)]"/>
                      <a href={`tel:${branch.phone_number}`} className="hover:text-[var(--accent-text)] transition-colors">{branch.phone_number}</a>
                    </div>
                  )}
                  {branch.hours && (
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-[var(--accent-text)] shrink-0 mt-0.5"/>
                      <span>{branch.hours}</span>
                    </div>
                  )}
                </div>
                {/* Map Placeholder */}
                <div className="mt-4 h-24 rounded-xl bg-gradient-to-br from-[var(--accent-subtle)] to-[var(--card-hover)] flex items-center justify-center border border-[var(--accent-border)]/40">
                  <div className="text-center">
                    <MapPin className="h-5 w-5 text-[var(--accent-text)] mx-auto mb-1"/>
                    <p className="text-xs text-[var(--accent-text)]">{t('viewOnMaps')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Gallery — hidden when the tenant has no gallery images in marketplace meta yet */}
        {gallery.length > 0 && (
        <section className="py-12 border-t border-[var(--border)]">
          <h2 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)] mb-8">{t('gallery')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {gallery.map((src, i) => (
              <div key={i} className="relative rounded-2xl overflow-hidden h-48 group">
                <Image src={src} alt={`Gallery ${i + 1}`} fill className="object-cover group-hover:scale-105 transition-transform duration-500"sizes="(max-width: 768px) 50vw, 33vw"/>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"/>
              </div>
            ))}
          </div>
        </section>
        )}
      </div>

      <Footer />
    </div>
  )
}
