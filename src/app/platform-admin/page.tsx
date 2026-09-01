'use client'

/**
 * Platform Administration Center — index route (P9.4)
 *
 * Renders the exact same `ConfigurationStudioLayout` shell the
 * Configuration Studio (P9.3) uses, with no module selected — the
 * workspace pane shows the metadata-driven `PlatformDashboard` (Phase D)
 * instead of the Studio's plain placeholder text. Importing
 * '@/platform-admin' here (not in any P9.0–P9.3 file) is what actually
 * registers every Platform Administration module/widget/search-provider as
 * a side effect — the Configuration Studio routes never depend on P9.4.
 */
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ConfigurationStudioLayout } from '@/components/admin/configuration/ConfigurationStudioLayout'
import { PlatformDashboard } from '@/components/admin/platform-admin/PlatformDashboard'
import '@/platform-admin'

function PlatformAdminIndexContent() {
  const router = useRouter()
  return (
    <ConfigurationStudioLayout
      onNavigate={(moduleId) => router.push(`/platform-admin/${moduleId}`)}
      emptyWorkspace={<PlatformDashboard />}
      permissionContext="platform"
    />
  )
}

export default function PlatformAdminIndexPage() {
  return (
    <ErrorBoundary feature="Platform Administration Center">
      <PlatformAdminIndexContent />
    </ErrorBoundary>
  )
}
