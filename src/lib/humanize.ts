/**
 * Generic humanization for backend wire values.
 * No per-domain label maps — unknown values render via this helper only.
 */

export function humanizeWireValue(value: string | undefined | null): string {
  if (!value) return ''
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}
