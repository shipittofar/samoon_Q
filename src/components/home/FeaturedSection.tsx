'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { ArrowRight, Star, Clock, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui'
import { useFeaturedItems } from '@/hooks'
import { useMoney } from '@/hooks/use-money'

function FeaturedCard({ item }: { item: { id: string; name: string; image: string; category?: { name: string } | null; price: number; discount?: number; rating: number; preparation_time: number; is_popular?: boolean; is_featured?: boolean } }) {
  const t = useTranslations('home')
  const money = useMoney()
  const displayLabel = money.formatItem(item as { price: number; discount?: number; currency?: string; prices?: Record<string, string | number> }, { discounted: true })

  const badge = item.is_popular ? t('popular') : item.is_featured ? t('featured') : null

  return (
    <div className="group bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="relative h-48 overflow-hidden">
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, 25vw"
        />
        {badge && (
          <div className="absolute top-3 start-3">
            <span className="bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-medium px-2.5 py-1 rounded-full shadow">
              {badge}
            </span>
          </div>
        )}
      </div>
      <div className="p-4">
        {item.category && (
          <span className="text-xs text-[var(--accent-text)] font-medium">{item.category.name}</span>
        )}
        <h3 className="font-[var(--font-display)] font-semibold text-[var(--fg)] mt-1 mb-3 line-clamp-1">
          {item.name}
        </h3>
        <div className="flex items-center justify-between">
          <span className="font-bold text-[var(--fg)]">{displayLabel}</span>
          <div className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 text-[var(--rating)] fill-[var(--rating)]"/>
              {item.rating?.toFixed(1) ?? "0.0"}
            </span>
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3"/>
              {item.preparation_time}m
            </span>
          </div>
        </div>
        <Link
          href="/menu"
          className="mt-3 flex items-center justify-center gap-1.5 bg-[var(--accent-subtle)] hover:bg-[var(--accent-subtle)] text-[var(--accent-text)] text-sm font-medium py-2.5 rounded-xl transition-colors"
        >
          {t('orderNow')} <ArrowRight className="h-3.5 w-3.5"/>
        </Link>
      </div>
    </div>
  )
}

function FeaturedCardSkeleton() {
  return (
    <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
      <Skeleton className="h-48 w-full rounded-none"/>
      <div className="p-4 space-y-3">
        <Skeleton className="h-3 w-1/4"/>
        <Skeleton className="h-4 w-3/4"/>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-1/4"/>
          <Skeleton className="h-4 w-1/4"/>
        </div>
        <Skeleton className="h-9 w-full rounded-xl"/>
      </div>
    </div>
  )
}

export function FeaturedSection({ branchId }: { branchId?: string } = {}) {
  const t = useTranslations('home')
  const { data: items, isLoading, isError } = useFeaturedItems(branchId)

  return (
    <section className="py-20 bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-sm font-medium text-[var(--accent-text)] uppercase tracking-widest mb-2">{t('handpicked')}</p>
            <h2 className="font-[var(--font-display)] text-4xl font-bold text-[var(--fg)]">{t('featuredDishes')}</h2>
          </div>
          <Link
            href="/menu?featured=true"
            className="flex items-center gap-1 text-sm text-[var(--fg-muted)] hover:text-[var(--accent-text)] transition-colors"
          >
            {t('seeAll')} <ChevronRight className="h-4 w-4"/>
          </Link>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => <FeaturedCardSkeleton key={i} />)}
          </div>
        )}

        {isError && (
          <div className="text-center py-12 text-[var(--fg-muted)]">
            <p className="text-sm">{t('unableToLoadFeaturedDishes')} <Link href="/menu"className="text-[var(--accent-text)] hover:underline">{t('browseTheFullMenu')}</Link></p>
          </div>
        )}

        {!isLoading && !isError && items && items.length === 0 && (
          <div className="text-center py-12 text-[var(--fg-muted)]">
            <p className="text-sm">{t('noFeaturedDishesAvailable')} <Link href="/menu"className="text-[var(--accent-text)] hover:underline">{t('exploreTheMenu')}</Link></p>
          </div>
        )}

        {!isLoading && !isError && items && items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {items.slice(0, 8).map((item) => (
              <FeaturedCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
