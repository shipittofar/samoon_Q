export const PRICE_LEVEL_SYMBOLS: Record<number, string> = {
  1: '$',
  2: '$$',
  3: '$$$',
  4: '$$$$',
}

export const MENU_PRICE_BANDS: { id: number; min?: number; max?: number }[] = [
  { id: 1, max: 15 },
  { id: 2, min: 15, max: 35 },
  { id: 3, min: 35 },
]

/** Maps selected Menu price-band chips onto the existing min/max query params. */
export function bandsToPriceRange(levels: number[]): { min?: number; max?: number } {
  if (levels.length === 0 || levels.length >= MENU_PRICE_BANDS.length) return {}
  const selected = MENU_PRICE_BANDS.filter((b) => levels.includes(b.id))
  if (selected.length === 0) return {}
  const mins = selected.map((b) => b.min ?? 0)
  const maxes = selected.map((b) => b.max ?? Number.POSITIVE_INFINITY)
  const min = Math.min(...mins)
  const max = Math.max(...maxes)
  return {
    min: min > 0 ? min : undefined,
    max: Number.isFinite(max) ? max : undefined,
  }
}
