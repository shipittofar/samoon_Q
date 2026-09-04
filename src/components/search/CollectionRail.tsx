'use client'

import { type ReactNode } from 'react'
import { cn } from '@/utils'

interface CollectionRailProps {
  title: string
  children: ReactNode
  headingId?: string
}

export function CollectionRail({ title, children, headingId }: CollectionRailProps) {
  const id = headingId ?? `rail-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <section aria-labelledby={id} className="mb-8">
      <h2
        id={id}
        className="font-[var(--font-display)] text-lg sm:text-xl font-semibold text-[var(--fg)] mb-3"
      >
        {title}
      </h2>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1 -mx-4 px-4">
        {children}
      </div>
    </section>
  )
}

export function CollectionRailCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('w-[min(80vw,20rem)] sm:w-72 shrink-0 snap-start', className)}>
      {children}
    </div>
  )
}
