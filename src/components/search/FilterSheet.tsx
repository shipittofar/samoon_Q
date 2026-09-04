'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Drawer } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface FilterSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  onReset?: () => void
  dirty?: boolean
}

const SHEET_DESKTOP_MQ = '(min-width: 600px)'

function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia(SHEET_DESKTOP_MQ)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function getDesktopSnapshot() {
  return window.matchMedia(SHEET_DESKTOP_MQ).matches
}

export function FilterSheet({ open, onClose, title, children, onReset, dirty }: FilterSheetProps) {
  const t = useTranslations('searchUi')
  const tCommon = useTranslations('common')
  const isDesktop = useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, () => false)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      side={isDesktop ? 'end' : 'bottom'}
      size="compact"
      overlay="subtle"
      density="compact"
      fitContent
      closeLabel={tCommon('close')}
    >
      <div className="flex flex-col min-h-0 flex-auto">
        <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain px-4 py-3 space-y-4">
          {children}
        </div>
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-t border-[var(--border)] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {onReset && (
            <Button variant="ghost" className="min-h-11" onClick={onReset} disabled={!dirty}>
              {t('reset')}
            </Button>
          )}
          <Button className="ms-auto min-h-11" onClick={onClose}>
            {t('done')}
          </Button>
        </div>
      </div>
    </Drawer>
  )
}

export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fg)] mb-2">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
