'use client'

/**
 * PreviewButton — P8.7 Phase C
 *
 * Opens a public-facing page in a new tab so admins can preview exactly
 * what customers see, without navigating away from the admin panel.
 *
 * Usage:
 *   <PreviewButton href="/menu" label="Preview Menu" />
 *   <PreviewButton href="/" />           // defaults to "Preview Public Site"
 *   <PreviewButton href="/reservation" size="sm" />
 */

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/utils'

export interface PreviewButtonProps {
  /** The public URL to open (relative, e.g. "/menu"). */
  href: string
  /** Button label. Defaults to "Preview Public Site". */
  label?: string
  /** Visual size. Defaults to "default". */
  size?: 'sm' | 'default'
  /** Extra class names applied to the anchor. */
  className?: string
}

export function PreviewButton({
  href,
  label = 'Preview Public Site',
  size = 'default',
  className,
}: PreviewButtonProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium transition-colors hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900',
        size === 'sm'
          ? 'px-2.5 py-1.5 text-xs'
          : 'px-3 py-2 text-sm',
        className,
      )}
    >
      <ExternalLink className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {label}
    </Link>
  )
}
