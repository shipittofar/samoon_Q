'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/utils'
import { Button } from './Button'

// ── Modal ──────────────────────────────────────────────────────────────────────
export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'product'
  className?: string
  contentClassName?: string
  /** When false, children manage their own scroll (e.g. product detail). */
  scrollable?: boolean
  closeOnOverlay?: boolean
  showClose?: boolean
  /** Visually hidden title for screen readers when showClose is false */
  ariaTitle?: string
  /** Stacking order for nested modals (default 50). */
  zIndex?: number
}

const modalSizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-4xl',
  product: 'max-w-5xl',
}

export function Modal({
  open, onClose, title, description, children, size = 'md',
  className, contentClassName, scrollable = true,
  closeOnOverlay = true, showClose = true, ariaTitle, zIndex = 50,
}: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const dialogLabelId = title ? 'modal-title' : ariaTitle ? 'modal-aria-title' : undefined

  useEffect(() => {
    if (!open) return

    const previousFocus = document.activeElement as HTMLElement | null

    const FOCUSABLE =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    const getFocusable = (): HTMLElement[] =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null,
      )

    const frameId = requestAnimationFrame(() => getFocusable()[0]?.focus())

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return }
      if (e.key !== 'Tab') return
      const focusable = getFocusable()
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }

    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'

    return () => {
      cancelAnimationFrame(frameId)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previousFocus?.focus()
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-hidden" style={{ zIndex }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeOnOverlay ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogLabelId}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={cn(
              'relative z-10 my-auto w-full bg-[var(--card)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden flex flex-col',
              'max-h-[calc(100dvh-2rem)]',
              size === 'product' && 'md:min-h-[min(720px,90dvh)]',
              modalSizes[size],
              className,
            )}
          >
            {ariaTitle && !title && (
              <h2 id="modal-aria-title" className="sr-only">{ariaTitle}</h2>
            )}
            {(title || showClose) && (
              <div className="flex items-start justify-between p-6 pb-0 shrink-0">
                <div>
                  {title && (
                    <h2 id="modal-title" className="text-xl font-semibold text-[var(--fg)] font-[var(--font-display)]">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="text-sm text-[var(--fg-muted)] mt-1">{description}</p>
                  )}
                </div>
                {showClose && (
                  <Button variant="ghost" size="icon-sm" onClick={onClose} className="shrink-0 -mt-1 -me-1" aria-label="Close">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
            <div
              className={cn(
                scrollable ? 'p-6 overflow-y-auto min-h-0 flex-1 overscroll-contain scrollbar-thin' : 'min-h-0 flex-1 flex flex-col overflow-hidden',
                contentClassName,
              )}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ── Drawer / Sheet ─────────────────────────────────────────────────────────────
export interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  side?: 'left' | 'right' | 'bottom'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const drawerMotion = {
  right: { hidden: { x: '100%' }, visible: { x: 0 } },
  left: { hidden: { x: '-100%' }, visible: { x: 0 } },
  bottom: { hidden: { y: '100%' }, visible: { y: 0 } },
}

export function Drawer({ open, onClose, title, children, side = 'right', size = 'md', className }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const widths = { sm: 'w-72', md: 'w-80 sm:w-96', lg: 'w-full max-w-lg' }
  const isBottom = side === 'bottom'

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex"
          style={{ justifyContent: side === 'left' ? 'flex-start' : side === 'right' ? 'flex-end' : 'flex-end' }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'drawer-title' : undefined}
            initial={drawerMotion[side].hidden}
            animate={drawerMotion[side].visible}
            exit={drawerMotion[side].hidden}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              'relative z-10 bg-[var(--card)] border-[var(--border)] shadow-2xl flex flex-col',
              isBottom ? 'w-full rounded-t-2xl border-t max-h-[85vh]' : `h-full ${widths[size]}`,
              side === 'right' && 'border-l',
              side === 'left' && 'border-r',
              className,
            )}
          >
            {(title || true) && (
              <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
                {isBottom && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-[var(--border-strong)] rounded-full" />
                )}
                {title && (
                  <h2 id="drawer-title" className="font-semibold text-[var(--fg)] font-[var(--font-display)]">{title}</h2>
                )}
                <Button variant="ghost" size="icon-sm" onClick={onClose} className="ms-auto" aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
