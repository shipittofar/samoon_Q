'use client'

import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils'

interface ChipRailProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  'aria-label': string
}

export function ChipRail({ children, className, ...rest }: ChipRailProps) {
  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto overscroll-x-contain scrollbar-hide snap-x snap-mandatory py-0.5',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
