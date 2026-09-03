'use client'

import { type ComponentProps, Suspense } from 'react'
import * as Flags from 'country-flag-icons/react/3x2'

interface FlagIconProps extends ComponentProps<'span'> {
  code: string
  size?: number
}

export function FlagIcon({ code, size = 20, className, ...rest }: FlagIconProps) {
  const upper = code?.toUpperCase() as keyof typeof Flags
  const Flag = Flags[upper]

  if (!Flag) {
    return (
      <span
        {...rest}
        className={`inline-flex items-center justify-center rounded-sm bg-[var(--border)] text-[var(--fg-muted)] font-mono leading-none select-none ${className ?? ''}`}
        style={{ fontSize: size * 0.45, width: size, height: size * (2 / 3) }}
        aria-hidden="true"
      >
        {code?.toUpperCase().slice(0, 2) ?? '??'}
      </span>
    )
  }

  return (
    <span
      {...rest}
      className={`inline-block shrink-0 overflow-hidden rounded-sm ${className ?? ''}`}
      style={{ width: size, height: size * (2 / 3) }}
      aria-hidden="true"
    >
      <Flag style={{ width: '100%', height: '100%', display: 'block' }} title="" />
    </span>
  )
}
