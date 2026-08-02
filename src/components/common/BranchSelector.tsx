'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { MapPin, ChevronDown, Check, Clock } from 'lucide-react'
import { useBranchStore } from '@/stores'
import { useBranches } from '@/hooks'
import { cn } from '@/utils'
import { resolveLocationHoursStatus } from '@/lib/branch-hours'

export function BranchSelector({ className }: { className?: string }) {
  const t = useTranslations('branchSelector')
  const [open, setOpen] = useState(false)
  const { activeBranch, setActiveBranch } = useBranchStore()
  const { data: branches = [] } = useBranches()

  // Phase 3.2 — no `|| branches[0]` fallback: array position must never
  // have business meaning. Nothing is auto-selected here — `current` is
  // only ever what the user explicitly picked (`activeBranch`), or
  // nothing at all, in which case the button/list below render an
  // explicit "select branch" / empty state instead of a silent guess.
  const current = activeBranch

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm hover:border-orange-300 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <MapPin className="h-3.5 w-3.5 text-orange-500" />
        <span className="font-medium text-[var(--fg)] max-w-[120px] truncate">{current?.name || t('selectBranch')}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-[var(--fg-muted)] transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute start-0 top-full mt-2 w-72 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl z-40 overflow-hidden"
              role="listbox"
              aria-label={t('selectBranch')}
            >
              <div className="p-3 border-b border-[var(--border)]">
                <p className="text-xs font-semibold text-[var(--fg-muted)] uppercase tracking-wider">{t('chooseLocation')}</p>
              </div>
              <div className="p-2">
                {branches.length === 0 && (
                  <p className="px-3 py-2 text-sm text-[var(--fg-muted)]">{t('noLocationsAvailable')}</p>
                )}
                {branches.map((branch) => {
                  const isActive = current?.id === branch.id
                  const { openNow } = resolveLocationHoursStatus(branch.working_hours)

                  return (
                    <button
                      key={branch.id}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => { setActiveBranch(branch); setOpen(false) }}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 rounded-xl text-start transition-all',
                        isActive ? 'bg-orange-50 dark:bg-orange-950/20' : 'hover:bg-[var(--card-hover)]',
                      )}
                    >
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', isActive ? 'bg-orange-100 dark:bg-orange-900/50' : 'bg-[var(--card-hover)]')}>
                        <MapPin className={cn('h-4 w-4', isActive ? 'text-orange-500' : 'text-[var(--fg-muted)]')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn('text-sm font-medium truncate', isActive ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--fg)]')}>
                            {branch.name}
                          </p>
                          {isActive && <Check className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-[var(--fg-muted)] truncate mt-0.5">{branch.address}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3 text-[var(--fg-subtle)]" />
                          <span className={cn('text-xs', openNow ? 'text-emerald-500' : 'text-red-500')}>
                            {openNow ? t('openNow') : t('closed')}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
