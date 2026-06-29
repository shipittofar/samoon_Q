import Link from 'next/link'
import Image from 'next/image'
import { Star, MapPin, ChevronRight, ArrowRight } from 'lucide-react'

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  cafe: 'Café',
  bar: 'Bar',
  food_truck: 'Food Truck',
  food_court: 'Food Court',
  mobile_cafe: 'Mobile Café',
}

interface MockBusiness {
  id: string
  name: string
  slug: string
  type: string
  rating: number
  reviewCount: number
  location: string
  priceLevel: number
  tag: string
  image: string
}

// H1: replaced emoji+gradient card headers with real Unsplash food photography.
// Realistic images are a baseline trust requirement for any marketplace listing card.
const MOCK_BUSINESSES: MockBusiness[] = [
  {
    id: '1',
    name: 'Maison Dorée',
    slug: 'savor',
    type: 'restaurant',
    rating: 4.9,
    reviewCount: 1240,
    location: 'Downtown',
    priceLevel: 3,
    tag: 'Top Rated',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=75',
  },
  {
    id: '2',
    name: 'Brew Café',
    slug: 'brew-cafe',
    type: 'cafe',
    rating: 4.7,
    reviewCount: 820,
    location: 'Midtown',
    priceLevel: 1,
    tag: 'Trending',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=75',
  },
  {
    id: '3',
    name: 'The Oak Bar',
    slug: 'the-oak-bar',
    type: 'bar',
    rating: 4.6,
    reviewCount: 540,
    location: 'West Side',
    priceLevel: 2,
    tag: 'Popular',
    image: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&q=75',
  },
  {
    id: '4',
    name: 'Central Food Court',
    slug: 'central-food-court',
    type: 'food_court',
    rating: 4.5,
    reviewCount: 2100,
    location: 'City Center',
    priceLevel: 1,
    tag: 'Family Friendly',
    image: 'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=600&q=75',
  },
  {
    id: '5',
    name: 'Wheels & Brews',
    slug: 'wheels-and-brews',
    type: 'food_truck',
    rating: 4.8,
    reviewCount: 430,
    location: 'Various Spots',
    priceLevel: 1,
    tag: 'New',
    image: 'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?w=600&q=75',
  },
  {
    id: '6',
    name: 'Road Bites',
    slug: 'road-bites',
    type: 'food_truck',
    rating: 4.4,
    reviewCount: 310,
    location: 'East District',
    priceLevel: 1,
    tag: 'Budget Friendly',
    image: 'https://images.unsplash.com/photo-1551782450-17144efb9c50?w=600&q=75',
  },
]

const PRICE_SYMBOLS = ['', '$', '$$', '$$$', '$$$$']

function BusinessCard({ biz }: { biz: MockBusiness }) {
  return (
    <Link
      href={`/${biz.slug}`}
      className="group bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col"
    >
      {/* Photo header */}
      <div className="relative h-44 overflow-hidden">
        <Image
          src={biz.image}
          alt={biz.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <span className="absolute top-3 start-3 bg-black/40 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
          {biz.tag}
        </span>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-[var(--font-display)] font-semibold text-[var(--fg)] group-hover:text-orange-500 transition-colors line-clamp-1">
              {biz.name}
            </h3>
            <span className="text-xs text-orange-500 font-medium">
              {BUSINESS_TYPE_LABELS[biz.type] ?? biz.type}
            </span>
          </div>
          <span className="text-xs text-[var(--fg-subtle)] shrink-0 mt-0.5">{PRICE_SYMBOLS[biz.priceLevel]}</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-[var(--fg-muted)]">
          <span className="flex items-center gap-0.5">
            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
            <span className="font-medium text-[var(--fg)]">{biz.rating}</span>
            <span>({biz.reviewCount.toLocaleString()})</span>
          </span>
          <span className="flex items-center gap-0.5">
            <MapPin className="h-3 w-3" />
            {biz.location}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function DiscoveryPreview() {
  return (
    <section className="py-20 bg-[var(--bg)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-sm font-medium text-orange-500 uppercase tracking-widest mb-2">Explore</p>
            <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--fg)]">
              Popular on Savor
            </h2>
            <p className="text-[var(--fg-muted)] mt-2">Restaurants, cafés, bars, and more — all on Savor</p>
          </div>
          <Link
            href="/discover"
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-orange-500 hover:text-orange-600 transition-colors"
          >
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {MOCK_BUSINESSES.map((biz) => (
            <BusinessCard key={biz.id} biz={biz} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3.5 rounded-2xl transition-all shadow-[0_8px_30px_-4px_rgba(249,115,22,0.4)] hover:shadow-[0_12px_40px_-4px_rgba(249,115,22,0.5)] hover:-translate-y-0.5"
          >
            Browse All 500+ Businesses <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
