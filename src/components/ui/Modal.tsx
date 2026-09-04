'use client'

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { motion, AnimatePresence, useDragControls, useReducedMotion } from 'framer-motion'
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
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-hidden"style={{ zIndex }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm"
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
              <h2 id="modal-aria-title"className="sr-only">{ariaTitle}</h2>
            )}
            {(title || showClose) && (
              <div className="flex items-start justify-between p-6 pb-0 shrink-0">
                <div>
                  {title && (
                    <h2 id="modal-title"className="text-xl font-semibold text-[var(--fg)] font-[var(--font-display)]">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="text-sm text-[var(--fg-muted)] mt-1">{description}</p>
                  )}
                </div>
                {showClose && (
                  <Button variant="ghost"size="icon-sm"onClick={onClose} className="shrink-0 -mt-1 -me-1"aria-label="Close">
                    <X className="h-4 w-4"/>
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
export type DrawerSide = 'left' | 'right' | 'bottom' | 'start' | 'end'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  side?: DrawerSide
  size?: 'sm' | 'md' | 'lg' | 'compact'
  className?: string
  overlay?: 'default' | 'subtle'
  density?: 'default' | 'compact'
  /** Bottom sheets size to content instead of filling max-height. */
  fitContent?: boolean
  closeLabel?: string
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function subscribeRtl(cb: () => void) {
  const el = document.documentElement
  const obs = new MutationObserver(cb)
  obs.observe(el, { attributes: true, attributeFilter: ['dir'] })
  return () => obs.disconnect()
}

function getRtlSnapshot() {
  return document.documentElement.getAttribute('dir') === 'rtl'
}

function drawerMotion(side: DrawerSide, rtl: boolean) {
  if (side === 'bottom') return { hidden: { y: '100%', x: 0, opacity: 1 }, visible: { y: 0, x: 0, opacity: 1 } }
  if (side === 'left') return { hidden: { x: '-100%', y: 0, opacity: 1 }, visible: { x: 0, y: 0, opacity: 1 } }
  if (side === 'right') return { hidden: { x: '100%', y: 0, opacity: 1 }, visible: { x: 0, y: 0, opacity: 1 } }
  const fromPositiveX = (side === 'end' && !rtl) || (side === 'start' && rtl)
  return {
    hidden: { x: fromPositiveX ? '100%' : '-100%', y: 0, opacity: 0 },
    visible: { x: 0, y: 0, opacity: 1 },
  }
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = 'right',
  size = 'md',
  className,
  overlay = 'default',
  density = 'default',
  fitContent = false,
  closeLabel = 'Close',
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const titleId = useId()
  const reduceMotion = useReducedMotion()
  const dragControls = useDragControls()
  const rtl = useSyncExternalStore(subscribeRtl, getRtlSnapshot, () => false)

  useEffect(() => {
    if (!open) return

    const previousFocus = document.activeElement as HTMLElement | null
    const getFocusable = (): HTMLElement[] =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
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
      } else if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
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

  const widths = {
    sm: 'w-72',
    md: 'w-80 sm:w-96',
    lg: 'w-full max-w-lg',
    compact: 'w-[min(100%,var(--search-sheet-width))]',
  }
  const isBottom = side === 'bottom'
  const isCompact = density === 'compact'
  const motionForSide = drawerMotion(side, rtl)
  const duration = reduceMotion ? 0.08 : 0.2

  return (
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex',
            isBottom && 'flex-col justify-end',
            side === 'left' && 'justify-start',
            side === 'right' && 'justify-end',
          )}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
            className={cn(
              'absolute inset-0',
              overlay === 'subtle'
                ? 'bg-[var(--search-sheet-overlay)]'
                : 'bg-[var(--overlay)] backdrop-blur-sm',
            )}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            initial={reduceMotion ? { opacity: 0 } : motionForSide.hidden}
            animate={reduceMotion ? { opacity: 1, x: 0, y: 0 } : motionForSide.visible}
            exit={reduceMotion ? { opacity: 0 } : motionForSide.hidden}
            transition={reduceMotion ? { duration } : { type: 'spring', damping: 32, stiffness: 380, mass: 0.8 }}
            drag={isBottom && !reduceMotion ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.45 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (info.offset.y > 72 || info.velocity.y > 450) onClose()
            }}
            className={cn(
              'relative z-10 bg-[var(--card)] border-[var(--border)] shadow-2xl flex flex-col overflow-hidden min-h-0',
              isBottom && cn(
                'w-full rounded-t-2xl border-t',
                fitContent ? 'max-h-[var(--search-sheet-max-block-size)]' : 'max-h-[85vh]',
              ),
              !isBottom && `h-full ${widths[size]}`,
              side === 'right' && 'border-l',
              side === 'left' && 'border-r',
              side === 'end' && 'ms-auto border-s',
              side === 'start' && 'border-e',
              className,
            )}
          >
            <div className={cn('shrink-0 border-b border-[var(--border)]', isCompact ? 'pt-1' : '')}>
              {isBottom && (
                <div className="flex justify-center pt-1">
                  <div
                    aria-hidden="true"
                    className="flex h-11 w-11 items-center justify-center touch-none cursor-grab"
                    onPointerDown={(e) => dragControls.start(e)}
                  >
                    <span className="block h-1 w-10 rounded-full bg-[var(--border-strong)]" />
                  </div>
                </div>
              )}
              <div
                className={cn(
                  'flex items-center',
                  isCompact ? 'px-3 py-0.5' : 'px-4 py-4',
                  isBottom && !isCompact && 'pt-2',
                )}
              >
                {title && (
                  <h2 id={titleId} className={cn('font-semibold text-[var(--fg)] font-[var(--font-display)]', isCompact && 'text-sm')}>
                    {title}
                  </h2>
                )}
                <Button
                  variant="ghost"
                  size={isCompact ? 'icon' : 'icon-sm'}
                  onClick={onClose}
                  className={cn('ms-auto', isCompact && 'min-h-11 min-w-11')}
                  aria-label={closeLabel}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-auto flex flex-col overflow-hidden">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
