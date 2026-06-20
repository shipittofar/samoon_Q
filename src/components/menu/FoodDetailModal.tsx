'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Minus, Plus, X, Star, Clock, Flame, Heart, ChevronDown, ChevronUp } from 'lucide-react'
import { useCartStore, useFavoritesStore } from '@/stores'
import { useToggleFavorite, useRelatedItems } from '@/hooks'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { Badge, RatingStars, Divider } from '@/components/ui'
import { FoodCard } from './FoodCard'
import { cn, formatCurrency, getDiscountedPrice } from '@/utils'
import type { Extra, MenuItem } from '@/types'
import toast from 'react-hot-toast'

interface FoodDetailModalProps {
  item: MenuItem | null
  open: boolean
  onClose: () => void
}

export function FoodDetailModal({ item, open, onClose }: FoodDetailModalProps) {
  const { addItem } = useCartStore()
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  const { mutate: toggleFav } = useToggleFavorite()
  const [quantity, setQuantity] = useState(1)
  const [selectedExtras, setSelectedExtras] = useState<Extra[]>([])
  const [notes, setNotes] = useState('')
  const [showNutrition, setShowNutrition] = useState(false)
  const { data: related } = useRelatedItems(item?.id || '')

  if (!item) return null

  const discountedPrice = item.discount ? getDiscountedPrice(item.price, item.discount) : item.price
  const extrasTotal = selectedExtras.reduce((s, e) => s + e.price, 0)
  const unitPrice = discountedPrice + extrasTotal
  const totalPrice = unitPrice * quantity
  const favorited = isFavorite(item.id)

  const handleExtraToggle = (extra: Extra) => {
    setSelectedExtras((prev) =>
      prev.some((e) => e.id === extra.id) ? prev.filter((e) => e.id !== extra.id) : [...prev, extra],
    )
  }

  const handleAddToCart = () => {
    addItem({ ...item, discounted_price: discountedPrice }, quantity, selectedExtras, notes || undefined)
    toast.success(`${item.name} added to cart!`, { icon: '🛒' })
    setQuantity(1)
    setSelectedExtras([])
    setNotes('')
    onClose()
  }

  const handleFavorite = () => {
    toggleFavorite(item.id)
    toggleFav(item.id)
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" showClose={false} className="!p-0">
      <div className="flex flex-col md:flex-row max-h-[85vh]">
        {/* Image */}
        <div className="relative md:w-2/5 h-60 md:h-auto shrink-0">
          <Image
            src={item.image}
            alt={item.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 40vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/20 to-transparent" />

          {/* Badges overlay */}
          <div className="absolute top-3 start-3 flex flex-col gap-1.5">
            {item.is_new && <Badge variant="info">New</Badge>}
            {item.is_popular && <Badge variant="warning">Popular</Badge>}
            {item.discount && <Badge variant="danger">{item.discount}% OFF</Badge>}
          </div>

          {/* Action buttons */}
          <div className="absolute top-3 end-3 flex gap-2">
            <button
              onClick={handleFavorite}
              className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center transition-all shadow-lg',
                favorited ? 'bg-red-500 text-white' : 'bg-white/80 backdrop-blur-sm text-gray-600 hover:bg-white',
              )}
              aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart className={cn('h-4 w-4', favorited && 'fill-current')} />
            </button>
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-gray-600 hover:bg-white transition-all shadow-lg"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            {/* Header */}
            <div className="mb-4">
              <h2 className="text-2xl font-[var(--font-display)] font-bold text-[var(--fg)] mb-2">{item.name}</h2>
              <div className="flex items-center gap-4 text-sm text-[var(--fg-muted)] mb-3">
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                  <strong className="text-[var(--fg)]">{item.rating}</strong>
                  <span>({item.rating_count} reviews)</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {item.preparation_time} min
                </span>
                {item.calories && (
                  <span className="flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5" />
                    {item.calories} cal
                  </span>
                )}
              </div>
              <p className="text-[var(--fg-muted)] text-sm leading-relaxed">{item.description}</p>

              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="capitalize">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Nutritional Info */}
            {item.nutritional_info && (
              <div className="mb-4">
                <button
                  onClick={() => setShowNutrition((v) => !v)}
                  className="flex items-center gap-2 text-sm font-medium text-[var(--fg)] hover:text-orange-500 transition-colors"
                >
                  Nutritional Info
                  {showNutrition ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {showNutrition && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="grid grid-cols-4 gap-2 mt-3"
                  >
                    {Object.entries(item.nutritional_info).map(([key, val]) => (
                      <div key={key} className="bg-[var(--card-hover)] rounded-xl p-2.5 text-center">
                        <p className="text-xs text-[var(--fg-muted)] capitalize">{key}</p>
                        <p className="text-sm font-semibold text-[var(--fg)]">{val}g</p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            )}

            <Divider className="my-4" />

            {/* Extras */}
            {item.extras && item.extras.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[var(--fg)] mb-3">Add Extras</h3>
                <div className="space-y-2">
                  {item.extras.map((extra) => {
                    const selected = selectedExtras.some((e) => e.id === extra.id)
                    return (
                      <button
                        key={extra.id}
                        onClick={() => handleExtraToggle(extra)}
                        disabled={!extra.available}
                        className={cn(
                          'flex items-center justify-between w-full px-3 py-2.5 rounded-xl border text-sm transition-all duration-150',
                          selected
                            ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-600'
                            : 'border-[var(--border)] hover:border-orange-300 text-[var(--fg)]',
                          !extra.available && 'opacity-40 cursor-not-allowed',
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className={cn('h-4 w-4 rounded border-2 flex items-center justify-center transition-all', selected ? 'border-orange-500 bg-orange-500' : 'border-[var(--border-strong)]')}>
                            {selected && <span className="text-white text-[10px]">✓</span>}
                          </span>
                          {extra.name}
                        </span>
                        <span className="font-medium">+{formatCurrency(extra.price)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="mb-4">
              <Textarea
                label="Special requests"
                placeholder="Any special requests? (e.g. no onions, extra spicy…)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border)] p-4 bg-[var(--card)] flex items-center gap-4">
            {/* Quantity */}
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] overflow-hidden">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="h-10 w-10 flex items-center justify-center text-[var(--fg-muted)] hover:bg-[var(--card-hover)] transition-colors"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center font-semibold text-[var(--fg)]">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="h-10 w-10 flex items-center justify-center text-[var(--fg-muted)] hover:bg-[var(--card-hover)] transition-colors"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <Button
              className="flex-1"
              size="lg"
              onClick={handleAddToCart}
              disabled={!item.available}
            >
              Add to Cart · {formatCurrency(totalPrice)}
            </Button>
          </div>
        </div>
      </div>

      {/* Related Items */}
      {related && related.length > 0 && (
        <div className="border-t border-[var(--border)] p-6">
          <h3 className="font-[var(--font-display)] font-semibold text-[var(--fg)] mb-4">You might also like</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {related.slice(0, 4).map((rel) => (
              <FoodCard key={rel.id} item={rel} compact />
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
