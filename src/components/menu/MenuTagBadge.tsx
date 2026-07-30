'use client'

import { Badge } from '@/components/ui'
import { cn } from '@/utils'
import type { MenuItemTag } from '@/types'

/** Inline tag visual: image → icon → name. Safe to use inside buttons or badges. */
export function MenuTagLabel({ tag, className }: { tag: MenuItemTag; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {tag.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tag.image} alt="" className="h-4 w-4 rounded-full object-cover shrink-0" />
      ) : tag.icon ? (
        <span aria-hidden="true">{tag.icon}</span>
      ) : null}
      {tag.name}
    </span>
  )
}

interface MenuTagBadgeProps {
  tag: MenuItemTag
  variant?: 'secondary' | 'default' | 'info' | 'warning' | 'danger'
  className?: string
}

/** Renders a menu tag as a Badge. Never renders the raw tag object. */
export function MenuTagBadge({ tag, variant = 'secondary', className }: MenuTagBadgeProps) {
  return (
    <Badge variant={variant} className={cn('inline-flex items-center gap-1', className)}>
      <MenuTagLabel tag={tag} />
    </Badge>
  )
}
