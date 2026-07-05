'use client'

/**
 * Platform Configuration — Studio index route (P9.3 Phase B)
 *
 * Renders the same `ConfigurationStudioLayout` shell every module route
 * uses, with no module selected — the workspace pane shows a "pick a
 * module" prompt while the nav/toolbar/command-palette are already fully
 * live. Navigating to a module pushes `/console/settings/configuration/
 * [moduleId]` via the router so the URL and back/forward history stay
 * correct (P9.1.3's requirement this route preserves).
 */
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ConfigurationStudioLayout } from '@/components/admin/configuration/ConfigurationStudioLayout'

function ConfigurationIndexContent() {
  const router = useRouter()
  return (
    <ConfigurationStudioLayout
      onNavigate={(moduleId) => router.push(`/console/settings/configuration/${moduleId}`)}
    />
  )
}

export default function ConfigurationIndexPage() {
  return (
    <ErrorBoundary feature="Platform Configuration">
      <PermissionGuard permission="settings.view" fallback={<AccessDenied />}>
        <ConfigurationIndexContent />
      </PermissionGuard>
    </ErrorBoundary>
  )
}
