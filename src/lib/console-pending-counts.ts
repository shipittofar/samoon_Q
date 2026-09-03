import type { QueryClient } from '@tanstack/react-query'

export const PENDING_ORDERS_COUNT_KEY = 'pending-orders-count' as const
export const PENDING_RESERVATIONS_COUNT_KEY = 'pending-reservations-count' as const

export type PendingOrdersCountQueryKey = readonly [typeof PENDING_ORDERS_COUNT_KEY, string, string]
export type PendingReservationsCountQueryKey = readonly [
  typeof PENDING_RESERVATIONS_COUNT_KEY,
  string,
  string,
]

export function pendingOrdersCountKey(tenantId: string, branchId: string): PendingOrdersCountQueryKey {
  return [PENDING_ORDERS_COUNT_KEY, tenantId, branchId]
}

export function pendingReservationsCountKey(
  tenantId: string,
  branchId: string,
): PendingReservationsCountQueryKey {
  return [PENDING_RESERVATIONS_COUNT_KEY, tenantId, branchId]
}

/** Django Channels path (WS_BASE_URL already includes `/ws`). */
export function consoleWebSocketPath(branchId: string): string {
  return `/console/${branchId}/`
}

export function eventMatchesWorkspace(
  data: unknown,
  tenantId: string,
  branchId?: string | null,
): boolean {
  if (!tenantId) return false
  if (!data || typeof data !== 'object') return true
  const payload = data as { tenant_id?: string; branch_id?: string }
  if (payload.tenant_id && payload.tenant_id !== tenantId) return false
  if (branchId && payload.branch_id && payload.branch_id !== branchId) return false
  return true
}

export function invalidatePendingOrdersCountQueries(qc: QueryClient, tenantId?: string, branchId?: string) {
  if (tenantId && branchId) {
    qc.invalidateQueries({ queryKey: pendingOrdersCountKey(tenantId, branchId) })
    return
  }
  qc.invalidateQueries({ queryKey: [PENDING_ORDERS_COUNT_KEY] })
}

export function invalidatePendingReservationsCountQueries(
  qc: QueryClient,
  tenantId?: string,
  branchId?: string,
) {
  if (tenantId && branchId) {
    qc.invalidateQueries({ queryKey: pendingReservationsCountKey(tenantId, branchId) })
    return
  }
  qc.invalidateQueries({ queryKey: [PENDING_RESERVATIONS_COUNT_KEY] })
}
