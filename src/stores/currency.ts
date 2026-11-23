/**
 * Display currency: the list of enabled currencies with their rates (from
 * GET /currencies/) and the one this visitor chose to see prices in
 * (remembered in localStorage). Empty choice = each item in its own
 * (business) currency.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BASE_CURRENCY_FALLBACK, DEFAULT_CURRENCY_TABLE, type CurrencyInfo, type CurrencyTable } from '@/lib/currency'

interface CurrencyState {
  base: string
  table: CurrencyTable
  /** Chosen display currency code ('' = business currency). */
  selected: string
  loaded: boolean
  setSelected: (code: string) => void
  setTable: (base: string, currencies: CurrencyInfo[]) => void
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      base: BASE_CURRENCY_FALLBACK,
      table: DEFAULT_CURRENCY_TABLE,
      selected: '',
      loaded: false,
      setSelected: (code) => set({ selected: code }),
      setTable: (base, currencies) => {
        const table: CurrencyTable = {}
        for (const c of currencies) table[c.code] = c
        if (!table[base]) table[base] = { ...DEFAULT_CURRENCY_TABLE[BASE_CURRENCY_FALLBACK], code: base }
        // A choice that is no longer enabled falls back to the business currency.
        const selected = get().selected && table[get().selected]?.enabled ? get().selected : ''
        set({ base, table, selected, loaded: true })
      },
    }),
    {
      name: 'samoon-display-currency',
      partialize: (s) => ({ selected: s.selected }),
    },
  ),
)
