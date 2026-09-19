import type { ManagedQr, QrCode, QrDestination } from '@/types/qr'
import { QR_DESTINATIONS } from '@/types/qr'

export const tenantQrQueryKey = (tenantId: string) => ['tenant-qr', tenantId] as const
export const branchQrQueryKey = (branchId: string) => ['branch-qr', branchId] as const

export type QrWorkspaceKind = 'tenant' | 'branch'
export type QrListTypeFilter = 'all' | QrWorkspaceKind
export type QrListStatusFilter = 'all' | 'active' | 'disabled'

export type QrListEntry = {
  kind: QrWorkspaceKind
  id: string
  name: string
  slug?: string
  isActive: boolean | null
}

export function matchesQrListFilters(
  entry: QrListEntry,
  search: string,
  type: QrListTypeFilter,
  status: QrListStatusFilter,
): boolean {
  if (type !== 'all' && entry.kind !== type) return false
  const q = search.trim().toLowerCase()
  if (q) {
    const haystack = `${entry.name} ${entry.kind}`.toLowerCase()
    if (!haystack.includes(q)) return false
  }
  if (status === 'all') return true
  if (entry.isActive === null) return false
  return status === 'active' ? entry.isActive : !entry.isActive
}

export function isQrDestination(value: unknown): value is QrDestination {
  return typeof value === 'string' && (QR_DESTINATIONS as readonly string[]).includes(value)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function pickActive(record: Record<string, unknown>): boolean {
  const raw = record.is_active ?? record.isActive ?? record.active
  if (raw === false || raw === 0 || raw === 'false' || raw === '0') return false
  if (raw === true || raw === 1 || raw === 'true' || raw === '1') return true
  return true
}

function pickDestination(record: Record<string, unknown>): QrDestination | null {
  const raw = record.destination ?? record.destination_type ?? record.destinationType
  return isQrDestination(raw) ? raw : null
}

/** Unwrap `{ qr }` envelopes and snake/camel aliases from the QR management API. */
export function normalizeManagedQr(raw: unknown, fallbackDestination: QrDestination = 'tenant'): ManagedQr | null {
  const outer = asRecord(raw)
  if (!outer) return null
  const nested = asRecord(outer.qr) ?? outer
  const code = pickString(nested, ['code'])
  const url = pickString(nested, ['url'])
  if (!code || !url) return null
  return {
    code,
    url,
    is_active: pickActive(nested),
    destination: pickDestination(nested) ?? fallbackDestination,
  }
}

export function toQrSummary(qr: ManagedQr): QrCode {
  return {
    code: qr.code,
    url: qr.url,
    is_active: qr.is_active,
    destination: qr.destination,
  }
}
