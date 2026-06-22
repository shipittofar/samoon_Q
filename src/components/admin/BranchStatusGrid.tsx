'use client'

import type { BranchStatus, BranchHealthLevel, OperationsScope } from '@/types/realtime-operations'
import { useBranchStatus } from '@/hooks'

const HEALTH_COLOR: Record<BranchHealthLevel, string> = {
  healthy: 'bg-green-100 border-green-300 text-green-800',
  degraded: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  critical: 'bg-red-100 border-red-300 text-red-800',
  offline: 'bg-gray-100 border-gray-300 text-gray-600',
}

const HEALTH_DOT: Record<BranchHealthLevel, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-400',
  critical: 'bg-red-500',
  offline: 'bg-gray-400',
}

interface BranchCardProps {
  branch: BranchStatus
}

function BranchCard({ branch }: BranchCardProps) {
  const updated = new Date(branch.lastUpdated)
  const minutesAgo = Math.round((Date.now() - updated.getTime()) / 60_000)

  return (
    <div className={`rounded-lg border-2 p-4 ${HEALTH_COLOR[branch.health]}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-sm">{branch.branchName}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`w-2.5 h-2.5 rounded-full ${HEALTH_DOT[branch.health]}`} />
            <span className="text-xs capitalize">{branch.health}</span>
            {!branch.isOpen && <span className="text-xs bg-gray-800 text-white rounded px-1.5 ml-1">CLOSED</span>}
          </div>
        </div>
        {branch.notificationCount > 0 && (
          <span className="text-xs bg-white rounded-full px-2 py-0.5 border font-semibold">
            {branch.notificationCount} alerts
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        <div className="bg-white bg-opacity-50 rounded p-2">
          <div className="font-bold text-base">{branch.activeOrders}</div>
          <div className="text-gray-600">Orders</div>
        </div>
        <div className="bg-white bg-opacity-50 rounded p-2">
          <div className="font-bold text-base">{branch.pendingReservations}</div>
          <div className="text-gray-600">Reservations</div>
        </div>
        <div className="bg-white bg-opacity-50 rounded p-2">
          <div className="font-bold text-base">{branch.staffOnline}</div>
          <div className="text-gray-600">Staff</div>
        </div>
      </div>

      {branch.systemAlerts.length > 0 && (
        <div className="mt-3 space-y-1">
          {branch.systemAlerts.map((alert, i) => (
            <div key={i} className="text-xs bg-white bg-opacity-60 rounded px-2 py-1 text-red-700">
              {alert}
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500 text-right">
        Updated {minutesAgo < 1 ? 'just now' : `${minutesAgo}m ago`}
      </div>
    </div>
  )
}

interface BranchStatusGridProps {
  scope: OperationsScope
}

export function BranchStatusGrid({ scope }: BranchStatusGridProps) {
  const { data: branches = [], isLoading, isError } = useBranchStatus(scope)

  if (isLoading) return <div className="text-sm text-gray-500 p-4">Loading branch status…</div>
  if (isError) return <div className="text-sm text-red-500 p-4">Failed to load branch status.</div>

  const healthCounts = {
    healthy: branches.filter((b) => b.health === 'healthy').length,
    degraded: branches.filter((b) => b.health === 'degraded').length,
    critical: branches.filter((b) => b.health === 'critical').length,
    offline: branches.filter((b) => b.health === 'offline').length,
  }

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap text-sm">
        <span className="bg-green-100 text-green-700 rounded px-3 py-1">
          Healthy: <strong>{healthCounts.healthy}</strong>
        </span>
        <span className="bg-yellow-100 text-yellow-700 rounded px-3 py-1">
          Degraded: <strong>{healthCounts.degraded}</strong>
        </span>
        <span className="bg-red-100 text-red-700 rounded px-3 py-1">
          Critical: <strong>{healthCounts.critical}</strong>
        </span>
        <span className="bg-gray-100 text-gray-600 rounded px-3 py-1">
          Offline: <strong>{healthCounts.offline}</strong>
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {branches.map((branch) => (
          <BranchCard key={branch.branchId} branch={branch} />
        ))}
      </div>
    </div>
  )
}
