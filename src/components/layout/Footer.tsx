import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Instagram, Twitter, Facebook, Youtube, Mail } from 'lucide-react'

// P8.8.1 — Footer rewritten to represent the Savor hospitality platform
// rather than a single restaurant. Routing structure is unchanged; only
// labels, sections, and brand copy were updated.

const LINKS = {
  explore: [
    { labelKey: 'discoverBusinesses', href: '/discover' },
    { labelKey: 'restaurants', href: '/discover?category=restaurant' },
    { labelKey: 'cafes', href: '/discover?category=cafe' },
    { labelKey: 'barsAndVenues', href: '/discover?category=bar' },
    { labelKey: 'foodTrucks', href: '/discover?category=food_truck' },
  ],
  platform: [
    { labelKey: 'orderOnline', href: '/menu' },
    { labelKey: 'bookATable', href: '/reservation' },
    { labelKey: 'trackOrder', href: '/dashboard/orders' },
    { labelKey: 'becomeAPartner', href: '/restaurant' },
    { labelKey: 'pricing', href: '/restaurant' },
  ],
  company: [
    { labelKey: 'aboutSavor', href: '/restaurant' },
    { labelKey: 'support', href: '/restaurant' },
    { labelKey: 'privacyPolicy', href: '/privacy' },
    { labelKey: 'termsOfService', href: '/terms' },
  ],
}

const SOCIALS = [
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Facebook, href: '#', label: 'Facebook' },
  { icon: Youtube, href: '#', label: 'YouTube' },
]

export function Footer() {
  const t = useTranslations('footer')
  return (
    <footer className="bg-[var(--bg-secondary)] border-t border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer */}
        <div className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <span className="text-white font-bold">S</span>
              </div>
              <span className="font-[var(--font-display)] text-xl font-bold text-[var(--fg)]">Savor</span>
            </Link>
            <p className="text-sm text-[var(--fg-muted)] leading-relaxed mb-6 max-w-xs">
              {t('brandDescription')}
            </p>
            <div className="space-y-3 text-sm text-[var(--fg-muted)]">
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-orange-500" />
                <a href="mailto:hello@savor.com" className="hover:text-orange-500 transition-colors">hello@savor.com</a>
              </div>
            </div>
          </div>

          {/* Links */}
          {Object.entries(LINKS).map(([section, links]) => (
            <div key={section}>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-4">{t(`sections.${section}`)}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--fg-muted)] hover:text-orange-500 transition-colors"
                    >
                      {t(`links.${link.labelKey}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--fg-subtle)]">
            {t('copyright', { year: new Date().getFullYear() })}
          </p>
          <div className="flex items-center gap-1">
            {SOCIALS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--fg-muted)] hover:text-orange-500 hover:bg-[var(--card-hover)] transition-all"
              >
                <social.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
