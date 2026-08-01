'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Heart, X, Share2 } from 'lucide-react'
import { Badge } from '@/components/ui'
import { cn } from '@/utils'
import type { MenuItem } from '@/types'

interface ProductDetailMediaProps {
  item: MenuItem
  favorited: boolean
  favoritePending?: boolean
  onFavorite: () => void
  onClose?: () => void
  favoriteLabel: string
  unfavoriteLabel: string
  closeLabel: string
  newLabel: string
  popularLabel: string
  discountLabel: (percent: number) => string
  priority?: boolean
  showClose?: boolean
  onShare?: () => void
  shareLabel?: string
}

export function ProductDetailMedia({
  item,
  favorited,
  favoritePending = false,
  onFavorite,
  onClose,
  favoriteLabel,
  unfavoriteLabel,
  closeLabel,
  newLabel,
  popularLabel,
  discountLabel,
  priority = false,
  showClose = false,
  onShare,
  shareLabel,
}: ProductDetailMediaProps) {
  const gallery = (item.images?.length ? item.images : item.image ? [item.image] : []) as string[]
  const [activeImage, setActiveImage] = useState(0)

  useEffect(() => {
    setActiveImage(0)
  }, [item.id])

  const activeSrc = gallery[activeImage]

  return (
    <div className="relative lg:w-[42%] shrink-0 lg:min-h-[520px] lg:sticky lg:top-0 lg:self-start bg-[var(--card-hover)]">
      <div className="relative h-60 sm:h-72 lg:h-full lg:min-h-[520px]">
        {activeSrc ? (
          <Image
            src={activeSrc}
            alt={item.name}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 42vw"
            priority={priority}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-950/30 dark:to-stone-900">
            <span className="text-6xl opacity-30" aria-hidden="true">🍽️</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-black/20 to-transparent pointer-events-none" />

        <div className="absolute top-3 start-3 flex flex-col gap-1.5">
          {item.is_new && <Badge variant="info">{newLabel}</Badge>}
          {item.is_popular && <Badge variant="warning">{popularLabel}</Badge>}
          {item.discount != null && item.discount > 0 && (
            <Badge variant="danger">{discountLabel(item.discount)}</Badge>
          )}
        </div>

        <div className="absolute top-3 end-3 flex gap-2">
          <button
            type="button"
            onClick={onFavorite}
            disabled={favoritePending}
            className={cn(
              'h-9 w-9 rounded-full flex items-center justify-center transition-all shadow-[var(--shadow-soft)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2',
              favorited ? 'bg-red-500 text-white' : 'bg-white/80 backdrop-blur-sm text-[var(--fg-muted)] hover:bg-white',
              favoritePending && 'opacity-70 cursor-wait',
            )}
            aria-label={favorited ? unfavoriteLabel : favoriteLabel}
            aria-busy={favoritePending}
          >
            <Heart className={cn('h-4 w-4', favorited && 'fill-current')} />
          </button>
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="h-9 w-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-[var(--fg-muted)] hover:bg-white transition-all shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              aria-label={shareLabel}
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
          {showClose && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-[var(--fg-muted)] hover:bg-white transition-all shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
              aria-label={closeLabel}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {gallery.length > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto scrollbar-hide bg-[var(--card)]/80 backdrop-blur-sm border-t border-[var(--border)]">
          {gallery.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActiveImage(i)}
              aria-label={`Image ${i + 1}`}
              aria-current={i === activeImage}
              className={cn(
                'relative h-14 w-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all',
                i === activeImage ? 'border-[var(--accent)]' : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <Image src={src} alt="" fill className="object-cover" sizes="56px" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
