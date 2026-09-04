'use client'

import { type ReactNode } from 'react'
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

export function FilterSheet({ open, onClose, title, children, onReset, dirty }: FilterSheetProps) {
  const t = useTranslations('searchUi')
  const tCommon = useTranslations('common')

  return (
    <Drawer open={open} onClose={onClose} title={title} side="bottom" size="lg">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-6">
          {children}
        </div>
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-t border-[var(--border)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {onReset && (
            <Button variant="ghost" onClick={onReset} disabled={!dirty}>
              {t('reset')}
            </Button>
          )}
          <Button className="ms-auto" onClick={onClose}>
            {tCommon('close')}
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
