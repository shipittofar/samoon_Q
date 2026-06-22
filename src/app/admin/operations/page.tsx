'use client'

import { useState } from 'react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { LiveOrderQueue } from '@/components/admin/LiveOrderQueue'
import { LiveReservationQueue } from '@/components/admin/LiveReservationQueue'
import { KitchenDisplay } from '@/components/admin/KitchenDisplay'
import { StaffPresenceBoard } from '@/components/admin/StaffPresenceBoard'
import { BranchStatusGrid } from '@/components/admin/BranchStatusGrid'
import { SLAMonitor } from '@/components/admin/SLAMonitor'
import { ActivityFeed } from '@/components/admin/ActivityFeed'
import {
  RealtimeConnectionStatus,
  ActiveUsersCounter,
  EventsPerMinute,
  SystemHealthBadge,
  BranchContextIndicator,
} from '@/components/admin/RealtimeDashboardWidgets'
import { useRealtimeStatistics } from '@/hooks'
import { useBranchStore } from '@/stores'
import type { OperationsScope } from '@/types/realtime-operations'

const MOCK_TENANT_ID = 'tenant-savor-01'

const SECTIONS = [
  'orders',
  'reservations',
  'branches',
  'staff',
  'kitchen',
  'sla',
  'activity',
] as const
type Section = (typeof SECTIONS)[number]

const SECTION_LABEL: Record<Section, string> = {
  orders: 'Live Orders',
  reservations: 'Live Reservations',
  branches: 'Branch Status',
  staff: 'Staff Presence',
  kitchen: 'Kitchen Display',
  sla: 'SLA Monitor',
  activity: 'Activity Feed',
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function OperationsContent() {
  const [activeSection, setActiveSection] = useState<Section>('orders')
  const activeBranch = useBranchStore((s) => s.activeBranch)
  const branchFilter = activeBranch?.id

  const scope: OperationsScope = {
    tenantId: MOCK_TENANT_ID,
    branchId: branchFilter,
  }

  const { data: stats } = useRealtimeStatistics(scope)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold">Operations Dashboard</h1>
              <BranchContextIndicator branchId={branchFilter} />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <RealtimeConnectionStatus />
              <ActiveUsersCounter scope={scope} />
              <EventsPerMinute scope={scope} />
              <SystemHealthBadge scope={scope} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard label="Active Orders" value={stats.ordersProcessedToday} sub="today" />
            <StatCard label="Reservations" value={stats.reservationsToday} sub="today" />
            <StatCard label="Active Staff" value={stats.activeStaff} />
            <StatCard label="Events/min" value={stats.eventsPerMinute} />
            <StatCard label="Avg Prep" value={`${stats.averageOrderPrepMinutes}m`} />
            <StatCard label="SLA Compliance" value={`${stats.slaCompliancePercent}%`} />
            <StatCard label="Events Today" value={stats.totalEventsToday} />
          </div>
        )}

        {/* Section tabs */}
        <div className="flex gap-1 border-b overflow-x-auto">
          {SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeSection === s
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {SECTION_LABEL[s]}
            </button>
          ))}
        </div>

        {/* Section content */}
        <div className="bg-white rounded-lg border p-4">
          <ErrorBoundary feature={SECTION_LABEL[activeSection]}>
            {activeSection === 'orders' && <LiveOrderQueue scope={scope} />}
            {activeSection === 'reservations' && <LiveReservationQueue scope={scope} />}
            {activeSection === 'branches' && <BranchStatusGrid scope={scope} />}
            {activeSection === 'staff' && (
              <StaffPresenceBoard scope={scope} filterBranchId={branchFilter} />
            )}
            {activeSection === 'kitchen' && (
              <KitchenDisplay
                branchId={branchFilter ?? 'branch-rest-01'}
                tenantId={MOCK_TENANT_ID}
              />
            )}
            {activeSection === 'sla' && <SLAMonitor scope={scope} />}
            {activeSection === 'activity' && <ActivityFeed scope={scope} limit={100} />}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}

export default function OperationsPage() {
  return (
    <ErrorBoundary feature="Operations Dashboard">
      <PermissionGuard permission="operations.view">
        <OperationsContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
