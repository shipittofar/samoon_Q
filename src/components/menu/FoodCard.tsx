'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Heart, Plus, Clock, Flame, Star, ChefHat } from 'lucide-react'
import { useCartStore, useFavoritesStore, useRecentlyViewedStore } from '@/stores'
import { useToggleFavorite } from '@/hooks'
import { cn, formatCurrency, getDiscountedPrice } from '@/utils'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import type { MenuItem } from '@/types'

interface FoodCardProps {
  item: MenuItem
  onOpenDetail?: (item: MenuItem) => void
  compact?: boolean
  className?: string
}

export function FoodCard({ item, onOpenDetail, compact = false, className }: FoodCardProps) {
  const { addItem } = useCartStore()
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  const { mutate: toggleFav } = useToggleFavorite()
  const addRecentlyViewed = useRecentlyViewedStore((s) => s.addItem)
  const [addedAnim, setAddedAnim] = useState(false)

  const discountedPrice = item.discount ? getDiscountedPrice(item.price, item.discount) : item.price
  const favorited = isFavorite(item.id)

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!item.available) return
    if (item.extras && item.extras.length > 0) {
      onOpenDetail?.(item)
      return
    }
    addItem({ ...item, discounted_price: discountedPrice })
    setAddedAnim(true)
    setTimeout(() => setAddedAnim(false), 1200)
  }

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavorite(item.id)
    toggleFav(item.id)
  }

  const handleClick = () => {
    addRecentlyViewed(item)
    onOpenDetail?.(item)
  }

  if (compact) {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        onClick={handleClick}
        className={cn(
          'group flex gap-3 bg-[var(--card)] rounded-xl border border-[var(--border)] p-3 cursor-pointer hover:border-orange-200 dark:hover:border-orange-900 hover:shadow-md transition-all duration-200',
          !item.available && 'opacity-60',
          className,
        )}
      >
        <div className="relative h-20 w-20 rounded-lg overflow-hidden shrink-0">
          <Image src={item.image} alt={item.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="80px" />
          {!item.available && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white text-[10px] font-medium">Unavailable</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-[var(--fg)] truncate">{item.name}</h3>
          <p className="text-xs text-[var(--fg-muted)] line-clamp-2 mt-0.5">{item.description}</p>
          <div className="flex items-center justify-between mt-2">
            <div>
              <span className="text-sm font-bold text-[var(--fg)]">{formatCurrency(discountedPrice)}</span>
              {item.discount && (
                <span className="text-xs text-[var(--fg-subtle)] line-through ms-1">{formatCurrency(item.price)}</span>
              )}
            </div>
            <Button size="icon-sm" onClick={handleAdd} disabled={!item.available} aria-label="Add to cart">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={handleClick}
      className={cn(
        'group relative bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden cursor-pointer hover:border-orange-200 dark:hover:border-orange-900 hover:shadow-xl transition-all duration-300',
        !item.available && 'opacity-70',
        className,
      )}
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 start-3 flex flex-col gap-1.5">
          {item.is_new && <Badge variant="info" className="shadow-sm text-[10px]">New</Badge>}
          {item.is_popular && <Badge variant="warning" className="shadow-sm text-[10px]">Popular</Badge>}
          {item.is_featured && <Badge variant="default" className="shadow-sm text-[10px]">Featured</Badge>}
          {item.discount && (
            <Badge variant="danger" className="shadow-sm text-[10px]">{item.discount}% OFF</Badge>
          )}
        </div>

        {/* Favorite */}
        <button
          onClick={handleFavorite}
          className={cn(
            'absolute top-3 end-3 h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg',
            favorited
              ? 'bg-red-500 text-white scale-110'
              : 'bg-white/80 backdrop-blur-sm text-gray-500 hover:bg-white hover:text-red-500',
          )}
          aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={cn('h-4 w-4', favorited && 'fill-current')} />
        </button>

        {/* Not available overlay */}
        {!item.available && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge variant="secondary" className="text-xs">Currently Unavailable</Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-[var(--font-display)] font-semibold text-[var(--fg)] leading-snug mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-1">
          {item.name}
        </h3>
        <p className="text-xs text-[var(--fg-muted)] line-clamp-2 mb-3 leading-relaxed">
          {item.description}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-3 mb-4 text-xs text-[var(--fg-muted)]">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
            {item.rating.toFixed(1)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {item.preparation_time}m
          </span>
          {item.calories && (
            <span className="flex items-center gap-1">
              <Flame className="h-3 w-3" />
              {item.calories} cal
            </span>
          )}
        </div>

        {/* Price + Add */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-[var(--fg)]">{formatCurrency(discountedPrice)}</span>
            {item.discount && (
              <span className="text-xs text-[var(--fg-subtle)] line-through ms-1.5">
                {formatCurrency(item.price)}
              </span>
            )}
          </div>
          <motion.div animate={addedAnim ? { scale: [1, 1.25, 1] } : {}}>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!item.available}
              leftIcon={addedAnim ? <span>✓</span> : <Plus className="h-3.5 w-3.5" />}
              className={cn(addedAnim && 'bg-emerald-500 hover:bg-emerald-500')}
            >
              {item.extras && item.extras.length > 0 ? (
                <><ChefHat className="h-3.5 w-3.5" /> Customize</>
              ) : addedAnim ? 'Added!' : 'Add'}
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
