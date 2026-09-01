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
import { useTranslations } from 'next-intl'
import { platformDashboardRegistry } from '@/platform-admin/dashboard'
import { usePlatformRole } from '@/platform-admin/hooks'
import { hasPlatformPermission } from '@/platform-admin/permissions'
import { useAuthStore } from '@/stores'
import { isPlatformSuperuser } from '@/lib/platform-admin-access'
import { PlatformDashboardWidgetCard } from './PlatformDashboardWidgetCard'

export function PlatformDashboard() {
  const t = useTranslations('console')
  const role = usePlatformRole()
  const isSuperuser = useAuthStore((s) => isPlatformSuperuser(s.user))
  const canViewDashboard = isSuperuser || hasPlatformPermission(role, 'platform.dashboard.view')

  const widgets = platformDashboardRegistry
    .getWidgets()
    .filter((w) => isSuperuser || !w.platformPermission || hasPlatformPermission(role, w.platformPermission))

  if (!canViewDashboard) {
    return (
      <EmptyState
        icon={<LayoutDashboard className="h-6 w-6" />}
        title={t('noDashboardAccessTitle')}
        description={t('noDashboardAccessDesc')}
      />
    )
  }

  if (widgets.length === 0) {
    return (
      <EmptyState
        icon={<LayoutDashboard className="h-6 w-6" />}
        title={t('noWidgetsTitle')}
        description={t('noWidgetsDesc')}
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
