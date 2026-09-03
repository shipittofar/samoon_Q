import { type HTMLAttributes, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn, getInitials } from '@/utils'

// ── Badge ──────────────────────────────────────────────────────────────────────
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[var(--accent-subtle)] text-[var(--accent-text)]',
        secondary: 'bg-[var(--card-hover)] text-[var(--fg-muted)]',
        success: 'bg-[var(--success-subtle)] text-[var(--success-text)]',
        warning: 'bg-[var(--warning-subtle)] text-[var(--warning-text)]',
        danger: 'bg-[var(--danger-subtle)] text-[var(--danger-text)]',
        info: 'bg-[var(--info-subtle)] text-[var(--info-text)]',
        purple: 'bg-[var(--chart-5)]/15 text-[var(--chart-5)]',
        outline: 'border border-[var(--border-strong)] text-[var(--fg-muted)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current"/>}
      {children}
    </span>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────────
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ className, hover = false, padding = 'md', children, ...props }: CardProps) {
  const paddings = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' }
  return (
    <div
      className={cn(
        'bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-soft)]',
        hover && 'transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer',
        paddings[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4', className)} {...props}>{children}</div>
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-lg font-semibold text-[var(--fg)] font-[var(--font-display)]', className)} {...props}>
      {children}
    </h3>
  )
}

export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-[var(--fg-muted)]', className)} {...props}>{children}</div>
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
export interface AvatarProps {
  src?: string
  firstName?: string
  lastName?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const avatarSizes = { xs: 'h-6 w-6 text-xs', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base', xl: 'h-16 w-16 text-lg' }

export function Avatar({ src, firstName = '', lastName = '', size = 'md', className }: AvatarProps) {
  const initials = getInitials(firstName || '?', lastName || '')
  return (
    <div className={cn('relative rounded-full overflow-hidden bg-gradient-to-br from-[var(--accent)] to-[var(--accent-active)] flex items-center justify-center font-semibold text-[var(--accent-fg)] shrink-0', avatarSizes[size], className)}>
      {src ? (
        <img src={src} alt={`${firstName} ${lastName}`} className="h-full w-full object-cover"onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-[var(--card-hover)] dark:bg-[var(--border)]', className)}
      {...props}
    />
  )
}

export function FoodCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-[var(--card)] border border-[var(--border)]">
      <Skeleton className="h-48 w-full rounded-none"/>
      <div className="p-4 space-y-2">
        <Skeleton className="h-5 w-3/4"/>
        <Skeleton className="h-4 w-full"/>
        <Skeleton className="h-4 w-2/3"/>
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-6 w-20"/>
          <Skeleton className="h-9 w-24 rounded-xl"/>
        </div>
      </div>
    </div>
  )
}

// ── Divider ────────────────────────────────────────────────────────────────────
export function Divider({ className, label }: { className?: string; label?: string }) {
  if (label) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="flex-1 h-px bg-[var(--border)]"/>
        <span className="text-xs text-[var(--fg-subtle)] shrink-0">{label}</span>
        <div className="flex-1 h-px bg-[var(--border)]"/>
      </div>
    )
  }
  return <hr className={cn('border-[var(--border)]', className)} />
}

// ── Rating Stars ───────────────────────────────────────────────────────────────
export function RatingStars({ rating, count, size = 'sm' }: { rating: number; count?: number; size?: 'sm' | 'md' }) {
  const stars = Array.from({ length: 5 }, (_, i) => {
    const filled = i < Math.floor(rating)
    const half = !filled && i < Math.ceil(rating) && rating % 1 >= 0.5
    return { filled, half }
  })
  const starSize = size === 'sm' ? 'text-xs' : 'text-sm'
  return (
    <span className="flex items-center gap-1">
      <span className={cn('flex', starSize)}>
        {stars.map((s, i) => (
          <span key={i} className={s.filled ? 'text-[var(--warning-border)]' : s.half ? 'text-[var(--warning-border)]/60' : 'text-[var(--border-strong)]'}>
            ★
          </span>
        ))}
      </span>
      <span className={cn('text-[var(--fg-muted)]', size === 'sm' ? 'text-xs' : 'text-sm')}>
        {rating.toFixed(1)}
        {count !== undefined && ` (${count})`}
      </span>
    </span>
  )
}

export { PhoneInput } from './PhoneInput'
export type { PhoneInputProps, PhoneInputMeta } from './PhoneInput'
export { OTPInput } from './OTPInput'
export type { OTPInputProps } from './OTPInput'
export { PaginationControls } from './PaginationControls'
export type { PaginationControlsProps } from './PaginationControls'
export { QuantityStepper } from './QuantityStepper'
export type { QuantityStepperProps } from './QuantityStepper'
export { CollapsibleSection } from './CollapsibleSection'
export type { CollapsibleSectionProps } from './CollapsibleSection'
export { SelectableOptionRow } from './SelectableOptionRow'
export type { SelectableOptionRowProps } from './SelectableOptionRow'
export { StarRatingInput } from './StarRatingInput'
export type { StarRatingInputProps } from './StarRatingInput'
