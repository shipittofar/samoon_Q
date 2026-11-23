'use client'

/**
 * Lets a visitor see prices in another enabled currency. "Business currency"
 * (empty choice) shows each price as the business set it. Hidden when only
 * the base currency is enabled. Orders are still charged in the business
 * currency — checkout says so.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Coins } from 'lucide-react'
import { cn } from '@/utils'
import { useCurrencyStore } from '@/stores/currency'
import { loadCurrencies } from '@/hooks/use-money'

export function CurrencySwitcher({ className }: { className?: string }) {
  const t = useTranslations('currencyDisplay')
  const { table, selected, setSelected } = useCurrencyStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadCurrencies()
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const options = Object.values(table).filter((c) => c.enabled && !c.isBase)
  if (options.length === 0) return null

  const choose = (code: string) => {
    setSelected(code)
    setOpen(false)
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('label')}
        className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-[var(--fg-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--fg)]"
      >
        <Coins className="h-4 w-4" aria-hidden="true" />
        <span>{selected || t('businessCurrency')}</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t('label')}
          className="absolute end-0 z-50 mt-1 min-w-48 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg"
        >
          {[{ code: '', name: t('businessCurrency') }, ...options].map((c) => (
            <li key={c.code || 'business'}>
              <button
                type="button"
                role="option"
                aria-selected={selected === c.code}
                onClick={() => choose(c.code)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm text-[var(--fg)] hover:bg-[var(--card-hover)]"
              >
                <span>
                  {c.code && <span className="font-mono text-xs text-[var(--fg-muted)] me-2">{c.code}</span>}
                  {c.name}
                </span>
                {selected === c.code && <Check className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
