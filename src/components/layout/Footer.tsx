import Link from 'next/link'
import { Instagram, Twitter, Facebook, Youtube, MapPin, Phone, Mail, Clock } from 'lucide-react'

const LINKS = {
  Menu: [
    { label: 'Full Menu', href: '/menu' },
    { label: 'Pizza', href: '/menu?category=pizza' },
    { label: 'Burgers', href: '/menu?category=burger' },
    { label: 'Desserts', href: '/menu?category=desserts' },
  ],
  Services: [
    { label: 'Table Reservation', href: '/reservation' },
    { label: 'Order Online', href: '/menu' },
    { label: 'Track Order', href: '/dashboard/orders' },
    { label: 'Catering', href: '/restaurant' },
  ],
  Company: [
    { label: 'About Us', href: '/restaurant' },
    { label: 'Our Branches', href: '/restaurant#branches' },
    { label: 'Careers', href: '/careers' },
    { label: 'Privacy Policy', href: '/privacy' },
  ],
}

const SOCIALS = [
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Facebook, href: '#', label: 'Facebook' },
  { icon: Youtube, href: '#', label: 'YouTube' },
]

export function Footer() {
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
              Experience extraordinary cuisine crafted with passion. From farm-fresh ingredients to unforgettable flavors.
            </p>
            <div className="space-y-3 text-sm text-[var(--fg-muted)]">
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 text-orange-500 mt-0.5" />
                <span>123 Culinary Avenue, New York, NY 10001</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-orange-500" />
                <a href="tel:+12125550100" className="hover:text-orange-500 transition-colors">+1 (212) 555-0100</a>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-orange-500" />
                <a href="mailto:hello@savor.com" className="hover:text-orange-500 transition-colors">hello@savor.com</a>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-orange-500" />
                <span>Mon–Fri 10am–11pm · Sat–Sun 9am–midnight</span>
              </div>
            </div>
          </div>

          {/* Links */}
          {Object.entries(LINKS).map(([section, links]) => (
            <div key={section}>
              <h4 className="text-sm font-semibold text-[var(--fg)] mb-4">{section}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--fg-muted)] hover:text-orange-500 transition-colors"
                    >
                      {link.label}
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
            © {new Date().getFullYear()} Savor Restaurant. All rights reserved.
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
