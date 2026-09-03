'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { adminService } from '@/services/admin.service'
import { consoleWebSocket, type DjangoChannelsWebSocket } from '@/services/websocket.service'
import { STALE_TIME } from '@/constants'
import { useConsoleWorkspace } from './console-workspace'
import {
  consoleWebSocketPath,
  eventMatchesWorkspace,
  invalidatePendingOrdersCountQueries,
  invalidatePendingReservationsCountQueries,
  pendingOrdersCountKey,
  pendingReservationsCountKey,
} from '@/lib/console-pending-counts'

export function useConsolePendingCountsEnabled(): boolean {
  const { workspacePhase, activeTenantId, selectedBranchId, branchLoading } = useConsoleWorkspace()
  return (
    workspacePhase === 'ready' &&
    !branchLoading &&
    Boolean(activeTenantId) &&
    Boolean(selectedBranchId)
  )
}

export function usePendingOrdersCount() {
  const { activeTenantId, selectedBranchId } = useConsoleWorkspace()
  const enabled = useConsolePendingCountsEnabled()
  const tenantId = activeTenantId ?? ''
  const branchId = selectedBranchId ?? ''

  return useQuery({
    queryKey: pendingOrdersCountKey(tenantId, branchId),
    queryFn: () => adminService.getPendingOrdersCount(tenantId, branchId),
    enabled,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
    retry: 1,
  })
}

export function usePendingReservationsCount() {
  const { activeTenantId, selectedBranchId } = useConsoleWorkspace()
  const enabled = useConsolePendingCountsEnabled()
  const tenantId = activeTenantId ?? ''
  const branchId = selectedBranchId ?? ''

  return useQuery({
    queryKey: pendingReservationsCountKey(tenantId, branchId),
    queryFn: () => adminService.getPendingReservationsCount(tenantId, branchId),
    enabled,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
    retry: 1,
  })
}

export function attachConsolePendingCountHandlers(opts: {
  socket: DjangoChannelsWebSocket
  qc: QueryClient
  tenantId: string
  branchId: string
  isCurrent: () => boolean
  onStaleConnection: () => void
}): () => void {
  const { socket, qc, tenantId, branchId, isCurrent, onStaleConnection } = opts

  const refetchBothCounts = () => {
    if (!isCurrent()) return
    invalidatePendingOrdersCountQueries(qc, tenantId, branchId)
    invalidatePendingReservationsCountQueries(qc, tenantId, branchId)
  }

  const offEstablished = socket.on('connection_established', (data) => {
    if (!isCurrent()) return
    if (!eventMatchesWorkspace(data, tenantId, branchId)) {
      onStaleConnection()
      return
    }
    refetchBothCounts()
  })

  const offOrder = socket.on('order.changed', (data) => {
    if (!isCurrent()) return
    if (!eventMatchesWorkspace(data, tenantId, branchId)) return
    invalidatePendingOrdersCountQueries(qc, tenantId, branchId)
    qc.invalidateQueries({ queryKey: ['live-orders', tenantId, branchId] })
  })

  const offReservation = socket.on('reservation.changed', (data) => {
    if (!isCurrent()) return
    if (!eventMatchesWorkspace(data, tenantId, branchId)) return
    invalidatePendingReservationsCountQueries(qc, tenantId, branchId)
    qc.invalidateQueries({ queryKey: ['live-reservations', tenantId, branchId] })
  })

  return () => {
    offEstablished()
    offOrder()
    offReservation()
  }
}

/**
 * Owns the single Console WebSocket: connect when workspace+branch are stable,
 * disconnect on tenant/branch switch or unmount.
 */
export function useConsoleWorkspaceRealtime() {
  const qc = useQueryClient()
  const { workspacePhase, activeTenantId, selectedBranchId, branchLoading } = useConsoleWorkspace()
  const generationRef = useRef(0)

  const ready =
    workspacePhase === 'ready' &&
    !branchLoading &&
    Boolean(activeTenantId) &&
    Boolean(selectedBranchId)

  useEffect(() => {
    if (!ready || !activeTenantId || !selectedBranchId) {
      generationRef.current += 1
      consoleWebSocket.disconnect()
      return
    }

    const generation = ++generationRef.current
    const tenantId = activeTenantId
    const branchId = selectedBranchId
    const isCurrent = () => generationRef.current === generation

    const detach = attachConsolePendingCountHandlers({
      socket: consoleWebSocket,
      qc,
      tenantId,
      branchId,
      isCurrent,
      onStaleConnection: () => {
        if (!isCurrent()) return
        consoleWebSocket.disconnect()
      },
    })

    consoleWebSocket.connect(consoleWebSocketPath(branchId))

    return () => {
      detach()
      if (generationRef.current === generation) {
        generationRef.current += 1
        consoleWebSocket.disconnect()
      }
    }
  }, [ready, activeTenantId, selectedBranchId, qc])
}
