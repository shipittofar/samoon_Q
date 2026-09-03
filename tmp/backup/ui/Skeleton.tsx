/**
 * Skeleton UI Primitives — Phase 4 (P4.3.1)
 *
 * Pure presentational loading placeholders. CSS animation only (no framer-motion).
 * All components are ARIA-safe: they use role="status" + aria-busy or
 * aria-hidden to communicate loading state to screen readers.
 */
import { type HTMLAttributes } from 'react'
import { cn } from '@/utils'

// ── Base pulse animation class ─────────────────────────────────────────────────
const PULSE = 'animate-pulse rounded-lg bg-[var(--card-hover)] dark:bg-[var(--border)]'

// ── Skeleton ──────────────────────────────────────────────────────────────────
/**
 * Generic rectangular skeleton block. Use for images, banners, and any
 * content region whose shape is rectangular.
 */
export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Set false to suppress the top-level aria-hidden wrapper (e.g. inside SkeletonCard). */
  accessible?: boolean
}

export function Skeleton({ className, accessible = true, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden={accessible ? undefined : true}
      className={cn(PULSE, className)}
      {...props}
    />
  )
}

// ── SkeletonText ──────────────────────────────────────────────────────────────
/**
 * One or more lines of text placeholder. Renders narrower lines to mimic
 * natural text flow. The last line is 60 % wide by default.
 */
export interface SkeletonTextProps {
  lines?: number
  className?: string
  /** Width of the last (shorter) line. Tailwind width class. Defaults to 'w-3/5'. */
  lastLineWidth?: string
}

export function SkeletonText({ lines = 3, className, lastLineWidth = 'w-3/5' }: SkeletonTextProps) {
  return (
    <div
      role="status"
      aria-label="Loading text"
      aria-busy="true"
      className={cn('space-y-2', className)}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn(
            PULSE,
            'h-4',
            i === lines - 1 && lines > 1 ? lastLineWidth : 'w-full',
          )}
        />
      ))}
    </div>
  )
}

// ── SkeletonAvatar ────────────────────────────────────────────────────────────
/**
 * Circular avatar placeholder. Sizes mirror the Avatar component in index.tsx.
 */
export type SkeletonAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const AVATAR_SIZES: Record<SkeletonAvatarSize, string> = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
}

export interface SkeletonAvatarProps {
  size?: SkeletonAvatarSize
  className?: string
}

export function SkeletonAvatar({ size = 'md', className }: SkeletonAvatarProps) {
  return (
    <div
      role="status"
      aria-label="Loading avatar"
      aria-busy="true"
      className={cn(
        'animate-pulse rounded-full bg-[var(--card-hover)] dark:bg-[var(--border)] shrink-0',
        AVATAR_SIZES[size],
        className,
      )}
    />
  )
}

// ── SkeletonCard ──────────────────────────────────────────────────────────────
/**
 * Card-shaped skeleton with an image area, title line, body lines, and an
 * optional action button area. Matches the visual weight of Card from index.tsx.
 */
export interface SkeletonCardProps {
  /** Show an image placeholder at the top of the card. */
  showImage?: boolean
  /** Number of body text lines. */
  bodyLines?: number
  /** Show a button placeholder at the bottom. */
  showAction?: boolean
  className?: string
}

export function SkeletonCard({
  showImage = true,
  bodyLines = 3,
  showAction = false,
  className,
}: SkeletonCardProps) {
  return (
    <div
      role="status"
      aria-label="Loading content"
      aria-busy="true"
      className={cn(
        'rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden',
        className,
      )}
    >
      {showImage && (
        <div
          aria-hidden="true"
          className="animate-pulse bg-[var(--card-hover)] dark:bg-[var(--border)] h-48 w-full"
        />
      )}
      <div className="p-4 space-y-3">
        {/* Title line */}
        <div aria-hidden="true" className={cn(PULSE, 'h-5 w-3/4')} />
        {/* Body lines */}
        {Array.from({ length: bodyLines }).map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className={cn(PULSE, 'h-4', i === bodyLines - 1 ? 'w-2/3' : 'w-full')}
          />
        ))}
        {showAction && (
          <div className="flex items-center justify-between pt-1">
            <div aria-hidden="true" className={cn(PULSE, 'h-6 w-20')} />
            <div aria-hidden="true" className={cn(PULSE, 'h-9 w-24 rounded-xl')} />
          </div>
        )}
      </div>
    </div>
  )
}
