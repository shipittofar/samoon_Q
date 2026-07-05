'use client'

/**
 * PlatformDashboard — P9.4 Phase D
 *
 * Renders every registered `PlatformWidgetDefinition`
 * (src/platform-admin/widgets.ts) in a responsive grid, filtered by the
 * current platform role's permission — nothing here hardcodes a widget by
 * name, so a future module (CRM, Inventory, POS, …) registering its own
 * widget appears automatically.
 */
import { EmptyState } from '@/components/ui/EmptyState'
import { LayoutDashboard } from 'lucide-react'
import { platformDashboardRegistry } from '@/platform-admin/dashboard'
import { usePlatformPermission, usePlatformRole } from '@/platform-admin/hooks'
import { hasPlatformPermission } from '@/platform-admin/permissions'
import { PlatformDashboardWidgetCard } from './PlatformDashboardWidgetCard'

export function PlatformDashboard() {
  const role = usePlatformRole()
  const canViewDashboard = usePlatformPermission('platform.dashboard.view')

  const widgets = platformDashboardRegistry
    .getWidgets()
    .filter((w) => !w.platformPermission || hasPlatformPermission(role, w.platformPermission))

  if (!canViewDashboard) {
    return (
      <EmptyState
        icon={<LayoutDashboard className="h-6 w-6" />}
        title="No dashboard access"
        description="Your platform role doesn't include platform.dashboard.view."
      />
    )
  }

  if (widgets.length === 0) {
    return (
      <EmptyState
        icon={<LayoutDashboard className="h-6 w-6" />}
        title="No widgets available"
        description="No dashboard widgets are visible to your platform role."
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {widgets.map((widget) => (
        <PlatformDashboardWidgetCard key={widget.id} widget={widget} />
      ))}
    </div>
  )
}
