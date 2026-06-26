'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Star, MapPin, Phone, Clock, ChevronRight,
  UtensilsCrossed, Tag, Share2, Check, Copy,
  ShoppingBag, ArrowLeft, Store,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { cn } from '@/utils'
import { usePublicTenant, usePublicBranch, useCategories, useMenuItems, useActivePromotions } from '@/hooks'
import { getMarketplaceMeta, type PublicBranchInfo } from '@/types/marketplace'
import type { Tenant, MenuItem, Category, PromotionRule } from '@/types'

// ── Breadcrumb ────────────────────────────────────────────────────────────────

function Breadcrumb({ tenantSlug, tenantName, branchName }: { tenantSlug: string; tenantName: string; branchName: string }) {
  return (
    <nav aria-label="Breadcrumb" className="bg-[var(--bg)] border-b border-[var(--border)]">
      <ol className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-1.5 text-sm text-[var(--fg-muted)] flex-wrap">
        <li>
          <Link href="/discover" className="hover:text-[var(--fg)] transition-colors">Discover</Link>
        </li>
        <li aria-hidden="true"><ChevronRight className="w-3.5 h-3.5" /></li>
        <li>
          <Link href={`/${tenantSlug}`} className="hover:text-[var(--fg)] transition-colors truncate max-w-[160px] inline-block">{tenantName}</Link>
        </li>
        <li aria-hidden="true"><ChevronRight className="w-3.5 h-3.5" /></li>
        <li className="font-medium text-[var(--fg)] truncate max-w-[160px]" aria-current="page">{branchName}</li>
      </ol>
    </nav>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function HeroSection({ branch, tenant, accentColor }: { branch: PublicBranchInfo; tenant: Tenant; accentColor: string }) {
  return (
    <section className="relative h-64 md:h-80 overflow-hidden bg-gray-900">
      {branch.image ? (
        <img
          src={branch.image}
          alt={branch.name}
          className="absolute inset-0 w-full h-full object-cover opacity-70"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accentColor}88, ${accentColor}44)` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 max-w-7xl mx-auto px-4 pb-6">
        <div className="flex items-end gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-white/80 text-sm font-medium mb-1">{tenant.name}</p>
            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight truncate">{branch.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold',
                  branch.openNow ? 'bg-emerald-500 text-white' : 'bg-gray-500 text-white',
                )}
              >
                {branch.openNow ? 'Open Now' : 'Closed'}
              </span>
              {branch.todayHours && (
                <span className="text-white/70 text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />{branch.todayHours}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Quick Actions ─────────────────────────────────────────────────────────────

function QuickActions({ branch, tenantSlug, branchSlug }: { branch: PublicBranchInfo; tenantSlug: string; branchSlug: string }) {
  const [copied, setCopied] = useState(false)
  const pageUrl = typeof window !== 'undefined' ? window.location.href : `/${tenantSlug}/${branchSlug}`

  async function handleCopy() {
    await navigator.clipboard.writeText(pageUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({ title: branch.name, url: pageUrl }).catch(() => {})
    } else {
      handleCopy()
    }
  }

  return (
    <section className="bg-[var(--card)] border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap gap-2">
        <Link
          href={`/${tenantSlug}/${branchSlug}/menu`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-[var(--accent-fg)] rounded-lg text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          <UtensilsCrossed className="w-4 h-4" />View Menu
        </Link>
        <Link
          href={`/${tenantSlug}/${branchSlug}/reservation`}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
        >
          <Clock className="w-4 h-4" />Reserve Table
        </Link>
        <Link
          href={`/${tenantSlug}/${branchSlug}/menu`}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
        >
          <ShoppingBag className="w-4 h-4" />Order Online
        </Link>
        {branch.phone && (
          <a
            href={`tel:${branch.phone.replace(/\s/g, '')}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
          >
            <Phone className="w-4 h-4" />Call
          </a>
        )}
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(`${branch.address}, ${branch.city}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
        >
          <MapPin className="w-4 h-4" />Directions
        </a>
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
        >
          <Share2 className="w-4 h-4" />Share
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--fg)] hover:bg-[var(--card-hover)] transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'Copy URL'}
        </button>
      </div>
    </section>
  )
}

// ── Branch Info ───────────────────────────────────────────────────────────────

function BranchInfo({ branch }: { branch: PublicBranchInfo }) {
  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 space-y-4">
      <h2 className="font-semibold text-[var(--fg)]">Branch Information</h2>
      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-3 text-[var(--fg-muted)]">
          <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-[var(--accent)]" />
          <div>
            <p>{branch.address}</p>
            <p>{branch.city}</p>
          </div>
        </div>
        {branch.phone && (
          <div className="flex items-center gap-3 text-[var(--fg-muted)]">
            <Phone className="w-4 h-4 shrink-0 text-[var(--accent)]" />
            <a href={`tel:${branch.phone.replace(/\s/g, '')}`} className="hover:text-[var(--fg)] transition-colors">{branch.phone}</a>
          </div>
        )}
        {branch.todayHours && (
          <div className="flex items-center gap-3 text-[var(--fg-muted)]">
            <Clock className="w-4 h-4 shrink-0 text-[var(--accent)]" />
            <span>Today: {branch.todayHours}</span>
          </div>
        )}
      </div>
      {/* Map placeholder */}
      <div
        className="w-full h-36 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-[var(--fg-muted)] text-sm cursor-pointer hover:bg-[var(--card-hover)] transition-colors"
        onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(`${branch.address}, ${branch.city}`)}`, '_blank')}
        role="button"
        aria-label="Open in Google Maps"
      >
        <div className="text-center">
          <MapPin className="w-8 h-8 mx-auto mb-1 text-[var(--accent)]" aria-hidden="true" />
          <p>View on Map</p>
        </div>
      </div>
    </div>
  )
}

// ── Branch Switcher ───────────────────────────────────────────────────────────

function BranchSwitcher({
  branches,
  currentSlug,
  tenantSlug,
}: {
  branches: PublicBranchInfo[]
  currentSlug: string
  tenantSlug: string
}) {
  if (branches.length <= 1) return null
  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
      <h2 className="font-semibold text-[var(--fg)] mb-3">Other Locations</h2>
      <div className="space-y-2">
        {branches
          .filter((b) => b.slug !== currentSlug)
          .map((b) => (
            <Link
              key={b.slug}
              href={`/${tenantSlug}/${b.slug}`}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--card-hover)] transition-colors group"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--fg)] truncate">{b.name}</p>
                <p className="text-xs text-[var(--fg-muted)] truncate">{b.address}, {b.city}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    b.openNow ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500',
                  )}
                >
                  {b.openNow ? 'Open' : 'Closed'}
                </span>
                <ChevronRight className="w-4 h-4 text-[var(--fg-muted)] group-hover:text-[var(--fg)]" />
              </div>
            </Link>
          ))}
      </div>
    </div>
  )
}

// ── Featured Menu Items ───────────────────────────────────────────────────────

function FeaturedMenuSection({ items, tenantSlug, branchSlug }: { items: MenuItem[]; tenantSlug: string; branchSlug: string }) {
  if (!items.length) return null
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[var(--fg)]">Popular Items</h2>
        <Link href={`/${tenantSlug}/${branchSlug}/menu`} className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1">
          Full Menu <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.slice(0, 6).map((item) => (
          <div key={item.id} className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden hover:shadow-md transition-shadow">
            {item.image && (
              <img src={item.image} alt={item.name} className="w-full h-28 object-cover" loading="lazy" />
            )}
            <div className="p-3">
              <p className="text-sm font-medium text-[var(--fg)] truncate">{item.name}</p>
              <p className="text-sm text-[var(--accent)] font-semibold mt-0.5">
                ${(item.price / 100).toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Categories ────────────────────────────────────────────────────────────────

function CategoriesSection({ categories, tenantSlug, branchSlug }: { categories: Category[]; tenantSlug: string; branchSlug: string }) {
  if (!categories.length) return null
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[var(--fg)]">Categories</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/${tenantSlug}/${branchSlug}/menu?category=${cat.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] text-sm text-[var(--fg-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--fg)] transition-colors"
          >
            <Tag className="w-3.5 h-3.5" />{cat.name}
          </Link>
        ))}
      </div>
    </section>
  )
}

// ── Promotions ────────────────────────────────────────────────────────────────

function PromotionsSection({ promotions, tenantSlug, branchSlug }: { promotions: PromotionRule[]; tenantSlug: string; branchSlug: string }) {
  if (!promotions.length) return null
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[var(--fg)]">Current Offers</h2>
        <Link href={`/${tenantSlug}/${branchSlug}/promotions`} className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1">
          All Offers <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {promotions.slice(0, 4).map((promo) => (
          <div key={promo.id} className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-[var(--fg)] text-sm truncate">{promo.name}</p>
              {promo.description && (
                <p className="text-xs text-[var(--fg-muted)] mt-0.5 line-clamp-2">{promo.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Mock Reviews ──────────────────────────────────────────────────────────────

const MOCK_REVIEWS = [
  { id: '1', author: 'Alex M.', rating: 5, text: 'Exceptional experience — every detail was perfect. Will definitely be back!', date: '2 days ago' },
  { id: '2', author: 'Sarah K.', rating: 4, text: 'Great atmosphere and friendly staff. Food was delicious and arrived quickly.', date: '1 week ago' },
  { id: '3', author: 'James P.', rating: 5, text: 'One of the best spots in the city. Highly recommend the specials.', date: '2 weeks ago' },
]

function ReviewsSection({ rating, reviewCount }: { rating?: number; reviewCount?: number }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-[var(--fg)]">Reviews</h2>
        {rating != null && (
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-[var(--fg)]">{rating.toFixed(1)}</span>
            {reviewCount != null && (
              <span className="text-sm text-[var(--fg-muted)]">({reviewCount.toLocaleString()})</span>
            )}
          </div>
        )}
      </div>
      <div className="space-y-3">
        {MOCK_REVIEWS.map((r) => (
          <div key={r.id} className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm text-[var(--fg)]">{r.author}</span>
              <span className="text-xs text-[var(--fg-muted)]">{r.date}</span>
            </div>
            <div className="flex gap-0.5 mb-2" aria-label={`Rating: ${r.rating} out of 5`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn('w-3.5 h-3.5', i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200')}
                  aria-hidden="true"
                />
              ))}
            </div>
            <p className="text-sm text-[var(--fg-muted)]">{r.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Gallery ───────────────────────────────────────────────────────────────────

function GallerySection({ images }: { images: string[] }) {
  if (!images.length) return null
  return (
    <section>
      <h2 className="text-xl font-semibold text-[var(--fg)] mb-4">Gallery</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {images.slice(0, 6).map((url, i) => (
          <div key={i} className="aspect-square rounded-xl overflow-hidden">
            <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" loading="lazy" aria-hidden="true" />
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function BranchSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-64 bg-gray-200 dark:bg-gray-700" />
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>
    </div>
  )
}

// ── Not found (client) ────────────────────────────────────────────────────────

function BranchNotFound({ tenantSlug }: { tenantSlug: string }) {
  return (
    <>
      <Header />
      <main className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center">
        <Store className="w-16 h-16 text-[var(--fg-muted)] mb-6" aria-hidden="true" />
        <h1 className="text-3xl font-bold text-[var(--fg)] mb-3">Branch not found</h1>
        <p className="text-[var(--fg-muted)] max-w-sm mb-8">
          We could not find this location. It may have moved or no longer be listed.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href={`/${tenantSlug}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] font-medium hover:bg-[var(--accent-hover)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to Business
          </Link>
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] text-[var(--fg)] font-medium hover:bg-[var(--card-hover)] transition-colors"
          >
            Browse all businesses
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface Props {
  tenantSlug: string
  branchSlug: string
}

export default function BranchHomepageClient({ tenantSlug, branchSlug }: Props) {
  const { data: tenant, isLoading: tenantLoading } = usePublicTenant(tenantSlug)
  // usePublicBranch returns PublicBranchInfo | null (properly typed via useQuery<PublicBranchInfo | null>)
  const { data: branch, isLoading: branchLoading } = usePublicBranch(tenantSlug, branchSlug)
  // useCategories returns Category[] directly (not paginated)
  const { data: categories = [] } = useCategories()
  // useMenuItems returns PaginatedResponse<MenuItem>
  const { data: menuItemsPage } = useMenuItems()
  const { data: promotions = [] } = useActivePromotions()

  const menuItems: MenuItem[] = menuItemsPage?.results ?? []

  if (tenantLoading || branchLoading) return <BranchSkeleton />
  // After this guard, branch is PublicBranchInfo (not null/undefined)
  if (!tenant || !branch) return <BranchNotFound tenantSlug={tenantSlug} />

  const meta = getMarketplaceMeta(tenant.settings)

  const accentColor =
    (tenant.settings?.theme as { primaryColor?: string } | undefined)?.primaryColor ?? '#e85d04'

  const allBranches = meta?.branches ?? []
  const gallery = meta?.gallery ?? []
  const rating = meta?.rating
  const reviewCount = meta?.reviewCount

  return (
    <>
      <Header />
      <Breadcrumb tenantSlug={tenantSlug} tenantName={tenant.name} branchName={branch.name} />
      <HeroSection branch={branch} tenant={tenant} accentColor={accentColor} />
      <QuickActions branch={branch} tenantSlug={tenantSlug} branchSlug={branchSlug} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-10">
            <FeaturedMenuSection items={menuItems} tenantSlug={tenantSlug} branchSlug={branchSlug} />
            <CategoriesSection categories={categories} tenantSlug={tenantSlug} branchSlug={branchSlug} />
            <PromotionsSection promotions={promotions as PromotionRule[]} tenantSlug={tenantSlug} branchSlug={branchSlug} />
            <ReviewsSection rating={rating} reviewCount={reviewCount} />
            {gallery.length > 0 && <GallerySection images={gallery} />}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <BranchInfo branch={branch} />
            <BranchSwitcher branches={allBranches} currentSlug={branchSlug} tenantSlug={tenantSlug} />
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
