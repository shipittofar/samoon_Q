/**
 * Coerces Django DecimalField JSON (`"8000.00"`) and numeric values into a
 * finite JavaScript number. Used at API boundaries and inside formatters.
 */
export function parseDecimal(
  value: string | number | null | undefined,
  fallback = 0,
): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback
  }
  if (value == null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
