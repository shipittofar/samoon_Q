'use client'

import { operationsChannelManager } from '@/services/websocket.service'
import type { OperationsScope } from '@/types/realtime-operations'
import { useRealtimeStatistics, useSLAAlerts, useBranchStatus } from '@/hooks'

// ── RealtimeConnectionStatus ─────────────────────────────────────────────────

export function RealtimeConnectionStatus() {
  const channels = ['admin.operations', 'orders.broadcast', 'reservations.broadcast']
  const healthMap = operationsChannelManager.getAllHealth()

  const statuses = channels.map((ch) => healthMap[ch]?.status ?? 'disconnected')
  const allConnected = statuses.every((s) => s === 'connected')
  const anyConnecting = statuses.some((s) => s === 'connecting' || s === 'reconnecting')

  const label = allConnected ? 'Live' : anyConnecting ? 'Connecting…' : 'Offline'
  const color = allConnected
    ? 'bg-green-500'
    : anyConnecting
    ? 'bg-yellow-400 animate-pulse'
    : 'bg-red-500'

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-gray-600">{label}</span>
    </div>
  )
}

// ── ActiveUsersCounter ───────────────────────────────────────────────────────

interface ActiveUsersCounterProps {
  scope: OperationsScope
}

export function ActiveUsersCounter({ scope }: ActiveUsersCounterProps) {
  const { data: stats } = useRealtimeStatistics(scope)
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-600">
      <span>Active staff:</span>
      <strong>{stats?.activeStaff ?? '—'}</strong>
    </div>
  )
}

// ── EventsPerMinute ───────────────────────────────────────────────────────────

interface EventsPerMinuteProps {
  scope: OperationsScope
}

export function EventsPerMinute({ scope }: EventsPerMinuteProps) {
  const { data: stats } = useRealtimeStatistics(scope)
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-600">
      <span>Events/min:</span>
      <strong>{stats?.eventsPerMinute ?? '—'}</strong>
    </div>
  )
}

// ── SystemHealthBadge ─────────────────────────────────────────────────────────

interface SystemHealthBadgeProps {
  scope: OperationsScope
}

export function SystemHealthBadge({ scope }: SystemHealthBadgeProps) {
  const { data: branches = [] } = useBranchStatus(scope)
  const { data: alerts = [] } = useSLAAlerts(scope)

  const criticalAlerts = alerts.filter((a) => a.isActive && a.priority === 'critical').length
  const criticalBranches = branches.filter((b) => b.health === 'critical').length

  const isHealthy = criticalAlerts === 0 && criticalBranches === 0
  const isDegraded = !isHealthy && criticalAlerts < 3 && criticalBranches < 2

  const label = isHealthy ? 'Healthy' : isDegraded ? 'Degraded' : 'Critical'
  const color = isHealthy
    ? 'bg-green-100 text-green-700 border-green-300'
    : isDegraded
    ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
    : 'bg-red-100 text-red-800 border-red-400'

  return (
    <span className={`text-xs rounded border px-2 py-0.5 font-medium ${color}`}>
      System: {label}
    </span>
  )
}

// ── BranchContextIndicator ────────────────────────────────────────────────────

interface BranchContextIndicatorProps {
  branchId?: string
  branchName?: string
}

export function BranchContextIndicator({ branchId, branchName }: BranchContextIndicatorProps) {
  if (!branchId) {
    return (
      <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded px-2 py-0.5">
        All Branches
      </span>
    )
  }
  return (
    <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5">
      {branchName ?? branchId}
    </span>
  )
}
