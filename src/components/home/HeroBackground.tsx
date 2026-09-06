'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/utils'
import { isUnoptimizedMediaUrl } from '@/utils/media-url'
import type { HeroBackgroundImage } from '@/types/website-builder'

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return reduced
}

function useIsMobilePosition(): boolean {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return mobile
}

function HeroSlide({
  image,
  isActive,
  isPriority,
  transitionMs,
  onError,
}: {
  image: HeroBackgroundImage
  isActive: boolean
  isPriority: boolean
  transitionMs: number
  onError: () => void
}) {
  const isMobile = useIsMobilePosition()
  const objectPosition =
    (isMobile && image.objectPositionMobile ? image.objectPositionMobile : image.objectPosition) ?? 'center'
  const decorative = !image.altText?.trim()

  return (
    <div
      className="absolute inset-0"
      style={{
        opacity: isActive ? 1 : 0,
        transition: `opacity ${transitionMs}ms ease-in-out`,
        zIndex: isActive ? 1 : 0,
      }}
      aria-hidden={decorative ? true : !isActive}
    >
      <Image
        src={image.src}
        alt={decorative ? '' : image.altText!}
        fill
        priority={isPriority}
        loading={isPriority ? undefined : 'lazy'}
        sizes="100vw"
        quality={80}
        className="object-cover"
        style={{ objectPosition }}
        unoptimized={isUnoptimizedMediaUrl(image.src)}
        onError={onError}
      />
    </div>
  )
}

export interface HeroBackgroundProps {
  images: HeroBackgroundImage[]
  intervalMs?: number
  transitionMs?: number
  className?: string
  overlay?: React.ReactNode
  fallback?: React.ReactNode
}

export function HeroBackground({
  images,
  intervalMs = 7000,
  transitionMs = 900,
  className,
  overlay,
  fallback,
}: HeroBackgroundProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [failed, setFailed] = useState<Set<string>>(() => new Set())
  const live = images.filter((img) => !failed.has(img.id))
  const liveKey = live.map((img) => img.id).join('|')
  const slideshow = live.length >= 2 && !reducedMotion
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [liveKey])

  useEffect(() => {
    if (!slideshow) return
    const id = window.setInterval(() => {
      if (document.hidden) return
      setIndex((i) => (i + 1) % live.length)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [slideshow, intervalMs, live.length])

  const markFailed = useCallback((id: string) => {
    setFailed((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const safeIndex = live.length === 0 ? 0 : index % live.length

  return (
    <div className={cn('absolute inset-0 z-0 overflow-hidden pointer-events-none', className)} aria-hidden="true">
      {live.length === 0
        ? (fallback ?? (
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-orange-950" />
          ))
        : live.map((image, i) => (
            <HeroSlide
              key={image.id}
              image={image}
              isActive={!slideshow ? i === 0 : i === safeIndex}
              isPriority={i === 0}
              transitionMs={slideshow ? transitionMs : 0}
              onError={() => markFailed(image.id)}
            />
          ))}
      {overlay ? <div className="absolute inset-0 z-[2]">{overlay}</div> : null}
    </div>
  )
}
