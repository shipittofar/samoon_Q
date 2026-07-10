import type { Metadata } from 'next'
import Image from 'next/image'
import { MapPin, Phone, Mail, Clock, Globe } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer, FloatingCart } from '@/components/cart/CartDrawer'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Badge } from '@/components/ui'
import { tenantService } from '@/services/tenant.service'
import { getMarketplaceMeta } from '@/types/marketplace'
import { getLocalizedPageMetadata } from '@/lib/seo'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.savor.com'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return getLocalizedPageMetadata({ locale, path: '/restaurant', namespaceKey: 'restaurantAbout', baseUrl: BASE_URL })
}

// Fallback data used when the tenant service cannot be reached.
const FALLBACK_BRANCHES = [
  { name: 'Main Branch', address: '123 Culinary Avenue', city: 'New York, NY 10001', phone_number: '+1 (212) 555-0100', hours: 'Mon–Fri 10am–11pm · Sat–Sun 9am–midnight', status: 'open' },
  { name: 'Downtown', address: '456 Urban Street', city: 'New York, NY 10013', phone_number: '+1 (212) 555-0200', hours: 'Mon–Fri 11am–10pm · Sat–Sun 10am–11pm', status: 'open' },
]

const FALLBACK_GALLERY = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600',
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600',
  'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=600',
  'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=600',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=600',
]

const FALLBACK_STORY = 'Founded with a passion for extraordinary hospitality, we believe great food and warm service should be accessible to everyone. Our team works with local producers and time-honoured recipes to create experiences worth returning for.'

export default async function RestaurantPage() {
  const t = await getTranslations('restaurant')
  // Load the savor tenant data so all public content is driven by admin settings.
  const tenant = await tenantService.getTenant('savor').catch(() => null)
  const meta = tenant ? getMarketplaceMeta(tenant.settings) : undefined

  const story = meta?.story || FALLBACK_STORY
  const tagline = meta?.tagline || 'Where every dish tells a story.'
  const gallery = meta?.gallery?.length ? meta.gallery : FALLBACK_GALLERY
  const contactPhone = meta?.phone_number || tenant?.settings?.contactPhone as string | undefined
  const contactEmail = meta?.email || tenant?.settings?.contactEmail as string | undefined
  const contactWebsite = meta?.website

  // Derive public branch list from marketplace meta when available.
  const branches = meta?.branches?.length
    ? meta.branches.map((b) => ({
        name: b.name,
        address: b.address,
        city: b.city,
        phone_number: b.phone_number,
        hours: b.todayHours ?? '',
        status: b.openNow ? 'open' : 'closed',
      }))
    : FALLBACK_BRANCHES

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <ErrorBoundary feature="CartDrawer"><CartDrawer /></ErrorBoundary>
      <ErrorBoundary feature="FloatingCart"><FloatingCart /></ErrorBoundary>

      {/* Hero */}
      <div className="relative h-[60vh] overflow-hidden">
        <Image
          src={meta?.heroImage || meta?.coverImage || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920'}
          alt={`${meta ? tenant?.name ?? 'Savor' : 'Savor'} interior`}
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-8 sm:p-12 max-w-7xl mx-auto">
          <Badge variant="default" className="mb-3">{t('establishedBadge', { year: 2018 })}</Badge>
          <h1 className="font-[var(--font-display)] text-4xl sm:text-6xl font-bold text-white mb-3">{t('ourStory')}</h1>
          <p className="text-white/80 text-lg max-w-xl">{tagline}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* About */}
        <section className="py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-medium text-orange-500 uppercase tracking-widest mb-3">{t('title')}</p>
            <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--fg)] mb-6">{t('craftedTagline')}</h2>
            <div className="space-y-4 text-[var(--fg-muted)] leading-relaxed">
              {story.split('\n\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {gallery.slice(0, 4).map((src, i) => (
              <div key={i} className={`relative rounded-2xl overflow-hidden ${i === 0 ? 'row-span-2' : ''} ${i === 0 ? 'h-72' : 'h-32'}`}>
                <Image src={src} alt={`Gallery ${i + 1}`} fill className="object-cover hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 50vw, 25vw" />
              </div>
            ))}
          </div>
        </section>

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
                <a key={label} href={href} className="group flex items-start gap-4 bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 hover:border-orange-200 dark:hover:border-orange-900 transition-all">
                  <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors">
                    <Icon className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--fg-muted)] mb-0.5">{label}</p>
                    <p className="font-medium text-[var(--fg)] group-hover:text-orange-500 transition-colors">{value}</p>
                  </div>
                </a>
              )
            })}
          </div>
        </section>

        {/* Branches / Locations */}
        <section className="py-12 border-t border-[var(--border)]" id="branches">
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
                    <MapPin className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                    <span>{branch.address}<br />{branch.city}</span>
                  </div>
                  {branch.phone_number && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-orange-500" />
                      <a href={`tel:${branch.phone_number}`} className="hover:text-orange-500 transition-colors">{branch.phone_number}</a>
                    </div>
                  )}
                  {branch.hours && (
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                      <span>{branch.hours}</span>
                    </div>
                  )}
                </div>
                {/* Map Placeholder */}
                <div className="mt-4 h-24 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 flex items-center justify-center border border-orange-200 dark:border-orange-900">
                  <div className="text-center">
                    <MapPin className="h-5 w-5 text-orange-400 mx-auto mb-1" />
                    <p className="text-xs text-orange-500">{t('viewOnMaps')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Gallery */}
        <section className="py-12 border-t border-[var(--border)]">
          <h2 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)] mb-8">{t('gallery')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {gallery.map((src, i) => (
              <div key={i} className="relative rounded-2xl overflow-hidden h-48 group">
                <Image src={src} alt={`Gallery ${i + 1}`} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 50vw, 33vw" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  )
}
