import type { Metadata } from 'next'
import Image from 'next/image'
import { MapPin, Phone, Mail, Clock, Instagram, Twitter, Facebook, Globe } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer, FloatingCart } from '@/components/cart/CartDrawer'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Badge } from '@/components/ui'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about Savor restaurant — our story, team, and locations.',
}

const BRANCHES = [
  { name: 'Main Branch', address: '123 Culinary Avenue', city: 'New York, NY 10001', phone: '+1 (212) 555-0100', hours: 'Mon–Fri 10am–11pm · Sat–Sun 9am–midnight', status: 'open' },
  { name: 'Downtown', address: '456 Urban Street', city: 'New York, NY 10013', phone: '+1 (212) 555-0200', hours: 'Mon–Fri 11am–10pm · Sat–Sun 10am–11pm', status: 'open' },
  { name: 'Airport (Terminal 4)', address: 'JFK International Airport', city: 'Jamaica, NY 11430', phone: '+1 (212) 555-0300', hours: 'Daily 6am–11pm', status: 'open' },
]

const GALLERY = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600',
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600',
  'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=600',
  'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=600',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=600',
]

export default function RestaurantPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Header />
      <ErrorBoundary feature="CartDrawer"><CartDrawer /></ErrorBoundary>
      <ErrorBoundary feature="FloatingCart"><FloatingCart /></ErrorBoundary>

      {/* Hero */}
      <div className="relative h-[60vh] overflow-hidden">
        <Image src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920" alt="Savor Restaurant interior" fill className="object-cover" sizes="100vw" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-8 sm:p-12 max-w-7xl mx-auto">
          <Badge variant="default" className="mb-3">Est. 2018</Badge>
          <h1 className="font-[var(--font-display)] text-4xl sm:text-6xl font-bold text-white mb-3">Our Story</h1>
          <p className="text-white/80 text-lg max-w-xl">Where extraordinary ingredients meet culinary mastery — every dish a love letter to food.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* About */}
        <section className="py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-medium text-orange-500 uppercase tracking-widest mb-3">About Savor</p>
            <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--fg)] mb-6">Crafted With Passion, Served With Love</h2>
            <div className="space-y-4 text-[var(--fg-muted)] leading-relaxed">
              <p>Founded in 2018 by Chef Marco Rossi and his partner Amara Chen, Savor was born from a simple belief: extraordinary food should be accessible to everyone.</p>
              <p>We source our ingredients from local farms and artisan producers, ensuring every dish reflects the season and the land. Our chefs train under Michelin-starred mentors, bringing world-class technique to everyday dining.</p>
              <p>From our signature 72-hour fermented dough pizzas to our wagyu smash burgers, every item on our menu tells a story — one we are proud to share with you.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {GALLERY.slice(0, 4).map((src, i) => (
              <div key={i} className={`relative rounded-2xl overflow-hidden ${i === 0 ? 'row-span-2' : ''} ${i === 0 ? 'h-72' : 'h-32'}`}>
                <Image src={src} alt={`Gallery ${i + 1}`} fill className="object-cover hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 50vw, 25vw" />
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="py-12 border-t border-[var(--border)]">
          <h2 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)] mb-8">Contact Us</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: Phone, label: 'Phone', value: '+1 (212) 555-0100', href: 'tel:+12125550100' },
              { icon: Mail, label: 'Email', value: 'hello@savor.com', href: 'mailto:hello@savor.com' },
              { icon: Globe, label: 'Website', value: 'www.savor.com', href: 'https://savor.com' },
            ].map(({ icon: Icon, label, value, href }) => (
              <a key={label} href={href} className="group flex items-start gap-4 bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 hover:border-orange-200 dark:hover:border-orange-900 transition-all">
                <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors">
                  <Icon className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-[var(--fg-muted)] mb-0.5">{label}</p>
                  <p className="font-medium text-[var(--fg)] group-hover:text-orange-500 transition-colors">{value}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Branches */}
        <section className="py-12 border-t border-[var(--border)]" id="branches">
          <h2 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)] mb-8">Our Locations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {BRANCHES.map((branch) => (
              <div key={branch.name} className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-[var(--font-display)] text-lg font-semibold text-[var(--fg)]">{branch.name}</h3>
                  <Badge variant={branch.status === 'open' ? 'success' : 'danger'} dot className="capitalize">{branch.status}</Badge>
                </div>
                <div className="space-y-3 text-sm text-[var(--fg-muted)]">
                  <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" /><span>{branch.address}<br />{branch.city}</span></div>
                  <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-orange-500" /><a href={`tel:${branch.phone}`} className="hover:text-orange-500 transition-colors">{branch.phone}</a></div>
                  <div className="flex items-start gap-2"><Clock className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" /><span>{branch.hours}</span></div>
                </div>
                {/* Map Placeholder */}
                <div className="mt-4 h-24 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 flex items-center justify-center border border-orange-200 dark:border-orange-900">
                  <div className="text-center">
                    <MapPin className="h-5 w-5 text-orange-400 mx-auto mb-1" />
                    <p className="text-xs text-orange-500">View on Maps</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Gallery */}
        <section className="py-12 border-t border-[var(--border)]">
          <h2 className="font-[var(--font-display)] text-3xl font-bold text-[var(--fg)] mb-8">Gallery</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {GALLERY.map((src, i) => (
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
