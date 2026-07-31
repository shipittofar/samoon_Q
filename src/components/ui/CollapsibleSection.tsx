'use client'

import { useId, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/utils'

export interface CollapsibleSectionProps {
  title: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
  className?: string
  icon?: ReactNode
}

export function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
  className,
  icon,
}: CollapsibleSectionProps) {
  const panelId = useId()
  const buttonId = useId()
  const reduceMotion = useReducedMotion()

  return (
    <div className={className}>
      <button
        id={buttonId}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          'flex items-center gap-2 text-base font-semibold text-[var(--fg)] w-full',
          'hover:text-[var(--accent)] transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-lg',
        )}
      >
        {icon}
        <span className="flex-1 text-start">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {open && (
        reduceMotion ? (
          <div id={panelId} role="region" aria-labelledby={buttonId} className="mt-4">
            {children}
          </div>
        ) : (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="mt-4"
          >
            {children}
          </motion.div>
        )
      )}
    </div>
  )
}
