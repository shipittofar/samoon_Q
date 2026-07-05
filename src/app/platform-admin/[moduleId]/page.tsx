'use client'

/**
 * Platform Administration Center — module route (P9.4)
 *
 * `moduleId` from the URL renders through the same
 * `ConfigurationStudioLayout`/`ConfigurationModulePage` pipeline every
 * Configuration Studio module (Authentication, Countries, …) and every
 * newly-registered Platform Administration module (Tenants, Platform
 * Users, Billing, …) already share — this route file only wires
 * routing + the platform-scoped permission guard.
 */
import { useParams, useRouter } from 'next/navigation'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PlatformPermissionGuard } from '@/components/auth/PlatformPermissionGuard'
import { AccessDenied } from '@/components/admin/AccessDenied'
import { ConfigurationStudioLayout } from '@/components/admin/configuration/ConfigurationStudioLayout'
import { PlatformDashboard } from '@/components/admin/platform-admin/PlatformDashboard'
import '@/platform-admin'

export default function PlatformAdminModuleRoute() {
  const params = useParams<{ moduleId: string }>()
  const router = useRouter()
  const moduleId = params.moduleId

  return (
    <ErrorBoundary feature={`Platform Administration — ${moduleId}`}>
      <PlatformPermissionGuard permission="platform.dashboard.view" fallback={<AccessDenied />}>
        <ConfigurationStudioLayout
          activeModuleId={moduleId}
          onNavigate={(nextModuleId) => router.push(`/platform-admin/${nextModuleId}`)}
          emptyWorkspace={<PlatformDashboard />}
        />
      </PlatformPermissionGuard>
    </ErrorBoundary>
  )
}
